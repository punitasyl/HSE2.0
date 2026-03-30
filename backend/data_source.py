"""
HSE Analytics — Data Source Adapter
====================================
Supports three backends, selected via the DATA_SOURCE env variable:

    DATA_SOURCE=excel   (default) — read from local .xlsx files
    DATA_SOURCE=db      — connect to a relational database via SQLAlchemy
    DATA_SOURCE=api     — fetch from a REST API of the source system

Each backend returns two normalised DataFrames with identical column contracts:

  incidents:  date, year, month_str, type, Организация, Место происшествия,
              Бизнес-подразделение, (flag cols: Несчастный случай, …)

  korgau:     date, month_str, is_violation, Организация,
              Тип наблюдения, Категория нарушения, Статус
"""

import os
import warnings
import pandas as pd
import numpy as np
from typing import Tuple

import analytics as an

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATA_SOURCE = os.getenv("DATA_SOURCE", "excel").strip().lower()

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# ── DB settings ─────────────────────────────────────────────────────────────
DB_URL              = os.getenv("SOURCE_DB_URL", "")           # e.g. postgresql://user:pass@host/hse
DB_INCIDENTS_TABLE  = os.getenv("DB_INCIDENTS_TABLE",  "hse_incidents")
DB_KORGAU_TABLE     = os.getenv("DB_KORGAU_TABLE",     "korgau_cards")
# Optional raw SQL overrides (if tables have complex views / joins)
DB_INCIDENTS_QUERY  = os.getenv("DB_INCIDENTS_QUERY",  "")
DB_KORGAU_QUERY     = os.getenv("DB_KORGAU_QUERY",     "")

# ── REST API settings ────────────────────────────────────────────────────────
API_BASE_URL        = os.getenv("SOURCE_API_URL",       "")    # e.g. https://hse.corp/api/v1
API_TOKEN           = os.getenv("SOURCE_API_TOKEN",     "")
API_INCIDENTS_PATH  = os.getenv("API_INCIDENTS_PATH",   "/incidents")
API_KORGAU_PATH     = os.getenv("API_KORGAU_PATH",      "/korgau-cards")
API_PAGE_SIZE       = int(os.getenv("API_PAGE_SIZE",    "1000"))

# ── Column mapping DB/API → internal names ───────────────────────────────────
# Override these via env vars if your source system uses different field names.
# Format: INCIDENTS_COL_MAP = "source_col:internal_col,source_col2:internal_col2"
def _parse_col_map(env_key: str, defaults: dict) -> dict:
    raw = os.getenv(env_key, "")
    if not raw.strip():
        return defaults
    result = dict(defaults)
    for pair in raw.split(","):
        parts = pair.strip().split(":")
        if len(parts) == 2:
            result[parts[0].strip()] = parts[1].strip()
    return result

INCIDENTS_COL_MAP = _parse_col_map("INCIDENTS_COL_MAP", {
    # source_field: internal_field
    "incident_date":       "Дата возникновения происшествия",
    "organization":        "Организация",
    "location":            "Место происшествия",
    "business_unit":       "Бизнес-подразделение",
    "is_accident":         "Несчастный случай",
    "is_fire":             "Пожар/Возгорание",
    "is_rta":              "Дорожно-транспортное происшествие",
    "is_incident":         "Инцидент",
    "is_microtrauma":      "Оказание Медицинской помощи/микротравма",
})

KORGAU_COL_MAP = _parse_col_map("KORGAU_COL_MAP", {
    "observation_date":    "Дата",
    "observation_type":    "Тип наблюдения",
    "organization":        "Организация",
    "violation_category":  "Категория нарушения",
    "status":              "Статус",
})


# ---------------------------------------------------------------------------
# Shared normalisation helpers
# ---------------------------------------------------------------------------

_VIOLATION_TYPES = {
    "Небезопасное условие",
    "Небезопасное условие ",
    "Небезопасное поведение",
    "Небезопасное действие",
    "Опасный фактор",
    "Опасный случай",
}


def _normalise_incidents(df: pd.DataFrame) -> pd.DataFrame:
    """Parse dates, derive type, month_str, year columns."""
    df["date"] = pd.to_datetime(df["Дата возникновения происшествия"], errors="coerce")
    df = df.dropna(subset=["date"])
    df["year"] = df["date"].dt.year
    df["month_str"] = df["date"].dt.strftime("%Y-%m")
    df["type"] = df.apply(an.get_incident_type, axis=1)
    return df


def _normalise_korgau(df: pd.DataFrame) -> pd.DataFrame:
    """Parse dates, derive is_violation, month_str columns."""
    df["date"] = pd.to_datetime(df["Дата"], errors="coerce")
    df = df[df["date"].dt.year >= 2020].dropna(subset=["date"])
    df["month_str"] = df["date"].dt.strftime("%Y-%m")
    df["is_violation"] = df["Тип наблюдения"].fillna("").isin(_VIOLATION_TYPES)
    return df


