"""
HSE Analytics computation module.
All heavy data processing and ML logic lives here.
"""

import warnings
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from statsmodels.tsa.arima.model import ARIMA
from scipy.stats import pearsonr
from typing import Any


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _safe_str(v: Any) -> str:
    if pd.isna(v):
        return "Не указано"
    return str(v).strip()


def _flag(row: pd.Series, col: str) -> bool:
    v = row.get(col, np.nan)
    try:
        return float(v) == 1.0
    except (TypeError, ValueError):
        return False


def get_incident_type(row: pd.Series) -> str:
    if _flag(row, "Несчастный случай"):
        return "Несчастный случай"
    if _flag(row, "Пожар/Возгорание"):
        return "Пожар/Возгорание"
    if _flag(row, "Дорожно-транспортное происшествие"):
        return "ДТП"
    if _flag(row, "Инцидент"):
        return "Инцидент"
    if _flag(row, "Оказание Медицинской помощи/микротравма"):
        return "Микротравма"
    return "Ухудшение здоровья"


# ---------------------------------------------------------------------------
# Incidents summary
# ---------------------------------------------------------------------------

def compute_incidents_summary(df: pd.DataFrame) -> dict:
    total = len(df)

    by_type = df["type"].value_counts().to_dict()

    by_month = (
        df.groupby("month_str")
        .size()
        .reset_index(name="count")
        .rename(columns={"month_str": "month"})
        .sort_values("month")
        .to_dict(orient="records")
    )

    by_org_raw = (
        df["Наименование организации ДЗО"]
        .fillna("Не указано")
        .value_counts()
        .head(15)
        .reset_index()
    )
    by_org_raw.columns = ["org", "count"]
    by_org = by_org_raw.to_dict(orient="records")

    by_loc_raw = (
        df["Место происшествия"]
        .fillna("Не указано")
        .value_counts()
        .head(15)
        .reset_index()
    )
    by_loc_raw.columns = ["location", "count"]
    by_location = by_loc_raw.to_dict(orient="records")

    by_biz_raw = (
        df["Бизнес направление"]
        .fillna("Не указано")
        .value_counts()
        .reset_index()
    )
    by_biz_raw.columns = ["unit", "count"]
    by_business = by_biz_raw.to_dict(orient="records")

    return {
        "total": total,
        "by_type": by_type,
        "by_month": by_month,
        "by_org": by_org,
        "by_location": by_location,
        "by_business": by_business,
    }


# ---------------------------------------------------------------------------
# Incidents list
# ---------------------------------------------------------------------------

def compute_incidents_list(df: pd.DataFrame) -> list:
    cols = [
        "ID",
        "Дата возникновения происшествия",
        "Бизнес направление",
        "Наименование организации ДЗО",
        "Место происшествия",
        "Краткое описание происшествия",
        "Предварительные причины",
        "Классификация НС",
        "Тяжесть травмы",
        "Структурное подразделение",
        "Область",
        "type",
    ]
    available = [c for c in cols if c in df.columns]
    sub = df[available].copy()
    sub["Дата возникновения происшествия"] = sub["Дата возникновения происшествия"].dt.strftime("%Y-%m-%d")
    sub = sub.fillna("")
    return sub.to_dict(orient="records")


# ---------------------------------------------------------------------------
# Predictions (12-month forecast)
# ---------------------------------------------------------------------------

