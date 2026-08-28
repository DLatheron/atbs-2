#!/usr/bin/env python3
"""Generate deployment action icons matching the thick black stroke style."""

import struct
import zlib
from pathlib import Path

SIZE = 512
STROKE = 36
COLOR = (0, 0, 0, 255)


def write_png(path: Path, pixels: bytearray) -> None:
    raw = bytearray()
    row_bytes = SIZE * 4
    for y in range(SIZE):
        raw.append(0)
        start = y * row_bytes
        raw.extend(pixels[start : start + row_bytes])

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def set_pixel(pixels: bytearray, x: int, y: int, color=COLOR) -> None:
    if 0 <= x < SIZE and 0 <= y < SIZE:
        i = (y * SIZE + x) * 4
        pixels[i : i + 4] = bytes(color)


def stamp_disc(pixels: bytearray, cx: float, cy: float, radius: float, color=COLOR) -> None:
    r2 = radius * radius
    for y in range(int(cy - radius - 1), int(cy + radius + 2)):
        for x in range(int(cx - radius - 1), int(cx + radius + 2)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                set_pixel(pixels, x, y, color)


def draw_capsule(pixels: bytearray, x0: float, y0: float, x1: float, y1: float, thickness: float) -> None:
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(steps + 1):
        t = i / steps if steps else 0
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        stamp_disc(pixels, x, y, thickness / 2)


def draw_rounded_rect(pixels: bytearray, left: float, top: float, right: float, bottom: float, radius: float) -> None:
    draw_capsule(pixels, left + radius, top, right - radius, top, STROKE)
    draw_capsule(pixels, left + radius, bottom, right - radius, bottom, STROKE)
    draw_capsule(pixels, left, top + radius, left, bottom - radius, STROKE)
    draw_capsule(pixels, right, top + radius, right, bottom - radius, STROKE)
    for cx, cy in (
        (left + radius, top + radius),
        (right - radius, top + radius),
        (left + radius, bottom - radius),
        (right - radius, bottom - radius),
    ):
        stamp_disc(pixels, cx, cy, radius)


def draw_die(pixels: bytearray, cx: float, cy: float, size: float) -> None:
    half = size / 2
    draw_rounded_rect(pixels, cx - half, cy - half, cx + half, cy + half, size * 0.12)
    dot = size * 0.08
    for ox, oy in ((-0.22, -0.22), (0.22, 0.22), (0.22, -0.22), (-0.22, 0.22), (0, 0)):
        stamp_disc(pixels, cx + ox * size, cy + oy * size, dot)


def draw_person(pixels: bytearray, cx: float, cy: float, scale: float = 1.0) -> None:
    head_r = 28 * scale
    stamp_disc(pixels, cx, cy - 70 * scale, head_r)
    draw_capsule(pixels, cx, cy - 40 * scale, cx, cy + 55 * scale, STROKE * scale * 0.85)
    draw_capsule(pixels, cx, cy - 5 * scale, cx - 45 * scale, cy + 35 * scale, STROKE * scale * 0.75)
    draw_capsule(pixels, cx, cy - 5 * scale, cx + 45 * scale, cy + 35 * scale, STROKE * scale * 0.75)
    draw_capsule(pixels, cx, cy + 55 * scale, cx - 35 * scale, cy + 120 * scale, STROKE * scale * 0.75)
    draw_capsule(pixels, cx, cy + 55 * scale, cx + 35 * scale, cy + 120 * scale, STROKE * scale * 0.75)


def make_auto_deploy() -> bytearray:
    pixels = bytearray(SIZE * SIZE * 4)
    draw_die(pixels, 256, 220, 180)
    for i, ox in enumerate((-95, 0, 95)):
        draw_person(pixels, 256 + ox, 360, 0.55)
    for cx in (161, 256, 351):
        draw_capsule(pixels, cx, 285, cx, 305, STROKE * 0.55)
    return pixels


def make_undeploy_all() -> bytearray:
    pixels = bytearray(SIZE * SIZE * 4)
    for cx in (170, 256, 342):
        draw_person(pixels, cx, 360, 0.62)
    # Upward arrow above the group
    ax = 256
    draw_capsule(pixels, ax, 360, ax, 120, STROKE)
    draw_capsule(pixels, ax, 120, ax - 70, 200, STROKE)
    draw_capsule(pixels, ax, 120, ax + 70, 200, STROKE)
    # Small X marks near feet
    for cx in (170, 256, 342):
        draw_capsule(pixels, cx - 22, 430, cx + 22, 470, STROKE * 0.65)
        draw_capsule(pixels, cx - 22, 470, cx + 22, 430, STROKE * 0.65)
    return pixels


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "packages" / "server" / "data" / "icons"
    write_png(out / "autoDeploy.png", make_auto_deploy())
    write_png(out / "undeployAll.png", make_undeploy_all())
    print("Wrote autoDeploy.png and undeployAll.png")


if __name__ == "__main__":
    main()
