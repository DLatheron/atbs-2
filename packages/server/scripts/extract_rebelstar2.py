#!/usr/bin/env python3
"""Extract Rebelstar 2 tiles into ATBS furniture/terrain/map assets."""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(__file__).resolve().parent / "Rebelstar2.gif"
FURN_DIR = ROOT / "data" / "furniture"
TERRAIN_DIR = ROOT / "data" / "terrain"
MAPS_DIR = ROOT / "data" / "maps"
EDITOR_DIR = ROOT / "data" / "editor"

TS = 16
OUT = 100
MW = 80
MH = 50
TILE_SET = "Rebelstar 2"
ORIENTATIONS = (0, 2, 4, 6)
WALL_EDGE = "0-5-0"

# ZX-inspired recolours (ink -> these; paper stays black except empty floor)
C_GRASS = (0, 186, 0)
C_WATER = (0, 90, 220)
C_FLOOR_CHECK = (92, 92, 148)
C_FLOOR_WEAVE = (168, 118, 52)
C_FLOOR_STRIPE = (70, 140, 150)
C_FLOOR_ORNAMENT = (160, 50, 150)
C_FLOOR_EMPTY = (22, 22, 30)
C_WALL = (198, 198, 210)
C_DOOR = (220, 170, 40)
C_CREEPER = (28, 148, 42)
C_PLANT = (48, 210, 48)
C_BUSH = (20, 132, 68)
C_PALM = (0, 168, 88)
C_OBELISK = (186, 186, 204)
C_FLOWER = (210, 70, 200)


def tile_hash(img: Image.Image) -> str:
    return hashlib.md5(img.convert("RGB").tobytes()).hexdigest()


def rotate_cw(img: Image.Image) -> Image.Image:
    return img.transpose(Image.ROTATE_270)


def rotations_cw(img: Image.Image) -> list[Image.Image]:
    imgs = [img.convert("RGB")]
    for _ in range(3):
        imgs.append(rotate_cw(imgs[-1]))
    return imgs


def recolor(img: Image.Image, colour: tuple[int, int, int]) -> Image.Image:
    rgb = img.convert("RGB")
    hi = tuple(min(255, int(c * 1.35 + 20)) for c in colour)
    out = Image.new("RGB", rgb.size, (0, 0, 0))
    src = rgb.load()
    dst = out.load()
    w, h = rgb.size
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            if r == 0 and g == 0 and b == 0:
                continue
            dst[x, y] = hi if r >= 250 else colour
    return out


def upscale(img: Image.Image) -> Image.Image:
    rgb = img.convert("RGB").resize((OUT, OUT), Image.NEAREST)
    rgba = Image.new("RGBA", (OUT, OUT), (0, 0, 0, 0))
    px = rgb.load()
    out = rgba.load()
    for y in range(OUT):
        for x in range(OUT):
            r, g, b = px[x, y]
            if r == 0 and g == 0 and b == 0:
                out[x, y] = (0, 0, 0, 0)
            else:
                out[x, y] = (r, g, b, 255)
    return rgba


def make_cl(rgba: Image.Image) -> Image.Image:
    cl = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    src = rgba.load()
    dst = cl.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            if a > 0 and (r + g + b) > 0:
                dst[x, y] = (128, 128, 128, 255)
    return cl


def opaque_terrain(img: Image.Image) -> Image.Image:
    return img.convert("RGB").resize((OUT, OUT), Image.NEAREST).convert("RGBA")


def binary_mask(img: Image.Image) -> bytes:
    return bytes(0 if p == (0, 0, 0) else 1 for p in img.convert("RGB").getdata())


def hamming(a: bytes, b: bytes) -> int:
    return sum(x != y for x, y in zip(a, b))


@dataclass
class Family:
    canon_hash: str
    canon_img: Image.Image
    members: dict[str, int] = field(default_factory=dict)
    count: int = 0
    positions: list[tuple[int, int]] = field(default_factory=list)
    kind: str = "furniture"
    base_name: str = "unknown"
    image_id: str = ""
    furniture_id: str = ""
    terrain_id: str = ""
    wall_edges: list[str | None] | None = None
    movement: int = 40
    hit_points: int = 50
    material: str = "thin-wood.material"
    category: str = "Nature"
    colour: tuple[int, int, int] = C_PLANT
    display: str = ""
    skip: bool = False


