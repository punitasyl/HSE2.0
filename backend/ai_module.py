"""
AI module placeholder.
In production this would call the Anthropic Claude API for
natural-language summaries and recommendations.
For now it provides template-based smart text generation.
"""

from typing import Any


def generate_summary_text(data: dict[str, Any]) -> str:
    total = data.get("total", 0)
    by_type = data.get("by_type", {})
    top_type = max(by_type, key=lambda k: by_type[k]) if by_type else "—"
    return (
        f"За отчётный период зафиксировано {total} происшествий. "
        f"Наиболее частый тип: {top_type} ({by_type.get(top_type, 0)} случаев). "
        "Система рекомендует уделить особое внимание выявленным зонам риска."
    )


def generate_recommendation_description(category: str, count: int, orgs: list[str]) -> str:
    org_str = ", ".join(orgs[:3]) if orgs else "ряд организаций"
    templates = {
        "СИЗ": (
            f"Выявлено {count} нарушений, связанных со средствами индивидуальной защиты "
            f"в организациях: {org_str}. "
            "Рекомендуется провести внеплановый инструктаж и усилить надзор."
        ),
        "Управление рисками": (
            f"В {org_str} зафиксировано {count} происшествий. "
            "Требуется комплексный аудит системы управления рисками."
        ),
    }
    return templates.get(
        category,
        f"Зафиксировано {count} случаев категории '{category}' в {org_str}. "
        "Требуются корректирующие мероприятия.",
    )
