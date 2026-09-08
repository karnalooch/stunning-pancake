#!/usr/bin/env python3
"""Emulator UI walkthrough — reliable adb navigation + screenshots + report."""

from __future__ import annotations

import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date
from io import BytesIO
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
ADB = ["adb", "-s", "emulator-5554"]
DATE = date.today().isoformat()
OUT_DIR = REPO / "docs" / "design" / "screenshots" / f"{DATE}-emulator-audit"
REPORT = REPO / "docs" / "design" / f"MOBILE_EMULATOR_UI_AUDIT_{DATE}.md"
ACTIVITY = "com.sport.athlete/.MainActivity"

TABS = {
    "jazda": (170, 2282),
    "rywalizacja": (422, 2282),
    "odkrywaj": (668, 2282),
    "profil": (915, 2282),
}


@dataclass
class Step:
    id: str
    title: str
    screenshot: str = ""
    visible: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    status: str = "ok"


steps: list[Step] = []


def run(cmd: list[str], timeout: int = 45) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, encoding="utf-8", errors="replace")


def adb(*args: str) -> None:
    return run(ADB + list(args), timeout=60)


def sleep(sec: float = 2.0) -> None:
    time.sleep(sec)


def foreground_app() -> None:
    adb("shell", "am", "start", "-n", ACTIVITY)
    sleep(2.5)


def screencap(step_id: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    local = OUT_DIR / f"{step_id}.png"
    r = subprocess.run(ADB + ["exec-out", "screencap", "-p"], capture_output=True, timeout=30)
    if r.returncode != 0 or not r.stdout or len(r.stdout) < 50_000:
        return local
    local.write_bytes(r.stdout)
    return local


def dump_ui() -> ET.Element | None:
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    tmp = OUT_DIR / "_ui.xml"
    if tmp.exists():
        tmp.unlink()
    r = run(ADB + ["pull", "/sdcard/ui.xml", str(tmp)], timeout=20)
    if r.returncode != 0 or not tmp.exists():
        return None
    return ET.parse(tmp).getroot()


def visible_texts(root: ET.Element | None, limit: int = 25) -> list[str]:
    if root is None:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for n in root.iter("node"):
        if n.attrib.get("package") != "com.sport.athlete":
            continue
        t = (n.attrib.get("text") or n.attrib.get("content-desc") or "").strip()
        if not t or t in seen or len(t) > 80:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= limit:
            break
    return out


def find_bounds(root: ET.Element | None, pattern: str) -> tuple[int, int] | None:
    if root is None:
        return None
    rx = re.compile(pattern, re.I)
    for n in root.iter("node"):
        if n.attrib.get("package") != "com.sport.athlete":
            continue
        t = (n.attrib.get("text") or n.attrib.get("content-desc") or "").strip()
        rid = n.attrib.get("resource-id") or ""
        if (not t or not rx.search(t)) and not rx.search(rid):
            continue
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", n.attrib.get("bounds", ""))
        if not m:
            continue
        x1, y1, x2, y2 = map(int, m.groups())
        return (x1 + x2) // 2, (y1 + y2) // 2
    return None


def tap(x: int, y: int) -> None:
    adb("shell", "input", "tap", str(x), str(y))


def swipe(x1: int, y1: int, x2: int, y2: int, ms: int = 450) -> None:
    adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(ms))


def tap_tab(name: str) -> None:
    x, y = TABS[name]
    foreground_app()
    tap(x, y)
    sleep()


def capture_raw(step_id: str, title: str, notes: list[str] | None = None, status: str = "ok") -> None:
    foreground_app()
    texts = visible_texts(dump_ui())
    shot = screencap(step_id)
    extra = notes or []
    if not shot.exists() or shot.stat().st_size < 50_000:
        status = "fail" if status == "ok" else status
        extra.append("Plik PNG zbyt mały")
    steps.append(
        Step(
            id=step_id,
            title=title,
            screenshot=shot.name,
            visible=texts,
            notes=extra,
            status=status,
        )
    )
    print(f"[{status}] {step_id}: {title} (raw)")


