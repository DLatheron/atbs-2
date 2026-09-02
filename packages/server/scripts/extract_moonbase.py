#!/usr/bin/env python3
"""Extract Rebelstar Moonbase Delta tiles into ATBS furniture/terrain/map assets."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(__file__).resolve().parent / "Rebelstar1.png"
FURN_DIR = ROOT / "data" / "furniture"
TERRAIN_DIR = ROOT / "data" / "terrain"
MAPS_DIR = ROOT / "data" / "maps"
EDITOR_DIR = ROOT / "data" / "editor"

# Playable area inside the double blue border
LEFT, TOP, RIGHT, BOTTOM = 38, 40, 1318, 840
TS = 16  # source tile size
OUT = 100  # project tile size
MW = (RIGHT - LEFT) // TS  # 80
MH = (BOTTOM - TOP) // TS  # 50

ORIENTATIONS = (0, 2, 4, 6)


def tile_hash(img: Image.Image) -> str:
    return hashlib.md5(img.convert("RGB").tobytes()).hexdigest()


def rotate_cw(img: Image.Image) -> Image.Image:
    # 90° CW == PIL ROTATE_270; matches Orientation.EAST sampling
    return img.transpose(Image.ROTATE_270)


def rotations_cw(img: Image.Image) -> list[Image.Image]:
    imgs = [img.convert("RGB")]
    for _ in range(3):
        imgs.append(rotate_cw(imgs[-1]))
    return imgs


def upscale(img: Image.Image) -> Image.Image:
    """16x16 RGB -> 100x100 RGBA with black made transparent."""
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
    """Terrain tiles stay fully opaque (black floors included)."""
    return img.convert("RGB").resize((OUT, OUT), Image.NEAREST).convert("RGBA")


def slug(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


@dataclass
class Family:
    canon_hash: str
    canon_img: Image.Image
    members: dict[str, int] = field(default_factory=dict)  # hash -> orientation
    count: int = 0
    examples: list[tuple[int, int]] = field(default_factory=list)
    kind: str = "furniture"
    base_name: str = "unknown"
    image_id: str = ""
    furniture_id: str = ""
    terrain_id: str = ""
    multi_tile: str | None = None  # e.g. moonbuggy / fuel-tank
    multi_xy: tuple[int, int] | None = None
    wall_edges: list[str | None] | None = None
    movement: int = 40
    hit_points: int = 50
    material: str = "thin-metal.material"


def classify_colors(img: Image.Image) -> dict:
    colors = Counter(img.convert("RGB").getdata())
    total = TS * TS

    def n(*rgbs):
        return sum(colors.get(c, 0) for c in rgbs)

    black = n((0, 0, 0))
    cyan = n((0, 255, 255), (0, 204, 204))
    green = n((0, 255, 0), (0, 204, 0))
    yellow = n((255, 255, 0), (204, 204, 0))
    magenta = n((255, 0, 255), (204, 0, 204))
    white = n((255, 255, 255), (204, 204, 204))
    blue = n((0, 0, 255), (0, 0, 204))
    red = n((255, 0, 0), (204, 0, 0))
    return {
        "black": black,
        "cyan": cyan,
        "green": green,
        "yellow": yellow,
        "magenta": magenta,
        "white": white,
        "blue": blue,
        "red": red,
        "ncolors": len(colors),
        "nonblack": total - black,
        "colors": colors,
    }


def edge_cyan_mask(img: Image.Image) -> tuple[bool, bool, bool, bool]:
    """Return (N,E,S,W) whether cyan touches that edge."""
    px = img.convert("RGB").load()

    def is_cyan(p):
        return p in ((0, 255, 255), (0, 204, 204))

    n = any(is_cyan(px[x, 0]) for x in range(TS))
    s = any(is_cyan(px[x, TS - 1]) for x in range(TS))
    w = any(is_cyan(px[0, y]) for y in range(TS))
    e = any(is_cyan(px[TS - 1, y]) for y in range(TS))
    return n, e, s, w


def classify_family(fam: Family) -> None:
    c = classify_colors(fam.canon_img)
    nonblack = c["nonblack"]
    if nonblack == 0:
        fam.kind = "empty"
        fam.base_name = "empty"
        return

    # Grass terrain: mostly green, little else
    if c["green"] >= 20 and c["cyan"] == 0 and c["yellow"] == 0 and c["magenta"] + c["blue"] + c["red"] < 8:
        other = c["white"]
        if other < 25:
            fam.kind = "terrain"
            fam.base_name = "garden-grass"
            fam.material = "concrete.material"
            return

    # Structural cyan walls / airlocks
    if c["cyan"] >= 40 and c["cyan"] >= c["yellow"] and c["cyan"] >= c["magenta"] and c["cyan"] >= c["green"]:
        edges = edge_cyan_mask(fam.canon_img)
        edge_count = sum(edges)
        if c["yellow"] >= 12:
            fam.base_name = "cyan-airlock"
            fam.movement = 100
            fam.hit_points = 150
        elif c["red"] >= 12:
            fam.base_name = "cyan-medlock"
            fam.movement = 100
            fam.hit_points = 150
        elif edge_count >= 1 and c["cyan"] / max(nonblack, 1) > 0.45:
            n, e, s, w = edges
            if edge_count == 4:
                fam.base_name = "cyan-cross-wall"
                fam.wall_edges = ["0-3-0", "0-3-0", "0-3-0", "0-3-0"]
            elif edge_count == 3:
                fam.base_name = "cyan-t-wall"
                fam.wall_edges = ["0-3-0", "0-3-0", "0-3-0", None]
            elif edge_count == 2 and ((n and s) or (e and w)):
                fam.base_name = "cyan-wall"
                fam.wall_edges = ["0-3-0", None, "0-3-0", None]
            elif edge_count == 2:
                fam.base_name = "cyan-corner-wall"
                fam.wall_edges = [None, "0-3-0", "0-3-0", None]
            else:
                fam.base_name = "cyan-wall-cap"
            fam.movement = 200
            fam.hit_points = 200
            fam.material = "thin-metal.material"
        else:
            fam.base_name = "cyan-fixture"
            fam.movement = 80
            fam.hit_points = 80
        fam.kind = "furniture"
        return

    # Blue tanks / circles — corner/edge/center named after multi-tile pass
    if c["blue"] >= 60:
        fam.base_name = "fuel-tank-part"
        fam.movement = 180
        fam.hit_points = 220
        fam.material = "thin-metal.material"
        return

    # Yellow machinery / chairs / vehicles
    if c["yellow"] >= 40:
        if c["yellow"] >= 90:
            fam.base_name = "yellow-machine"
            fam.movement = 100
            fam.hit_points = 120
        else:
            fam.base_name = "yellow-chair"
            fam.movement = 30
            fam.hit_points = 40
            fam.material = "thin-metal.material"
        return

    # Magenta furniture
    if c["magenta"] >= 40:
        fam.base_name = "magenta-console"
        fam.movement = 60
        fam.hit_points = 70
        return

    # Green plants / bunks (with other colours or denser)
    if c["green"] >= 40:
        if c["magenta"] + c["white"] + c["yellow"] > 5:
            fam.base_name = "garden-plant"
            fam.movement = 40
            fam.hit_points = 30
            fam.material = "thin-wood.material"
        else:
            fam.base_name = "green-bunk"
            fam.movement = 60
            fam.hit_points = 60
        return

    # White rocks / craters / ladders
    if c["white"] >= 20:
        if c["white"] >= 60:
            fam.base_name = "moon-crater"
        else:
            fam.base_name = "moon-rock"
        fam.movement = 20
        fam.hit_points = 80
        fam.material = "stone.material"
        return

    # Red markers
    if c["red"] >= 40:
        fam.base_name = "red-marker"
        fam.movement = 10
        fam.hit_points = 20
        return

    fam.base_name = "misc-fixture"
    fam.movement = 40
    fam.hit_points = 50


def furniture_json(fam: Family) -> dict:
    if fam.multi_tile == "moonbuggy":
        display = "Moonbuggy"
    elif fam.multi_tile == "fuel-tank":
        display = {
            "fuel-tank-corner": "Fuel Tank Corner",
            "fuel-tank-edge": "Fuel Tank Edge",
            "fuel-tank-centre": "Fuel Tank Centre",
        }.get(fam.base_name, "Fuel Tank")
    else:
        display = fam.base_name.replace("-", " ").title()

    return {
        "id": fam.furniture_id,
        "name": display,
        "description": [{"text": f"Moonbase Delta {display.lower()}"}],
        "renderable": {
            "default": {
                "default": [{"imageId": fam.image_id}],
                "destroyed": [],
            },
            "FIRE_MODE": {
                "default": [{"imageId": f"{fam.image_id}-cl"}],
                "destroyed": [],
            },
        },
        "materials": [fam.material],
        "hitPoints": {"max": fam.hit_points},
        "movementObstruction": {
            "default": {"default": fam.movement},
            "destroyed": {"default": 0},
        },
    }


def terrain_json(terrain_id: str, name: str, image_id: str, description: str) -> dict:
    return {
        "id": terrain_id,
        "name": name,
        "category": "Terrain",
        "description": [{"text": description}],
        "renderable": {
            "default": [{"imageId": image_id}],
            "FIRE_MODE": [],
        },
    }


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    assert (RIGHT - LEFT) % TS == 0 and (BOTTOM - TOP) % TS == 0

    # Grid of raw tile images / hashes
    grid_hash: list[list[str]] = []
    hash_to_img: dict[str, Image.Image] = {}
    for ty in range(MH):
        row = []
        for tx in range(MW):
            crop = src.crop((LEFT + tx * TS, TOP + ty * TS, LEFT + (tx + 1) * TS, TOP + (ty + 1) * TS))
            h = tile_hash(crop)
            hash_to_img[h] = crop
            row.append(h)
        grid_hash.append(row)

    empty_hash = tile_hash(Image.new("RGB", (TS, TS), (0, 0, 0)))

    # Rotation families
    hash_to_family: dict[str, Family] = {}
    families: dict[str, Family] = {}

    for h, img in hash_to_img.items():
        if h in hash_to_family:
            continue
        rots = rotations_cw(img)
        rot_hashes = [tile_hash(r) for r in rots]
        # Prefer the rotation that maximises a stable "upright" heuristic:
        # more content in top half for asymmetric tiles; else lexicographic min hash
        scored = []
        for i, (rh, rim) in enumerate(zip(rot_hashes, rots)):
            top = sum(1 for y in range(TS // 2) for x in range(TS) if rim.getpixel((x, y)) != (0, 0, 0))
            scored.append((rh, i, top, rim))
        # Canon = minimum hash among rotations (stable)
        canon_h = min(rot_hashes)
        canon_img = next(rim for rh, i, top, rim in scored if rh == canon_h)
        canon_ori_of_first = rot_hashes.index(canon_h)
        # For each rotation of original img, orientation needed to reproduce it from canon:
        # rot_hashes[k] is original rotated k*90 CW.
        # canon is original rotated canon_ori_of_first * 90 CW.
        # To get rot_hashes[k] from canon: rotate canon by (k - canon_ori_of_first) CW.
        fam = Family(canon_hash=canon_h, canon_img=canon_img)
        for k, rh in enumerate(rot_hashes):
            ori_steps = (k - canon_ori_of_first) % 4
            # Prefer lowest orientation when a tile is rotationally symmetric
            fam.members.setdefault(rh, ORIENTATIONS[ori_steps])
        families[canon_h] = fam
        for rh in rot_hashes:
            hash_to_family[rh] = fam

    # Counts / examples
    for ty in range(MH):
        for tx in range(MW):
            h = grid_hash[ty][tx]
            fam = hash_to_family[h]
            fam.count += 1
            if len(fam.examples) < 3:
                fam.examples.append((tx, ty))

    for fam in families.values():
        classify_family(fam)

    # --- Multi-tile: moonbuggy 2x2 (four unique tiles) ---
    buggy_origin = (13, 22)
    buggy_cell_names = {
        (0, 0): "moonbuggy-0-0",
        (1, 0): "moonbuggy-1-0",
        (0, 1): "moonbuggy-0-1",
        (1, 1): "moonbuggy-1-1",
    }
    for dy in range(2):
        for dx in range(2):
            h = grid_hash[buggy_origin[1] + dy][buggy_origin[0] + dx]
            fam = hash_to_family[h]
            fam.kind = "furniture"
            fam.base_name = buggy_cell_names[(dx, dy)]
            fam.multi_tile = "moonbuggy"
            fam.multi_xy = (dx, dy)
            fam.movement = 150
            fam.hit_points = 200
            fam.material = "thin-metal.material"
            # Keep this cell's exact pixels as canon (pieces are not rotations of each other)
            fam.canon_img = hash_to_img[h]
            fam.canon_hash = h
            rots = rotations_cw(fam.canon_img)
            fam.members = {tile_hash(r): ORIENTATIONS[i] for i, r in enumerate(rots)}
            for rh in fam.members:
                hash_to_family[rh] = fam

    # --- Multi-tile: fuel tank 3x3 collapses to corner / edge / centre via rotation ---
    tank_origin = (44, 23)
    tank_corner_h = grid_hash[tank_origin[1]][tank_origin[0]]  # 0,0
    tank_edge_h = grid_hash[tank_origin[1]][tank_origin[0] + 1]  # 1,0
    tank_centre_h = grid_hash[tank_origin[1] + 1][tank_origin[0] + 1]  # 1,1
    for h, name, xy in (
        (tank_corner_h, "fuel-tank-corner", (0, 0)),
        (tank_edge_h, "fuel-tank-edge", (1, 0)),
        (tank_centre_h, "fuel-tank-centre", (1, 1)),
    ):
        fam = hash_to_family[h]
        fam.kind = "furniture"
        fam.base_name = name
        fam.multi_tile = "fuel-tank"
        fam.multi_xy = xy
        fam.movement = 180
        fam.hit_points = 220
        fam.material = "thin-metal.material"
        fam.canon_img = hash_to_img[h]
        fam.canon_hash = h
        rots = rotations_cw(fam.canon_img)
        fam.members = {}
        for i, r in enumerate(rots):
            rh = tile_hash(r)
            # Prefer the lowest orientation when tiles are rotationally symmetric
            fam.members.setdefault(rh, ORIENTATIONS[i])
        for rh in fam.members:
            hash_to_family[rh] = fam

    # Oriented fuel-tank palette layout (relative to corner/edge canons above)
    fuel_tank_palette_tiles = [
        [
            {"id": "fuel-tank-corner.furniture", "orientation": 0},
            {"id": "fuel-tank-edge.furniture", "orientation": 0},
            {"id": "fuel-tank-corner.furniture", "orientation": 2},
        ],
        [
            {"id": "fuel-tank-edge.furniture", "orientation": 6},
            {"id": "fuel-tank-centre.furniture", "orientation": 0},
            {"id": "fuel-tank-edge.furniture", "orientation": 2},
        ],
        [
            {"id": "fuel-tank-corner.furniture", "orientation": 6},
            {"id": "fuel-tank-edge.furniture", "orientation": 4},
            {"id": "fuel-tank-corner.furniture", "orientation": 4},
        ],
    ]

    # Assign unique names for remaining families
    name_counts: Counter[str] = Counter()
    # Rebuild family set from hash map after multi-tile remaps (drop orphans)
    seen_fam_ids: set[int] = set()
    unique_fams: list[Family] = []
    for fam in hash_to_family.values():
        if id(fam) in seen_fam_ids:
            continue
        seen_fam_ids.add(id(fam))
        unique_fams.append(fam)

    unique_fams.sort(key=lambda f: (0 if f.multi_tile else 1, -f.count, f.canon_hash))

    families = {}
    for fam in unique_fams:
        families[fam.canon_hash] = fam
        for rh in fam.members:
            hash_to_family[rh] = fam

    for fam in unique_fams:
        if fam.kind == "empty":
            continue
        base = fam.base_name
        name_counts[base] += 1
        n = name_counts[base]
        if fam.multi_tile or n == 1:
            final = base
        else:
            final = f"{base}-{n}"

        fam.image_id = final
        if fam.kind == "terrain":
            fam.terrain_id = f"{final}.terrain"
        else:
            fam.furniture_id = f"{final}.furniture"

    # --- Write images + JSON ---
    written_images: set[str] = set()
    furniture_meta: list[Family] = []
    terrain_meta: list[Family] = []

    # moon-surface terrain (solid black)
    moon_img = Image.new("RGBA", (OUT, OUT), (0, 0, 0, 255))
    moon_img.save(TERRAIN_DIR / "moon-surface.png")
    (TERRAIN_DIR / "moon-surface.terrain.json").write_text(
        json.dumps(
            terrain_json(
                "moon-surface.terrain",
                "Moon Surface",
                "moon-surface",
                "Barren lunar regolith.",
            ),
            indent=4,
        )
        + "\n"
    )

    for fam in unique_fams:
        if fam.kind == "empty":
            continue
        if fam.kind == "terrain":
            img = opaque_terrain(fam.canon_img)
            img.save(TERRAIN_DIR / f"{fam.image_id}.png")
            (TERRAIN_DIR / f"{fam.image_id}.terrain.json").write_text(
                json.dumps(
                    terrain_json(
                        fam.terrain_id,
                        fam.image_id.replace("-", " ").title(),
                        fam.image_id,
                        "Garden grass inside the moonbase.",
                    ),
                    indent=4,
                )
                + "\n"
            )
            terrain_meta.append(fam)
            written_images.add(fam.image_id)
            continue

        rgba = upscale(fam.canon_img)
        rgba.save(FURN_DIR / f"{fam.image_id}.png")
        make_cl(rgba).save(FURN_DIR / f"{fam.image_id}-cl.png")
        (FURN_DIR / f"{fam.image_id}.furniture.json").write_text(
            json.dumps(furniture_json(fam), indent=4) + "\n"
        )
        furniture_meta.append(fam)
        written_images.add(fam.image_id)

    # --- Build map grid ---
    # Track which cells are covered by multi-tile placement at orientation 0
    # For map fidelity we place per-cell furniture matching each tile's family+orientation
    # (multi-tile pieces are still individual furniture cells, like big-tree)

    def resolve_cell(tx: int, ty: int) -> tuple[str | None, int, str]:
        """Return (furniture_id|None, orientation, terrain_id)."""
        h = grid_hash[ty][tx]
        if h == empty_hash:
            return None, 0, "moon-surface.terrain"
        fam = hash_to_family[h]
        ori = fam.members.get(h, 0)
        if fam.kind == "terrain":
            return None, 0, fam.terrain_id
        # Furniture on grass if green-heavy, else moon surface
        c = classify_colors(hash_to_img[h])
        terrain = (
            "garden-grass.terrain"
            if c["green"] >= 30 and fam.base_name.startswith("garden")
            else "moon-surface.terrain"
        )
        # If a garden-grass terrain variant exists and cell has grass furniture... keep moon/grass:
        if c["green"] >= 40 and fam.base_name.startswith("garden-plant"):
            terrain = "garden-grass.terrain"
        return fam.furniture_id, ori, terrain

    # Prefer the primary garden-grass terrain id if we created numbered variants under cells
    # Fix: grass terrain cells use their specific variant id from resolve

    tiles_out = []
    for ty in range(MH):
        row_out = []
        for tx in range(MW):
            furniture_id, ori, terrain_id = resolve_cell(tx, ty)
            cell: dict = {"terrain": {"id": terrain_id, "orientation": 0}}
            if furniture_id:
                cell["furniture"] = {"id": furniture_id, "orientation": ori}
            row_out.append(cell)
        tiles_out.append(row_out)

    map_obj = {
        "id": "moonbase.map",
        "name": "Moonbase Delta",
        "width": MW,
        "height": MH,
        "tileSize": OUT,
        "tiles": tiles_out,
    }
    (MAPS_DIR / "moonbase.map.json").write_text(json.dumps(map_obj, indent=4) + "\n")

    # --- Update furniture palette ---
    palette_path = EDITOR_DIR / "furniture.furniturepalette.json"
    palette = json.loads(palette_path.read_text())
    existing_ids = {e["id"] for e in palette["furniture"]}

    def add_palette(entry):
        if entry["id"] not in existing_ids:
            palette["furniture"].append(entry)
            existing_ids.add(entry["id"])

    # Moonbuggy 2x2
    add_palette(
        {
            "id": "moonbuggy",
            "tiles": [
                ["moonbuggy-0-0.furniture", "moonbuggy-1-0.furniture"],
                ["moonbuggy-0-1.furniture", "moonbuggy-1-1.furniture"],
            ],
            "allowRandomOrientation": True,
        }
    )
    # Fuel tank 3x3 (corner/edge/centre + orientation)
    add_palette(
        {
            "id": "fuel-tank",
            "tiles": fuel_tank_palette_tiles,
            "allowRandomOrientation": False,
        }
    )

    # Add single-tile furniture (skip multi pieces individually except uniques)
    for fam in sorted(furniture_meta, key=lambda f: f.image_id):
        if fam.multi_tile:
            continue
        add_palette(
            {
                "id": fam.image_id,
                "tiles": [[fam.furniture_id]],
                "allowRandomOrientation": fam.base_name.startswith(
                    ("moon-", "garden-", "yellow-chair", "misc")
                ),
            }
        )

    palette_path.write_text(json.dumps(palette, indent=4) + "\n")

    # --- Update wall palette with cyan wall family ---
    wall_path = EDITOR_DIR / "wall.wallpalette.json"
    wall_palette = json.loads(wall_path.read_text())
    existing_walls = {w["id"] for w in wall_palette["walls"]}

    wall_defs = []
    for fam in furniture_meta:
        if fam.wall_edges and fam.furniture_id not in existing_walls:
            # Only add primary named walls (not numbered extras) when edges known
            if fam.image_id in {
                "cyan-wall",
                "cyan-corner-wall",
                "cyan-t-wall",
                "cyan-cross-wall",
                "cyan-airlock",
            }:
                wall_defs.append({"id": fam.furniture_id, "edges": fam.wall_edges})

    # Ensure we have at least straight/corner/t/cross if classified under numbered names
    wanted = {
        "cyan-wall": ["0-3-0", None, "0-3-0", None],
        "cyan-corner-wall": [None, "0-3-0", "0-3-0", None],
        "cyan-t-wall": ["0-3-0", "0-3-0", "0-3-0", None],
        "cyan-cross-wall": ["0-3-0", "0-3-0", "0-3-0", "0-3-0"],
    }
    by_image = {f.image_id: f for f in furniture_meta}
    for name, edges in wanted.items():
        # find family whose image_id starts with name
        match = by_image.get(name) or next(
            (f for f in furniture_meta if f.image_id.startswith(name)), None
        )
        if match and match.furniture_id not in existing_walls and match.furniture_id not in {
            w["id"] for w in wall_defs
        }:
            wall_defs.append({"id": match.furniture_id, "edges": edges})

    wall_palette["walls"].extend(wall_defs)
    wall_path.write_text(json.dumps(wall_palette, indent=4) + "\n")

    # --- Terrain palette ---
    terrain_path = EDITOR_DIR / "terrain.terrainpalette.json"
    terrain_palette = json.loads(terrain_path.read_text())
    for tid in ("garden-grass.terrain", "moon-surface.terrain"):
        if tid not in terrain_palette["terrains"]:
            # insert after grass if present
            terrains = terrain_palette["terrains"]
            if "grass.terrain" in terrains:
                idx = terrains.index("grass.terrain") + 1
                terrains.insert(idx, tid)
            else:
                terrains.append(tid)
    no_rand = set(terrain_palette.get("noRandomOrientation", []))
    no_rand.add("moon-surface.terrain")
    terrain_palette["noRandomOrientation"] = list(no_rand)
    terrain_path.write_text(json.dumps(terrain_palette, indent=4) + "\n")

    # Summary
    summary = {
        "grid": [MW, MH],
        "unique_families": len(unique_fams),
        "furniture": len(furniture_meta),
        "terrain_variants": len(terrain_meta),
        "images": sorted(written_images),
        "wall_palette_added": wall_defs,
        "moonbuggy_cells": 4,
        "fuel_tank_parts": 3,
    }
    print(json.dumps(summary, indent=2))
    print(
        f"Wrote map {MAPS_DIR / 'moonbase.map.json'} "
        f"({MW}x{MH}), furniture={len(furniture_meta)}, terrain={len(terrain_meta)+1}"
    )


if __name__ == "__main__":
    main()
