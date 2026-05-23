import re
from typing import TypedDict


LEVEL_PATTERN = re.compile(
    r"^(?P<timestamp>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[\w.+-]*)?\s*"
    r"(?P<level>DEBUG|INFO|WARNING|WARN|ERROR|CRITICAL|FATAL)\b",
    re.IGNORECASE,
)


class LogLine(TypedDict):
    line_number: int
    level: str
    raw: str


class ParseResult(TypedDict):
    total_lines: int
    entries: list[LogLine]
    summary: dict[str, int]
    errors: list[LogLine]
    warnings: list[LogLine]


def parse_log(content: str) -> ParseResult:
    entries: list[LogLine] = []
    summary: dict[str, int] = {"DEBUG": 0, "INFO": 0, "WARNING": 0, "ERROR": 0, "CRITICAL": 0, "UNKNOWN": 0}

    lines = content.splitlines()
    for i, raw in enumerate(lines, start=1):
        stripped = raw.strip()
        if not stripped:
            continue

        match = LEVEL_PATTERN.search(stripped)
        if match:
            level = match.group("level").upper()
            if level == "WARN":
                level = "WARNING"
            if level == "FATAL":
                level = "CRITICAL"
        else:
            level = "UNKNOWN"

        # Keep summary keys bounded
        key = level if level in summary else "UNKNOWN"
        summary[key] += 1

        entries.append(LogLine(line_number=i, level=level, raw=stripped))

    errors = [e for e in entries if e["level"] == "ERROR"]
    warnings = [e for e in entries if e["level"] == "WARNING"]

    return ParseResult(
        total_lines=len(lines),
        entries=entries,
        summary=summary,
        errors=errors,
        warnings=warnings,
    )
