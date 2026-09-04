#!/usr/bin/env python3
"""
Enhance all Rebelstar / Rebelstar 2 tile graphics.

Pipeline (approved via preview_rebelstar_enhance.py):
  1. Recover true 16×16 masks from flat 100×100 NN upscales.
  2. Style: organic (Chaikin), diagonal (DP stair collapse), or rectilinear (NN+AA).
  3. Reflect-pad so smoothing continues through the tile rim; crop back.
  4. Visual: rotation-safe thickness shading + grain.
  5. Collision (-cl): same silhouette/alpha, flat material colour.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_dilation, distance_transform_edt, label
from skimage.measure import approximate_polygon, find_contours

ROOT = Path(__file__).resolve().parents[1]
FURN_DIR = ROOT / "data" / "furniture"
TERRAIN_DIR = ROOT / "data" / "terrain"
BACKUP_DIR = Path(__file__).resolve().parent / "_rebelstar_flat_backup"
TILE_SETS = {"Rebelstar", "Rebelstar 2"}
TS, OUT, SCALE = 16, 100, 8


def walk_image_ids(node, out: set[str]) -> None:
    if isinstance(node, dict):
        if isinstance(node.get("imageId"), str):
            out.add(node["imageId"])
        for value in node.values():
            walk_image_ids(value, out)
    elif isinstance(node, list):
        for item in node:
            walk_image_ids(item, out)


def rebelstar_image_ids() -> tuple[set[str], set[str]]:
    furn: set[str] = set()
    terr: set[str] = set()
    for path in FURN_DIR.glob("*.furniture.json"):
        recipe = json.loads(path.read_text())
        if recipe.get("tileSet") not in TILE_SETS:
            continue
        walk_image_ids(recipe.get("renderable"), furn)
    for path in TERRAIN_DIR.glob("*.terrain.json"):
        recipe = json.loads(path.read_text())
        if recipe.get("tileSet") not in TILE_SETS:
            continue
        walk_image_ids(recipe.get("renderable"), terr)
    furn = {i for i in furn if not i.endswith("-cl")}
    terr = {i for i in terr if not i.endswith("-cl")}
    return furn, terr


def recover_mask16(arr: np.ndarray, furniture: bool) -> np.ndarray:
    if furniture:
        ink = arr[:, :, 3] > 0
    else:
        ink = ~((arr[:, :, 0] == 0) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 0))
    mask = np.zeros((TS, TS), dtype=bool)
    for ty in range(TS):
        for tx in range(TS):
            y0 = int(round(ty * OUT / TS))
            y1 = int(round((ty + 1) * OUT / TS))
            x0 = int(round(tx * OUT / TS))
            x1 = int(round((tx + 1) * OUT / TS))
            mask[ty, tx] = ink[y0:y1, x0:x1].mean() >= 0.5
    return mask


def base_colour(arr: np.ndarray, furniture: bool) -> tuple[int, int, int]:
    if furniture:
        pix = arr[arr[:, :, 3] > 0][:, :3]
    else:
        ink = ~((arr[:, :, 0] == 0) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 0))
        pix = arr[ink][:, :3]
    if len(pix) == 0:
        return (255, 255, 255)
    return tuple(int(x) for x in np.median(pix, axis=0))


def edge_stairiness(mask: np.ndarray) -> float:
    h, w = mask.shape
    scores: list[float] = []
    for flip, axis in ((False, 1), (True, 1), (False, 0), (True, 0)):
        m = np.flip(mask, axis=axis) if flip else mask
        profile: list[int] = []
        if axis == 1:
            for r in range(h):
                cols = np.where(m[r])[0]
                profile.append(int(cols.max()) if cols.size else -1)
        else:
            for c in range(w):
                rows = np.where(m[:, c])[0]
                profile.append(int(rows.max()) if rows.size else -1)
        vals = [p for p in profile if p >= 0]
        if len(vals) < 3:
            scores.append(0.0)
            continue
        d = np.diff(vals)
        scores.append(float(np.mean(np.abs(d) == 1)))
    return max(scores) if scores else 0.0


def style_for(mask: np.ndarray) -> str:
    n = label(mask)[1]
    if n >= 3:
        return "organic"
    if edge_stairiness(mask) >= 0.25:
        return "diagonal"
    return "rectilinear"


def chaikin(points: np.ndarray, iterations: int = 2) -> np.ndarray:
    pts = points.astype(np.float64)
    if len(pts) < 3:
        return pts
    if not np.allclose(pts[0], pts[-1]):
        pts = np.vstack([pts, pts[0]])
    for _ in range(iterations):
        new = []
        for i in range(len(pts) - 1):
            p, q = pts[i], pts[i + 1]
            new.append(0.75 * p + 0.25 * q)
            new.append(0.25 * p + 0.75 * q)
        pts = np.array(new)
        pts = np.vstack([pts, pts[0]])
    return pts


def smooth_contour(contour: np.ndarray, style: str) -> np.ndarray:
    if style == "diagonal":
        eps, ck = 1.15, 0
    elif style == "organic":
        eps, ck = 0.32, 3
    else:
        eps, ck = 0.55, 0
    simp = approximate_polygon(contour, tolerance=eps)
    if len(simp) < 3:
        simp = contour
    if ck:
        simp = chaikin(simp, ck)
    return simp


def contour_to_xy(contour: np.ndarray, scale: int, pad: float = 1.0) -> list[tuple[float, float]]:
    rr = (contour[:, 0] - pad) * scale
    cc = (contour[:, 1] - pad) * scale
    return list(zip(cc.tolist(), rr.tolist()))


def enclosed_holes(comp: np.ndarray) -> np.ndarray:
    empty = ~comp
    lab, n = label(empty)
    border_ids = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(
        lab[:, -1].tolist()
    )
    border_ids.discard(0)
    holes = np.zeros_like(comp)
    for i in range(1, n + 1):
        if i in border_ids:
            continue
        region = lab == i
        if (binary_dilation(region, iterations=1) & comp).any():
            holes |= region
    return holes


def rasterize_component(comp: np.ndarray, style: str) -> tuple[np.ndarray, np.ndarray]:
    h0, w0 = comp.shape
    hi_h, hi_w = h0 * SCALE, w0 * SCALE
    holes_lo = enclosed_holes(comp)

    if style == "rectilinear":
        hard = (
            np.array(
                Image.fromarray((comp.astype(np.uint8) * 255)).resize(
                    (hi_w, hi_h), Image.NEAREST
                )
            )
            > 127
        )
        if holes_lo.any():
            hole_hi = (
                np.array(
                    Image.fromarray((holes_lo.astype(np.uint8) * 255)).resize(
                        (hi_w, hi_h), Image.NEAREST
                    )
                )
                > 127
            )
            hard = hard & ~hole_hi
        soft = distance_transform_edt(~hard)
        alpha = np.where(hard, 1.0, np.clip(1.0 - soft / 1.25, 0.0, 1.0)).astype(np.float32)
        if holes_lo.any():
            alpha = np.where(hole_hi & ~hard, 0.0, alpha)
        return hard, alpha

    padded = np.pad(comp.astype(float), 1, mode="constant", constant_values=0)
    contours = find_contours(padded, 0.5)
    if not contours:
        return np.zeros((hi_h, hi_w), dtype=bool), np.zeros((hi_h, hi_w), dtype=np.float32)

    contours = sorted(contours, key=len, reverse=True)
    img = Image.new("L", (hi_w, hi_h), 0)
    draw = ImageDraw.Draw(img)

    outer = smooth_contour(contours[0], style)
    draw.polygon(contour_to_xy(outer, SCALE), outline=255, fill=255)

    used_contour_holes = False
    hole_style = "rectilinear" if style != "organic" else style
    for c in contours[1:]:
        if len(c) < 4:
            continue
        if style == "diagonal":
            hole = approximate_polygon(c, tolerance=0.35)
            if len(hole) < 3:
                hole = c
        else:
            hole = smooth_contour(c, hole_style)
        draw.polygon(contour_to_xy(hole, SCALE), outline=0, fill=0)
        used_contour_holes = True

    hard = np.array(img) > 127

    if holes_lo.any():
        hole_hi = (
            np.array(
                Image.fromarray((holes_lo.astype(np.uint8) * 255)).resize(
                    (hi_w, hi_h), Image.NEAREST
                )
            )
            > 127
        )
        if used_contour_holes:
            core = hole_hi & ~binary_dilation(hard & ~hole_hi, iterations=1)
            hard = hard & ~core
        else:
            hard = hard & ~hole_hi

    expected = int(comp.sum()) * (SCALE * SCALE)
    if hard.sum() > expected * 1.4:
        hard = (
            np.array(
                Image.fromarray((comp.astype(np.uint8) * 255)).resize(
                    (hi_w, hi_h), Image.NEAREST
                )
            )
            > 127
        )
        if holes_lo.any():
            hole_hi = (
                np.array(
                    Image.fromarray((holes_lo.astype(np.uint8) * 255)).resize(
                        (hi_w, hi_h), Image.NEAREST
                    )
                )
                > 127
            )
            hard = hard & ~hole_hi

    soft = distance_transform_edt(~hard)
    alpha = np.where(hard, 1.0, np.clip(1.0 - soft / 1.25, 0.0, 1.0)).astype(np.float32)
    if holes_lo.any():
        hole_hi = (
            np.array(
                Image.fromarray((holes_lo.astype(np.uint8) * 255)).resize(
                    (hi_w, hi_h), Image.NEAREST
                )
            )
            > 127
        )
        alpha = np.where(hole_hi & ~hard, 0.0, alpha)

    return hard, alpha


def hash_noise(ys: np.ndarray, xs: np.ndarray, seed: int) -> np.ndarray:
    n = (
        xs.astype(np.int64) * 374761393
        + ys.astype(np.int64) * 668265263
        + seed * 982451653
    ) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return (n & 0xFFFF).astype(np.float32) / 65535.0


def colourise(
    hard: np.ndarray,
    alpha: np.ndarray,
    colour: tuple[int, int, int],
) -> np.ndarray:
    hi = hard.shape[0]
    rgb = np.zeros((hi, hi, 3), dtype=np.float32)
    if not hard.any():
        return rgb.astype(np.uint8)

    p = max(4, SCALE // 2)
    hard_p = np.pad(hard, p, mode="edge")
    dist_in = distance_transform_edt(hard_p)[p:-p, p:-p]
    max_d = float(dist_in.max()) or 1.0
    thickness = dist_in / max_d

    base = np.array(colour, dtype=np.float32)
    shade = 0.88 + 0.22 * thickness
    yy, xx = np.mgrid[0:hi, 0:hi]
    grain = (hash_noise(yy, xx, seed=int(base[0] + base[2] * 17)) - 0.5) * 14.0

    for c in range(3):
        channel = base[c] * shade + grain
        drift = (hash_noise(yy, xx, seed=100 + c * 31 + int(base[c])) - 0.5) * 6.0
        rgb[:, :, c] = np.clip(channel + drift, 0, 255)

    rgb = np.where(alpha[..., None] > 0.02, rgb, 0.0)
    return rgb.astype(np.uint8)


def downscale_rgba(
    rgb_hi: np.ndarray,
    alpha_hi: np.ndarray,
    furniture: bool,
) -> Image.Image:
    rgb_img = Image.fromarray(rgb_hi).resize((OUT, OUT), Image.LANCZOS)
    a_img = Image.fromarray((np.clip(alpha_hi, 0, 1) * 255).astype(np.uint8)).resize(
        (OUT, OUT), Image.LANCZOS
    )
    rgb_a = np.array(rgb_img)
    a = np.array(a_img).astype(np.float32) / 255.0

    if furniture:
        out = np.zeros((OUT, OUT, 4), dtype=np.uint8)
        vis = a > 0.04
        out[vis, :3] = rgb_a[vis]
        out[:, :, 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
        out[out[:, :, 3] < 10] = 0
    else:
        out = np.zeros((OUT, OUT, 4), dtype=np.uint8)
        out[:, :, 3] = 255
        a3 = a[..., None]
        out[:, :, :3] = (rgb_a.astype(np.float32) * a3).astype(np.uint8)
    return Image.fromarray(out)


def render_pair(
    mask16: np.ndarray, colour: tuple[int, int, int], furniture: bool
) -> tuple[Image.Image, Image.Image]:
    pad = 2
    work = np.pad(mask16, pad, mode="reflect")
    hi_h, hi_w = work.shape[0] * SCALE, work.shape[1] * SCALE
    hard = np.zeros((hi_h, hi_w), dtype=bool)
    alpha = np.zeros((hi_h, hi_w), dtype=np.float32)
    style = style_for(mask16)

    labeled, n = label(work)
    for i in range(1, n + 1):
        comp = labeled == i
        inner = comp[pad : pad + TS, pad : pad + TS]
        if not inner.any():
            continue
        comp_style = style if style == "organic" else style_for(inner)
        h, a = rasterize_component(comp, comp_style)
        hard |= h
        alpha = np.maximum(alpha, a)

    y0 = pad * SCALE
    x0 = pad * SCALE
    hard = hard[y0 : y0 + TS * SCALE, x0 : x0 + TS * SCALE]
    alpha = alpha[y0 : y0 + TS * SCALE, x0 : x0 + TS * SCALE]

    holes16 = enclosed_holes(mask16)
    if holes16.any():
        hi = TS * SCALE
        hole_hi = (
            np.array(
                Image.fromarray((holes16.astype(np.uint8) * 255)).resize((hi, hi), Image.NEAREST)
            )
            > 127
        )
        hard = hard & ~hole_hi
        soft = distance_transform_edt(~hard)
        alpha = np.where(hard, 1.0, np.clip(1.0 - soft / 1.25, 0.0, 1.0)).astype(np.float32)
        alpha = np.where(hole_hi, 0.0, alpha)

    rgb = colourise(hard, alpha, colour)
    visual = downscale_rgba(rgb, alpha, furniture)

    flat = np.zeros_like(rgb)
    flat[alpha > 0.02] = np.array(colour, dtype=np.uint8)
    collision = downscale_rgba(flat, alpha, furniture=True)
    return visual, collision


def enhance_image(path: Path, furniture: bool) -> tuple[Image.Image, Image.Image | None]:
    """Return (visual, collision_or_None). Collision only for furniture."""
    src = Image.open(path).convert("RGBA")
    if src.size != (OUT, OUT):
        src = src.resize((OUT, OUT), Image.NEAREST)
    arr = np.array(src)

    if furniture:
        coverage = float((arr[:, :, 3] > 0).mean())
    else:
        ink = ~((arr[:, :, 0] == 0) & (arr[:, :, 1] == 0) & (arr[:, :, 2] == 0))
        coverage = float(ink.mean())

    if coverage < 0.002:
        return src, None

    mask16 = recover_mask16(arr, furniture)
    if not mask16.any():
        return src, None

    colour = base_colour(arr, furniture)
    visual, collision = render_pair(mask16, colour, furniture)
    return visual, collision if furniture else None


def ensure_flat_backup(image_id: str, src: Path, kind: str) -> Path:
    dest_dir = BACKUP_DIR / kind
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{image_id}.png"
    if not dest.exists():
        dest.write_bytes(src.read_bytes())
    return dest


def main() -> None:
    furn_ids, terr_ids = rebelstar_image_ids()
    print(f"Enhancing furniture={len(furn_ids)} terrain={len(terr_ids)}")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    done = 0
    by_style = {"organic": 0, "diagonal": 0, "rectilinear": 0}

    for image_id in sorted(furn_ids):
        path = FURN_DIR / f"{image_id}.png"
        if not path.exists():
            print(f"  missing furniture image: {image_id}")
            continue
        source = ensure_flat_backup(image_id, path, "furniture")
        arr = np.array(Image.open(source).convert("RGBA"))
        mask = recover_mask16(arr, True)
        if mask.any():
            by_style[style_for(mask)] += 1
        visual, collision = enhance_image(source, furniture=True)
        visual.save(path)
        if collision is not None:
            collision.save(FURN_DIR / f"{image_id}-cl.png")
        done += 1
        if done % 25 == 0:
            print(f"  … furniture {done}/{len(furn_ids)}")

    for image_id in sorted(terr_ids):
        path = TERRAIN_DIR / f"{image_id}.png"
        if not path.exists():
            print(f"  missing terrain image: {image_id}")
            continue
        if image_id in {"moon-surface"}:
            continue
        source = ensure_flat_backup(image_id, path, "terrain")
        arr = np.array(Image.open(source).convert("RGBA"))
        mask = recover_mask16(arr, False)
        if mask.any():
            by_style[style_for(mask)] += 1
        visual, _ = enhance_image(source, furniture=False)
        visual.save(path)
        done += 1

    print(f"Wrote {done} enhanced images (+ CL silhouettes for furniture)")
    print(f"Styles: {by_style}")
    print(f"Flat sources cached in {BACKUP_DIR}")


if __name__ == "__main__":
    main()