def edge_counts(img: Image.Image) -> tuple[int, int, int, int]:
    px = img.convert("RGB").load()

    def on(p):
        return p != (0, 0, 0)

    n = sum(1 for x in range(TS) if on(px[x, 0]))
    s = sum(1 for x in range(TS) if on(px[x, TS - 1]))
    w = sum(1 for y in range(TS) if on(px[0, y]))
    e = sum(1 for y in range(TS) if on(px[TS - 1, y]))
    return n, e, s, w


def fill_count(img: Image.Image) -> int:
    return sum(1 for p in img.convert("RGB").getdata() if p != (0, 0, 0))


def quadrant_fills(img: Image.Image) -> tuple[int, int, int, int]:
    px = img.convert("RGB").load()

    def quad(x0: int, y0: int) -> int:
        return sum(
            1
            for y in range(y0, y0 + 8)
            for x in range(x0, x0 + 8)
            if px[x, y] != (0, 0, 0)
        )

    return quad(0, 0), quad(8, 0), quad(0, 8), quad(8, 8)


def has_axis_checker_split(img: Image.Image) -> bool:
    """True when some row/column is an 8-on / 8-off checker band."""
    px = img.convert("RGB").load()
    for y in range(TS):
        row = [px[x, y] != (0, 0, 0) for x in range(TS)]
        left, right = sum(row[:8]), sum(row[8:])
        if (left >= 7 and right <= 1) or (right >= 7 and left <= 1):
            return True
    for x in range(TS):
        col = [px[x, y] != (0, 0, 0) for y in range(TS)]
        top, bot = sum(col[:8]), sum(col[8:])
        if (top >= 7 and bot <= 1) or (bot >= 7 and top <= 1):
            return True
    return False


def is_checker_floor(img: Image.Image) -> bool:
    a, b, c, d = quadrant_fills(img)
    quads = (a >= 40 and d >= 40 and b <= 32 and c <= 32) or (
        b >= 40 and c >= 40 and a <= 32 and d <= 32
    )
    return quads and has_axis_checker_split(img)


def as_wall(fam: Family, base: str, display: str, edges: list[str | None] | None = None) -> None:
    fam.kind = "furniture"
    fam.base_name = base
    fam.category = "Walls"
    fam.colour = C_WALL
    fam.display = display
    fam.material = "thin-metal.material"
    fam.movement = 200
    fam.hit_points = 220
    fam.wall_edges = edges


def as_terrain(
    fam: Family, base: str, display: str, category: str, colour: tuple[int, int, int]
) -> None:
    fam.kind = "terrain"
    fam.base_name = base
    fam.category = category
    fam.colour = colour
    fam.display = display


