#!/usr/bin/env python3
"""Compose 1080×1920 Play Store phone screenshots from live STUDRC content."""

from __future__ import annotations

import io
import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "play"
API = "https://api.studrc.com/api"
W, H = 1080, 1920
NAVY = (0, 19, 43)
GOLD = (253, 189, 1)
RED = (214, 48, 38)
BLUE = (5, 101, 171)
WHITE = (255, 255, 255)
INK = (18, 28, 45)
MUTED = (90, 102, 118)
LINE = (230, 233, 238)
TONES = {"red": RED, "blue": BLUE, "gold": (196, 140, 0), "teal": (14, 116, 144)}

TAB_H = 168
STATUS_H = 54
MAST_H = 92
FILTER_H = 72
CONTENT_TOP = STATUS_H + MAST_H + FILTER_H


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def get(url: str):
    with urllib.request.urlopen(url, timeout=30) as res:
        return json.load(res)


def fetch_image(url: str | None) -> Image.Image | None:
    if not url:
        return None
    try:
        with urllib.request.urlopen(url, timeout=30) as res:
            im = Image.open(io.BytesIO(res.read())).convert("RGB")
        return im
    except Exception:
        return None


def knock_black(im: Image.Image, thresh: int = 28) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r <= thresh and g <= thresh and b <= thresh:
                px[x, y] = (0, 0, 0, 0)
    return im


def fit_cover(im: Image.Image, w: int, h: int) -> Image.Image:
    scale = max(w / im.width, h / im.height)
    nw, nh = int(im.width * scale), int(im.height * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = (nh - h) // 2
    return im.crop((left, top, left + w, top + h))


def round_cover(im: Image.Image, radius: int) -> Image.Image:
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *im.size), radius, fill=255)
    im.putalpha(mask)
    return im


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, max_w: int, max_lines: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = word if not cur else f"{cur} {word}"
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
            if len(lines) == max_lines - 1:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines:
        last = lines[-1]
        while draw.textlength(last + "…", font=fnt) > max_w and last:
            last = last[:-1]
        lines[-1] = last.rstrip() + "…" if last != text and len(words) > 2 else lines[-1]
    return lines


def paint_status(draw: ImageDraw.ImageDraw, y_color=INK) -> None:
    draw.text((48, 14), "9:41", font=font(28, True), fill=y_color)
    draw.text((W - 210, 14), "5G  ████", font=font(24, True), fill=y_color)


def paint_nav(base: Image.Image, active: int) -> None:
    draw = ImageDraw.Draw(base)
    y = H - TAB_H
    draw.rectangle((0, y, W, H), fill=WHITE)
    draw.line((0, y, W, y), fill=LINE, width=2)
    labels = ["Accueil", "Actualités", "Kiosque", "Compte"]
    icons = ["⌂", "☰", "▣", "☺"]
    slot = W / 4
    for i, (lab, ic) in enumerate(zip(labels, icons)):
        cx = int(slot * (i + 0.5))
        color = NAVY if i == active else MUTED
        draw.text((cx, y + 28), ic, font=font(34, True), fill=color, anchor="mt")
        draw.text((cx, y + 88), lab, font=font(22, True), fill=color, anchor="mt")
        if i == active:
            draw.rounded_rectangle((cx - 48, y + 18, cx + 48, y + 22), 2, fill=GOLD)


def paint_masthead(base: Image.Image, logo: Image.Image) -> None:
    draw = ImageDraw.Draw(base)
    draw.rectangle((0, STATUS_H, W, STATUS_H + MAST_H), fill=WHITE)
    draw.text((48, STATUS_H + 28), "⌕", font=font(36), fill=NAVY)
    lw = 280
    lh = min(MAST_H - 20, int(logo.height * (lw / logo.width)))
    lw = int(logo.width * (lh / logo.height))
    mark = logo.resize((lw, lh), Image.Resampling.LANCZOS)
    x = (W - lw) // 2
    y = STATUS_H + (MAST_H - lh) // 2
    base.paste(mark, (x, y), mark)
    draw.text((W - 72, STATUS_H + 28), "🔔", font=font(32), fill=NAVY, anchor="rt")


