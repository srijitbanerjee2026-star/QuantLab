"""Research analytics on real data. Nothing here is simulated: if a provider fails, the endpoint returns an error."""
import time
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd
import yfinance as yf
from fastapi import APIRouter, HTTPException, Query

from app.services import fred_client
from app.services.macro_engine import CURVE_SERIES, SAHM_THRESHOLD, curve_snapshot, inversion_state, sahm_rule, to_points, yoy
from app.services.options_engine import analyse_chain
from app.services.price_loader import load_full_ohlcv, load_ohlcv
from app.services.seasonality_engine import analyse as analyse_seasonality
from app.services.technicals_engine import compute as compute_technicals

router = APIRouter()
_CACHE: dict[tuple, tuple[float, Any]] = {}


def _cached(key: tuple, ttl: int, fn):
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _CACHE[key] = (time.time(), val)
    return val


# ---------------------------------------------------------------- technicals
@router.get("/technicals/{symbol}")
def technicals(symbol: str, years: float = Query(2.0, ge=0.5, le=10)):
    sym = symbol.strip().upper()
    try:
        out = compute_technicals(load_full_ohlcv(sym, years + 1.0))  # +1y so SMA200 is warm at the start of the window
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Market data provider error: {e}")
    # Trim to the requested window after indicator warm-up
    keep = max(0, len(out["dates"]) - int(years * 252))
    for k, v in out.items():
        if isinstance(v, list):
            out[k] = v[keep:]
    return {"symbol": sym, "source": "yfinance (adjusted, daily)", "freshness": "historical", **out}


# --------------------------------------------------------------- seasonality
@router.get("/seasonality/{symbol}")
def seasonality(symbol: str):
    sym = symbol.strip().upper()
    try:
        close = load_ohlcv(sym, 30.0)["Close"]
        res = analyse_seasonality(close)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Market data provider error: {e}")
    return {"symbol": sym, "source": "yfinance (adjusted close, month-end)", **res}


# --------------------------------------------------------------------- macro
def _macro() -> dict[str, Any]:
    try:
        curve_raw = {label: fred_client.fetch_series(sid, "2024-01-01") for label, sid in CURVE_SERIES}
        unrate = fred_client.fetch_series("UNRATE", "1990-01-01")
        spread_2s10s = fred_client.fetch_series("T10Y2Y", "2022-01-01")
        spread_3m10y = fred_client.fetch_series("T10Y3M", "2022-01-01")
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Could not load macro data from FRED: {e}")

    def optional(sid: str, start: str = "2000-01-01") -> Optional[pd.Series]:
        try:
            return fred_client.fetch_series(sid, start)
        except ValueError:
            return None

    recprob, fedfunds, cpi = optional("RECPROUSM156N"), optional("FEDFUNDS"), optional("CPIAUCSL")
    sahm = sahm_rule(unrate)
    snap = curve_snapshot(curve_raw)
    spread_now = float(spread_2s10s.iloc[-1])

    def last(s: Optional[pd.Series]):
        return None if s is None or s.empty else {"value": round(float(s.iloc[-1]), 2) + 0.0, "date": str(s.index[-1])[:10]}

    inflation = yoy(cpi) if cpi is not None else None
    return {
        "curve": snap,
        "spread_2s10s": to_points(spread_2s10s, 2),
        "spread_3m10y": to_points(spread_3m10y, 2),
        "spread_2s10s_now": {"value": round(spread_now, 2), "date": str(spread_2s10s.index[-1])[:10], "state": inversion_state(spread_now)},
        "unemployment": {"series": to_points(unrate[unrate.index >= "2015-01-01"], 1), "latest": last(unrate)},
        "sahm": {
            "series": to_points(sahm[sahm.index >= "2015-01-01"], 2),
            "latest": last(sahm),
            "threshold": SAHM_THRESHOLD,
            "triggered": bool(float(sahm.iloc[-1]) >= SAHM_THRESHOLD),
        },
        "recession_probability": {
            "series": [] if recprob is None else to_points(recprob[recprob.index >= "2015-01-01"], 2),
            "latest": last(recprob),
            "note": "Smoothed US recession probability (Chauvet-Piger model, FRED RECPROUSM156N). Published with a lag of about two months.",
        },
        "fed_funds": last(fedfunds),
        "inflation_yoy": None if inflation is None else {"value": round(float(inflation.iloc[-1]), 2), "date": str(inflation.index[-1])[:10]},
        "sources": "Federal Reserve Economic Data (FRED), St. Louis Fed: DGS*, T10Y2Y, T10Y3M, UNRATE, RECPROUSM156N, FEDFUNDS, CPIAUCSL",
    }


@router.get("/macro")
def macro():
    return _cached(("macro",), 3600, _macro)


# ------------------------------------------------------------------- options
def _risk_free() -> tuple[float, str]:
    try:
        return float(fred_client.fetch_series("DGS3MO", "2024-01-01").iloc[-1]) / 100.0, "3-month Treasury yield (FRED)"
    except ValueError:
        return 0.04, "assumed 4.0% (FRED unavailable)"


@router.get("/options/{symbol}")
def options(symbol: str, expiration: Optional[str] = None):
    sym = symbol.strip().upper()
    try:
        tk = yf.Ticker(sym)
        expirations = list(tk.options or [])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Options data provider error: {e}")
    if not expirations:
        raise HTTPException(status_code=404, detail=f"{sym} has no listed options (options exist for most US stocks and ETFs).")

    today = datetime.now(timezone.utc).date()

    def days(exp: str) -> int:
        return (datetime.strptime(exp, "%Y-%m-%d").date() - today).days

    if expiration is None:
        # default: first expiry at least a week out, else the nearest
        expiration = next((e for e in expirations if days(e) >= 7), expirations[0])
    if expiration not in expirations:
        raise HTTPException(status_code=400, detail="Unknown expiration for this symbol")

    try:
        hist = tk.history(period="5d")
        if hist.empty:
            raise ValueError("No recent price for this symbol")
        spot = float(hist["Close"].iloc[-1])
        r, r_src = _cached(("rf",), 3600, _risk_free)

        def chain_for(exp: str):
            def fetch():
                oc = tk.option_chain(exp)
                return oc.calls, oc.puts

            return _cached(("chain", sym, exp), 120, fetch)

        calls, puts = chain_for(expiration)
        T = max(days(expiration), 0.5) / 365.0
        res = analyse_chain(calls, puts, spot, T, r)

        term = []
        for exp in expirations[:7]:
            try:
                c2, p2 = chain_for(exp)
                a = analyse_chain(c2, p2, spot, max(days(exp), 0.5) / 365.0, r)
                term.append({
                    "expiration": exp,
                    "days": days(exp),
                    "atm_iv": a["atm_iv"],
                    "expected_move_pct": a["expected_move_pct"],
                    "put_call_oi_ratio": a["put_call_oi_ratio"],
                })
            except ValueError:
                continue
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Options data provider error: {e}")

    return {
        "symbol": sym,
        "expiration": expiration,
        "expirations": [{"date": e, "days": days(e)} for e in expirations],
        "risk_free_rate": round(r, 4),
        "risk_free_source": r_src,
        "term_structure": term,
        "source": "yfinance option chain (delayed)",
        "freshness": "delayed",
        "assumptions": "Greeks use Black-Scholes-Merton with each contract's own implied volatility and zero dividend yield. GEX and DEX assume dealers are long calls and short puts, which cannot be observed from public data.",
        **res,
    }