def classify(fam: Family) -> None:
    img = fam.canon_img
    fill = fill_count(img)
    n, e, s, w = edge_counts(img)
    max_edge = max(n, e, s, w)
    min_edge = min(n, e, s, w)
    full_edges = sum(1 for v in (n, e, s, w) if v >= 14)
    indoor = (
        sum(1 for x, _y in fam.positions if x >= 54) >= max(1, fam.count) * 0.5
        if fam.positions
        else False
    )
    cx = (
        sum(p[0] for p in fam.positions) / len(fam.positions) if fam.positions else 0
    )

    if fam.skip or fam.count == 0:
        return

    if fill == 0:
        as_terrain(fam, "rs2-floor-empty", "Alien Floor", "Built", C_FLOOR_EMPTY)
        return

    if fill <= 28:
        as_terrain(fam, "rs2-grass", "Alien Grass", "Natural", C_GRASS)
        return

    # Grass tufts: sparse, no solid edge, not a door
    if fill <= 55 and max_edge < 8:
        as_terrain(fam, "rs2-grass", "Alien Grass", "Natural", C_GRASS)
        return

    if fill >= 200:
        as_terrain(fam, "rs2-water", "Water", "Natural", C_WATER)
        return

    # Coastline masses (filled water stipple with a solid edge) before floor patterns
    if full_edges >= 1 and fill >= 60 and not indoor:
        if full_edges >= 2:
            as_terrain(fam, "rs2-water-corner", "Water Corner", "Natural", C_WATER)
        else:
            as_terrain(fam, "rs2-water-shore", "Water Shore", "Natural", C_WATER)
        return

    if indoor:
        # Round 4-way hub
        if fill >= 160 and min_edge >= 6 and abs(n - s) <= 2 and abs(e - w) <= 2:
            as_wall(
                fam,
                "rs2-cross-wall",
                "Alien Wall Junction",
                [WALL_EDGE, WALL_EDGE, WALL_EDGE, WALL_EDGE],
            )
            return

        # Vertical wall column
        if n >= 6 and s >= 6 and e <= 2 and w <= 2 and fill >= 90:
            as_wall(fam, "rs2-wall", "Alien Wall", [WALL_EDGE, None, WALL_EDGE, None])
            return

        # Horizontal wall band
        if e >= 6 and w >= 6 and n <= 2 and s <= 2 and fill >= 80:
            as_wall(fam, "rs2-h-wall", "Alien Wall", [None, WALL_EDGE, None, WALL_EDGE])
            return

        # Thin door / airlock
        if fill <= 45 and ((e >= 6 and w >= 6) or (n >= 6 and s >= 6)):
            fam.kind = "furniture"
            fam.base_name = "rs2-door"
            fam.category = "Doors"
            fam.colour = C_DOOR
            fam.display = "Alien Door"
            fam.material = "thin-metal.material"
            fam.movement = 100
            fam.hit_points = 120
            fam.wall_edges = [WALL_EDGE, None, WALL_EDGE, None]
            return

        # Rounded / diagonal corner walls
        adjacent = (
            (n >= 6 and e >= 6 and s <= 2 and w <= 2)
            or (e >= 6 and s >= 6 and n <= 2 and w <= 2)
            or (s >= 6 and w >= 6 and n <= 2 and e <= 2)
            or (w >= 6 and n >= 6 and e <= 2 and s <= 2)
        )
        if adjacent and 50 <= fill <= 85 and max_edge < 14:
            as_wall(
                fam,
                "rs2-corner-wall",
                "Alien Corner Wall",
                [None, WALL_EDGE, WALL_EDGE, None],
            )
            return

        if is_checker_floor(img):
            as_terrain(fam, "rs2-floor-check", "Checked Floor", "Built", C_FLOOR_CHECK)
            return

        # Basket-weave floor
        if fill >= 130 and min_edge >= 4 and abs(n - s) <= 2 and abs(e - w) <= 2:
            as_terrain(fam, "rs2-floor-weave", "Woven Floor", "Built", C_FLOOR_WEAVE)
            return

        # Four-petal / ornate indoor floor
        if 110 <= fill <= 145 and max_edge <= 3:
            as_terrain(
                fam, "rs2-floor-ornament", "Ornate Floor", "Built", C_FLOOR_ORNAMENT
            )
            return

        # Diagonal stripe floor (two triangles)
        if 95 <= fill <= 125 and min_edge >= 7 and abs(n - e) <= 2:
            as_terrain(fam, "rs2-floor-stripe", "Striped Floor", "Built", C_FLOOR_STRIPE)
            return

        if fill >= 90:
            as_terrain(fam, "rs2-floor", "Alien Floor", "Built", C_FLOOR_CHECK)
            return

        as_wall(fam, "rs2-diag-wall", "Alien Diagonal Wall")
        return

    # Outdoor vegetation / rocks
    if cx < 22 and fill >= 70:
        fam.kind = "furniture"
        fam.base_name = "rs2-creeper"
        fam.category = "Nature"
        fam.colour = C_CREEPER
        fam.display = "Creeper Vine"
        fam.material = "thin-wood.material"
        fam.movement = 50
        fam.hit_points = 40
        return

    # Isolated standing stones / obelisks in open terrain
    if 80 <= fill <= 100 and max_edge <= 1:
        fam.kind = "furniture"
        fam.base_name = "rs2-obelisk"
        fam.category = "Exterior"
        fam.colour = C_OBELISK
        fam.display = "Obelisk"
        fam.material = "stone.material"
        fam.movement = 80
        fam.hit_points = 150
        return

    if fill >= 90:
        fam.kind = "furniture"
        fam.base_name = "rs2-palm"
        fam.category = "Nature"
        fam.colour = C_PALM
        fam.display = "Alien Palm"
        fam.material = "thin-wood.material"
        fam.movement = 40
        fam.hit_points = 50
        return

    if fill >= 60:
        fam.kind = "furniture"
        fam.base_name = "rs2-bush"
        fam.category = "Nature"
        fam.colour = C_BUSH
        fam.display = "Alien Bush"
        fam.material = "thin-wood.material"
        fam.movement = 30
        fam.hit_points = 35
        return

    fam.kind = "furniture"
    fam.base_name = "rs2-plant"
    fam.category = "Nature"
    fam.colour = C_FLOWER if fill < 50 else C_PLANT
    fam.display = "Star Flower" if fill < 50 else "Alien Plant"
    fam.material = "thin-wood.material"
    fam.movement = 15
    fam.hit_points = 20