def compute_predictions(df: pd.DataFrame) -> dict:
    monthly = (
        df.groupby("month_str")
        .size()
        .reset_index(name="count")
        .sort_values("month_str")
    )

    historical = [
        {"month": r["month_str"], "actual": int(r["count"])}
        for _, r in monthly.iterrows()
    ]

    counts = monthly["count"].values.astype(float)
    n = len(counts)

    # Auto-select ARIMA(p,d,q) order by AIC
    best_aic = np.inf
    best_result = None
    best_order = (1, 1, 1)

    if n >= 10:
        for p in range(3):
            for d in range(2):
                for q in range(3):
                    try:
                        with warnings.catch_warnings():
                            warnings.simplefilter("ignore")
                            res = ARIMA(counts, order=(p, d, q)).fit()
                        if res.aic < best_aic:
                            best_aic = res.aic
                            best_result = res
                            best_order = (p, d, q)
                    except Exception:
                        continue

    if best_result is None:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            best_result = ARIMA(counts, order=(1, 1, 1)).fit()
        best_order = (1, 1, 1)
        best_aic = float(best_result.aic)

    # MAE on in-sample fitted values
    fv = best_result.fittedvalues
    mae = float(np.mean(np.abs(counts[-len(fv):] - fv)))

    # Trend direction: compare last 3 months vs previous 3 months
    if n >= 6:
        trend_direction = "decreasing" if np.mean(counts[-3:]) < np.mean(counts[-6:-3]) else "increasing"
    else:
        trend_direction = "decreasing" if counts[-1] < counts[0] else "increasing"

    # Forecast 12 months with 95% confidence interval
    last_month = pd.Period(monthly["month_str"].iloc[-1], freq="M")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fc = best_result.get_forecast(steps=12)

    fc_mean_raw = fc.predicted_mean
    fc_ci = fc.conf_int(alpha=0.05)

    # conf_int() may return DataFrame or ndarray depending on statsmodels version
    if hasattr(fc_ci, "columns"):
        lower_vals = fc_ci.iloc[:, 0].values
        upper_vals = fc_ci.iloc[:, 1].values
    else:
        lower_vals = np.asarray(fc_ci)[:, 0]
        upper_vals = np.asarray(fc_ci)[:, 1]

    fc_mean_arr = np.asarray(fc_mean_raw)

    forecast = []
    for i in range(12):
        pred = max(0.0, float(fc_mean_arr[i]))
        lower = max(0.0, float(lower_vals[i]))
        upper = float(upper_vals[i])
        month_label = str(last_month + i + 1)
        forecast.append({
            "month": month_label,
            "predicted": round(pred, 1),
            "lower": round(lower, 1),
            "upper": round(upper, 1),
        })

    return {
        "historical": historical,
        "forecast": forecast,
        "model_metrics": {
            "mae": round(mae, 2),
            "trend": trend_direction,
            "method": f"ARIMA{best_order}",
            "aic": round(float(best_aic), 1),
        },
    }


# ---------------------------------------------------------------------------
# Risk zones
# ---------------------------------------------------------------------------

