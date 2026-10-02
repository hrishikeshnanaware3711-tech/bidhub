import base64
import json
from datetime import datetime
from pathlib import Path

import httpx

from ..config import OLLAMA_BASE_URL, OLLAMA_MODEL


CATEGORIES = [
    "Pothole",
    "Damaged Road",
    "Street Light",
    "Garbage",
    "Water Leakage",
    "Fallen Tree",
    "Fire",
    "Vehicle Accident",
    "Medical Emergency",
    "Other",
]

DEPARTMENTS = [
    "Municipal Corporation",
    "Police Department",
    "Fire Department",
    "PWD (Roads)",
    "Tree Authority",
    "Medical Emergency",
]

FLAG_RULES = {
    "RED": "Fire or fire-related emergency",
    "GREEN": "Tree, environment, infrastructure, or general civic issue",
    "BLACK": "Vehicle accident or road collision",
    "BLUE": "Medical or person-in-danger emergency",
}

PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "suggested_category": {"type": "string"},
        "flag": {"type": "string", "enum": list(FLAG_RULES)},
        "suggested_priority": {"type": "string", "enum": PRIORITIES},
        "suggested_department": {"type": "string"},
        "summary": {"type": "string"},
        "reason": {"type": "string"},
        "emergency_risk": {"type": "boolean"},
    },
    "required": [
        "suggested_category",
        "flag",
        "suggested_priority",
        "suggested_department",
        "summary",
        "reason",
        "emergency_risk",
    ],
}

BRIEF_SCHEMA = {
    "type": "object",
    "properties": {
        "risk_level": {"type": "string", "enum": PRIORITIES},
        "response_actions": {
            "type": "array",
            "items": {"type": "string"},
        },
        "citizen_message": {"type": "string"},
        "admin_note": {"type": "string"},
        "tags": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": [
        "risk_level",
        "response_actions",
        "citizen_message",
        "admin_note",
        "tags",
    ],
}

CLOSURE_SCHEMA = {
    "type": "object",
    "properties": {
        "closure_title": {"type": "string"},
        "citizen_message": {"type": "string"},
        "resolution_summary": {"type": "string"},
        "follow_up_note": {"type": "string"},
    },
    "required": [
        "closure_title",
        "citizen_message",
        "resolution_summary",
        "follow_up_note",
    ],
}

TRANSLATE_SCHEMA = {
    "type": "object",
    "properties": {
        "translated_text": {"type": "string"},
    },
    "required": ["translated_text"],
}

QUESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "data_points": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["answer", "data_points"],
}

AREA_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "top_concerns": {"type": "array", "items": {"type": "string"}},
        "hotspots": {"type": "array", "items": {"type": "string"}},
        "recommended_focus": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "top_concerns", "hotspots", "recommended_focus"],
}

CLUSTERS_SCHEMA = {
    "type": "object",
    "properties": {
        "clusters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "issue_ids": {"type": "array", "items": {"type": "integer"}},
                    "summary": {"type": "string"},
                },
                "required": ["name", "issue_ids", "summary"],
            },
        }
    },
    "required": ["clusters"],
}