def paint_filters(draw: ImageDraw.ImageDraw, labels: list[str], active: int) -> None:
    y = STATUS_H + MAST_H
    draw.rectangle((0, y, W, y + FILTER_H), fill=WHITE)
    x = 36
    fnt = font(26, True)
    for i, lab in enumerate(labels):
        color = NAVY if i == active else MUTED
        draw.text((x, y + 18), lab, font=fnt, fill=color)
        tw = draw.textlength(lab, font=fnt)
        if i == active:
            draw.rounded_rectangle((x, y + FILTER_H - 10, x + tw, y + FILTER_H - 6), 2, fill=GOLD)
        x += int(tw) + 36


def article_row(base: Image.Image, article: dict, y: int) -> int:
    draw = ImageDraw.Draw(base)
    thumb_h, thumb_w = 168, 224
    img = fetch_image(article.get("videoPosterUrl") or article.get("coverUrl"))
    if img:
        cov = round_cover(fit_cover(img, thumb_w, thumb_h), 22)
        base.paste(cov, (40, y), cov)
    tone = TONES.get(str(article.get("categoryTone") or "red"), RED)
    label = str(article.get("categoryLabel") or "").title()
    draw.text((40 + thumb_w + 24, y + 6), label, font=font(22, True), fill=tone)
    fnt = font(30, True)
    lines = wrap(draw, article.get("title") or "", fnt, W - 40 - thumb_w - 72, 3)
    ty = y + 40
    for line in lines:
        draw.text((40 + thumb_w + 24, ty), line, font=fnt, fill=INK)
        ty += 38
    meta = article.get("dateLabel") or ""
    draw.text((40 + thumb_w + 24, y + thumb_h - 32), meta, font=font(22), fill=MUTED)
    return y + thumb_h + 28


def screenshot_home(home: dict, logo: Image.Image) -> Image.Image:
    base = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(base)
    paint_status(draw)
    paint_masthead(base, logo)
    paint_filters(draw, ["À la une", "Stu News", "Stu Data", "Stu Stories"], 0)

    featured = (home.get("featured") or [None])[0]
    y = CONTENT_TOP + 12
    if featured:
        img = fetch_image(featured.get("videoPosterUrl") or featured.get("coverUrl"))
        hero_h = 520
        if img:
            cov = round_cover(fit_cover(img, W - 80, hero_h), 28)
            base.paste(cov, (40, y), cov)
        draw.rounded_rectangle((56, y + 28, 240, y + 68), 8, fill=GOLD)
        draw.text((68, y + 34), "À la une", font=font(22, True), fill=NAVY)
        fnt = font(40, True)
        lines = wrap(draw, featured.get("title") or "", fnt, W - 120, 3)
        ty = y + hero_h - 8 - 44 * len(lines)
        for line in lines:
            draw.text((56, ty), line, font=fnt, fill=WHITE)
            ty += 44
        y += hero_h + 36

    rest = (home.get("topGrid") or [])[:3]
    for art in rest:
        y = article_row(base, art, y)
        if y > H - TAB_H - 40:
            break
    paint_nav(base, 0)
    return base


def screenshot_news(feed: dict, logo: Image.Image) -> Image.Image:
    base = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(base)
    paint_status(draw)
    paint_masthead(base, logo)
    paint_filters(draw, ["Tous", "Stu News", "Stu Data", "Stu Stories"], 1)
    y = CONTENT_TOP + 20
    items = feed.get("items") or []
    hero = items[0] if items else None
    if hero:
        img = fetch_image(hero.get("videoPosterUrl") or hero.get("coverUrl"))
        if img:
            cov = round_cover(fit_cover(img, W - 80, 420), 28)
            base.paste(cov, (40, y), cov)
        fnt = font(36, True)
        lines = wrap(draw, hero.get("title") or "", fnt, W - 80, 3)
        ty = y + 444
        for line in lines:
            draw.text((40, ty), line, font=fnt, fill=INK)
            ty += 42
        y = ty + 28
    for art in items[1:5]:
        y = article_row(base, art, y)
        if y > H - TAB_H - 40:
            break
    paint_nav(base, 1)
    return base