def compute_risk_zones(df_inc: pd.DataFrame, df_kor: pd.DataFrame) -> dict:
    resolved_col = "Было ли небезопасное условие / поведение исправлено и опасность устранена?"

    # --- Incidents per org ---
    if not df_inc.empty:
        inc_by_org = (
            df_inc.groupby("Наименование организации ДЗО")
            .size()
            .reset_index(name="incident_count")
            .rename(columns={"Наименование организации ДЗО": "org"})
        )
        acc_by_org = (
            df_inc[df_inc["type"] == "Несчастный случай"]
            .groupby("Наименование организации ДЗО")
            .size()
            .reset_index(name="accidents")
            .rename(columns={"Наименование организации ДЗО": "org"})
        )
    else:
        inc_by_org = pd.DataFrame(columns=["org", "incident_count"])
        acc_by_org = pd.DataFrame(columns=["org", "accidents"])

    # --- Violations per org (Korgau) ---
    if not df_kor.empty:
        violations_by_org = (
            df_kor[df_kor["is_violation"]]
            .groupby("Организация")
            .size()
            .reset_index(name="violations")
            .rename(columns={"Организация": "org"})
        )
    else:
        violations_by_org = pd.DataFrame(columns=["org", "violations"])

    # --- Resolution rate per org ---
    if not df_kor.empty and resolved_col in df_kor.columns:
        viol_df = df_kor[df_kor["is_violation"]].copy()
        res_by_org = (
            viol_df.groupby("Организация")
            .agg(total_viol=("is_violation", "count"), resolved=(resolved_col, "sum"))
            .reset_index()
            .rename(columns={"Организация": "org"})
        )
        res_by_org["res_rate"] = res_by_org["resolved"] / res_by_org["total_viol"].clip(lower=1)
        res_by_org = res_by_org[["org", "res_rate"]]
    else:
        res_by_org = None

    # --- Trend: incidents growing? (last 6 vs prev 6 months) ---
    trend_growing: dict = {}
    if not df_inc.empty:
        max_date = df_inc["date"].max()
        mid = max_date - pd.DateOffset(months=6)
        start = max_date - pd.DateOffset(months=12)
        recent_cnt = (
            df_inc[df_inc["date"] > mid]
            .groupby("Наименование организации ДЗО").size().rename("recent")
        )
        prev_cnt = (
            df_inc[(df_inc["date"] > start) & (df_inc["date"] <= mid)]
            .groupby("Наименование организации ДЗО").size().rename("prev")
        )
        trend_df = pd.concat([recent_cnt, prev_cnt], axis=1).fillna(0)
        trend_growing = {
            org: bool(row["recent"] > row["prev"])
            for org, row in trend_df.iterrows()
        }

    # --- Merge all ---
    merged = inc_by_org.merge(acc_by_org, on="org", how="outer")
    merged = merged.merge(violations_by_org, on="org", how="outer")
    if res_by_org is not None and len(res_by_org) > 0:
        merged = merged.merge(res_by_org, on="org", how="left")
    else:
        merged["res_rate"] = 0.0
    merged = merged.fillna(0)

    # --- Risk Score formula ---
    # score = incidents×10 + accidents×30 + violations×2 + trend_penalty(+15) - resolution_bonus(-10)
    def raw_score(row: pd.Series) -> float:
        trend_penalty = 15.0 if trend_growing.get(row["org"], False) else 0.0
        res_bonus = 10.0 if row.get("res_rate", 0.0) >= 0.8 else 0.0
        return (
            row["incident_count"] * 10.0
            + row["accidents"] * 30.0
            + row["violations"] * 2.0
            + trend_penalty
            - res_bonus
        )

    if len(merged) > 0:
        merged["_raw"] = merged.apply(raw_score, axis=1)
        max_raw = merged["_raw"].max()
        merged["risk_score"] = (merged["_raw"] / max(float(max_raw), 1.0) * 100).round(1)
    else:
        merged["risk_score"] = 0.0

    def risk_level(score: float) -> str:
        if score >= 70: return "critical"
        if score >= 40: return "high"
        if score >= 20: return "medium"
        return "low"

    top_orgs_rows = merged.sort_values("risk_score", ascending=False).head(10).to_dict(orient="records")
    top_orgs = []
    for r in top_orgs_rows:
        top_orgs.append({
            "org": r["org"],
            "incident_count": int(r["incident_count"]),
            "accidents": int(r["accidents"]),
            "violations": int(r["violations"]),
            "risk_score": float(r["risk_score"]),
            "risk_level": risk_level(float(r["risk_score"])),
            "trend_growing": trend_growing.get(r["org"], False),
        })

    # --- Top locations ---
    loc_counts = (
        df_inc["Место происшествия"]
        .fillna("Не указано")
        .value_counts()
        .head(10)
        .reset_index()
    )
    loc_counts.columns = ["location", "count"]
    max_loc = int(loc_counts["count"].max()) if len(loc_counts) > 0 else 1
    loc_counts["risk_score"] = (loc_counts["count"] / max_loc * 100).round(1)
    top_locations = loc_counts.to_dict(orient="records")

    return {"top_orgs": top_orgs, "top_locations": top_locations}


# ---------------------------------------------------------------------------
# Koргau summary
# ---------------------------------------------------------------------------

