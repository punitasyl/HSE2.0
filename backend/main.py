"""
HSE Analytics API — FastAPI backend
Run: uvicorn main:app --reload --port 8001
"""

import os
import sys
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI, HTTPException, Query
from typing import List
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np

# Make sure analytics module is importable
sys.path.insert(0, os.path.dirname(__file__))

import analytics as an
import ai_module
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

app = FastAPI(title="HSE Analytics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def load_incidents() -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "incidents.xlsx")
    df = pd.read_excel(path)

    df["date"] = pd.to_datetime(df["Дата возникновения происшествия"], errors="coerce")
    df = df.dropna(subset=["date"])
    df["year"] = df["date"].dt.year
    df["month_str"] = df["date"].dt.strftime("%Y-%m")
    df["type"] = df.apply(an.get_incident_type, axis=1)

    return df


def load_korgau() -> pd.DataFrame:
    path = os.path.join(DATA_DIR, "korgau_cards.xlsx")
    df = pd.read_excel(path)

    df["date"] = pd.to_datetime(df["Дата"], errors="coerce")
    # Filter to reasonable date range (ignore obvious outliers like 1965)
    df = df[df["date"].dt.year >= 2020].dropna(subset=["date"])
    df["month_str"] = df["date"].dt.strftime("%Y-%m")
    df["is_violation"] = df["Тип наблюдения"].fillna("").isin(
        [
            "Небезопасное условие",
            "Небезопасное условие ",  # trailing space variant in data
            "Небезопасное поведение",
            "Небезопасное действие",
            "Опасный фактор",
            "Опасный случай",
        ]
    )

    return df


# Load once at startup
try:
    incidents_df = load_incidents()
    print(f"Loaded incidents: {len(incidents_df)} rows")
except Exception as e:
    print(f"ERROR loading incidents: {e}")
    incidents_df = pd.DataFrame()

try:
    korgau_df = load_korgau()
    print(f"Loaded korgau: {len(korgau_df)} rows")
except Exception as e:
    print(f"ERROR loading korgau: {e}")
    korgau_df = pd.DataFrame()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/incidents/summary")
def incidents_summary():
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_incidents_summary(incidents_df)


@app.get("/api/incidents/list")
def incidents_list():
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_incidents_list(incidents_df)


@app.get("/api/predictions")
def predictions():
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_predictions(incidents_df)


@app.get("/api/risk-zones")
def risk_zones():
    return an.compute_risk_zones(incidents_df, korgau_df)


@app.get("/api/korgau/summary")
def korgau_summary():
    if korgau_df.empty:
        raise HTTPException(status_code=500, detail="korgau data not loaded")
    return an.compute_koргau_summary(korgau_df)


@app.get("/api/alerts")
def alerts():
    return an.compute_alerts(incidents_df, korgau_df)


@app.get("/api/recommendations")
def recommendations():
    return an.compute_recommendations(incidents_df, korgau_df)



@app.get("/api/economic-effect")
def economic_effect():
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_economic_effect(incidents_df)


@app.get("/api/scenario")
def scenario(measures: List[str] = Query(default=[])):
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_scenario(incidents_df, measures)


@app.get("/api/correlation")
def correlation():
    return an.compute_correlation(incidents_df, korgau_df)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "incidents_rows": len(incidents_df),
        "korgau_rows": len(korgau_df),
    }