def _apply_col_map(df: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    """Rename columns according to mapping dict (source → internal)."""
    rename = {src: dst for src, dst in col_map.items() if src in df.columns}
    return df.rename(columns=rename)


# ---------------------------------------------------------------------------
# Backend: Excel (default)
# ---------------------------------------------------------------------------

def _load_incidents_excel() -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "incidents.xlsx")
    df = pd.read_excel(path)
    return _normalise_incidents(df)


def _load_korgau_excel() -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "korgau_cards.xlsx")
    df = pd.read_excel(path)
    return _normalise_korgau(df)


# ---------------------------------------------------------------------------
# Backend: Relational Database (SQLAlchemy)
# ---------------------------------------------------------------------------

def _get_db_engine():
    """Lazy-import sqlalchemy so it's optional for Excel users."""
    try:
        from sqlalchemy import create_engine  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "sqlalchemy is required for DATA_SOURCE=db. "
            "Run: pip install sqlalchemy psycopg2-binary"
        ) from exc
    if not DB_URL:
        raise RuntimeError("SOURCE_DB_URL env variable is not set.")
    return create_engine(DB_URL)


def _load_incidents_db() -> pd.DataFrame:
    engine = _get_db_engine()
    query = DB_INCIDENTS_QUERY or f"SELECT * FROM {DB_INCIDENTS_TABLE}"
    df = pd.read_sql(query, engine)
    df = _apply_col_map(df, INCIDENTS_COL_MAP)
    return _normalise_incidents(df)


def _load_korgau_db() -> pd.DataFrame:
    engine = _get_db_engine()
    query = DB_KORGAU_QUERY or f"SELECT * FROM {DB_KORGAU_TABLE}"
    df = pd.read_sql(query, engine)
    df = _apply_col_map(df, KORGAU_COL_MAP)
    return _normalise_korgau(df)


# ---------------------------------------------------------------------------
# Backend: REST API
# ---------------------------------------------------------------------------

def _api_fetch_all(path: str) -> list:
    """
    Fetch all pages from a paginated REST endpoint.
    Supports two common pagination styles:
      - ?page=1&page_size=N  (page-based)
      - ?offset=0&limit=N    (offset-based)
    Auto-detected: if response JSON is a list → no pagination.
    If dict with 'data' or 'results' key → extract records + paginate.
    """
    try:
        import httpx  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "httpx is required for DATA_SOURCE=api. Run: pip install httpx"
        ) from exc

    if not API_BASE_URL:
        raise RuntimeError("SOURCE_API_URL env variable is not set.")

    headers = {}
    if API_TOKEN:
        headers["Authorization"] = f"Bearer {API_TOKEN}"

    url = API_BASE_URL.rstrip("/") + path
    records: list = []
    page = 1

    with httpx.Client(headers=headers, timeout=30) as client:
        while True:
            resp = client.get(url, params={"page": page, "page_size": API_PAGE_SIZE})
            resp.raise_for_status()
            body = resp.json()

            # Unwrap common envelope formats
            if isinstance(body, list):
                records.extend(body)
                break  # no pagination
            elif isinstance(body, dict):
                chunk = (
                    body.get("data")
                    or body.get("results")
                    or body.get("items")
                    or []
                )
                records.extend(chunk)
                # Stop if last page
                if len(chunk) < API_PAGE_SIZE:
                    break
                page += 1
            else:
                break

    return records


def _load_incidents_api() -> pd.DataFrame:
    records = _api_fetch_all(API_INCIDENTS_PATH)
    df = pd.DataFrame(records)
    df = _apply_col_map(df, INCIDENTS_COL_MAP)
    return _normalise_incidents(df)


def _load_korgau_api() -> pd.DataFrame:
    records = _api_fetch_all(API_KORGAU_PATH)
    df = pd.DataFrame(records)
    df = _apply_col_map(df, KORGAU_COL_MAP)
    return _normalise_korgau(df)


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

_BACKENDS = {
    "excel": (_load_incidents_excel, _load_korgau_excel),
    "db":    (_load_incidents_db,    _load_korgau_db),
    "api":   (_load_incidents_api,   _load_korgau_api),
}

if DATA_SOURCE not in _BACKENDS:
    warnings.warn(
        f"Unknown DATA_SOURCE='{DATA_SOURCE}'. Falling back to 'excel'.",
        stacklevel=1,
    )
    _backend = _BACKENDS["excel"]
else:
    _backend = _BACKENDS[DATA_SOURCE]

_load_incidents_fn, _load_korgau_fn = _backend


def load_incidents() -> pd.DataFrame:
    """Load and normalise incidents data from the configured backend."""
    return _load_incidents_fn()


def load_korgau() -> pd.DataFrame:
    """Load and normalise Korgau observation cards from the configured backend."""
    return _load_korgau_fn()


def active_backend() -> str:
    return DATA_SOURCE if DATA_SOURCE in _BACKENDS else "excel"
