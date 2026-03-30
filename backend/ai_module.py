"""
AI module — generates HSE recommendations via:
  1. OpenAI API (if OPENAI_API_KEY is set)
  2. Ollama Llama 3.2 (local fallback, requires `ollama serve` running)
"""

import json
import os
import urllib.error
import urllib.request
from typing import Any

SYSTEM_PROMPT = """Ты — эксперт по охране труда и промышленной безопасности (ОТиПБ) на нефтегазовых предприятиях Казахстана.
На основе предоставленной статистики по инцидентам и нарушениям сформируй конкретные, actionable рекомендации для снижения рисков.

Ответь строго в формате JSON-массива (без markdown-блоков, только чистый JSON), где каждый элемент:
{
  "priority": "high" | "medium" | "low",
  "category": "<краткая категория на русском>",
  "title": "<заголовок рекомендации>",
  "description": "<подробное описание с конкретными мероприятиями, 2-4 предложения>",
  "affected_orgs": ["<org1>", "<org2>"],
  "expected_reduction": "<N%>",
  "timeline": "немедленно" | "30 дней" | "90 дней" | "6 месяцев",
  "steps": ["<конкретный шаг 1>", "<конкретный шаг 2>", "<конкретный шаг 3>"]
}

Правила:
- Сформируй 5-7 рекомендаций на основе данных
- Используй реальные названия организаций из статистики
- expected_reduction — обоснованный % снижения инцидентов при выполнении рекомендации
- Приоритет high = немедленные действия, medium = плановые, low = долгосрочные
- Описания — конкретные мероприятия, не общие фразы
- steps — 3-4 конкретных последовательных действия (не общие слова)
- timeline соответствует приоритету: high→немедленно или 30 дней, low→6 месяцев
"""

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_summary_text(data: dict[str, Any]) -> str:
    total = data.get("total", 0)
    by_type = data.get("by_type", {})
    top_type = max(by_type, key=lambda k: by_type[k]) if by_type else "—"
    return (
        f"За отчётный период зафиксировано {total} происшествий. "
        f"Наиболее частый тип: {top_type} ({by_type.get(top_type, 0)} случаев). "
        "Система рекомендует уделить особое внимание выявленным зонам риска."
    )


def build_context(stats: dict[str, Any]) -> str:
    lines = []

    inc = stats.get("incidents", {})
    if inc:
        lines.append(f"Всего происшествий: {inc.get('total', 0)}")
        by_type = inc.get("by_type", {})
        if by_type:
            lines.append("Распределение по типам: " + ", ".join(f"{k}: {v}" for k, v in by_type.items()))
        top_orgs = inc.get("top_orgs", [])
        if top_orgs:
            lines.append("Топ организаций по числу происшествий: " + ", ".join(
                f"{o['org']} ({o['count']})" for o in top_orgs[:5]
            ))

    kor = stats.get("korgau", {})
    if kor:
        lines.append(f"Карточек Коргау всего: {kor.get('total', 0)}, нарушений: {kor.get('violations', 0)}")
        res_rate = kor.get("resolution_rate")
        if res_rate is not None:
            lines.append(f"Процент устранённых нарушений: {res_rate:.1f}%")
        stop_rate = kor.get("stop_rate")
        if stop_rate is not None:
            lines.append(f"Остановка работ при опасных факторах: {stop_rate:.1f}%")
        top_cats = kor.get("top_categories", [])
        if top_cats:
            lines.append("Топ категорий нарушений: " + ", ".join(
                f"{c['category']} ({c['count']})" for c in top_cats[:5]
            ))
        top_kor_orgs = kor.get("top_orgs", [])
        if top_kor_orgs:
            lines.append("Организации с наибольшим числом нарушений: " + ", ".join(
                f"{o['org']} ({o['count']})" for o in top_kor_orgs[:5]
            ))

    return "\n".join(lines)


def _parse_recommendations(raw: str, model_name: str) -> list[dict]:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    recommendations = json.loads(raw)
    if not isinstance(recommendations, list):
        raise ValueError(f"Expected JSON array from {model_name}")

    valid = []
    for r in recommendations:
        valid.append({
            "priority": r.get("priority", "medium"),
            "category": r.get("category", "Общее"),
            "title": r.get("title", ""),
            "description": r.get("description", ""),
            "affected_orgs": r.get("affected_orgs", []),
            "expected_reduction": r.get("expected_reduction", "10%"),
            "timeline": r.get("timeline", "30 дней"),
            "steps": r.get("steps", []),
            "ai_generated": True,
            "model": model_name,
        })
    return valid


# ---------------------------------------------------------------------------
# Backends
# ---------------------------------------------------------------------------

def _call_openai(context: str) -> list[dict]:
    from openai import OpenAI  # lazy import

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Статистика ОТиПБ:\n\n{context}\n\nСформируй рекомендации."},
        ],
        temperature=0.3,
        max_tokens=2048,
    )
    text = response.choices[0].message.content or ""
    return _parse_recommendations(text, OPENAI_MODEL)


def _call_ollama(context: str) -> list[dict]:
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Статистика ОТиПБ:\n\n{context}\n\nСформируй рекомендации."},
        ],
        "stream": False,
        "options": {"temperature": 0.3},
    }).encode()

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except urllib.error.URLError as e:
        raise ConnectionError(f"Ollama недоступен ({OLLAMA_URL}): {e}") from e

    text = data["message"]["content"]
    return _parse_recommendations(text, f"Ollama/{OLLAMA_MODEL}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_ai_recommendations(stats: dict[str, Any]) -> list[dict]:
    """
    Generate recommendations using available AI backend:
    - OpenAI API if OPENAI_API_KEY is set (falls back to Ollama on any error)
    - Ollama (llama3.2) if no key or OpenAI fails
    """
    context = build_context(stats)
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if api_key:
        try:
            return _call_openai(context)
        except Exception as e:
            print(f"[ai_module] OpenAI failed ({e}), falling back to Ollama")

    return _call_ollama(context)


def active_backend() -> str:
    return "openai" if os.environ.get("OPENAI_API_KEY", "").strip() else "ollama"
