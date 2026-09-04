#!/usr/bin/env python3
"""
Preview Rebelstar tile enhancement (examples only — does not write game assets).

Approach:
  1. Recover true 16×16 masks from flat 100×100 NN upscales.
  2. Per connected component, vectorize contours, collapse stair-steps with
     Douglas–Peucker (rebuilds diagonals), then light Chaikin on organics.
  3. Rasterize + soft AA; punch hole cores so grates stay open.
  4. Lock tile-border cells to the original mask so adjacent tiles still tessellate.
  5. Visual: rotation-safe colour variation (edge distance + grain).
  6. Collision (-cl): same silhouette/alpha, flat material colour only.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_dilation, distance_transform_edt, label
from skimage.measure import approximate_polygon, find_contours

ROOT = Path(__file__).resolve().parents[1]
BACKUP = Path(__file__).resolve().parent / "_rebelstar_flat_backup"
OUT_DIR = Path(__file__).resolve().parent / "_enhance_preview"
TS, OUT = 16, 100
SCALE = 8  # work at 128×128 then downscale to 100

EXAMPLES = [
    ("furniture", "cyan-wall.png", True),
    ("furniture", "yellow-machine.png", True),
    ("furniture", "rs2-corner-wall.png", True),
    ("furniture", "rs2-creeper.png", True),
    ("terrain", "rs2-water-shore.png", False),
]


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
    """Max fraction of ±1 steps along the four silhouette profiles."""
    scores: list[float] = []
    for flip, axis in ((False, 1), (True, 1), (False, 0), (True, 0)):
        m = np.flip(mask, axis=axis) if flip else mask
        profile: list[int] = []
        if axis == 1:
            for r in range(TS):
                cols = np.where(m[r])[0]
                profile.append(int(cols.max()) if cols.size else -1)
        else:
            for c in range(TS):
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
    """
    organic     — vines etc.: keep Chaikin look, mild DP
    diagonal    — shores/corner walls: rebuild stairs as true diagonals
    rectilinear — boxes/grates: light corner soften only
    """
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
    """
    diagonal    → aggressive DP (stairs → straight diagonals), tiny Chaikin
    organic     → mild DP + strong Chaikin (creeper look you liked)
    rectilinear → modest DP, light Chaikin (round box corners without melting)
    """
    if style == "diagonal":
        # Strong DP collapses stair runs into long straight (often 45°) segments.
        # No Chaikin — that re-introduces bumps along the rebuilt diagonal.
        eps, ck = 1.15, 0
    elif style == "organic":
        eps, ck = 0.32, 3
    else:
        # Boxes / grates: keep long edges straight. Chaikin waves walls.
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
    """Empty cells fully enclosed within this component (not open to tile exterior)."""
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
        # must touch this component
        if (binary_dilation(region, iterations=1) & comp).any():
            holes |= region
    return holes


def rasterize_component(comp: np.ndarray, style: str) -> tuple[np.ndarray, np.ndarray]:
    h0, w0 = comp.shape
    hi_h, hi_w = h0 * SCALE, w0 * SCALE
    holes_lo = enclosed_holes(comp)

    if style == "rectilinear":
        # Keep axis-aligned geometry exact (walls, grates). Only add soft AA.
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

    # Prefer explicit hole contours when present; else punch from hole mask
    used_contour_holes = False
    hole_style = "rectilinear" if style != "organic" else style
    for c in contours[1:]:
        if len(c) < 4:
            continue
        # Holes in walls/machines stay rectilinear (no diagonal melting of grate slits)
        if style == "diagonal":
            hole = smooth_contour(c, "rectilinear")
            # but rectilinear smooth_contour still DP — for holes use raw approx mild
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
            # keep cores clear even if AA crept in
            core = hole_hi & ~binary_dilation(hard & ~hole_hi, iterations=1)
            hard = hard & ~core
        else:
            hard = hard & ~hole_hi

    # Topology guard: if ink blew up, fall back to NN for this component
    expected = int(comp.sum()) * (SCALE * SCALE)
    if hard.sum() > expected * 1.4:
        hard = (
            np.array(
                Image.fromarray((comp.astype(np.uint8) * 255)).resize((hi_w, hi_h), Image.NEAREST)
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
        # no AA glow inside hole cores
        alpha = np.where(hole_hi & ~hard, 0.0, alpha)

    return hard, alpha



def hash_noise(ys: np.ndarray, xs: np.ndarray, seed: int) -> np.ndarray:
    n = (xs.astype(np.int64) * 374761393 + ys.astype(np.int64) * 668265263 + seed * 982451653) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    n = n ^ (n >> 16)
    return (n & 0xFFFF).astype(np.float32) / 65535.0


def colourise(
    hard: np.ndarray,
    alpha: np.ndarray,
    colour: tuple[int, int, int],
) -> np.ndarray:
    """Rotation-safe detail: brighter toward medial axis + fine grain. No light direction."""
    hi = hard.shape[0]
    rgb = np.zeros((hi, hi, 3), dtype=np.float32)
    if not hard.any():
        return rgb.astype(np.uint8)

    # Pad so ink that touches the image rim isn't treated as "thin" by EDT
    # (otherwise highlights die in the outer ~few pixels of full-height walls etc.)
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
    """Returns (visual, collision) images.

    Reflect-pads the 16×16 mask before smoothing so contours continue through
    the tile rim (Chaikin otherwise pulls ink inward, leaving a dead outer band).
    Crop back to the tile after rasterize.
    """
    pad = 2  # extra reflected cells so Chaikin can't eat the rim
    work = np.pad(mask16, pad, mode="reflect")
    hi_h, hi_w = work.shape[0] * SCALE, work.shape[1] * SCALE
    hard = np.zeros((hi_h, hi_w), dtype=bool)
    alpha = np.zeros((hi_h, hi_w), dtype=np.float32)
    style = style_for(mask16)

    labeled, n = label(work)
    for i in range(1, n + 1):
        comp = labeled == i
        # Classify from the original-tile portion of this component
        inner = comp[pad : pad + TS, pad : pad + TS]
        if not inner.any():
            continue
        comp_style = style if style == "organic" else style_for(inner)
        h, a = rasterize_component(comp, comp_style)
        hard |= h
        alpha = np.maximum(alpha, a)

    y0 = pad * SCALE
    x0 = pad * SCALE
    y1 = y0 + TS * SCALE
    x1 = x0 + TS * SCALE
    hard = hard[y0:y1, x0:x1]
    alpha = alpha[y0:y1, x0:x1]

    # Re-punch holes from the original (unpadded) topology
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


def checkerboard(size: int, cell: int = 10) -> Image.Image:
    img = Image.new("RGB", (size, size), (40, 40, 40))
    px = img.load()
    for y in range(size):
        for x in range(size):
            if ((x // cell) + (y // cell)) % 2:
                px[x, y] = (55, 55, 55)
    return img


def composite_on_bg(tile: Image.Image) -> Image.Image:
    bg = checkerboard(tile.size[0])
    return Image.alpha_composite(bg.convert("RGBA"), tile.convert("RGBA")).convert("RGB")


def side_by_side(before: Image.Image, after: Image.Image, label: str) -> Image.Image:
    gap = 8
    label_h = 22
    w = OUT * 2 + gap
    canvas = Image.new("RGB", (w, OUT + label_h), (20, 20, 20))
    canvas.paste(composite_on_bg(before), (0, label_h))
    canvas.paste(composite_on_bg(after), (OUT + gap, label_h))
    draw = ImageDraw.Draw(canvas)
    draw.text((4, 4), f"{label}  |  LEFT: flat   RIGHT: proposed visual", fill=(200, 200, 200))
    return canvas


def triple(before: Image.Image, visual: Image.Image, collision: Image.Image, label: str) -> Image.Image:
    gap = 8
    label_h = 22
    w = OUT * 3 + gap * 2
    canvas = Image.new("RGB", (w, OUT + label_h), (20, 20, 20))
    canvas.paste(composite_on_bg(before), (0, label_h))
    canvas.paste(composite_on_bg(visual), (OUT + gap, label_h))
    canvas.paste(composite_on_bg(collision), (OUT * 2 + gap * 2, label_h))
    draw = ImageDraw.Draw(canvas)
    draw.text(
        (4, 4),
        f"{label}  |  flat  →  visual (detail)  →  collision (flat material)",
        fill=(200, 200, 200),
    )
    return canvas


def tessellation_strip(tiles: list[Image.Image], label: str) -> Image.Image:
    """2×2 of the same tile to show edge seams."""
    label_h = 22
    canvas = Image.new("RGB", (OUT * 2, OUT * 2 + label_h), (20, 20, 20))
    for i, t in enumerate(tiles[:4]):
        r, c = divmod(i, 2)
        canvas.paste(composite_on_bg(t), (c * OUT, label_h + r * OUT))
    draw = ImageDraw.Draw(canvas)
    draw.text((4, 4), label, fill=(200, 200, 200))
    return canvas


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    creeper_vis = None

    for kind, name, furniture in EXAMPLES:
        src_path = BACKUP / kind / name
        arr = np.array(Image.open(src_path).convert("RGBA"))
        colour = base_colour(arr, furniture)
        mask16 = recover_mask16(arr, furniture)
        style = style_for(mask16)
        visual, collision = render_pair(mask16, colour, furniture)
        before = Image.open(src_path).convert("RGBA")

        if furniture:
            b_ink = int((np.array(before)[:, :, 3] > 0).sum())
            a_ink = int((np.array(visual)[:, :, 3] > 40).sum())
        else:
            b_ink = int((np.array(before)[:, :, :3].sum(axis=2) > 0).sum())
            a_ink = int((np.array(visual)[:, :, :3].sum(axis=2) > 0).sum())

        empty = ~mask16
        lab, n = label(empty)
        holes = 0
        border = set(lab[0].tolist() + lab[-1].tolist() + lab[:, 0].tolist() + lab[:, -1].tolist())
        for i in range(1, n + 1):
            if i not in border:
                holes += int((lab == i).sum())

        triple(before, visual, collision, name).save(OUT_DIR / f"compare_{name}")
        visual.save(OUT_DIR / f"proposed_{name}")
        collision.save(OUT_DIR / f"proposed_cl_{name}")
        if name == "rs2-creeper.png":
            creeper_vis = visual
        print(
            f"{name}: style={style} stair={edge_stairiness(mask16):.3f} "
            f"ink16={mask16.sum()} hole_cells16={holes} "
            f"flat_px={b_ink} proposed_px={a_ink} delta={a_ink - b_ink} colour={colour}"
        )

    # Tessellation check: real adjacent creeper tiles from the map (not the same tile 4×)
    try:
        import json as _json

        map_path = ROOT / "data" / "maps" / "alien-world.map.json"
        if map_path.exists():
            obj = _json.loads(map_path.read_text())
            best = None
            for r in range(len(obj["tiles"]) - 1):
                for c in range(len(obj["tiles"][0]) - 1):
                    ids = []
                    ok = True
                    for dr in (0, 1):
                        for dc in (0, 1):
                            f = (obj["tiles"][r + dr][c + dc].get("furniture") or {})
                            fid = f.get("id", "")
                            if "creeper" not in fid:
                                ok = False
                                break
                            ids.append((fid, int(f.get("orientation", 0))))
                        if not ok:
                            break
                    if ok:
                        best = (r, c, ids)
                        break
                if best:
                    break
            if best:
                r, c, ids = best
                # Orientation values 0/2/4/6 → CW quarter-turns from stored image
                rot_cw = {0: 0, 2: 90, 4: 180, 6: 270}

                def load_enhanced(fid: str, orientation: int) -> Image.Image:
                    image_id = fid.replace(".furniture", "")
                    bp = BACKUP / "furniture" / f"{image_id}.png"
                    src = bp if bp.exists() else ROOT / "data" / "furniture" / f"{image_id}.png"
                    a = np.array(Image.open(src).convert("RGBA"))
                    v, _ = render_pair(recover_mask16(a, True), base_colour(a, True), True)
                    deg = rot_cw.get(orientation, 0)
                    # PIL rotate is CCW; game orientation is CW quarters
                    if deg:
                        v = v.rotate(-deg, expand=False)
                    return v

                tiles = [load_enhanced(fid, ori) for fid, ori in ids]
                tessellation_strip(
                    tiles, f"creeper map 2×2 @ ({r},{c}) — real neighbors, watch seams"
                ).save(OUT_DIR / "tessellate_rs2-creeper.png")
    except Exception as exc:
        print(f"(tessellation preview skipped: {exc})")

    shore_path = BACKUP / "terrain" / "rs2-water-shore.png"
    if shore_path.exists():
        arr = np.array(Image.open(shore_path).convert("RGBA"))
        colour = base_colour(arr, False)
        mask16 = recover_mask16(arr, False)
        visual, _ = render_pair(mask16, colour, False)
        # also load a rotated member if present
        tiles = [visual]
        for alt in ("rs2-water-shore-2.png", "rs2-water-shore-5.png", "rs2-water-shore-8.png"):
            p = BACKUP / "terrain" / alt
            if not p.exists():
                p = ROOT / "data" / "terrain" / alt
            if p.exists():
                a = np.array(Image.open(p).convert("RGBA"))
                # prefer backup-flat if available via recover from live (may already be flat)
                m = recover_mask16(a, False)
                v, _ = render_pair(m, base_colour(a, False), False)
                tiles.append(v)
            if len(tiles) == 4:
                break
        while len(tiles) < 4:
            tiles.append(visual)
        tessellation_strip(tiles[:4], "water-shore variants 2×2").save(
            OUT_DIR / "tessellate_rs2-water-shore.png"
        )


if __name__ == "__main__":
    main()