def _fallback_analysis(description: str, category: str) -> dict:
    text = f"{category} {description}".lower()

    if any(word in text for word in ("fire", "flame", "burning", "smoke", "explosion")):
        return {
            "suggested_category": "Fire",
            "flag": "RED",
            "suggested_priority": "CRITICAL",
            "suggested_department": "Fire Department",
            "summary": description[:500],
            "reason": "Fire-related keywords were detected by the local fallback rules.",
            "emergency_risk": True,
            "ai_status": "fallback",
        }

    if any(word in text for word in ("car accident", "bike accident", "vehicle accident", "collision", "crash")):
        return {
            "suggested_category": "Vehicle Accident",
            "flag": "BLACK",
            "suggested_priority": "HIGH",
            "suggested_department": "Police Department",
            "summary": description[:500],
            "reason": "Vehicle-accident keywords were detected by the local fallback rules.",
            "emergency_risk": True,
            "ai_status": "fallback",
        }

    if any(word in text for word in ("injury", "injured", "medical", "unconscious", "bleeding", "trapped", "ambulance")):
        return {
            "suggested_category": "Medical Emergency",
            "flag": "BLUE",
            "suggested_priority": "CRITICAL",
            "suggested_department": "Medical Emergency",
            "summary": description[:500],
            "reason": "Medical-risk keywords were detected by the local fallback rules.",
            "emergency_risk": True,
            "ai_status": "fallback",
        }

    if any(word in text for word in ("tree", "branch", "fallen tree")):
        return {
            "suggested_category": "Fallen Tree",
            "flag": "GREEN",
            "suggested_priority": "MEDIUM",
            "suggested_department": "Tree Authority",
            "summary": description[:500],
            "reason": "Tree-related keywords were detected by the local fallback rules.",
            "emergency_risk": False,
            "ai_status": "fallback",
        }

    guessed_category = category if category in CATEGORIES and category != "Auto Detect" else "Other"

    return {
        "suggested_category": guessed_category,
        "flag": "GREEN",
        "suggested_priority": "MEDIUM" if guessed_category != "Other" else "LOW",
        "suggested_department": "Municipal Corporation",
        "summary": description[:500],
        "reason": "Ollama was unavailable; the platform used a safe fallback classification.",
        "emergency_risk": False,
        "ai_status": "fallback",
    }


async def _ollama_is_available() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return response.is_success
    except Exception:
        return False


async def _call_ollama_json(
    prompt: str,
    schema: dict,
    image_path: str | None = None,
    timeout: float = 90.0,
) -> dict:
    message = {"role": "user", "content": prompt}

    if image_path:
        path = Path(image_path)
        if path.exists():
            message["images"] = [
                base64.b64encode(path.read_bytes()).decode("utf-8")
            ]

    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": schema,
        "options": {"temperature": 0},
        "messages": [
            {
                "role": "system",
                "content": "Return only valid data matching the supplied JSON schema.",
            },
            message,
        ],
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        content = data.get("message", {}).get("content", "{}")
        return json.loads(content)


async def analyze_report(description: str, category: str, image_path: str | None = None) -> dict:
    if not await _ollama_is_available():
        return _fallback_analysis(description, category)

    prompt = f"""
You are the incident analysis assistant for OneMap.

Analyze this civic report using the written description and, if attached, the image.

USER SELECTED CATEGORY:
{category}

DESCRIPTION:
{description}

Flags:
RED = {FLAG_RULES['RED']}
GREEN = {FLAG_RULES['GREEN']}
BLACK = {FLAG_RULES['BLACK']}
BLUE = {FLAG_RULES['BLUE']}

Allowed categories: {', '.join(CATEGORIES)}
Allowed departments: {', '.join(DEPARTMENTS)}
Allowed priorities: LOW, MEDIUM, HIGH, CRITICAL

Return a concise, structured suggestion.
Do not invent facts. Priority and emergency risk are suggestions for a human administrator.
"""

    try:
        result = await _call_ollama_json(prompt, ANALYSIS_SCHEMA, image_path=image_path)

        category_value = result.get("suggested_category", "Other")
        if category_value not in CATEGORIES:
            category_value = "Other"

        flag = str(result.get("flag", "GREEN")).upper()
        if flag not in FLAG_RULES:
            flag = "GREEN"

        priority = str(result.get("suggested_priority", "MEDIUM")).upper()
        if priority not in PRIORITIES:
            priority = "MEDIUM"

        department = result.get("suggested_department", "Municipal Corporation")
        if department not in DEPARTMENTS:
            department = "Municipal Corporation"

        return {
            "suggested_category": category_value,
            "flag": flag,
            "suggested_priority": priority,
            "suggested_department": department,
            "summary": str(result.get("summary", description[:500]))[:500],
            "reason": str(result.get("reason", "AI-generated suggestion."))[:700],
            "emergency_risk": bool(result.get("emergency_risk", False)),
            "ai_status": "ollama",
        }
    except Exception:
        return _fallback_analysis(description, category)