def furniture_json(fam: Family) -> dict:
    return {
        "id": fam.furniture_id,
        "name": fam.display or fam.base_name.replace("-", " ").title(),
        "tileSet": TILE_SET,
        "category": fam.category,
        "description": [{"text": f"Rebelstar 2 {fam.display.lower()}"}],
        "renderable": {
            "default": {"default": [{"imageId": fam.image_id}], "destroyed": []},
            "FIRE_MODE": {"default": [{"imageId": f"{fam.image_id}-cl"}], "destroyed": []},
        },
        "materials": [fam.material],
        "hitPoints": {"max": fam.hit_points},
        "movementObstruction": {
            "default": {"default": fam.movement},
            "destroyed": {"default": 0},
        },
    }


def terrain_json(fam: Family) -> dict:
    return {
        "id": fam.terrain_id,
        "name": fam.display or fam.base_name.replace("-", " ").title(),
        "tileSet": TILE_SET,
        "category": fam.category,
        "description": [{"text": f"Rebelstar 2 {fam.display.lower()}"}],
        "renderable": {
            "default": [{"imageId": fam.image_id}],
            "FIRE_MODE": [],
        },
    }


def wipe_rs2_assets() -> None:
    for directory in (FURN_DIR, TERRAIN_DIR):
        for path in directory.glob("rs2-*"):
            path.unlink()


def unique_families(hash_to_family: dict[str, Family]) -> list[Family]:
    seen: set[int] = set()
    out: list[Family] = []
    for fam in hash_to_family.values():
        if id(fam) in seen:
            continue
        seen.add(id(fam))
        out.append(fam)
    return out