def capture(step_id: str, title: str, notes: list[str] | None = None, status: str = "ok") -> None:
    foreground_app()
    img = screencap_image()
    texts = visible_texts(dump_ui())
    shot = screencap(step_id)
    kind = classify_capture(img)
    extra = notes or []
    if kind == "onboarding":
        status = "fail"
        extra.append("Zrzut pokazuje OnboardingScreen zamiast docelowego ekranu")
    elif kind == "system_settings":
        status = "fail"
        extra.append("Zrzut pokazuje systemowe ustawienia Androida, nie aplikację")
    elif kind == "blank":
        status = "fail"
        extra.append("Pusty ekran aplikacji")
    elif kind == "empty":
        status = "fail"
        extra.append("Zrzut pusty lub aplikacja nie na pierwszym planie")
    elif not shot.exists() or shot.stat().st_size < 50_000:
        status = "fail" if status == "ok" else status
        extra.append("Plik PNG zbyt mały")
    steps.append(
        Step(
            id=step_id,
            title=title,
            screenshot=shot.name,
            visible=texts,
            notes=extra,
            status=status,
        )
    )
    print(f"[{status}] {step_id}: {title} ({kind})")


def tap_pattern(pattern: str, fallback: tuple[int, int] | None = None) -> bool:
    root = dump_ui()
    pt = find_bounds(root, pattern)
    if pt:
        tap(*pt)
        sleep()
        return True
    if fallback:
        tap(*fallback)
        sleep()
        return True
    return False


def screencap_image() -> Image.Image | None:
    r = subprocess.run(ADB + ["exec-out", "screencap", "-p"], capture_output=True, timeout=30)
    if r.returncode != 0 or not r.stdout:
        return None
    return Image.open(BytesIO(r.stdout))


def is_onboarding_image(img: Image.Image | None) -> bool:
    if img is None:
        return False
    w, h = img.size
    tab_strip = img.getpixel((540, h - 100))
    if tab_strip[0] > 200:
        return False
    mid = img.getpixel((540, int(h * 0.55)))
    return mid[0] < 100 or mid[2] > mid[0] + 10


def is_blank_image(img: Image.Image | None) -> bool:
    if img is None:
        return True
    w, h = img.size
    samples = [
        img.getpixel((200, int(h * 0.25))),
        img.getpixel((540, int(h * 0.45))),
        img.getpixel((800, int(h * 0.25))),
    ]
    if len({s[:3] for s in samples}) > 2:
        return False
    return samples[0][0] > 230 and samples[0][1] > 230


def is_main_shell_image(img: Image.Image | None) -> bool:
    if img is None or is_blank_image(img):
        return False
    w, h = img.size
    tab_strip = img.getpixel((540, h - 100))
    header = img.getpixel((200, 220))
    if tab_strip[0] < 200 or header[0] < 180:
        return False
    mid = img.getpixel((540, int(h * 0.55)))
    return mid[0] > 80


def is_system_settings_image(img: Image.Image | None) -> bool:
    if img is None:
        return False
    w, h = img.size
    top = img.getpixel((540, 280))
    return top[0] > 240 and top[1] > 240


def classify_capture(img: Image.Image | None) -> str:
    if img is None:
        return "empty"
    if is_blank_image(img):
        return "blank"
    if is_system_settings_image(img):
        return "system_settings"
    if is_onboarding_image(img):
        return "onboarding"
    if is_main_shell_image(img):
        return "main"
    return "unknown"


def tap_testid(test_id: str) -> bool:
    return tap_pattern(re.escape(test_id))


def ensure_app_foreground() -> None:
    if classify_capture(screencap_image()) == "system_settings":
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        sleep(1)
    foreground_app()
    sleep(1.5)


def wait_for_main_shell(timeout_s: float = 30) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        img = screencap_image()
        if classify_capture(img) == "main":
            return True
        if classify_capture(img) == "onboarding":
            break
        sleep(2)
        foreground_app()
    return classify_capture(screencap_image()) == "main"