def _fallback_response_brief(category: str, description: str, flag: str, priority: str) -> dict:
    if flag == "RED":
        actions = [
            "Verify the location and reported fire conditions.",
            "Notify the appropriate fire-response team.",
            "Keep responders aware of access and scene conditions.",
        ]
        risk = "CRITICAL"
    elif flag == "BLACK":
        actions = [
            "Verify the incident location and traffic impact.",
            "Notify the appropriate police or traffic team.",
            "Check whether medical assistance is also required.",
        ]
        risk = "HIGH"
    elif flag == "BLUE":
        actions = [
            "Verify the reported location and immediate risk.",
            "Notify the appropriate medical response team.",
            "Treat the report as time-sensitive while details are confirmed.",
        ]
        risk = "CRITICAL"
    else:
        actions = [
            "Verify the location and reported condition.",
            "Assign the responsible civic department.",
            "Track the issue until field response is completed.",
        ]
        risk = priority if priority in PRIORITIES else "MEDIUM"

    return {
        "risk_level": risk,
        "response_actions": actions,
        "citizen_message": f"Your {category.lower()} report has been reviewed and is in the municipal response workflow.",
        "admin_note": "Fallback response brief generated because Ollama was unavailable.",
        "tags": [category, flag, priority],
        "ai_status": "fallback",
    }


async def generate_response_brief(
    category: str,
    description: str,
    flag: str,
    priority: str,
    status: str,
    ai_summary: str,
    image_path: str | None = None,
) -> dict:
    if not await _ollama_is_available():
        return _fallback_response_brief(category, description, flag, priority)

    prompt = f"""
Create a concise municipal response brief.

Category: {category}
Flag: {flag}
Priority: {priority}
Status: {status}
Description: {description}
AI summary: {ai_summary}

Provide high-level, non-dangerous administrative actions. Do not invent facts.
For emergencies, remind the user that direct emergency services should be used.
"""

    try:
        result = await _call_ollama_json(prompt, BRIEF_SCHEMA, image_path=image_path)
        risk = str(result.get("risk_level", priority)).upper()
        if risk not in PRIORITIES:
            risk = "MEDIUM"

        actions = [str(x)[:180] for x in result.get("response_actions", [])][:5]
        if not actions:
            return _fallback_response_brief(category, description, flag, priority)

        return {
            "risk_level": risk,
            "response_actions": actions,
            "citizen_message": str(result.get("citizen_message", "Your report is being processed."))[:400],
            "admin_note": str(result.get("admin_note", "AI-generated response brief."))[:500],
            "tags": [str(x)[:40] for x in result.get("tags", [])][:5],
            "ai_status": "ollama",
        }
    except Exception:
        return _fallback_response_brief(category, description, flag, priority)


def _fallback_closure(category: str, description: str) -> dict:
    return {
        "closure_title": f"{category} report resolved",
        "citizen_message": f"Your {category.lower()} report has been marked resolved by the municipal response team.",
        "resolution_summary": "The incident has completed the platform's response workflow and is now recorded as resolved.",
        "follow_up_note": "Contact the platform again if the issue appears again or the condition was not fully addressed.",
        "ai_status": "fallback",
    }


async def generate_closure_message(
    category: str,
    description: str,
    priority: str,
    flag: str,
    resolved_at: datetime | None,
) -> dict:
    if not await _ollama_is_available():
        return _fallback_closure(category, description)

    resolved_text = resolved_at.isoformat() if resolved_at else "recorded as resolved"

    prompt = f"""
Generate a short citizen-friendly resolution message for a municipal incident.

Category: {category}
Flag: {flag}
Priority: {priority}
Original report: {description}
Resolved timestamp: {resolved_text}

Do not invent a specific repair action because the database does not record it.
Do not claim physical work that is not stated.
"""

    try:
        result = await _call_ollama_json(prompt, CLOSURE_SCHEMA)
        return {
            "closure_title": str(result.get("closure_title", f"{category} report resolved"))[:120],
            "citizen_message": str(result.get("citizen_message", "Your report has been marked resolved."))[:400],
            "resolution_summary": str(result.get("resolution_summary", "The report is now resolved."))[:500],
            "follow_up_note": str(result.get("follow_up_note", "Contact the platform again if the issue continues."))[:500],
            "ai_status": "ollama",
        }
    except Exception:
        return _fallback_closure(category, description)