def compute_koргau_summary(df: pd.DataFrame) -> dict:
    total = len(df)

    by_type = df["Тип наблюдения"].fillna("Не указано").value_counts().to_dict()

    by_cat_raw = (
        df["Категория наблюдения"]
        .fillna("Не указано")
        .value_counts()
        .head(20)
        .reset_index()
    )
    by_cat_raw.columns = ["category", "count"]
    by_category = by_cat_raw.to_dict(orient="records")

    by_org_raw = (
        df["Организация"]
        .fillna("Не указано")
        .value_counts()
        .head(15)
        .reset_index()
    )
    by_org_raw.columns = ["org", "count"]
    by_org = by_org_raw.to_dict(orient="records")

    by_month = (
        df.groupby("month_str")
        .size()
        .reset_index(name="count")
        .rename(columns={"month_str": "month"})
        .sort_values("month")
        .to_dict(orient="records")
    )

    resolved_col = "Было ли небезопасное условие / поведение исправлено и опасность устранена?"
    if resolved_col in df.columns:
        violations = df[df["is_violation"]]
        if len(violations) > 0:
            resolution_rate = round(float(violations[resolved_col].sum()) / len(violations), 4)
        else:
            resolution_rate = 0.0
    else:
        resolution_rate = 0.0

    return {
        "total": total,
        "by_type": by_type,
        "by_category": by_category,
        "by_org": by_org,
        "by_month": by_month,
        "resolution_rate": resolution_rate,
    }


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def compute_alerts(df_inc: pd.DataFrame, df_kor: pd.DataFrame) -> dict:
    alerts = []

    # Use the most recent month with substantial data (>50 records) as "current"
    monthly_counts = df_kor.groupby("month_str").size()
    significant_months = monthly_counts[monthly_counts > 50].index.sort_values()
    if len(significant_months) >= 2:
        current_month = significant_months[-1]
        prev_month = significant_months[-2]
        recent = df_kor[df_kor["is_violation"] & (df_kor["month_str"] == current_month)]
        prev_period = df_kor[df_kor["is_violation"] & (df_kor["month_str"] == prev_month)]
    else:
        now = df_kor["date"].max()
        if pd.isna(now):
            now = datetime.now()
        cutoff_30 = now - timedelta(days=30)
        cutoff_30_prev = cutoff_30 - timedelta(days=30)
        recent = df_kor[df_kor["is_violation"] & (df_kor["date"] >= cutoff_30)]
        prev_period = df_kor[
            df_kor["is_violation"]
            & (df_kor["date"] >= cutoff_30_prev)
            & (df_kor["date"] < cutoff_30)
        ]

    # Group by org in recent 30 days
    recent_by_org = recent.groupby("Организация").size().reset_index(name="count")
    prev_by_org = prev_period.groupby("Организация").size().reset_index(name="count_prev")

    merged = recent_by_org.merge(prev_by_org, on="Организация", how="left").fillna(0)

    # Dynamic threshold: 75th percentile of org counts (min 5)
    if len(recent_by_org) > 0:
        threshold = max(5, int(np.percentile(recent_by_org["count"], 75)))
    else:
        threshold = 5

    for _, row in merged.iterrows():
        org = str(row["Организация"])
        cnt = int(row["count"])
        cnt_prev = int(row["count_prev"])

        if cnt > threshold * 2:
            alerts.append(
                {
                    "level": "critical",
                    "org": org,
                    "category": "Нарушения безопасности",
                    "message": f"Число нарушений за период превысило порог × 2 ({cnt} нарушений)",
                    "count": cnt,
                    "threshold": threshold,
                    "period": "last_30_days",
                }
            )
        elif cnt > threshold:
            alerts.append(
                {
                    "level": "high",
                    "org": org,
                    "category": "Нарушения безопасности",
                    "message": f"Число нарушений превысило пороговое значение ({cnt} нарушений)",
                    "count": cnt,
                    "threshold": threshold,
                    "period": "last_30_days",
                }
            )
        elif cnt_prev > 0 and cnt > cnt_prev * 1.15:
            growth_pct = round((cnt - cnt_prev) / cnt_prev * 100, 1)
            alerts.append(
                {
                    "level": "medium",
                    "org": org,
                    "category": "Тренд нарушений",
                    "message": f"Рост нарушений на {growth_pct}% по сравнению с предыдущим периодом",
                    "count": cnt,
                    "threshold": threshold,
                    "period": "last_30_days",
                }
            )
        elif cnt_prev > 0 and cnt < cnt_prev * 0.85:
            alerts.append(
                {
                    "level": "low",
                    "org": org,
                    "category": "Улучшение",
                    "message": f"Снижение числа нарушений: {cnt_prev} → {cnt}",
                    "count": cnt,
                    "threshold": threshold,
                    "period": "last_30_days",
                }
            )

    # Check repetitive violation type per org
    type_org_recent = (
        recent.groupby(["Организация", "Тип наблюдения"])
        .size()
        .reset_index(name="count")
    )
    for _, row in type_org_recent[type_org_recent["count"] > 3].iterrows():
        org = str(row["Организация"])
        vtype = str(row["Тип наблюдения"])
        cnt = int(row["count"])
        # avoid duplicate org entry
        existing_orgs = {a["org"] for a in alerts}
        if org not in existing_orgs:
            alerts.append(
                {
                    "level": "high",
                    "org": org,
                    "category": vtype,
                    "message": f"Один тип нарушения повторяется {cnt} раз за 30 дней: {vtype}",
                    "count": cnt,
                    "threshold": 3,
                    "period": "last_30_days",
                }
            )

    # Sort: critical > high > medium > low
    level_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    alerts.sort(key=lambda x: level_order.get(x["level"], 99))

    return {"alerts": alerts}


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------