def complete_onboarding_flow() -> tuple[list[str], bool]:
    notes: list[str] = []
    if wait_for_main_shell(20):
        notes.append("E2E skip — główna aplikacja bez ręcznego onboardingu")
        capture_raw("00_main_after_onboarding", "Po onboardingu — shell główny", notes=notes)
        capture_raw("00_onboarding_complete", "Po ukończeniu onboardingu", notes=notes)
        return notes, True

    capture_raw("00_onboarding_city", "Onboarding — wybór miasta")
    if not tap_pattern(r"onboarding-city-next|DALEJ|NEXT", (540, 1860)):
        notes.append("Onboarding city: brak przycisku DALEJ/NEXT")
        return notes, False

    sleep(1.0)
    capture_raw("00_onboarding_department", "Onboarding — wybór działu")
    if not tap_pattern(r"onboarding-department-next|DALEJ|NEXT", (540, 900)):
        notes.append("Onboarding department: brak przycisku DALEJ/NEXT")
        return notes, False

    sleep(1.0)
    capture_raw("00_onboarding_finish", "Onboarding — ekran końcowy")
    if not tap_pattern(
        r"onboarding-finish-join|DOŁĄCZ DO RYWALIZACJI|JOIN COMPETITION|DOŁĄCZANIE|JOINING",
        (540, 1110),
    ):
        notes.append("Onboarding finish: brak przycisku DOŁĄCZ/JOIN")
        return notes, False

    # Fallback for devices where permission prompt still appears despite pm grant.
    tap_pattern(r"Kontynuuj bez GPS|Continue without GPS", None)
    sleep(3.0)
    ensure_app_foreground()

    if not wait_for_main_shell(25):
        notes.append("Onboarding nie zakończył przejścia do shella głównego")
        return notes, False

    notes.append("Onboarding ukończony (sekwencja testID + fallback tekstowy)")
    capture_raw("00_onboarding_complete", "Po ukończeniu onboardingu", notes=notes)
    capture_raw("00_main_after_onboarding", "Po onboardingu — shell główny", notes=notes)
    return notes, True


