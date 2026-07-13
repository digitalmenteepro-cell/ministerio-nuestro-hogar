#!/usr/bin/env python3
"""Genera los iconos PWA del Ministerio de Alabanza Nuestro Hogar.

Uso:  python3 scripts/gen-icons.py
Salida: public/icon-192.png, public/icon-512.png,
        public/icon-maskable-512.png, public/apple-touch-icon.png
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

TOP = (122, 10, 160)      # violeta claro
MID = (89, 7, 118)        # #590776 (color de marca)
BOT = (45, 3, 64)         # violeta profundo
SS = 4                    # supersampling para bordes suaves


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size):
    """Degradado diagonal TOP -> MID -> BOT."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x / (size - 1) + y / (size - 1)) / 2
            if t < 0.55:
                px[x, y] = lerp(TOP, MID, t / 0.55)
            else:
                px[x, y] = lerp(MID, BOT, (t - 0.55) / 0.45)
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(0, 0), (size - 1, size - 1)], radius=radius, fill=255
    )
    return mask


def draw_content(img, size, ring_r, font_size, text_cy, bar_w, bar_h, bar_cy):
    d = ImageDraw.Draw(img, "RGBA")
    c = size / 2

    # anillo decorativo
    d.ellipse(
        [(c - ring_r, c - ring_r), (c + ring_r, c + ring_r)],
        outline=(255, 255, 255, 46),
        width=max(2, round(size * 0.02)),
    )

    # monograma NH
    font = ImageFont.truetype(FONT_PATH, font_size)
    text = "NH"
    box = d.textbbox((0, 0), text, font=font)
    d.text(
        (c - (box[2] - box[0]) / 2 - box[0], text_cy - (box[3] - box[1]) / 2 - box[1]),
        text,
        font=font,
        fill=(255, 255, 255, 255),
    )

    # barra inferior
    d.rounded_rectangle(
        [(c - bar_w / 2, bar_cy - bar_h / 2), (c + bar_w / 2, bar_cy + bar_h / 2)],
        radius=bar_h / 2,
        fill=(255, 255, 255, 140),
    )


def build(size, *, maskable=False):
    """Dibuja a 4x y reduce con LANCZOS -> antialiasing limpio."""
    big = size * SS
    img = gradient(big)

    if maskable:
        # zona segura: contenido dentro del 80% central, fondo a sangre
        scale = 0.78
        draw_content(
            img,
            big,
            ring_r=big * 0.273 * scale / 0.78 * 0.78,
            font_size=round(big * 0.273),
            text_cy=big * 0.50,
            bar_w=big * 0.234,
            bar_h=big * 0.0156,
            bar_cy=big * 0.652,
        )
        return img.convert("RGB").resize((size, size), Image.LANCZOS)

    draw_content(
        img,
        big,
        ring_r=big * 0.355,
        font_size=round(big * 0.371),
        text_cy=big * 0.472,
        bar_w=big * 0.3125,
        bar_h=big * 0.0195,
        bar_cy=big * 0.6975,
    )
    out = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    out.paste(img, (0, 0), rounded_mask(big, round(big * 0.1875)))
    return out.resize((size, size), Image.LANCZOS)


def main():
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]
    for name, size, maskable in targets:
        img = build(size, maskable=maskable)
        path = PUBLIC / name
        img.save(path, "PNG", optimize=True)
        print(f"  ✓ {name}  {img.size[0]}x{img.size[1]}  {path.stat().st_size / 1024:.1f} kB")


if __name__ == "__main__":
    print("Generando iconos PWA…")
    main()
    print("Listo.")
