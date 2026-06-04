#!/usr/bin/env python3
"""Generate build/icon.png (1024x1024) for mean-time.

Run this once (or whenever the design changes). The .icns file is built from
this PNG by scripts/make-icns.sh.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
RADIUS = 220  # macOS-ish "squircle" corner

# Colors
BG = (28, 28, 30, 255)        # match the in-app dark panel
ACCENT = (255, 184, 77, 255)  # amber — chopped interruption segments
FOCUS = (94, 201, 133, 255)   # calm green — long uninterrupted focus block
TEXT = (255, 255, 255, 255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Rounded rect background
draw.rounded_rectangle((0, 0, SIZE - 1, SIZE - 1), radius=RADIUS, fill=BG)

# Bottom "timeline" bar: amber pill, broken by thin interruptions. Internal
# cut corners are softened by a small uniform radius. Outer ends of the bar
# keep the full pill cap.
bar_h = 90
bar_left = 80
bar_right = SIZE - 80
# Keep the bar inside the straight-wall portion of the squircle (which ends
# at y = SIZE - RADIUS). Leave a bit of breathing room below.
bar_bottom = SIZE - RADIUS - 30
bar_top = bar_bottom - bar_h
pill_r = bar_h // 2

# Tune this: small => barely-softened cuts; larger => more pill-like segments.
inner_r = 6

tick_fracs = [0.05, 0.11, 0.14, 0.22, 0.27, 0.31, 0.38, 0.43, 0.47, 0.55]
tick_w = 12
tick_left = bar_left + pill_r
tick_right = bar_right - pill_r
tick_centers = [tick_left + f * (tick_right - tick_left) for f in tick_fracs]

# Build segment ranges (amber regions, between gaps).
segments = []
prev = bar_left
for cx in tick_centers:
    segments.append((prev, cx - tick_w / 2))
    prev = cx + tick_w / 2
segments.append((prev, bar_right))

def draw_segment(left, right, left_pill, right_pill, color=ACCENT):
    """Draw one amber segment composited from rectangle + pieslice primitives.

    Each side can independently use the full pill radius (bar_h/2) or a small
    inner radius. PIL's built-in rounded_rectangle has edge cases that fail
    on narrow segments, so we composite manually for reliability."""
    left = int(round(left))
    right = int(round(right))
    if right - left < 1:
        return
    half_w = (right - left) / 2
    lr = int(min(pill_r if left_pill else inner_r, half_w, bar_h / 2))
    rr = int(min(pill_r if right_pill else inner_r, half_w, bar_h / 2))

    # Central full-height block between the rounded ends.
    if (right - rr) > (left + lr):
        draw.rectangle((left + lr, bar_top, right - rr, bar_bottom), fill=color)

    if lr > 0:
        # Vertical strip on the left (between the two corner arcs)
        if (bar_bottom - lr) > (bar_top + lr):
            draw.rectangle(
                (left, bar_top + lr, left + lr, bar_bottom - lr), fill=color
            )
        # Top-left and bottom-left quarter arcs
        draw.pieslice(
            (left, bar_top, left + 2 * lr, bar_top + 2 * lr),
            start=180, end=270, fill=color,
        )
        draw.pieslice(
            (left, bar_bottom - 2 * lr, left + 2 * lr, bar_bottom),
            start=90, end=180, fill=color,
        )

    if rr > 0:
        if (bar_bottom - rr) > (bar_top + rr):
            draw.rectangle(
                (right - rr, bar_top + rr, right, bar_bottom - rr), fill=color
            )
        draw.pieslice(
            (right - 2 * rr, bar_top, right, bar_top + 2 * rr),
            start=270, end=360, fill=color,
        )
        draw.pieslice(
            (right - 2 * rr, bar_bottom - 2 * rr, right, bar_bottom),
            start=0, end=90, fill=color,
        )

for i, (left, right) in enumerate(segments):
    left_pill = (i == 0)
    right_pill = (i == len(segments) - 1)
    # Last (longest) segment is the uninterrupted focus block.
    color = FOCUS if i == len(segments) - 1 else ACCENT
    draw_segment(left, right, left_pill, right_pill, color=color)

# Monogram "MT"
def find_font(size):
    for path in (
        "/System/Library/Fonts/SFNS.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ):
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()

font = find_font(560)
text = "mt"
bbox = draw.textbbox((0, 0), text, font=font)
tw = bbox[2] - bbox[0]
th = bbox[3] - bbox[1]
# center horizontally; nudge up a little to balance with the bottom bar
tx = (SIZE - tw) / 2 - bbox[0]
ty = (SIZE - th) / 2 - bbox[1] - 70
draw.text((tx, ty), text, font=font, fill=TEXT)

out = Path(__file__).resolve().parent.parent / "build" / "icon.png"
out.parent.mkdir(exist_ok=True)
img.save(out)
print(f"wrote {out}")
