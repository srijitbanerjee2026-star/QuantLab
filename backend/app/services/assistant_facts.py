"""Deterministic, plainly-labelled fact sheets built from tool results, plus a number-grounding check.

Why: small local models mislabel numbers (calling a 1-month return "annual", attributing one asset's figure to
another). Code writes the labels and units here; the model only explains them, and the reply is verified against them.
"""
from __future__ import annotations

import re
from typing import Any, Callable, Optional


def _p(v: Optional[float], d: int = 1, signed: bool = True) -> str:
    """Percent from a value already expressed in percent."""
    if v is None:
        return "n/a"
    return f"{v:+.{d}f}%" if signed else f"{v:.{d}f}%"


def _f(v: Optional[float], d: int = 1, signed: bool = True) -> str:
    """Percent from a fraction (0.05 -> 5.0%)."""
    return "n/a" if v is None else _p(v * 100, d, signed)


def _n(v: Optional[float], d: int = 2) -> str:
    return "n/a" if v is None else f"{v:.{d}f}"


def _usd(v: Optional[float]) -> str:
    return "n/a" if v is None else f"${v:,.2f}"


def _scale(fall_fraction: Optional[float]) -> list[str]:
    """A beginner-friendly dollar example, computed here rather than by the model."""
    if fall_fraction is None or fall_fraction >= 0:
        return []
    return [f"For scale: a fall of {abs(fall_fraction) * 100:.1f}% turns $1,000 into ${1000 * (1 + fall_fraction):,.0f}"]


def quotes(d: dict) -> list[str]:
    out = []
    for q in d.get("quotes", []):
        if q.get("error") or q.get("price") is None:
            out.append(f"{q.get('symbol')}: price unavailable")
        else:
            out.append(f"{q['symbol']} last price {_usd(q['price'])}, {_p(q.get('change_pct'), 2)} on the day (as of {q.get('as_of')}, delayed data)")
    return out


def performance(d: dict) -> list[str]:
    r = d.get("returns_pct", {})
    s = d.get("symbol")
    names = [("1D", "1 day"), ("1W", "1 week"), ("1M", "1 month"), ("3M", "3 months"), ("6M", "6 months"), ("YTD", "year to date"), ("1Y", "1 year"), ("3Y", "3 years")]
    dd = d.get("max_drawdown_1y_pct")
    return [
        f"{s} last price {_usd(d.get('last'))} (delayed)",
        f"{s} price change over: " + ", ".join(f"{label} {_p(r.get(k))}" for k, label in names if r.get(k) is not None),
        f"{s} 52-week range {_usd(d.get('low_52w'))} to {_usd(d.get('high_52w'))}; now {_p(d.get('pct_from_high_52w'))} from the 52-week high",
        f"{s} volatility over the past year {_p(d.get('volatility_1y_pct'), 1, False)} (annualised); biggest peak-to-trough fall in the past year {_p(dd)}",
        *_scale(None if dd is None else dd / 100),
    ]


def risk(d: dict) -> list[str]:
    var = d.get("var_1day", {})
    out = [
        f"Period analysed: {d.get('start')} to {d.get('end')} ({d.get('observations')} trading days)",
        f"Average yearly return over that period {_f(d.get('annualized_return'))}; yearly volatility {_f(d.get('annualized_volatility'), 1, False)}",
        f"Biggest peak-to-trough fall {_f(d.get('max_drawdown'))} (peak {d.get('max_drawdown_peak')}, bottom {d.get('max_drawdown_trough')})",
        *_scale(d.get("max_drawdown")),
        f"Best single day {_f(d.get('best_day'), 2)}, worst single day {_f(d.get('worst_day'), 2)}",
        f"Sharpe ratio {_n(d.get('sharpe_ratio'))} (return per unit of risk; higher is better), Sortino ratio {_n(d.get('sortino_ratio'))}",
        f"On the worst 5% of days the loss was at least {_f(var.get('95'), 2, False).lstrip('-')} in a day (1-day 95% value at risk); average loss on those days {_f(d.get('cvar_95'), 2, False).lstrip('-')}",
    ]
    b = d.get("benchmark")
    if b:
        out.append(f"Versus {b.get('symbol')}: beta {_n(b.get('beta'))} (moves {_n(b.get('beta'))} times as much as {b.get('symbol')}), correlation {_n(b.get('correlation'))}")
    return out


def technical(d: dict) -> list[str]:
    s = d.get("symbol")
    out = [
        f"{s} last close {_usd(d.get('last_close'))}; price is {d.get('trend_vs_sma50')} its 50-day average and {d.get('trend_vs_sma200')} its 200-day average ({d.get('golden_cross_state')})",
        f"RSI (14-day) {_n(d.get('rsi_14'), 1)} ({d.get('rsi_state')}; above 70 is called overbought, below 30 oversold)",
        f"MACD: {d.get('macd_state')}",
        f"Bollinger %B {_n(d.get('bollinger_pct_b'))} (0 = at the lower band, 1 = at the upper band); typical daily move (ATR) {_n(d.get('atr_pct'))}% of price",
        f"Volume is {_n(d.get('volume_vs_20d_avg'))} times its 20-day average",
    ]
    c = d.get("last_macd_cross")
    if c:
        out.append(f"Last MACD crossover: {c.get('direction')} on {c.get('date')}")
    return out