def screen_signature(img: Image.Image | None) -> str:
    return classify_capture(img)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if "device" not in (run(ADB + ["get-state"]).stdout or ""):
        print("Brak emulatora", file=sys.stderr)
        return 1

    adb("shell", "pm", "grant", "com.sport.athlete", "android.permission.ACCESS_FINE_LOCATION")
    adb("shell", "pm", "grant", "com.sport.athlete", "android.permission.ACCESS_COARSE_LOCATION")
    adb("shell", "pm", "grant", "com.sport.athlete", "android.permission.POST_NOTIFICATIONS")
    foreground_app()

    foreground_app()
    onboard_notes, onboarding_ok = complete_onboarding_flow()

    # Vision parity runs require onboarding screens to be reachable.
    # If E2E auto-login skipped onboarding, the capture set is not comparable
    # to vision references and should fail fast.
    if os.getenv("EXPO_PUBLIC_VISION_FIXTURES") == "true" and any("E2E skip" in n for n in onboard_notes):
        steps.append(
            Step(
                id="00_invalid_run",
                title="Nieważny run parity (onboarding pominięty)",
                status="fail",
                notes=[
                    "EXPO_PUBLIC_E2E_SKIP_ONBOARDING jest aktywne dla buildu uruchomionego na emulatorze.",
                    "Przebuduj APK z EXPO_PUBLIC_E2E_SKIP_ONBOARDING=false i uruchom audit ponownie.",
                ],
            )
        )
        write_report()
        print(f"Report: {REPORT}")
        return 2

    if not onboarding_ok:
        steps.append(
            Step(
                id="00_blocker",
                title="Onboarding blokuje główną aplikację",
                status="fail",
                notes=onboard_notes + ["Audyt zakładek wykonany mimo blokady — zrzuty mogą być nieprawidłowe"],
            )
        )
        write_report()
        print(f"Report: {REPORT}")
        return 2

    img = screencap_image()
    if classify_capture(img) != "main":
        steps.append(
            Step(
                id="00_blocker",
                title="Onboarding blokuje główną aplikację",
                status="fail",
                notes=onboard_notes + ["Audyt zakładek wykonany mimo blokady — zrzuty mogą być nieprawidłowe"],
            )
        )

    capture("01_ride_dashboard", "Jazda — dashboard (stan startowy)")

    img = screencap_image()
    if classify_capture(img) == "main" and tap_pattern(r"DO JAZDY", (540, 1050)):
        capture("02_active_ride_hud", "Aktywny HUD jazdy")
        if tap_pattern(r"PAUZA", (800, 2100)):
            sleep(1.2)
            capture("03_ride_paused", "Modal pauzy jazdy")
            if tap_pattern(r"ZATRZYMAJ", (540, 1200)):
                sleep(3)
                capture("03b_ride_stopped", "Po zatrzymaniu jazdy")
            else:
                steps.append(Step(id="03b_ride_stopped", title="Zatrzymanie jazdy", status="warn", notes=["Brak przycisku ZATRZYMAJ JAZDĘ"]))
        else:
            steps.append(Step(id="03_ride_paused", title="Pauza jazdy", status="warn", notes=["Brak PAUZA — long-press STOP niewiarygodny przez adb"]))
    else:
        steps.append(Step(id="02_active_ride_hud", title="HUD jazdy", status="skip", notes=["Brak DO JAZDY — może już na HUD lub brak aktywnej sesji"]))

    tap_tab("jazda")
    if tap_pattern(r"KREATOR GPS", (540, 280)):
        sleep(2)
        capture("04_gps_diagnostics", "Kreator GPS (modal)")
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        sleep(1.5)
        foreground_app()
    else:
        steps.append(Step(id="04_gps_diagnostics", title="Kreator GPS", status="skip"))

    tap_tab("rywalizacja")
    capture("05_compete_hub", "Rywalizacja — City Hub")
    swipe(540, 1700, 540, 500, 500)
    sleep(0.8)
    capture("06_compete_scrolled", "Rywalizacja — dolna sekcja (questy)")

    if tap_pattern(r"^Kluby", (270, 1200)):
        sleep(2)
        capture("07_clubs", "Kluby")
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        sleep(1.5)
    else:
        steps.append(Step(id="07_clubs", title="Kluby", status="skip"))

    tap_tab("rywalizacja")
    swipe(540, 1700, 540, 500, 500)
    if tap_pattern(r"^Segmenty", (810, 1200)):
        sleep(2)
        capture("08_segments", "Segmenty")
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        sleep(1.5)
    else:
        steps.append(Step(id="08_segments", title="Segmenty", status="skip"))

    tap_tab("odkrywaj")
    capture("09_explore_hub", "Odkrywaj — hub")
    if tap_pattern(r"^Mapa", (270, 400)):
        sleep(3)
        capture("10_explore_map", "Mapa POI")
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        sleep(1.5)
    else:
        steps.append(Step(id="10_explore_map", title="Mapa", status="skip"))

    tap_tab("odkrywaj")
    if tap_pattern(r"Marketplace", (810, 400)):
        sleep(2)
        capture("11_marketplace", "Marketplace")
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        sleep(1.5)
    else:
        steps.append(Step(id="11_marketplace", title="Marketplace", status="skip"))

    tap_tab("profil")
    capture("12_profile", "Profil — góra")
    swipe(540, 1600, 540, 600, 450)
    sleep(0.8)
    capture("13_profile_scrolled", "Profil — akcje (trendy, ranking, dziennik)")

    for pat, sid, title in [
        (r"TRENDY", "14_trends", "Trendy wydolności"),
        (r"RANKING", "15_leaderboard", "Ranking globalny"),
        (r"DZIENNIK", "16_training_log", "Dziennik treningów"),
    ]:
        tap_tab("profil")
        swipe(540, 1600, 540, 600, 450)
        if tap_pattern(pat, (540, 1100)):
            sleep(2)
            capture(sid, title)
            adb("shell", "input", "keyevent", "KEYCODE_BACK")
            sleep(1.5)
        else:
            steps.append(Step(id=sid, title=title, status="skip"))

    tap_tab("profil")
    settings_opened = False
    if tap_testid("profile-settings-button") or tap_pattern(r"Ustawienia|settings", (980, 130)):
        sleep(2)
        root = dump_ui()
        if root is not None and re.search(
            r"Ustawienia|Ogólne|Sensory|Settings", " ".join(visible_texts(root)), re.I
        ):
            settings_opened = True
            capture("17_settings", "Ustawienia")
            swipe(540, 1700, 540, 600, 450)
            capture("18_settings_scrolled", "Ustawienia — scroll")
            adb("shell", "input", "keyevent", "KEYCODE_BACK")
            sleep(1.5)
    if not settings_opened:
        steps.append(
            Step(
                id="17_settings",
                title="Ustawienia",
                status="skip",
                notes=["Ikona ustawień w headerze nie otworzyła modala"],
            )
        )

    tap_tab("jazda")
    capture("19_final", "Stan końcowy — zakładka Jazda")

    write_report()
    print(f"Report: {REPORT}")
    return 0


