#!/usr/bin/env python3
"""Complete mobile onboarding on emulator via coordinate taps (RN has no a11y text)."""

from __future__ import annotations

import subprocess
import sys
import time
from io import BytesIO
from pathlib import Path

from PIL import Image

ADB = ["adb", "-s", "emulator-5554"]
ACTIVITY = "com.sport.athlete/.MainActivity"


def run(*args: str) -> None:
    subprocess.run(ADB + list(args), capture_output=True)


def sleep(sec: float = 2.0) -> None:
    time.sleep(sec)


def screencap() -> Image.Image:
    r = subprocess.run(ADB + ["exec-out", "screencap", "-p"], capture_output=True, timeout=30)
    return Image.open(BytesIO(r.stdout))


def tap(x: int, y: int) -> None:
    run("shell", "input", "tap", str(x), str(y))
    sleep(1.8)


def find_tan_button(img: Image.Image, y0: int, y1: int) -> tuple[int, int] | None:
    best_y: int | None = None
    best_score = 0
    for y in range(y0, y1):
        r, g, b, _a = img.getpixel((540, y))
        if r > 160 and 100 < g < 200 and b < 150 and r > b + 30:
            score = r + g - b
            if score > best_score:
                best_score = score
                best_y = y
    return (540, best_y) if best_y else None


def find_green_button(img: Image.Image) -> tuple[int, int] | None:
    best_y: int | None = None
    best_score = 0
    for y in range(1050, 1180):
        r, g, b, _a = img.getpixel((540, y))
        if g > 140 and g > r + 40 and g > b + 40:
            score = g - r
            if score > best_score:
                best_score = score
                best_y = y
    return (540, best_y) if best_y else None


def is_blank_screen(img: Image.Image) -> bool:
    w, h = img.size
    samples = [
        img.getpixel((200, int(h * 0.25))),
        img.getpixel((540, int(h * 0.45))),
        img.getpixel((800, int(h * 0.25))),
    ]
    if len({s[:3] for s in samples}) > 2:
        return False
    return samples[0][0] > 230 and samples[0][1] > 230


def is_main_shell(img: Image.Image) -> bool:
    if is_blank_screen(img):
        return False
    w, h = img.size
    if find_green_button(img):
        return False
    if find_tan_button(img, 1700, 1950) or find_tan_button(img, 800, 960):
        return False
    tab_strip = img.getpixel((540, h - 100))
    header = img.getpixel((200, 220))
    return tab_strip[0] > 200 and header[0] > 180


def screen_kind(img: Image.Image) -> str:
    if is_main_shell(img):
        return "main"
    if find_green_button(img):
        return "finish"
    if find_tan_button(img, 1700, 1950):
        return "city"
    if find_tan_button(img, 800, 960):
        return "department"
    return "unknown"


def grant_permissions() -> None:
    for perm in (
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.POST_NOTIFICATIONS",
    ):
        run("shell", "pm", "grant", "com.sport.athlete", perm)


def complete_onboarding(max_attempts: int = 12) -> bool:
    grant_permissions()
    run("shell", "am", "start", "-n", ACTIVITY)
    sleep(3)

    for _ in range(max_attempts):
        img = screencap()
        kind = screen_kind(img)
        if kind == "main":
            return True
        if kind == "city":
            tap(540, 820)
            btn = find_tan_button(img, 1700, 1950) or (540, 1860)
            tap(*btn)
        elif kind == "department":
            btn = find_tan_button(img, 820, 960) or (540, 886)
            tap(*btn)
        elif kind == "finish":
            btn = find_green_button(img) or (540, 1115)
            tap(*btn)
            sleep(6)
            run("shell", "am", "start", "-n", ACTIVITY)
            sleep(4)
        else:
            tap(540, 1200)
    return screen_kind(screencap()) == "main"


if __name__ == "__main__":
    ok = complete_onboarding()
    print("onboarding_complete" if ok else "onboarding_failed")
    raise SystemExit(0 if ok else 1)