def compute_recommendations(df_inc: pd.DataFrame, df_kor: pd.DataFrame) -> dict:
    import ai_module
    stats = collect_stats_for_ai(df_inc, df_kor)
    try:
        recs = ai_module.generate_ai_recommendations(stats)
        model = recs[0].get("model", "unknown") if recs else "unknown"
        return {"recommendations": recs, "ai_generated": True, "model": model}
    except Exception as e:
        print(f"[recommendations] AI failed: {e}")
        return {"recommendations": [], "ai_generated": False, "error": str(e)}


def collect_stats_for_ai(df_inc: pd.DataFrame, df_kor: pd.DataFrame) -> dict:
    """Collect compact statistics dict to feed into the AI prompt."""
    stats: dict = {}

    # --- incidents ---
    if not df_inc.empty:
        by_type = df_inc["type"].value_counts().to_dict()
        top_orgs = (
            df_inc["Наименование организации ДЗО"]
            .value_counts()
            .head(7)
            .reset_index()
            .rename(columns={"Наименование организации ДЗО": "org", "count": "count"})
            .to_dict(orient="records")
        )
        # pandas ≥2 .value_counts() index name differs
        if top_orgs and "index" in top_orgs[0]:
            top_orgs = [{"org": r["index"], "count": r["Наименование организации ДЗО"]} for r in top_orgs]
        stats["incidents"] = {
            "total": len(df_inc),
            "by_type": by_type,
            "top_orgs": top_orgs,
        }

    # --- korgau ---
    if not df_kor.empty:
        violations = df_kor[df_kor["is_violation"]]
        resolved_col = "Было ли небезопасное условие / поведение исправлено и опасность устранена?"
        res_rate = None
        if resolved_col in df_kor.columns and len(violations) > 0:
            res_rate = float(violations[resolved_col].sum() / len(violations) * 100)

        stop_col = "Производилась ли остановка работ?"
        stop_rate = None
        if stop_col in df_kor.columns:
            critical = df_kor[df_kor["Тип наблюдения"].isin(["Опасный фактор", "Опасный случай"])]
            if len(critical) > 0:
                stop_rate = float(critical[stop_col].sum() / len(critical) * 100)

        top_cats = (
            df_kor[df_kor["is_violation"]]["Категория наблюдения"]
            .value_counts()
            .head(7)
            .reset_index()
            .rename(columns={"Категория наблюдения": "category", "count": "count"})
            .to_dict(orient="records")
        )
        if top_cats and "index" in top_cats[0]:
            top_cats = [{"category": r["index"], "count": r["Категория наблюдения"]} for r in top_cats]

        top_kor_orgs = (
            df_kor[df_kor["is_violation"]]["Организация"]
            .value_counts()
            .head(7)
            .reset_index()
            .rename(columns={"Организация": "org", "count": "count"})
            .to_dict(orient="records")
        )
        if top_kor_orgs and "index" in top_kor_orgs[0]:
            top_kor_orgs = [{"org": r["index"], "count": r["Организация"]} for r in top_kor_orgs]

        stats["korgau"] = {
            "total": len(df_kor),
            "violations": int(df_kor["is_violation"].sum()),
            "resolution_rate": res_rate,
            "stop_rate": stop_rate,
            "top_categories": top_cats,
            "top_orgs": top_kor_orgs,
        }

    return stats


