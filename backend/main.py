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
import data_source as ds
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

app = FastAPI(
    title="HSE Analytics API",
    version="1.0.0",
    description=(
        "Predictive HSE (Health, Safety, Environment) analytics platform for oil & gas sector (Kazakhstan). "
        "Ingests incidents.xlsx and korgau_cards.xlsx, delivers ML forecasts, risk scoring, AI recommendations, "
        "alert detection, scenario modeling and economic ROI calculation.\n\n"
        "**Data inputs:** `incidents.xlsx` (incidents log), `korgau_cards.xlsx` (Korgau observation cards).\n\n"
        "**Swagger UI:** `/docs` | **ReDoc:** `/redoc` | **OpenAPI JSON:** `/openapi.json`"
    ),
    contact={"name": "HSE Analytics Team"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Data loading  (delegates to data_source.py — Excel / DB / REST API)
# ---------------------------------------------------------------------------

print(f"Data backend: {ds.active_backend().upper()}")

try:
    incidents_df = ds.load_incidents()
    print(f"Loaded incidents: {len(incidents_df)} rows")
except Exception as e:
    print(f"ERROR loading incidents: {e}")
    incidents_df = pd.DataFrame()

try:
    korgau_df = ds.load_korgau()
    print(f"Loaded korgau: {len(korgau_df)} rows")
except Exception as e:
    print(f"ERROR loading korgau: {e}")
    korgau_df = pd.DataFrame()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get(
    "/api/incidents/summary",
    summary="Incident summary statistics",
    description="Returns total incident count, breakdown by type, organization, location and business unit.",
    tags=["Incidents"],
)
def incidents_summary():
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_incidents_summary(incidents_df)


@app.get(
    "/api/incidents/list",
    summary="Full incident records",
    description="Returns all incident rows with date, organization, type, location and description.",
    tags=["Incidents"],
)
def incidents_list():
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_incidents_list(incidents_df)


@app.get(
    "/api/predictions",
    summary="12-month ARIMA incident forecast",
    description=(
        "Fits ARIMA(p,d,q) with automatic order selection by AIC. "
        "Returns historical series, 12-month forecast with 95% CI, "
        "and out-of-sample backtesting metrics (MAE, RMSE, MAPE)."
    ),
    tags=["Predictive Analytics"],
)
def predictions():
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_predictions(incidents_df)


@app.get(
    "/api/risk-zones",
    summary="Risk scoring by organization and location",
    description=(
        "Computes weighted risk index per organization: "
        "incidents×10 + accidents×30 + violations×2 + trend_penalty − resolution_bonus. "
        "Normalized 0–100. Returns top-10 orgs and top-10 locations."
    ),
    tags=["Risk"],
)
def risk_zones():
    return an.compute_risk_zones(incidents_df, korgau_df)


@app.get(
    "/api/korgau/summary",
    summary="Korgau observation card statistics",
    description="Violation counts by type, category, organization and month. Includes resolution rate.",
    tags=["Korgau"],
)
def korgau_summary():
    if korgau_df.empty:
        raise HTTPException(status_code=500, detail="korgau data not loaded")
    return an.compute_koргau_summary(korgau_df)


@app.get(
    "/api/alerts",
    summary="Active HSE alerts",
    description=(
        "Detects anomalies using dynamic thresholds (75th percentile). "
        "Severity levels: critical (2× threshold), high, medium (15% growth), low (improvement). "
        "Deduplication prevents alert spam for the same organization."
    ),
    tags=["Alerts"],
)
def alerts():
    return an.compute_alerts(incidents_df, korgau_df)


@app.get(
    "/api/recommendations",
    summary="AI-generated HSE recommendations",
    description=(
        "Calls OpenAI (gpt-4o-mini) or Ollama (llama3.2) with aggregated statistics "
        "to generate 5–7 prioritized, actionable recommendations in Russian. "
        "Each recommendation includes timeline and implementation steps."
    ),
    tags=["Recommendations"],
)
def recommendations():
    return an.compute_recommendations(incidents_df, korgau_df)


@app.get(
    "/api/economic-effect",
    summary="Economic ROI of HSE improvements",
    description=(
        "Calculates prevented incident costs across 3 scenarios "
        "(pessimistic −20%, base −38%, optimistic −55%). "
        "Covers direct costs, indirect costs (×2), fines, investigation savings, audit efficiency. "
        "All values in KZT (Kazakhstan Tenge)."
    ),
    tags=["Economics"],
)
def economic_effect():
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_economic_effect(incidents_df)


@app.get(
    "/api/scenario",
    summary="Scenario modeling — what-if analysis",
    description=(
        "Pass one or more `measures` query params (e.g. `?measures=siz_control&measures=korgau_kpi`). "
        "Returns combined reduction using independent probability formula: 1 − ∏(1 − rᵢ), capped at 70%. "
        "Available keys: siz_control, risk_audit, driver_training, fire_prevention, "
        "korgau_kpi, stop_work_culture, near_miss_program."
    ),
    tags=["Economics"],
)
def scenario(measures: List[str] = Query(default=[])):
    if incidents_df.empty:
        raise HTTPException(status_code=500, detail="incidents data not loaded")
    return an.compute_scenario(incidents_df, measures)


@app.get(
    "/api/correlation",
    summary="Pearson correlation: violations → incidents",
    description=(
        "Tests lag 0–4 weeks between Korgau violations and incident counts (weekly aggregation). "
        "Returns best correlation coefficient, optimal lag in days, and interpretation."
    ),
    tags=["Predictive Analytics"],
)
def correlation():
    return an.compute_correlation(incidents_df, korgau_df)


@app.get(
    "/health",
    summary="Health check",
    description="Returns API status and number of loaded data rows.",
    tags=["System"],
)
def health():
    return {
        "status": "ok",
        "data_backend": ds.active_backend(),
        "incidents_rows": len(incidents_df),
        "korgau_rows": len(korgau_df),
    }
