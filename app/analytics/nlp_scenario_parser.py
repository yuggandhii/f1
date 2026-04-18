"""
app/analytics/nlp_scenario_parser.py — Natural-language → scenario dict via Ollama.

Model chain: tries gemma3 → gemma2 → mistral in order (first available wins).
Falls back to a regex-based heuristic parser if Ollama is unavailable.
"""
from __future__ import annotations

import json
import logging
import re

import httpx

_log = logging.getLogger(__name__)

_OLLAMA_BASE = "http://localhost:11434"
_MODEL_CHAIN = ["gemma3", "gemma2", "mistral"]

# Known driver slugs (extend as needed)
_DRIVER_SLUGS: dict[str, str] = {
    "verstappen": "max_verstappen",
    "max": "max_verstappen",
    "hamilton": "lewis_hamilton",
    "lewis": "lewis_hamilton",
    "leclerc": "charles_leclerc",
    "charles": "charles_leclerc",
    "sainz": "carlos_sainz",
    "carlos": "carlos_sainz",
    "norris": "lando_norris",
    "lando": "lando_norris",
    "perez": "sergio_perez",
    "checo": "sergio_perez",
    "russell": "george_russell",
    "george": "george_russell",
    "alonso": "fernando_alonso",
    "fernando": "fernando_alonso",
    "albon": "alexander_albon",
    "stroll": "lance_stroll",
    "bottas": "valtteri_bottas",
    "zhou": "guanyu_zhou",
    "tsunoda": "yuki_tsunoda",
    "gasly": "pierre_gasly",
    "ocon": "esteban_ocon",
    "hulkenberg": "nico_hulkenberg",
    "magnussen": "kevin_magnussen",
    "kevin": "kevin_magnussen",
    "piastri": "oscar_piastri",
    "oscar": "oscar_piastri",
    "bearman": "oliver_bearman",
    "lawson": "liam_lawson",
    "doohan": "jack_doohan",
    "antonelli": "kimi_antonelli",
}

# Known team slugs
_TEAM_SLUGS: dict[str, str] = {
    "red bull": "red_bull",
    "redbull": "red_bull",
    "ferrari": "ferrari",
    "mercedes": "mercedes",
    "mclaren": "mclaren",
    "aston martin": "aston_martin",
    "aston": "aston_martin",
    "alpine": "alpine",
    "williams": "williams",
    "haas": "haas",
    "alphatauri": "alphatauri",
    "rb": "rb",
    "sauber": "sauber",
    "kick sauber": "sauber",
    "alfa romeo": "alfa",
}

_SYSTEM_PROMPT = """
You are an F1 scenario parser. Convert a user's natural language query into a
JSON scenario object for the F1 Monte Carlo simulator.

Supported scenario types and their required fields:

1. DRIVER_SWAP — move a driver to a different team
   {"type": "DRIVER_SWAP", "driver_id": "<snake_case>", "to_team": "<constructor_slug>"}

2. RELIABILITY_FIX — eliminate mechanical failures for a team
   {"type": "RELIABILITY_FIX", "team": "<constructor_slug>", "mechanical_dnf_rate": 0.01}

3. REMOVE_DRIVER — remove a driver from the season
   {"type": "REMOVE_DRIVER", "driver_id": "<snake_case>"}

4. WEATHER_CHANGE — force weather at circuits
   {"type": "WEATHER_CHANGE", "weather": "wet|dry|mixed", "circuits": ["<circuit_ref>", ...]}
   (omit "circuits" for all races)

5. TEAM_ORDERS_FREE — both teammates get equal car development
   {"type": "TEAM_ORDERS_FREE", "team": "<constructor_slug>"}

6. REMAINING_SEASON — simulate remaining races from current standings
   {"type": "REMAINING_SEASON", "current_round": <int>, "current_standings": {}}

Driver snake_case IDs: max_verstappen, lewis_hamilton, charles_leclerc, carlos_sainz,
lando_norris, sergio_perez, george_russell, fernando_alonso, oscar_piastri, etc.

Constructor slugs: red_bull, ferrari, mercedes, mclaren, aston_martin, alpine,
williams, haas, alphatauri, rb, sauber, alfa.

Respond with ONLY a valid JSON object, no explanation or markdown.
""".strip()


async def parse_scenario_nlp(prompt: str) -> dict:
    """
    Parse a natural-language prompt into a scenario dict.

    Tries Ollama (gemma3 → gemma2 → mistral) first; falls back to
    regex heuristics if Ollama is unavailable.

    Returns a scenario dict suitable for apply_scenario().
    """
    ollama_result = await _try_ollama(prompt)
    if ollama_result is not None:
        return ollama_result

    _log.warning("Ollama unavailable — falling back to regex heuristic parser")
    return _heuristic_parse(prompt)