# ---------------------------------------------------------------------------
# Economic effect
# ---------------------------------------------------------------------------

def compute_economic_effect(df_inc: pd.DataFrame) -> dict:
    total_incidents = len(df_inc)
    accidents = int(df_inc[df_inc["type"] == "Несчастный случай"].shape[0])
    microtraumas = int(df_inc[df_inc["type"] == "Микротравма"].shape[0])

    predicted_reduction_pct = 38
    prevented_accidents = max(1, round(accidents * predicted_reduction_pct / 100))
    prevented_microtraumas = max(1, round(microtraumas * predicted_reduction_pct / 100))

    # Costs in KZT (rough industry estimates for Kazakhstan oil & gas)
    cost_per_accident = 5_000_000       # 5M KZT per serious accident
    cost_per_microtrauma = 200_000      # 200K KZT per microtrauma

    direct_costs = prevented_accidents * cost_per_accident + prevented_microtraumas * cost_per_microtrauma
    indirect_costs = direct_costs * 2   # indirect ~2x direct
    fines_reduction = prevented_accidents * 1_000_000
    investigation_savings = (prevented_accidents + prevented_microtraumas) * 150_000
    audit_efficiency = 3_000_000        # annual efficiency from AI system

    total_savings = (
        direct_costs
        + indirect_costs
        + fines_reduction
        + investigation_savings
        + audit_efficiency
    )

    return {
        "incidents_per_year": total_incidents,
        "predicted_reduction_pct": predicted_reduction_pct,
        "prevented_accidents": prevented_accidents,
        "prevented_microtraumas": prevented_microtraumas,
        "savings": {
            "direct_costs": direct_costs,
            "indirect_costs": indirect_costs,
            "fines_reduction": fines_reduction,
            "investigation_savings": investigation_savings,
            "audit_efficiency": audit_efficiency,
            "total": total_savings,
        },
        "currency": "KZT",
    }


# ---------------------------------------------------------------------------
# Correlation analysis
# ---------------------------------------------------------------------------

def compute_correlation(df_inc: pd.DataFrame, df_kor: pd.DataFrame) -> dict:
    # Filter to overlapping date range
    min_date = max(df_inc["date"].min(), df_kor["date"].min())
    max_date = min(df_inc["date"].max(), df_kor["date"].max())

    if pd.isna(min_date) or pd.isna(max_date) or min_date >= max_date:
        return {
            "correlation_coefficient": 0.0,
            "lag_days": 14,
            "description": "Недостаточно данных для корреляционного анализа",
        }

    inc_filt = df_inc[(df_inc["date"] >= min_date) & (df_inc["date"] <= max_date)].copy()
    kor_filt = df_kor[
        (df_kor["date"] >= min_date) & (df_kor["date"] <= max_date) & df_kor["is_violation"]
    ].copy()

    inc_weekly = (
        inc_filt.set_index("date")
        .resample("W")
        .size()
        .reset_index(name="inc_count")
        .rename(columns={"date": "week"})
    )
    kor_weekly = (
        kor_filt.set_index("date")
        .resample("W")
        .size()
        .reset_index(name="kor_count")
        .rename(columns={"date": "week"})
    )

    merged = pd.merge(inc_weekly, kor_weekly, on="week", how="inner").dropna()

    if len(merged) < 5:
        return {
            "correlation_coefficient": 0.0,
            "lag_days": 14,
            "description": "Недостаточно данных для корреляционного анализа",
        }

    best_corr = 0.0
    best_lag = 0

    for lag in range(0, 5):  # lag 0–4 weeks
        if lag == 0:
            x = merged["kor_count"].values
            y = merged["inc_count"].values
        else:
            x = merged["kor_count"].values[:-lag]
            y = merged["inc_count"].values[lag:]

        if len(x) < 4:
            continue
        try:
            corr, _ = pearsonr(x, y)
            if not np.isnan(corr) and abs(corr) > abs(best_corr):
                best_corr = corr
                best_lag = lag
        except Exception:
            pass

    lag_days = best_lag * 7

    if best_corr > 0.5:
        direction = "положительная"
        desc = (
            f"Выявлена {direction} корреляция ({best_corr:.2f}) между числом нарушений "
            f"(карточки Коргау) и последующими инцидентами с задержкой ~{lag_days} дней. "
            "Рост числа нарушений предшествует инцидентам."
        )
    elif best_corr < -0.5:
        direction = "отрицательная"
        desc = (
            f"Выявлена {direction} корреляция ({best_corr:.2f}): рост фиксаций нарушений "
            f"сопровождается снижением инцидентов с задержкой ~{lag_days} дней, "
            "что свидетельствует об эффективности системы Коргау."
        )
    else:
        desc = (
            f"Умеренная корреляция ({best_corr:.2f}) между нарушениями и инцидентами "
            f"с задержкой ~{lag_days} дней. Рекомендуется расширить выборку данных."
        )

    return {
        "correlation_coefficient": round(float(best_corr), 4),
        "lag_days": int(lag_days),
        "description": desc,
    }