def seasonality(d: dict) -> list[str]:
    best = max(d.get("by_month", []), key=lambda m: m["avg_return_pct"], default=None)
    worst = min(d.get("by_month", []), key=lambda m: m["avg_return_pct"], default=None)
    out = [f"{d.get('symbol')} monthly pattern over {d.get('months_of_history')} months of history"]
    if best and worst:
        out.append(f"Best month on average: {best['month']} ({_p(best['avg_return_pct'], 2)} average, up {best['win_rate_pct']:.0f}% of the time)")
        out.append(f"Worst month on average: {worst['month']} ({_p(worst['avg_return_pct'], 2)} average, up {worst['win_rate_pct']:.0f}% of the time)")
    out.append(f"{d.get('months_statistically_significant')} of 12 months are statistically significant; about 1 would appear significant by chance alone, so treat patterns cautiously")
    return out


def macro(d: dict) -> list[str]:
    yc = d.get("yield_curve_pct", {})
    sp, ff, cpi, un, sh, rp = (d.get(k) or {} for k in ("spread_10y_minus_2y", "fed_funds_rate", "inflation_cpi_yoy", "unemployment_rate", "sahm_rule", "recession_probability_model"))
    return [
        f"US Treasury yields (as of {d.get('yield_curve_as_of')}): " + ", ".join(f"{k} {v:.2f}%" for k, v in yc.items()),
        f"10-year minus 2-year yield spread {sp.get('value')} points ({sp.get('state')}; negative means inverted, which has often preceded recessions)",
        f"Fed funds rate {_n(ff.get('value'))}% ({str(ff.get('date'))[:7]}); inflation (CPI, year on year) {_n(cpi.get('value'), 1)}% ({str(cpi.get('date'))[:7]}); unemployment {_n(un.get('value'), 1)}% ({str(un.get('date'))[:7]})",
        f"Sahm rule indicator {_n(sh.get('value'))} ({'triggered' if sh.get('triggered') else 'not triggered'}; it triggers at {sh.get('trigger_level')})",
        f"Model-based recession probability {_n(rp.get('value'), 1)}% ({str(rp.get('date'))[:7]}, published with about a 2 month delay)",
        "Source: FRED (St. Louis Fed)",
    ]


def options(d: dict) -> list[str]:
    return [
        f"{d.get('symbol')} options for expiry {d.get('expiration')} ({d.get('days_to_expiry')} days), underlying price {_usd(d.get('spot'))} (delayed)",
        f"At-the-money implied volatility {_f(d.get('atm_iv'), 1, False)}; the options market implies a typical move of about {_usd(d.get('expected_move_1sd'))} ({_n(d.get('expected_move_pct'))}%) by expiry",
        f"Put/call open-interest ratio {_n(d.get('put_call_oi_ratio'))}; most call open interest at {d.get('call_wall')}, most put open interest at {d.get('put_wall')}, max pain {d.get('max_pain')}",
    ]


def backtest(d: dict) -> list[str]:
    m, prm = d.get("metrics", {}), d.get("parameters", {})
    strat = "buys when the 20-day average is above the 50-day average" if d.get("strategy") == "sma_crossover" else f"buys when RSI is below {prm.get('rsi_low')} and sells above {prm.get('rsi_high')}"
    return [
        f"Backtest of {d.get('symbol')} over {d.get('period')}: a rule that {strat} (trading costs {prm.get('cost_bps_per_side')} bps per side included)",
        f"Total return of the strategy {_p(m.get('total_return_pct'))} versus {_p(m.get('buy_hold_return_pct'))} for simply buying and holding",
        f"Strategy yearly volatility {_p(m.get('annual_volatility_pct'), 1, False)}; biggest fall {_p(m.get('max_drawdown_pct'))}; Sharpe ratio {_n(m.get('sharpe_ratio'))}",
        f"{m.get('total_trades')} trades; invested {_n(m.get('exposure_pct'), 0)}% of the time; winning trades {_n(m.get('win_rate_pct'), 0)}%",
        "Past results do not predict the future, and a rule fitted to past data often fails live",
    ]


FORMATTERS: dict[str, Callable[[dict], list[str]]] = {
    "get_quotes": quotes,
    "get_performance": performance,
    "get_risk_summary": risk,
    "get_technical_summary": technical,
    "get_seasonality": seasonality,
    "get_macro_snapshot": macro,
    "get_options_summary": options,
    "run_backtest": backtest,
}


def format_facts(tool_name: str, data: dict) -> list[str]:
    fn = FORMATTERS.get(tool_name)
    return fn(data) if fn else []


# ------------------------------------------------------------ grounding
_NUM = re.compile(r"(?<![\w.])[-−+]?\$?\d[\d,]*(?:\.\d+)?%?")


def _tokens(text: str) -> list[tuple[float, bool]]:
    """(absolute value, has a % or $ unit) for each number in the text."""
    out = []
    for m in _NUM.findall(text):
        try:
            out.append((abs(float(m.replace("−", "-").replace("$", "").replace("%", "").replace(",", ""))), "%" in m or "$" in m))
        except ValueError:
            continue
    return out


def ungrounded_numbers(reply: str, facts_text: str) -> list[float]:
    """Numbers in `reply` that do not appear (to 0-2 decimals) in the facts.

    Years and small plain counts ("3 months", "2 times") are ignored, but anything written as a % or $ amount is
    always checked, so an invented "15%" cannot slip through."""
    allowed = {round(v, d) for v, _ in _tokens(facts_text) for d in (0, 1, 2)}
    bad = []
    for v, has_unit in _tokens(reply):
        plain_int = float(v).is_integer() and not has_unit
        if plain_int and (1900 <= v <= 2100 or v <= 20):
            continue
        if round(v, 2) not in allowed:
            bad.append(v)
    return bad