def write_report() -> None:
    ok = sum(1 for s in steps if s.status == "ok")
    warn = sum(1 for s in steps if s.status == "warn")
    fail = sum(1 for s in steps if s.status == "fail")
    skip = sum(1 for s in steps if s.status == "skip")

    findings = [
        "**P0 — E2E skip onboarding:** `shouldSkipOnboardingForE2e()` domyślnie true przy auto-login; flagi w `app.config.js` extra.",
        "**P0 — Finish onboarding:** `onFinish` wywoływany nawet przy błędzie API; GPS z opcją „Kontynuuj bez GPS”.",
        "**P0 — Działy:** `updateProfile(tenant)` przed `getTree()` na kroku miasto→dział.",
        "**P1 — Ustawienia:** `testID=profile-settings-button` w headerze profilu.",
        "**P1 — Empty states:** Kluby, Marketplace — komponent `EmptyState`.",
        "**P1 — Onboarding tło:** parchment zamiast night chrome (spójność z tab bar).",
        "**P2 — Tab bar:** VT323 9px + `adjustsFontSizeToFit` zamiast Press Start 2P 8px.",
        "**P2 — Ride HUD:** `testID=ride-pause-button` dla audytu adb/Maestro.",
    ]

    lines = [
        "# Mobile Emulator UI Audit",
        "",
        "| | |",
        "|--|--|",
        f"| **Data** | {DATE} |",
        "| **Urządzenie** | `emulator-5554` (SportEmulator) |",
        "| **Pakiet** | `com.sport.athlete` |",
        "| **Build** | lokalny `assembleRelease` + E2E auto-login |",
        f"| **Zrzuty** | [`screenshots/{DATE}-emulator-audit/`](screenshots/{DATE}-emulator-audit/) |",
        "| **Skrypt** | `python scripts/emulator-ui-audit.py` |",
        "| **Flow Maestro** | `mobile/.maestro/flows/emulator-full-audit.yaml` |",
        "",
        "## Podsumowanie",
        "",
        f"- **{ok}** OK · **{warn}** ostrzeżeń · **{fail}** błędów · **{skip}** pominiętych",
        f"- Łącznie kroków: **{len(steps)}**",
        "",
        "## Ustalenia do poprawy",
        "",
    ]
    for i, f in enumerate(findings, 1):
        lines.append(f"{i}. {f}")

    lines.extend([
        "",
        "## Macierz ekranów",
        "",
        "| ID | Ekran | Status |",
        "|----|-------|--------|",
    ])
    for s in steps:
        icon = {"ok": "✅", "warn": "⚠️", "fail": "❌", "skip": "⏭️"}.get(s.status, "•")
        lines.append(f"| {s.id} | {s.title} | {icon} {s.status} |")

    lines.extend([
        "",
        "## Zrzuty ekranu",
        "",
    ])

    for s in steps:
        icon = {"ok": "✅", "warn": "⚠️", "fail": "❌", "skip": "⏭️"}.get(s.status, "•")
        lines.append(f"### {icon} {s.id} — {s.title}")
        lines.append("")
        if s.screenshot and (OUT_DIR / s.screenshot).exists():
            rel = f"screenshots/{DATE}-emulator-audit/{s.screenshot}"
            lines.append(f"![{s.title}]({rel})")
            lines.append("")
        if s.visible:
            lines.append("**Widoczny tekst:** " + ", ".join(f"`{t}`" for t in s.visible[:12]))
            lines.append("")
        if s.notes:
            for n in s.notes:
                lines.append(f"- {n}")
            lines.append("")

    lines.extend([
        "## Checklist wizualny",
        "",
        "- [ ] Tokeny stitch (parchment / gpDeepSea / primary) — spójność między zakładkami",
        "- [ ] Kontrast WCAG na parchment i night chrome",
        "- [ ] Tab bar + safe area (80px) na gestynav emulatorze",
        "- [ ] Modale: Settings, GPS Diagnostics, Ride Paused — zaokrąglenia i cienie pixel",
        "- [ ] Empty states: Compete leaderboard, Marketplace, Training log",
        "- [ ] Bannery: offline, GPS recovery, start ride error",
        "",
        "## Jak powtórzyć audyt",
        "",
        "```bash",
        "adb devices",
        "python scripts/emulator-ui-audit.py",
        "```",
        "",
    ])

    REPORT.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