# ---------------------------------------------------------------------------
# Scenario Modeling
# ---------------------------------------------------------------------------

MEASURE_EFFECTS: dict[str, dict] = {
    "siz_control":       {"label": "Усиление контроля СИЗ",           "reduction": 0.15},
    "risk_audit":        {"label": "Аудит системы управления рисками", "reduction": 0.20},
    "driver_training":   {"label": "Тренинги безопасного вождения",    "reduction": 0.25},
    "fire_prevention":   {"label": "Меры пожарной безопасности",       "reduction": 0.40},
    "korgau_kpi":        {"label": "KPI устранения нарушений 48ч",     "reduction": 0.18},
    "stop_work_culture": {"label": "Культура остановки работ",         "reduction": 0.10},
    "near_miss_program": {"label": "Программа near-miss reporting",    "reduction": 0.22},
}

_MAX_COMBINED_REDUCTION = 0.70
_COST_PER_INCIDENT_KZT = 1_500_000  # weighted KZT average (oil & gas sector)


def compute_scenario(df_inc: pd.DataFrame, measures: list[str]) -> dict:
    """
    Scenario Modeling: calculate expected incident reduction and economic saving
    when a set of control measures is applied.

    Combined effect uses independent probability formula:
        combined = 1 - ∏(1 - r_i)
    Capped at MAX_COMBINED_REDUCTION (70%) for realism.
    """
    monthly = (
        df_inc.groupby("month_str").size().reset_index(name="count").sort_values("month_str")
    )
    last_12 = monthly.tail(12)
    baseline_monthly = float(last_12["count"].mean()) if len(last_12) > 0 else 0.0
    baseline_annual = baseline_monthly * 12.0

    valid = [m for m in measures if m in MEASURE_EFFECTS]

    if valid:
        combined = 1.0 - float(np.prod([1.0 - MEASURE_EFFECTS[m]["reduction"] for m in valid]))
        combined = min(combined, _MAX_COMBINED_REDUCTION)
    else:
        combined = 0.0

    projected_monthly = baseline_monthly * (1.0 - combined)
    projected_annual = projected_monthly * 12.0
    saved_incidents = baseline_annual - projected_annual
    economic_saving_kzt = saved_incidents * _COST_PER_INCIDENT_KZT

    breakdown = [
        {
            "key": m,
            "label": MEASURE_EFFECTS[m]["label"],
            "reduction_pct": round(MEASURE_EFFECTS[m]["reduction"] * 100, 1),
            "incidents_saved": round(baseline_annual * MEASURE_EFFECTS[m]["reduction"], 1),
        }
        for m in valid
    ]

    available = [
        {"key": k, "label": v["label"], "reduction_pct": round(v["reduction"] * 100, 1)}
        for k, v in MEASURE_EFFECTS.items()
    ]

    return {
        "baseline_monthly": round(baseline_monthly, 1),
        "baseline_annual": round(baseline_annual, 1),
        "projected_monthly": round(projected_monthly, 1),
        "projected_annual": round(projected_annual, 1),
        "combined_reduction_pct": round(combined * 100, 1),
        "incidents_saved_annual": round(saved_incidents, 1),
        "economic_saving_kzt": int(economic_saving_kzt),
        "measures_applied": valid,
        "breakdown": breakdown,
        "available_measures": available,
    }
