#!/usr/bin/env python3
"""Convert DEPARTMENT_ARCHITECTURE ASCII blocks to Mermaid or Markdown tables."""

from __future__ import annotations

import re
from pathlib import Path

BOX = set("┌┐└┘├┤┬┴─│▼")


def fix_glued_fences(text: str) -> str:
    text = re.sub(r"```(#{1,3}\s)", r"```\n\n\1", text)
    text = re.sub(r"(#{1,3}[^\n]+)```", r"\1\n\n```", text)
    return text


def table_from_block(block: str) -> str | None:
    rows = []
    for line in block.splitlines():
        if "│" not in line or not any(c in line for c in "├┼┬┴"):
            if "│" in line:
                parts = [p.strip() for p in line.split("│") if p.strip()]
                if parts:
                    rows.append(parts)
            continue
        if "├" in line and ("┼" in line or "┬" in line):
            continue
        if "│" in line:
            parts = [p.strip() for p in line.split("│") if p.strip()]
            if parts:
                rows.append(parts)
    if len(rows) < 2:
        return None
    w = {len(r) for r in rows}
    if len(w) != 1:
        return None
    h, *body = rows
    n = len(h)
    out = ["| " + " | ".join(h) + " |", "| " + " | ".join(["---"] * n) + " |"]
    for r in body:
        if len(r) != n:
            return None
        out.append("| " + " | ".join(r) + " |")
    return "\n".join(out)


def is_er_block(block: str) -> bool:
    return "──" in block or "▶" in block or "1:N" in block


def er_to_mermaid(block: str) -> str:
    rels = [
        ("Tenant", "Department", "||--o{"),
        ("Tenant", "User", "||--o{"),
        ("Department", "Department", "o--o|"),
        ("User", "UserDepartment", "||--o{"),
        ("Department", "UserDepartment", "||--o{"),
        ("User", "Activity", "||--o{"),
        ("User", "UserRole", "||--o{"),
    ]
    lines = ["```mermaid", "erDiagram"]
    for a, b, r in rels:
        if a in block or b in block:
            lines.append(f"  {a} {r} {b} : rel")
    lines.append("```")
    return "\n".join(lines)


def hierarchy_mermaid() -> str:
    return """```mermaid
flowchart TB
  GO[GLOBAL_OWNER]
  GO --> T1[TENANT 1 City]
  GO --> T2[TENANT 2 Company]
  GO --> TN[TENANT N School]
  T1 --> T1D[Departments · Moderators · Users · Sponsor]
  T2 --> T2D[Departments · Moderators · Users · Sponsor]
  TN --> TND[Departments · Moderators · Users · Sponsor]
```"""


def nested_dept_mermaid() -> str:
    return """```mermaid
flowchart TB
  T[Tenant Acme Corp]
  T --> IT[IT]
  IT --> BE[Backend Team]
  IT --> FE[Frontend Team]
  IT --> DO[DevOps]
  T --> HR[HR]
  T --> SL[Sales]
  SL --> EN[Enterprise]
  SL --> SMB[SMB]
```"""


def info_flow(title: str, steps: list[str]) -> str:
    lines = ["```mermaid", "flowchart TB"]
    for i, s in enumerate(steps):
        sid = f"N{i}"
        lines.append(f'  {sid}["{s.replace(chr(34), chr(39))}"]')
    for i in range(len(steps) - 1):
        lines.append(f"  N{i} --> N{i+1}")
    lines.append("```")
    return "\n".join(lines)


REPLACEMENTS: list[tuple[str, str]] = [
    ("### 1.1.", hierarchy_mermaid()),
    ("### 1.2.", None),  # table handled generically
    ("### 1.3.", nested_dept_mermaid()),
]


def convert_block(block: str) -> str | None:
    if "GLOBAL_OWNER" in block and "TENANT 1" in block:
        return hierarchy_mermaid()
    if 'Tenant: Firma "Acme Corp"' in block or "Tenant: Firma" in block:
        return nested_dept_mermaid()
    if is_er_block(block) and "Department" in block:
        return er_to_mermaid(block)
    if "ZERO-DOWNTIME" in block or "ZASADY MIGRACJI" in block:
        return info_flow(
            "migration",
            [
                "ADDITIVE ONLY",
                "ZERO-DOWNTIME",
                "BACKWARD-COMPATIBLE",
                "FEATURE FLAG",
                "ROLLBACK",
            ],
        )
    if "TenantRLSMiddleware" in block and "app.user_department" in block:
        return """```mermaid
flowchart TB
  LOGIN[User login] --> DEPT[Load user departments]
  DEPT --> SET1[SET app.user_department_id]
  DEPT --> SET2[SET app.user_departments JSON]
  SET2 --> RLS[RLS policies filter data]
```"""
    if "RYZYKA" in block:
        t = table_from_block(block)
        return t
    tbl = table_from_block(block)
    if tbl and ("┬" in block or "┼" in block):
        return tbl
    if "Flow:" in block or "→" in block:
        steps = []
        for line in block.splitlines():
            if "│" in line:
                t = " ".join(p.strip() for p in line.split("│") if p.strip())
                if t and not t.startswith("─") and "──" not in t[:3]:
                    if re.match(r"^\d+\.", t) or "→" in t:
                        steps.append(t[:100])
        if len(steps) >= 2:
            return info_flow("flow", steps)
    # Model schema boxes → table
    if "DEPARTMENT" in block and "UUID" in block:
        return table_from_block(block) or None
    if "USERDEPARTMENT" in block or "ACTIVITY (rozszerzenie)" in block:
        return table_from_block(block) or None
    if "NOWE KOMPONENTY" in block or "ROZSZERZENIE ISTNIEJĄCYCH" in block:
        items = []
        for line in block.splitlines():
            if "│" in line and (".tsx" in line or ".ts" in line or "modules/" in line):
                t = " ".join(p.strip() for p in line.split("│") if p.strip())
                if t and "├" not in t[:2]:
                    items.append(f"- {t}")
        if items:
            return "\n".join(items[:20])
    if "Faza" in block and "[1." in block:
        return table_from_block(block)
    return None


def process(path: Path) -> int:
    text = fix_glued_fences(path.read_text(encoding="utf-8"))
    n = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal n
        body = m.group(1)
        if not any(c in body for c in BOX):
            return m.group(0)
        new = convert_block(body)
        if not new:
            return m.group(0)
        n += 1
        return new + "\n"

    text = re.sub(r"```\n(.*?)```", repl, text, flags=re.DOTALL)
    path.write_text(text, encoding="utf-8")
    return n


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    total = 0
    for name in ("docs/DEPARTMENT_ARCHITECTURE.md", "docs/pl/DEPARTMENT_ARCHITECTURE.md"):
        p = root / name
        c = process(p)
        print(f"{name}: {c}")
        total += c
    print(f"total: {total}")