async def _try_ollama(prompt: str) -> dict | None:
    """Attempt to parse via Ollama model chain. Returns None on any failure."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in _MODEL_CHAIN:
            try:
                resp = await client.post(
                    f"{_OLLAMA_BASE}/api/generate",
                    json={
                        "model": model,
                        "prompt": f"{_SYSTEM_PROMPT}\n\nUser: {prompt}",
                        "stream": False,
                    },
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                raw = data.get("response", "").strip()
                # Strip markdown code fences if present
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw.strip())
                parsed = json.loads(raw)
                if isinstance(parsed, dict) and "type" in parsed:
                    _log.info("NLP parsed via model %s: %s", model, parsed.get("type"))
                    return parsed
            except (httpx.ConnectError, httpx.ConnectTimeout):
                return None
            except Exception as exc:
                _log.debug("Ollama model %s failed: %s", model, exc)
                continue
    return None


def _heuristic_parse(prompt: str) -> dict:
    """
    Regex-based fallback parser for common scenario patterns.
    Handles the most common natural language forms.
    """
    p = prompt.lower()

    # DRIVER_SWAP: "what if X drove for Y" / "X to Y" / "X at Y"
    swap_patterns = [
        r"(?:what if\s+)?(\w+)\s+(?:drove for|was at|moved to|joined|at)\s+(.+?)(?:\?|$|in \d{4})",
        r"put\s+(\w+)\s+(?:in|at|with)\s+(.+?)(?:\?|$)",
        r"(\w+)\s+to\s+(.+?)(?:\?|$| in)",
    ]
    for pat in swap_patterns:
        m = re.search(pat, p)
        if m:
            driver = _resolve_driver(m.group(1))
            team = _resolve_team(m.group(2).strip())
            if driver and team:
                return {"type": "DRIVER_SWAP", "driver_id": driver, "to_team": team}

    # RELIABILITY_FIX: "fixed reliability" / "no reliability issues" / "had fixed"
    if re.search(r"reliabilit", p) and re.search(r"fix|no |without|zero|had|resolve", p):
        for slug, con in _TEAM_SLUGS.items():
            if slug in p:
                return {"type": "RELIABILITY_FIX", "team": con}

    # REMOVE_DRIVER: "without X" / "if X retired" / "X was absent"
    if re.search(r"without|retired|absent|banned|injured", p):
        for slug, driver_id in _DRIVER_SLUGS.items():
            if re.search(rf"\b{slug}\b", p):
                return {"type": "REMOVE_DRIVER", "driver_id": driver_id}

    # WEATHER_CHANGE: "monaco was wet" / "all races wet" / "wet race at X"
    w_match = re.search(r"(wet|dry|mixed)", p)
    if w_match and re.search(r"weather|race|circuit|was|always|if|condition|at\s+\w", p):
        weather = w_match.group(1)
        circuits: list[str] = []
        for circuit in ["monaco", "silverstone", "monza", "spa", "bahrain", "suzuka",
                        "interlagos", "suzuka", "singapore", "australia"]:
            if circuit in p:
                circuits.append(circuit)
        result: dict = {"type": "WEATHER_CHANGE", "weather": weather}
        if circuits:
            result["circuits"] = circuits
        return result

    # TEAM_ORDERS_FREE: "equal machinery" / "team orders" / "both X drivers"
    if re.search(r"equal|same car|team orders free|both drivers", p):
        for slug, con in _TEAM_SLUGS.items():
            if slug in p:
                return {"type": "TEAM_ORDERS_FREE", "team": con}

    # Default: try to extract a driver swap as a best guess
    for slug, driver_id in _DRIVER_SLUGS.items():
        if re.search(rf"\b{slug}\b", p):
            return {
                "type": "REMOVE_DRIVER",
                "driver_id": driver_id,
                "_heuristic_note": "fallback — could not determine scenario type",
            }

    return {
        "type": "UNKNOWN",
        "raw_prompt": prompt,
        "error": "Could not parse scenario from prompt",
    }


def _resolve_driver(word: str) -> str | None:
    word = word.lower().strip()
    return _DRIVER_SLUGS.get(word)


def _resolve_team(phrase: str) -> str | None:
    phrase = phrase.lower().strip()
    # Direct match
    if phrase in _TEAM_SLUGS:
        return _TEAM_SLUGS[phrase]
    # Partial match
    for slug, con in _TEAM_SLUGS.items():
        if slug in phrase or phrase in slug:
            return con
    return None