def screenshot_kiosque(mags: list[dict], logo_white: Image.Image) -> Image.Image:
    base = Image.new("RGB", (W, H), NAVY)
    draw = ImageDraw.Draw(base)
    paint_status(draw, WHITE)
    lw = 300
    lh = int(logo_white.height * (lw / logo_white.width))
    mark = logo_white.resize((lw, lh), Image.Resampling.LANCZOS)
    base.paste(mark, ((W - lw) // 2, STATUS_H + 16), mark)
    draw.text((W // 2, STATUS_H + lh + 28), "Kiosque", font=font(28, True), fill=GOLD, anchor="mt")

    hero = mags[0] if mags else {}
    cover = fetch_image(hero.get("coverUrl"))
    cw, ch = 560, 760
    if cover:
        cov = round_cover(fit_cover(cover, cw, ch), 18)
        base.paste(cov, ((W - cw) // 2, 280), cov)
    title = hero.get("title") or "STU MAG"
    draw.text((W // 2, 280 + ch + 36), title, font=font(42, True), fill=WHITE, anchor="mt")
    meta = " · ".join(x for x in [hero.get("dateLabel"), "Gratuit" if hero.get("accessType") == "FREE" else None] if x)
    if meta:
        draw.text((W // 2, 280 + ch + 92), meta, font=font(26), fill=(200, 210, 220), anchor="mt")
    paint_nav(base, 2)
    return base


def screenshot_compte(logo_white: Image.Image) -> Image.Image:
    photo = Image.open(ROOT / "assets/onboarding/2151031917.jpg").convert("RGB")
    base = fit_cover(photo, W, H)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i in range(H):
        t = i / H
        a = int(40 + 180 * t * t)
        od.line((0, i, W, i), fill=(0, 19, 43, a))
    base = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(base)
    paint_status(draw, WHITE)
    lw = 360
    lh = int(logo_white.height * (lw / logo_white.width))
    mark = logo_white.resize((lw, lh), Image.Resampling.LANCZOS)
    # crop wordmark-ish: keep full logo
    base.paste(mark, ((W - lw) // 2, 120), mark)

    draw.text((W // 2, 1180), "Votre espace STUDRC", font=font(44, True), fill=WHITE, anchor="mt")
    sub = "Connectez-vous pour vos achats, notifications\net la lecture des magazines."
    f_sub = font(28)
    for i, line in enumerate(sub.split("\n")):
        draw.text((W // 2, 1260 + i * 36), line, font=f_sub, fill=(230, 234, 238), anchor="mt")

    draw.rounded_rectangle((48, 1420, W - 48, 1510), 16, fill=GOLD)
    draw.text((W // 2, 1465), "Se connecter", font=font(32, True), fill=NAVY, anchor="mm")
    draw.rounded_rectangle((48, 1534, W - 48, 1624), 16, outline=WHITE, width=3)
    draw.text((W // 2, 1579), "Créer un compte", font=font(32, True), fill=WHITE, anchor="mm")
    paint_nav(base, 3)
    return base


def main() -> None:
    OUT.mkdir(exist_ok=True)
    logo_white = knock_black(Image.open(ROOT / "assets/brand/studrc-logo-white.png"))
    logo = logo_white.copy()
    px = logo.load()
    for y in range(logo.height):
        for x in range(logo.width):
            r, g, b, a = px[x, y]
            if a > 0:
                px[x, y] = (*NAVY, a)
    home = get(f"{API}/articles/home")
    news = get(f"{API}/articles/feed?take=8")
    mags = get(f"{API}/magazines?take=6").get("items") or []

    shots = [
        ("01-accueil.png", screenshot_home(home, logo)),
        ("02-actualites.png", screenshot_news(news, logo)),
        ("03-kiosque.png", screenshot_kiosque(mags, logo_white)),
        ("04-compte.png", screenshot_compte(logo_white)),
    ]
    for name, im in shots:
        path = OUT / name
        im.save(path, "PNG", optimize=True)
        print(path, im.size, path.stat().st_size)


if __name__ == "__main__":
    main()