async def translate_text(text: str, target_language: str) -> dict:
    if not await _ollama_is_available():
        return {
            "target_language": target_language,
            "translated_text": text,
            "ai_status": "fallback",
        }

    prompt = f"""
Translate the following civic incident text into {target_language}.
Preserve the meaning, urgency, quantities, locations and incident terminology.
Return only the translated text.

TEXT:
{text}
"""

    try:
        result = await _call_ollama_json(prompt, TRANSLATE_SCHEMA)
        return {
            "target_language": target_language,
            "translated_text": str(result.get("translated_text", text))[:1200],
            "ai_status": "ollama",
        }
    except Exception:
        return {
            "target_language": target_language,
            "translated_text": text,
            "ai_status": "fallback",
        }


async def answer_admin_question(question: str, context: str) -> dict:
    if not await _ollama_is_available():
        return {
            "answer": "Ollama is unavailable. Use the dashboard filters and statistics for the current data.",
            "data_points": [],
            "ai_status": "fallback",
        }

    prompt = f"""
You are the OneMap administrative civic assistant.
Answer the administrator's question using ONLY the supplied live database context.
Do not invent counts, locations, departments or incidents.
If the context does not contain enough information, say so.

ADMIN QUESTION:
{question}

LIVE DATABASE CONTEXT:
{context}
"""

    try:
        result = await _call_ollama_json(prompt, QUESTION_SCHEMA)
        return {
            "answer": str(result.get("answer", "The supplied data is insufficient."))[:1000],
            "data_points": [str(x)[:180] for x in result.get("data_points", [])][:8],
            "ai_status": "ollama",
        }
    except Exception:
        return {
            "answer": "I could not generate an AI answer. Use the dashboard statistics directly.",
            "data_points": [],
            "ai_status": "fallback",
        }


async def generate_area_brief(area_label: str, context: str) -> dict:
    if not await _ollama_is_available():
        return {
            "area_label": area_label,
            "summary": "Ollama is unavailable; review the incident map and filters for this area.",
            "top_concerns": [],
            "hotspots": [],
            "recommended_focus": [],
            "ai_status": "fallback",
        }

    prompt = f"""
Prepare a concise situation brief for the area named: {area_label}.
Use only the supplied incident data.

DATA:
{context}

Identify major concerns, repeated locations or patterns visible in the data, and high-level administrative focus areas.
Do not invent exact geography that is not in the data.
"""

    try:
        result = await _call_ollama_json(prompt, AREA_SCHEMA)
        return {
            "area_label": area_label,
            "summary": str(result.get("summary", "No summary."))[:700],
            "top_concerns": [str(x)[:180] for x in result.get("top_concerns", [])][:6],
            "hotspots": [str(x)[:180] for x in result.get("hotspots", [])][:6],
            "recommended_focus": [str(x)[:180] for x in result.get("recommended_focus", [])][:6],
            "ai_status": "ollama",
        }
    except Exception:
        return {
            "area_label": area_label,
            "summary": "AI area brief could not be generated.",
            "top_concerns": [],
            "hotspots": [],
            "recommended_focus": [],
            "ai_status": "fallback",
        }


async def cluster_incidents(context: str) -> dict:
    if not await _ollama_is_available():
        return {"clusters": [], "ai_status": "fallback"}

    prompt = f"""
Group the supplied active civic incidents into 2-6 useful thematic clusters.
Use only issue IDs present in the supplied data.
A cluster can be based on incident type, operational concern, or repeated problem pattern.
Do not fabricate issue IDs.

DATA:
{context}
"""

    try:
        result = await _call_ollama_json(prompt, CLUSTERS_SCHEMA)
        clusters = []
        valid_ids = set()

        for raw in result.get("clusters", []):
            ids = []
            for value in raw.get("issue_ids", []):
                try:
                    issue_id = int(value)
                except (TypeError, ValueError):
                    continue
                if issue_id in valid_ids:
                    continue
                ids.append(issue_id)

            if ids:
                valid_ids.update(ids)
                clusters.append({
                    "name": str(raw.get("name", "Incident cluster"))[:100],
                    "issue_ids": ids,
                    "summary": str(raw.get("summary", ""))[:300],
                })

        return {"clusters": clusters[:6], "ai_status": "ollama"}
    except Exception:
        return {"clusters": [], "ai_status": "fallback"}
