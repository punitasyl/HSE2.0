# HSE Analytics API

Predictive HSE (Health, Safety, Environment) analytics platform for the oil & gas sector (Kazakhstan).

## Quick Start

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Interactive docs: http://localhost:8001/docs
ReDoc: http://localhost:8001/redoc

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
OPENAI_API_KEY=sk-...        # Optional — enables GPT-4o-mini recommendations
OLLAMA_URL=http://localhost:11434  # Ollama host (default)
OLLAMA_MODEL=llama3.2              # Ollama model (default)
```

If `OPENAI_API_KEY` is not set, AI recommendations fall back to local Ollama (llama3.2).

## Data Files

Place these Excel files in the project root (`../` relative to `backend/`):

| File | Required columns |
|---|---|
| `incidents.xlsx` | `Дата возникновения происшествия`, `Организация`, `Вид происшествия`, `Место происшествия`, `Бизнес-подразделение` |
| `korgau_cards.xlsx` | `Дата`, `Тип наблюдения`, `Организация`, `Категория нарушения`, `Статус` |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/incidents/summary` | Incident count by type, org, location, BU |
| GET | `/api/incidents/list` | Full incident records |
| GET | `/api/predictions` | 12-month ARIMA forecast + backtesting metrics |
| GET | `/api/risk-zones` | Risk scoring (0–100) per org and location |
| GET | `/api/korgau/summary` | Korgau card stats: violations, resolution rate |
| GET | `/api/alerts` | Active HSE alerts with severity levels |
| GET | `/api/recommendations` | AI-generated recommendations (OpenAI / Ollama) |
| GET | `/api/economic-effect` | ROI in KZT across 3 scenarios |
| GET | `/api/scenario?measures=siz_control&measures=risk_audit` | What-if scenario modeling |
| GET | `/api/correlation` | Pearson correlation: violations → incidents (lag 0–4 weeks) |
| GET | `/health` | Status + loaded row counts |

## Scenario Modeling — Available Measures

Pass one or more `measures` query parameters to `/api/scenario`:

| Key | Description | Reduction |
|---|---|---|
| `siz_control` | PPE compliance monitoring | 15% |
| `risk_audit` | Monthly risk audits | 12% |
| `driver_training` | Driver safety training | 18% |
| `fire_prevention` | Fire prevention program | 8% |
| `korgau_kpi` | Korgau KPI integration | 10% |
| `stop_work_culture` | Stop-work authority culture | 14% |
| `near_miss_program` | Near-miss reporting program | 16% |

Combined reduction is calculated as `1 − ∏(1 − rᵢ)`, capped at 70%.

**Example:**
```
GET /api/scenario?measures=siz_control&measures=driver_training
```

## Predictions — Response Structure

```json
{
  "historical": [{"month": "2024-01", "actual": 12}],
  "forecast":   [{"month": "2025-02", "predicted": 9.2, "lower": 6.1, "upper": 12.3}],
  "model_metrics": {
    "mae": 1.4, "rmse": 1.8, "mape": 14.2,
    "baseline_mae": 2.1,
    "method": "ARIMA", "aic": 87.4,
    "trend": "decreasing"
  },
  "backtesting": [{"month": "2024-08", "actual": 11, "predicted": 9.8, "error": 1.2}]
}
```

## Economic Effect — Response Structure

```json
{
  "currency": "KZT",
  "incidents_per_year": 48,
  "predicted_reduction_pct": 38,
  "scenarios": {
    "pessimistic": {"reduction_pct": 20, "savings": {"total": 12000000, ...}},
    "base":        {"reduction_pct": 38, "savings": {"total": 23000000, ...}},
    "optimistic":  {"reduction_pct": 55, "savings": {"total": 33000000, ...}}
  },
  "methodology_note": "..."
}
```