def main() -> None:
    wipe_rs2_assets()
    src = Image.open(SRC).convert("RGB")
    assert src.size == (MW * TS, MH * TS)

    grid_hash: list[list[str]] = []
    hash_to_img: dict[str, Image.Image] = {}
    for ty in range(MH):
        row = []
        for tx in range(MW):
            crop = src.crop((tx * TS, ty * TS, (tx + 1) * TS, (ty + 1) * TS))
            h = tile_hash(crop)
            hash_to_img[h] = crop
            row.append(h)
        grid_hash.append(row)

    hash_to_family: dict[str, Family] = {}
    for h, img in hash_to_img.items():
        if h in hash_to_family:
            continue
        rots = rotations_cw(img)
        rot_hashes = [tile_hash(r) for r in rots]
        canon_h = min(rot_hashes)
        canon_ori = rot_hashes.index(canon_h)
        canon_img = next(r for rh, r in zip(rot_hashes, rots) if rh == canon_h)
        fam = Family(canon_hash=canon_h, canon_img=canon_img)
        for k, rh in enumerate(rot_hashes):
            ori_steps = (k - canon_ori) % 4
            fam.members.setdefault(rh, ORIENTATIONS[ori_steps])
        for rh in rot_hashes:
            hash_to_family[rh] = fam

    for ty in range(MH):
        for tx in range(MW):
            fam = hash_to_family[grid_hash[ty][tx]]
            fam.count += 1
            fam.positions.append((tx, ty))

    # Credit glyphs live only in the bottom-right overlay — replace with best-fit nearby tile
    credit_fams = []
    for fam in unique_families(hash_to_family):
        if fam.count == 0:
            continue
        if fam.count <= 2 and all(tx >= 54 and ty >= 48 for tx, ty in fam.positions):
            fam.skip = True
            credit_fams.append(fam)

    credit_cells = [pos for fam in credit_fams for pos in fam.positions]
    pad = 2
    minx = max(0, min(x for x, _y in credit_cells) - pad)
    maxx = min(MW - 1, max(x for x, _y in credit_cells) + pad)
    miny = max(0, min(y for _x, y in credit_cells) - pad)
    maxy = min(MH - 1, max(y for _x, y in credit_cells) + pad)
    context_hashes: list[str] = []
    for ty in range(miny, maxy + 1):
        for tx in range(minx, maxx + 1):
            h = grid_hash[ty][tx]
            if not hash_to_family[h].skip:
                context_hashes.append(h)
    freq = Counter(context_hashes)
    context_hashes = [h for h, n in freq.items() if n >= 5] or [freq.most_common(1)[0][0]]
    context_masks = {h: binary_mask(hash_to_img[h]) for h in context_hashes}

    credit_replacements: list[tuple[int, int, str, int]] = []
    for fam in credit_fams:
        for tx, ty in list(fam.positions):
            src_mask = binary_mask(hash_to_img[grid_hash[ty][tx]])
            best_h = min(context_hashes, key=lambda h: hamming(src_mask, context_masks[h]))
            dist = hamming(src_mask, context_masks[best_h])
            grid_hash[ty][tx] = best_h
            credit_replacements.append((tx, ty, hash_to_family[best_h].canon_hash[:8], dist))

    for fam in unique_families(hash_to_family):
        fam.count = 0
        fam.positions = []
    for ty in range(MH):
        for tx in range(MW):
            fam = hash_to_family[grid_hash[ty][tx]]
            fam.count += 1
            fam.positions.append((tx, ty))

    fams = [f for f in unique_families(hash_to_family) if f.count > 0]
    for fam in fams:
        classify(fam)

    name_counts: Counter[str] = Counter()
    fams.sort(key=lambda f: (0 if f.kind == "terrain" else 1, -f.count, f.canon_hash))
    for fam in fams:
        if fam.skip:
            continue
        name_counts[fam.base_name] += 1
        n = name_counts[fam.base_name]
        fam.image_id = fam.base_name if n == 1 else f"{fam.base_name}-{n}"
        if fam.kind == "terrain":
            fam.terrain_id = f"{fam.image_id}.terrain"
        else:
            fam.furniture_id = f"{fam.image_id}.furniture"

    furniture_meta: list[Family] = []
    terrain_meta: list[Family] = []

    for fam in fams:
        if fam.skip:
            continue
        if fam.kind == "terrain" and fam.base_name == "rs2-floor-empty":
            coloured = Image.new("RGB", (TS, TS), fam.colour)
        else:
            coloured = recolor(fam.canon_img, fam.colour)
        if fam.kind == "terrain":
            opaque_terrain(coloured).save(TERRAIN_DIR / f"{fam.image_id}.png")
            (TERRAIN_DIR / f"{fam.image_id}.terrain.json").write_text(
                json.dumps(terrain_json(fam), indent=4) + "\n"
            )
            terrain_meta.append(fam)
            continue
        rgba = upscale(coloured)
        rgba.save(FURN_DIR / f"{fam.image_id}.png")
        make_cl(rgba).save(FURN_DIR / f"{fam.image_id}-cl.png")
        (FURN_DIR / f"{fam.image_id}.furniture.json").write_text(
            json.dumps(furniture_json(fam), indent=4) + "\n"
        )
        furniture_meta.append(fam)

    grass_id = next(f.terrain_id for f in terrain_meta if f.base_name == "rs2-grass")
    empty_floor = next(
        (f.terrain_id for f in terrain_meta if f.base_name == "rs2-floor-empty"), grass_id
    )
    indoor_cats = {"Walls", "Doors", "Computers", "Interior"}

    tiles_out = []
    for ty in range(MH):
        row_out = []
        for tx in range(MW):
            h = grid_hash[ty][tx]
            fam = hash_to_family[h]
            ori = fam.members.get(h, 0)
            if fam.kind == "terrain":
                row_out.append({"terrain": {"id": fam.terrain_id, "orientation": ori}})
                continue
            terrain = empty_floor if fam.category in indoor_cats else grass_id
            row_out.append(
                {
                    "terrain": {"id": terrain, "orientation": 0},
                    "furniture": {"id": fam.furniture_id, "orientation": ori},
                }
            )
        tiles_out.append(row_out)

    (MAPS_DIR / "alien-world.map.json").write_text(
        json.dumps(
            {
                "id": "alien-world.map",
                "name": "Alien World",
                "width": MW,
                "height": MH,
                "tileSize": OUT,
                "tiles": tiles_out,
            },
            indent=4,
        )
        + "\n"
    )

    palette_path = EDITOR_DIR / "furniture.furniturepalette.json"
    palette = json.loads(palette_path.read_text())
    palette["furniture"] = [
        e for e in palette["furniture"] if not str(e.get("id", "")).startswith("rs2-")
    ]
    existing_ids = {e["id"] for e in palette["furniture"]}

    def add_palette(entry: dict) -> None:
        if entry["id"] not in existing_ids:
            palette["furniture"].append(entry)
            existing_ids.add(entry["id"])

    for fam in sorted(furniture_meta, key=lambda f: f.image_id):
        add_palette(
            {
                "id": fam.image_id,
                "tiles": [[fam.furniture_id]],
                "allowRandomOrientation": fam.category in {"Nature", "Exterior"},
            }
        )
    palette_path.write_text(json.dumps(palette, indent=4) + "\n")

    wall_path = EDITOR_DIR / "wall.wallpalette.json"
    wall_palette = json.loads(wall_path.read_text())
    wall_palette["walls"] = [
        w for w in wall_palette["walls"] if not str(w.get("id", "")).startswith("rs2-")
    ]
    existing_walls = {w["id"] for w in wall_palette["walls"]}
    wanted = {
        "rs2-wall": [WALL_EDGE, None, WALL_EDGE, None],
        "rs2-h-wall": [None, WALL_EDGE, None, WALL_EDGE],
        "rs2-corner-wall": [None, WALL_EDGE, WALL_EDGE, None],
        "rs2-cross-wall": [WALL_EDGE, WALL_EDGE, WALL_EDGE, WALL_EDGE],
        "rs2-door": [WALL_EDGE, None, WALL_EDGE, None],
    }
    by_image = {f.image_id: f for f in furniture_meta}
    for name, edges in wanted.items():
        match = by_image.get(name)
        if match and match.furniture_id not in existing_walls:
            wall_palette["walls"].append({"id": match.furniture_id, "edges": edges})
            existing_walls.add(match.furniture_id)
    wall_path.write_text(json.dumps(wall_palette, indent=4) + "\n")

    terrain_path = EDITOR_DIR / "terrain.terrainpalette.json"
    terrain_palette = json.loads(terrain_path.read_text())
    terrain_palette["terrains"] = [
        tid for tid in terrain_palette["terrains"] if not str(tid).startswith("rs2-")
    ]
    no_rand = {tid for tid in terrain_palette.get("noRandomOrientation", []) if not str(tid).startswith("rs2-")}
    for fam in terrain_meta:
        if fam.terrain_id not in terrain_palette["terrains"]:
            terrain_palette["terrains"].append(fam.terrain_id)
        if fam.base_name.startswith("rs2-floor") or fam.base_name.startswith("rs2-water"):
            no_rand.add(fam.terrain_id)
    terrain_palette["noRandomOrientation"] = list(no_rand)
    terrain_path.write_text(json.dumps(terrain_palette, indent=4) + "\n")

    kinds = Counter((f.kind, f.base_name) for f in fams if not f.skip)
    print(
        json.dumps(
            {
                "grid": [MW, MH],
                "families": len(fams),
                "credit_cells_replaced": len(credit_replacements),
                "credit_replacements": [
                    {"x": x, "y": y, "canon": canon, "hamming": dist}
                    for x, y, canon, dist in credit_replacements
                ],
                "furniture": len(furniture_meta),
                "terrain": len(terrain_meta),
                "kinds": {f"{k[0]}:{k[1]}": v for k, v in sorted(kinds.items())},
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
