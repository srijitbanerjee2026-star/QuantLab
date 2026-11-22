"""Minimal FRED client using the public CSV endpoint (no API key). Cached; errors surface as ValueError.

Note: do not send a custom User-Agent header. FRED's edge stalls requests that carry one, while the
default python-requests agent is answered in a fraction of a second.
"""
from __future__ import annotations

import io
import time

import pandas as pd
import requests

_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv"
_CACHE: dict[tuple[str, str], tuple[float, pd.Series]] = {}
_TTL = 6 * 3600


def fetch_series(series_id: str, start: str = "1990-01-01") -> pd.Series:
    """Date-indexed float series from `start`, with missing observations dropped."""
    key = (series_id, start)
    hit = _CACHE.get(key)
    if hit and time.time() - hit[0] < _TTL:
        return hit[1]
    last_err: Exception | None = None
    for _ in range(2):  # one retry for transient network errors
        try:
            resp = requests.get(_URL, params={"id": series_id, "cosd": start}, timeout=20)
            resp.raise_for_status()
            break
        except requests.RequestException as e:
            last_err = e
    else:
        raise ValueError(f"FRED request for {series_id} failed: {last_err}") from last_err
    df = pd.read_csv(io.StringIO(resp.text))
    if df.shape[1] != 2:
        raise ValueError(f"Unexpected FRED response for {series_id}")
    df.columns = ["date", "value"]
    df["date"] = pd.to_datetime(df["date"])
    s = pd.to_numeric(df["value"], errors="coerce").set_axis(df["date"]).dropna()
    s.name = series_id
    _CACHE[key] = (time.time(), s)
    return s
