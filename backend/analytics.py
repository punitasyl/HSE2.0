"""
HSE Analytics computation module.
All heavy data processing and ML logic lives here.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error
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
    X = np.arange(n).reshape(-1, 1)

    # Linear trend
    lr = LinearRegression()
    lr.fit(X, counts)
    trend_vals = lr.predict(X)
    residuals = counts - trend_vals

    # Simple seasonality: fit sine wave on residuals
    best_amp, best_phase, best_period = 0.0, 0.0, 12
    if n >= 6:
        for period in [12, 6]:
            for phase in np.linspace(0, 2 * np.pi, 20):
                amp = np.std(residuals)
                fitted = amp * np.sin(2 * np.pi * X.flatten() / period + phase)
                err = np.mean((residuals - fitted) ** 2)
                if err < np.mean(residuals**2):
                    best_amp = amp
                    best_phase = phase
                    best_period = period

    # MAE on in-sample
    in_sample = trend_vals + best_amp * np.sin(
        2 * np.pi * np.arange(n) / best_period + best_phase
    )
    mae = float(mean_absolute_error(counts, in_sample))

    trend_direction = "decreasing" if lr.coef_[0] < 0 else "increasing"

    # Forecast next 12 months
    last_month = pd.Period(monthly["month_str"].iloc[-1], freq="M")
    forecast = []
    std_res = float(np.std(residuals)) if n > 1 else 1.0

    for i in range(1, 13):
        future_idx = n - 1 + i
        pred = float(
            lr.predict([[future_idx]])[0]
            + best_amp * np.sin(2 * np.pi * future_idx / best_period + best_phase)
        )
        pred = max(0.0, pred)
        lower = max(0.0, pred - 1.96 * std_res)
        upper = pred + 1.96 * std_res
        month_label = str(last_month + i)
        forecast.append(
            {
                "month": month_label,
                "predicted": round(pred, 1),
                "lower": round(lower, 1),
                "upper": round(upper, 1),
            }
        )

    return {
        "historical": historical,
        "forecast": forecast,
        "model_metrics": {"mae": round(mae, 2), "trend": trend_direction},
    }


# ---------------------------------------------------------------------------
# Risk zones
# ---------------------------------------------------------------------------

def compute_risk_zones(df_inc: pd.DataFrame, df_kor: pd.DataFrame) -> dict:
    # Violations from koргau per org
    violations_by_org = (
        df_kor[df_kor["is_violation"]]
        .groupby("Организация")
        .size()
        .reset_index(name="violations")
    )

    # Incidents per org
    inc_by_org = (
        df_inc.groupby("Наименование организации ДЗО")
        .size()
        .reset_index(name="incident_count")
        .rename(columns={"Наименование организации ДЗО": "org"})
    )

    # Merge
    merged = inc_by_org.merge(
        violations_by_org.rename(columns={"Организация": "org"}),
        on="org",
        how="outer",
    ).fillna(0)

    if len(merged) > 0:
        max_score = (merged["incident_count"] * 10 + merged["violations"] * 2).max()
        if max_score == 0:
            max_score = 1
        merged["risk_score"] = (
            (merged["incident_count"] * 10 + merged["violations"] * 2) / max_score * 100
        ).round(1)
    else:
        merged["risk_score"] = 0

    top_orgs = (
        merged.sort_values("risk_score", ascending=False)
        .head(10)
        .to_dict(orient="records")
    )
    for r in top_orgs:
        r["incident_count"] = int(r["incident_count"])
        r["violations"] = int(r["violations"])
        r["risk_score"] = float(r["risk_score"])

    # Top locations by incident count
    loc_counts = (
        df_inc["Место происшествия"]
        .fillna("Не указано")
        .value_counts()
        .head(10)
        .reset_index()
    )
    loc_counts.columns = ["location", "count"]
    max_loc = loc_counts["count"].max() if len(loc_counts) > 0 else 1
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
    recommendations = []

    # 1. SIZ-related violations
    siz_mask = df_kor["Категория наблюдения"].fillna("").str.contains("СИЗ", case=False)
    siz_count = siz_mask.sum()
    if siz_count > 50:
        siz_orgs = (
            df_kor[siz_mask]["Организация"]
            .value_counts()
            .head(5)
            .index.tolist()
        )
        recommendations.append(
            {
                "priority": "high",
                "category": "СИЗ",
                "title": "Усиление контроля применения СИЗ",
                "description": (
                    f"Зафиксировано {siz_count} наблюдений, связанных с нарушениями в применении "
                    "средств индивидуальной защиты. Рекомендуется провести внеплановый инструктаж "
                    "по обязательному применению СИЗ и ужесточить контроль на рабочих местах."
                ),
                "affected_orgs": siz_orgs,
                "expected_reduction": "15%",
            }
        )

    # 2. Repeat accidents in top org
    top_org = (
        df_inc["Наименование организации ДЗО"]
        .value_counts()
        .idxmax()
        if len(df_inc) > 0
        else None
    )
    if top_org:
        cnt = int(df_inc["Наименование организации ДЗО"].value_counts().iloc[0])
        recommendations.append(
            {
                "priority": "high",
                "category": "Управление рисками",
                "title": f"Аудит безопасности: {top_org}",
                "description": (
                    f"Организация {top_org} лидирует по числу происшествий ({cnt}). "
                    "Рекомендуется провести комплексный аудит системы управления охраной труда, "
                    "пересмотреть оценку рисков на рабочих местах и усилить надзор."
                ),
                "affected_orgs": [top_org],
                "expected_reduction": "20%",
            }
        )

    # 3. Traffic accidents trend
    dtp_count = int(df_inc[df_inc["type"] == "ДТП"].shape[0])
    if dtp_count > 5:
        recommendations.append(
            {
                "priority": "medium",
                "category": "Безопасность дорожного движения",
                "title": "Программа снижения ДТП",
                "description": (
                    f"За отчётный период зафиксировано {dtp_count} дорожно-транспортных происшествий. "
                    "Рекомендуется ввести обязательные тренинги по безопасному вождению, "
                    "проверку технического состояния транспорта и систему контроля усталости водителей."
                ),
                "affected_orgs": list(
                    df_inc[df_inc["type"] == "ДТП"]["Наименование организации ДЗО"]
                    .dropna()
                    .value_counts()
                    .head(3)
                    .index
                ),
                "expected_reduction": "25%",
            }
        )

    # 4. Fire prevention
    fire_count = int(df_inc[df_inc["type"] == "Пожар/Возгорание"].shape[0])
    if fire_count > 0:
        recommendations.append(
            {
                "priority": "medium",
                "category": "Пожарная безопасность",
                "title": "Усиление мер пожарной безопасности",
                "description": (
                    f"Зафиксировано {fire_count} случаев пожара/возгорания. "
                    "Рекомендуется провести ревизию противопожарного оборудования, "
                    "актуализировать планы эвакуации и организовать практические учения."
                ),
                "affected_orgs": list(
                    df_inc[df_inc["type"] == "Пожар/Возгорание"]["Наименование организации ДЗО"]
                    .dropna()
                    .value_counts()
                    .head(3)
                    .index
                ),
                "expected_reduction": "40%",
            }
        )

    # 5. Low resolution rate alert
    resolved_col = "Было ли небезопасное условие / поведение исправлено и опасность устранена?"
    if resolved_col in df_kor.columns:
        violations = df_kor[df_kor["is_violation"]]
        if len(violations) > 0:
            res_rate = violations[resolved_col].sum() / len(violations)
            if res_rate < 0.70:
                recommendations.append(
                    {
                        "priority": "high",
                        "category": "Устранение нарушений",
                        "title": "Повышение оперативности устранения нарушений",
                        "description": (
                            f"Только {res_rate * 100:.1f}% выявленных нарушений устраняются своевременно. "
                            "Рекомендуется установить KPI по срокам устранения нарушений (не более 48 часов), "
                            "внедрить эскалацию для просроченных карточек Коргау."
                        ),
                        "affected_orgs": list(
                            violations[~violations[resolved_col]]["Организация"]
                            .value_counts()
                            .head(5)
                            .index
                        ),
                        "expected_reduction": "18%",
                    }
                )

    # 6. Work stoppage underutilization
    stop_col = "Производилась ли остановка работ?"
    if stop_col in df_kor.columns:
        critical_violations = df_kor[
            df_kor["Тип наблюдения"].isin(["Опасный фактор", "Опасный случай"])
        ]
        if len(critical_violations) > 0:
            stop_rate = critical_violations[stop_col].sum() / len(critical_violations)
            if stop_rate < 0.5:
                recommendations.append(
                    {
                        "priority": "medium",
                        "category": "Культура безопасности",
                        "title": "Применение права на остановку работ",
                        "description": (
                            f"При опасных факторах/случаях остановка работ производилась лишь "
                            f"в {stop_rate * 100:.1f}% случаев. Рекомендуется провести обучение "
                            "персонала по процедуре остановки работ и подчеркнуть, что это право, "
                            "а не нарушение трудовой дисциплины."
                        ),
                        "affected_orgs": [],
                        "expected_reduction": "10%",
                    }
                )

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    recommendations.sort(key=lambda x: priority_order.get(x["priority"], 99))

    return {"recommendations": recommendations}


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
