#!/usr/bin/env python3
"""Extract Hostage Crisis atlases and convert Mansion-Full.json to the current map format."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OLD_ROOT = ROOT.parents[2] / "atbs.old"
ATLAS_FURNITURE = OLD_ROOT / "public" / "atlases" / "terrain-atlas.png"
ATLAS_TERRAIN = OLD_ROOT / "public" / "atlases" / "atlas.jpg"
OLD_MAP = OLD_ROOT / "public" / "HostageCrisis" / "Mansion-Full.json"

FURN_DIR = ROOT / "data" / "furniture"
TERRAIN_DIR = ROOT / "data" / "terrain"
BLEND_DIR = ROOT / "data" / "blend"
MAPS_DIR = ROOT / "data" / "maps"
EDITOR_DIR = ROOT / "data" / "editor"

TS = 100
TILE_SET_PHOTO = "Photo"
TILE_SET_DEFAULT = "Default"

# Wall matching families: thick (40px) and thin (20px) from the old atlas.
THICK_EDGE = "0-6-0"
THIN_EDGE = "0-7-0"

# Old 0-3 (90°) -> new 0/2/4/6 (N/E/S/W).
def to_orientation(old: int) -> int:
    return (int(old) % 4) * 2


def crop_tile(image: Image.Image, col: int, row: int, size: int = TS) -> Image.Image:
    return image.crop((col * size, row * size, (col + 1) * size, (row + 1) * size))


def make_cl(rgba: Image.Image) -> Image.Image:
    cl = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    src = rgba.load()
    dst = cl.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = src[x, y]
            if a > 0 and (r + g + b) > 0:
                dst[x, y] = (128, 128, 128, 255)
    return cl


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=4) + "\n")


def terrain_recipe(terrain_id: str, name: str, image_id: str, description: str, category: str, tile_set: str) -> dict:
    return {
        "id": terrain_id,
        "name": name,
        "tileSet": tile_set,
        "category": category,
        "description": [{"text": description}],
        "renderable": {
            "default": [{"imageId": image_id}],
            "FIRE_MODE": [],
        },
    }


def blend_recipe(blend_id: str, name: str, image_id: str, description: str) -> dict:
    return {
        "id": blend_id,
        "name": name,
        "category": "Blend",
        "description": [{"text": description}],
        "renderable": {
            "default": [{"imageId": image_id}],
            "FIRE_MODE": [],
        },
    }


def furniture_recipe(
    furniture_id: str,
    name: str,
    image_id: str,
    description: str,
    category: str,
    materials: list[str],
    hit_points: int,
    movement: int,
    tile_set: str = TILE_SET_DEFAULT,
) -> dict:
    return {
        "id": furniture_id,
        "name": name,
        "tileSet": tile_set,
        "category": category,
        "description": [{"text": description}],
        "renderable": {
            "default": {
                "default": [{"imageId": image_id}],
                "destroyed": [],
            },
            "FIRE_MODE": {
                "default": [{"imageId": f"{image_id}-cl"}],
                "destroyed": [],
            },
        },
        "materials": materials,
        "hitPoints": {"max": hit_points},
        "movementObstruction": {
            "default": {"default": movement},
            "destroyed": {"default": 0},
        },
    }


def save_furniture_images(image_id: str, tile: Image.Image) -> None:
    rgba = tile.convert("RGBA")
    rgba.save(FURN_DIR / f"{image_id}.png")
    make_cl(rgba).save(FURN_DIR / f"{image_id}-cl.png")


PHOTO_TERRAIN = [
    # atlas.jpg is 8x4 of 100px photo tiles (incorrectly named vs terrain-atlas.png).
    {"col": 0, "row": 0, "id": "gravel", "name": "Gravel", "category": "Natural", "description": "Coarse dark gravel and soil."},
    {"col": 1, "row": 0, "id": "sandy-rock", "name": "Sandy Rock", "category": "Natural", "description": "Layered reddish sandy rock."},
    {"col": 2, "row": 0, "id": "cracked-earth", "name": "Cracked Earth", "category": "Natural", "description": "Sun-baked cracked earth."},
    {"col": 3, "row": 0, "id": "loam", "name": "Loam", "category": "Natural", "description": "Dark organic loam."},
    {"col": 4, "row": 0, "id": "moss-grass", "name": "Moss Grass", "category": "Natural", "description": "Fine mossy grass."},
    {"col": 5, "row": 0, "id": "muddy-grass", "name": "Muddy Grass", "category": "Natural", "description": "Dry, muddy grass."},
    {"col": 6, "row": 0, "id": "coarse-grass", "name": "Coarse Grass", "category": "Natural", "description": "Patchy coarse grass."},
    {"col": 7, "row": 0, "id": "dead-grass", "name": "Dead Grass", "category": "Natural", "description": "Dark olive dead grass."},
    {"col": 0, "row": 1, "id": "slate", "name": "Slate", "category": "Natural", "description": "Blue-grey slate."},
    {"col": 1, "row": 1, "id": "limestone", "name": "Limestone", "category": "Natural", "description": "Weathered light grey stone."},
    {"col": 2, "row": 1, "id": "craggy-rock", "name": "Craggy Rock", "category": "Natural", "description": "Rough grey rock."},
    {"col": 3, "row": 1, "id": "layered-sandstone", "name": "Layered Sandstone", "category": "Natural", "description": "Striated tan sandstone."},
    {"col": 4, "row": 1, "id": "olive-plaster", "name": "Olive Plaster", "category": "Built", "description": "Smooth olive plaster."},
    {"col": 5, "row": 1, "id": "volcanic-rock", "name": "Volcanic Rock", "category": "Natural", "description": "Jagged dark volcanic rock."},
    {"col": 6, "row": 1, "id": "sandy-plaster", "name": "Sandy Plaster", "category": "Built", "description": "Warm sandy plaster."},
    {"col": 7, "row": 1, "id": "beige-ground", "name": "Beige Ground", "category": "Natural", "description": "Flat beige earth."},
    {"col": 0, "row": 2, "id": "straw", "name": "Straw", "category": "Natural", "description": "Vertical straw and fibre."},
    {"col": 1, "row": 2, "id": "red-rock", "name": "Red Rock", "category": "Natural", "description": "Banded red sedimentary rock."},
    {"col": 2, "row": 2, "id": "grey-slab", "name": "Grey Slab", "category": "Built", "description": "Flat grey stone slab."},
    {"col": 3, "row": 2, "id": "brown-gravel", "name": "Brown Gravel", "category": "Natural", "description": "Fine brown gravel."},
    {"col": 4, "row": 2, "id": "cream-ground", "name": "Cream Ground", "category": "Built", "description": "Smooth cream surface."},
    {"col": 5, "row": 2, "id": "grey-gravel", "name": "Grey Gravel", "category": "Natural", "description": "Crushed light grey gravel."},
    {"col": 6, "row": 2, "id": "asphalt", "name": "Asphalt", "category": "Built", "description": "Dark asphalt."},
    {"col": 7, "row": 2, "id": "pebble-concrete", "name": "Pebble Concrete", "category": "Built", "description": "Concrete with embedded pebbles."},
    {"col": 0, "row": 3, "id": "fine-sand", "name": "Fine Sand", "category": "Natural", "description": "Fine light brown sand."},
    {"col": 1, "row": 3, "id": "wildflowers", "name": "Wildflowers", "category": "Natural", "description": "Foliage with purple wildflowers."},
    {"col": 2, "row": 3, "id": "forest-floor", "name": "Forest Floor", "category": "Natural", "description": "Leafy forest floor."},
    {"col": 3, "row": 3, "id": "brown-forest-floor", "name": "Brown Forest Floor", "category": "Natural", "description": "Dry brown forest floor."},
    {"col": 4, "row": 3, "id": "river-pebbles", "name": "River Pebbles", "category": "Natural", "description": "Rounded river pebbles."},
    {"col": 5, "row": 3, "id": "rusty-stone", "name": "Rusty Stone", "category": "Natural", "description": "Weathered rusty stone."},
    {"col": 6, "row": 3, "id": "orange-sandstone", "name": "Orange Sandstone", "category": "Natural", "description": "Warm orange sandstone."},
    {"col": 7, "row": 3, "id": "speckled-sand", "name": "Speckled Sand", "category": "Natural", "description": "Speckled gold-tan sand."},
]

PHOTO_NO_RANDOM = {
    "layered-sandstone.terrain",
    "straw.terrain",
    "red-rock.terrain",
    "wildflowers.terrain",
}

# Geometric walls from terrain-atlas.png (the furniture atlas, despite the filename).
WALLS = [
    {
        "id": "thick-wall",
        "name": "Thick Wall",
        "col": 0,
        "row": 2,
        "edges": [None, THICK_EDGE, None, THICK_EDGE],
        "hit_points": 250,
        "movement": 250,
        "description": "A thick masonry wall.",
    },
    {
        "id": "thick-corner-wall",
        "name": "Thick Wall Corner",
        "col": 1,
        "row": 2,
        "edges": [None, None, THICK_EDGE, THICK_EDGE],
        "hit_points": 250,
        "movement": 250,
        "description": "The corner of a thick masonry wall.",
    },
    {
        "id": "thick-t-junction-wall",
        "name": "Thick Wall T-Junction",
        "col": 2,
        "row": 2,
        "edges": [None, THICK_EDGE, THICK_EDGE, THICK_EDGE],
        "hit_points": 250,
        "movement": 250,
        "description": "A thick masonry wall T-junction.",
    },
    {
        "id": "thick-cross-wall",
        "name": "Thick Wall 4-Way Junction",
        "col": 3,
        "row": 2,
        "edges": [THICK_EDGE, THICK_EDGE, THICK_EDGE, THICK_EDGE],
        "hit_points": 250,
        "movement": 250,
        "description": "A four-way thick masonry wall junction.",
    },
    {
        "id": "thick-to-thin-t-junction",
        "name": "Thick-to-Thin Wall T-Junction",
        "col": 4,
        "row": 2,
        "edges": [None, THICK_EDGE, THIN_EDGE, THICK_EDGE],
        "hit_points": 180,
        "movement": 220,
        "description": "A T-junction joining thick and thin walls.",
    },
    {
        "id": "thin-wall",
        "name": "Thin Wall",
        "col": 0,
        "row": 4,
        "edges": [None, THIN_EDGE, None, THIN_EDGE],
        "hit_points": 140,
        "movement": 200,
        "description": "A thin interior wall.",
    },
    {
        "id": "thin-corner-wall",
        "name": "Thin Wall Corner",
        "col": 1,
        "row": 4,
        "edges": [None, None, THIN_EDGE, THIN_EDGE],
        "hit_points": 140,
        "movement": 200,
        "description": "The corner of a thin interior wall.",
    },
    {
        "id": "thin-t-junction-wall",
        "name": "Thin Wall T-Junction",
        "col": 2,
        "row": 4,
        "edges": [None, THIN_EDGE, THIN_EDGE, THIN_EDGE],
        "hit_points": 140,
        "movement": 200,
        "description": "A thin interior wall T-junction.",
    },
    {
        "id": "thin-cross-wall",
        "name": "Thin Wall 4-Way Junction",
        "col": 3,
        "row": 4,
        "edges": [THIN_EDGE, THIN_EDGE, THIN_EDGE, THIN_EDGE],
        "hit_points": 140,
        "movement": 200,
        "description": "A four-way thin interior wall junction.",
    },
    {
        "id": "thick-to-thin-wall",
        "name": "Thick-to-Thin Wall",
        "col": 4,
        "row": 4,
        "edges": [None, THIN_EDGE, None, THICK_EDGE],
        "hit_points": 180,
        "movement": 220,
        "description": "A straight join between thick and thin walls.",
    },
]

SLICE_CATEGORY = {
    "grass": "terrain",
    "tiles": "terrain",
    "blocks": "terrain",
    "concrete": "terrain",
    "tarmac": "terrain",
    "mud": "terrain",
    "wd-flr": "terrain",
    "sand": "terrain",
    "mask-1/2": "blend",
    "mask-1/4": "blend",
    "mask-3/4": "blend",
    "mask-star": "blend",
    "mask-path": "blend",
    "wall-straight": "wall",
    "wall-corner": "wall",
    "wall-t-junction": "wall",
    "wall-crossroads": "wall",
    "thin-wall-straight": "wall",
    "thin-wall-corner": "wall",
    "thin-wall-t-junction": "wall",
    "thin-wall-crossroads": "wall",
    "thick-to-thin-t-junction": "wall",
    "thick-to-thin-wall": "wall",
    "fountain": "furniture",
    "bush-1": "furniture",
    "bush-2": "furniture",
    "bush-3": "furniture",
    "bush-5": "furniture",
    "bush-6": "furniture",
    "bush-8": "furniture",
    "fern-1": "furniture",
    "rose-bush": "furniture",
    "cactus": "furniture",
    "conifier-small": "furniture",
    "door-closed": "furniture",
    "door-open": "furniture",
    "tree-large-top-left": "furniture",
    "tree-large-top-right": "furniture",
    "tree-large-bottom-left": "furniture",
    "tree-large-bottom-right": "furniture",
    "conifer-large-top-left": "furniture",
    "conifer-large-top-right": "furniture",
    "conifer-large-bottom-left": "furniture",
    "conifer-large-bottom-right": "furniture",
    "palm-tree-large-top-left": "furniture",
    "palm-tree-large-top-right": "furniture",
    "palm-tree-large-bottom-left": "furniture",
    "palm-tree-large-bottom-right": "furniture",
    "red-deployment": "marker",
    "blue-deployment": "marker",
    "green-deployment": "marker",
    "pink-deployment": "marker",
    "red-safe": "marker",
    "blue-safe": "marker",
    "green-safe": "marker",
    "pink-safe": "marker",
}

TERRAIN_ID = {
    "grass": "grass.terrain",
    "tarmac": "tarmac.terrain",
    "wd-flr": "wooden-blocks.terrain",
    "concrete": "concrete.terrain",
    "blocks": "grey-blocks.terrain",
    "tiles": "red-tiles.terrain",
    "sand": "sand.terrain",
    "mud": "dried-earth.terrain",
}

TERRAIN_IMAGE = {
    "grass": "grass",
    "tarmac": "tarmac",
    "wd-flr": "wooden-blocks",
    "concrete": "concrete",
    "blocks": "grey-blocks",
    "tiles": "red-tiles",
    "sand": "sand",
    "mud": "dried-earth",
}

BLEND_ID = {
    "mask-1/2": "half",
    "mask-1/4": "quarter",
    "mask-3/4": "three-quarter",
    "mask-star": "star",
    "mask-path": "three-quarter",
}

FURNITURE_ID = {
    "wall-straight": "thick-wall.furniture",
    "wall-corner": "thick-corner-wall.furniture",
    "wall-t-junction": "thick-t-junction-wall.furniture",
    "wall-crossroads": "thick-cross-wall.furniture",
    "thin-wall-straight": "thin-wall.furniture",
    "thin-wall-corner": "thin-corner-wall.furniture",
    "thin-wall-t-junction": "thin-t-junction-wall.furniture",
    "thin-wall-crossroads": "thin-cross-wall.furniture",
    "thick-to-thin-t-junction": "thick-to-thin-t-junction.furniture",
    "thick-to-thin-wall": "thick-to-thin-wall.furniture",
    "fountain": "fountain.furniture",
    # Atlas bush-1/bush-3 are missing; keep named furniture. Other atlas ids
    # already exist under the Default tileset with matching pixels.
    "bush-1": "bush-1.furniture",
    "bush-2": "bush-2.furniture",
    "bush-3": "bush-3.furniture",
    "bush-5": "bush-3.furniture",
    "bush-6": "bush-1.furniture",
    "bush-8": "flower-bush.furniture",
    "fern-1": "fern.furniture",
    "rose-bush": "rose-bush.furniture",
    "tree-large-top-left": "big-tree-0-0.furniture",
    "tree-large-top-right": "big-tree-1-0.furniture",
    "tree-large-bottom-left": "big-tree-0-1.furniture",
    "tree-large-bottom-right": "big-tree-1-1.furniture",
    "conifer-large-top-left": "big-bush-0-0.furniture",
    "conifer-large-top-right": "big-bush-1-0.furniture",
    "conifer-large-bottom-left": "big-bush-0-1.furniture",
    "conifer-large-bottom-right": "big-bush-1-1.furniture",
    "palm-tree-large-top-left": "palm-tree-0-0.furniture",
    "palm-tree-large-top-right": "palm-tree-1-0.furniture",
    "palm-tree-large-bottom-left": "palm-tree-0-1.furniture",
    "palm-tree-large-bottom-right": "palm-tree-1-1.furniture",
    "cactus": "cactus.furniture",
    "conifier-small": "bush-4.furniture",
    "door-closed": "mansion-door.furniture",
    "door-open": "mansion-door.furniture",
}

FURNITURE_STATE = {
    "door-open": "open",
}

THIN_WALL_IDS = {
    "thin-wall-straight",
    "thin-wall-corner",
    "thin-wall-t-junction",
    "thin-wall-crossroads",
}


def parse_cell(encoded: str | None) -> list[tuple[str, int, str]]:
    if not encoded:
        return []
    slices = []
    for part in encoded.split(","):
        values = part.strip().split(" ")
        if len(values) != 3:
            raise ValueError(f"Invalid encoded tile: {part!r}")
        slices.append((values[0], int(values[1]), values[2]))
    return slices


def compound_terrain_id(
    overlay_image: str,
    overlay_ori: int,
    blend_image: str,
    blend_ori: int,
    base_image: str,
    base_ori: int,
) -> str:
    # Colour.Blend keeps terrain1 where the mask is opaque. Old destination-out
    # punches a hole where the mask is opaque and destination-over fills it with
    # the overlay, so overlay is terrain1 (background) and base is terrain2.
    return (
        f"{overlay_image}[{overlay_ori}]_{blend_image}[{blend_ori}]_"
        f"{base_image}[{base_ori}].terrain"
    )


def convert_cell(encoded: str | None) -> dict:
    slices = parse_cell(encoded)

    base: tuple[str, int] | None = None
    blend: tuple[str, int] | None = None
    overlay: tuple[str, int] | None = None
    furniture: tuple[str, int] | None = None
    furniture_state: str | None = None

    for slice_id, old_ori, _comp in slices:
        category = SLICE_CATEGORY.get(slice_id)
        ori = to_orientation(old_ori)
        if category == "terrain":
            if base is None and blend is None:
                base = (slice_id, ori)
            else:
                overlay = (slice_id, ori)
        elif category == "blend":
            blend = (slice_id, ori)
        elif category in {"wall", "furniture"}:
            furniture = (slice_id, ori)
            furniture_state = FURNITURE_STATE.get(slice_id)
        elif category == "marker":
            continue
        else:
            raise ValueError(f"Unknown slice id in mansion map: {slice_id}")

    cell: dict = {}

    if base and overlay and blend and TERRAIN_IMAGE[base[0]] != TERRAIN_IMAGE[overlay[0]]:
        cell["terrain"] = {
            "id": compound_terrain_id(
                TERRAIN_IMAGE[overlay[0]],
                overlay[1],
                BLEND_ID[blend[0]],
                blend[1],
                TERRAIN_IMAGE[base[0]],
                base[1],
            ),
            "orientation": 0,
        }
    elif overlay:
        cell["terrain"] = {"id": TERRAIN_ID[overlay[0]], "orientation": overlay[1]}
    elif base:
        cell["terrain"] = {"id": TERRAIN_ID[base[0]], "orientation": base[1]}
    else:
        fallback = (
            "wooden-blocks.terrain"
            if furniture and furniture[0] in THIN_WALL_IDS
            else "grass.terrain"
        )
        cell["terrain"] = {"id": fallback, "orientation": 0}

    if furniture:
        placed: dict = {
            "id": FURNITURE_ID[furniture[0]],
            "orientation": furniture[1],
        }
        if furniture_state:
            placed["state"] = furniture_state
        cell["furniture"] = placed

    return cell


def extract_photo_terrain(atlas: Image.Image) -> list[str]:
    ids: list[str] = []
    for spec in PHOTO_TERRAIN:
        image_id = spec["id"]
        terrain_id = f"{image_id}.terrain"
        tile = crop_tile(atlas, spec["col"], spec["row"]).convert("RGBA")
        tile.save(TERRAIN_DIR / f"{image_id}.png")
        write_json(
            TERRAIN_DIR / f"{image_id}.terrain.json",
            terrain_recipe(
                terrain_id,
                spec["name"],
                image_id,
                spec["description"],
                spec["category"],
                TILE_SET_PHOTO,
            ),
        )
        ids.append(terrain_id)
    return ids


def extract_walls_and_furniture(atlas: Image.Image) -> None:
    for spec in WALLS:
        image_id = spec["id"]
        tile = crop_tile(atlas, spec["col"], spec["row"])
        save_furniture_images(image_id, tile)
        write_json(
            FURN_DIR / f"{image_id}.furniture.json",
            furniture_recipe(
                f"{image_id}.furniture",
                spec["name"],
                image_id,
                spec["description"],
                "Walls",
                ["concrete.material"],
                spec["hit_points"],
                spec["movement"],
            ),
        )

    cactus = crop_tile(atlas, 3, 7)
    save_furniture_images("cactus", cactus)
    write_json(
        FURN_DIR / "cactus.furniture.json",
        furniture_recipe(
            "cactus.furniture",
            "Cactus",
            "cactus",
            "A small, spiky cactus.",
            "Nature",
            ["thin-wood.material"],
            25,
            10,
        ),
    )

    star = crop_tile(atlas, 2, 3)
    star.save(BLEND_DIR / "star.png")
    write_json(
        BLEND_DIR / "star.blend.json",
        blend_recipe("star.blend", "Star Blend", "star", "A star-shaped terrain blend."),
    )


def update_palettes(photo_terrain_ids: list[str]) -> None:
    terrain_path = EDITOR_DIR / "terrain.terrainpalette.json"
    terrain_palette = json.loads(terrain_path.read_text())
    for terrain_id in photo_terrain_ids:
        if terrain_id not in terrain_palette["terrains"]:
            terrain_palette["terrains"].append(terrain_id)
    no_random = terrain_palette.get("noRandomOrientation", [])
    for terrain_id in PHOTO_NO_RANDOM:
        if terrain_id not in no_random:
            no_random.append(terrain_id)
    terrain_palette["noRandomOrientation"] = no_random
    if "star.blend" not in terrain_palette["blends"]:
        terrain_palette["blends"].append("star.blend")
    write_json(terrain_path, terrain_palette)

    furniture_path = EDITOR_DIR / "furniture.furniturepalette.json"
    furniture_palette = json.loads(furniture_path.read_text())
    existing = {entry["id"] for entry in furniture_palette["furniture"]}

    def add_furniture(entry: dict) -> None:
        if entry["id"] not in existing:
            furniture_palette["furniture"].append(entry)
            existing.add(entry["id"])

    for spec in WALLS:
        add_furniture(
            {
                "id": spec["id"],
                "tiles": [[f"{spec['id']}.furniture"]],
                "allowRandomOrientation": False,
            }
        )
    add_furniture(
        {
            "id": "cactus",
            "tiles": [["cactus.furniture"]],
            "allowRandomOrientation": True,
        }
    )
    write_json(furniture_path, furniture_palette)

    wall_path = EDITOR_DIR / "wall.wallpalette.json"
    wall_palette = json.loads(wall_path.read_text())
    existing_walls = {wall["id"] for wall in wall_palette["walls"]}
    for spec in WALLS:
        furniture_id = f"{spec['id']}.furniture"
        if furniture_id not in existing_walls:
            wall_palette["walls"].append({"id": furniture_id, "edges": spec["edges"]})
            existing_walls.add(furniture_id)
    write_json(wall_path, wall_palette)


def convert_map_file(src: Path, map_id: str, name: str) -> dict:
    raw = json.loads(src.read_text())
    width = raw["dimensions"]["x"]
    height = raw["dimensions"]["y"]
    tiles = []
    for row in raw["mapData"]:
        tiles.append([convert_cell(cell) for cell in row])
    return {
        "id": map_id,
        "name": name,
        "width": width,
        "height": height,
        "tileSize": TS,
        "tiles": tiles,
    }


def extract_mansion_door() -> None:
    furniture_atlas = Image.open(ATLAS_FURNITURE)
    collision_atlas = Image.open(OLD_ROOT / "public" / "atlases" / "collision-atlas.png")

    closed = crop_tile(furniture_atlas, 1, 9)
    opened = crop_tile(furniture_atlas, 2, 9)
    closed.save(FURN_DIR / "mansion-door.png")
    opened.save(FURN_DIR / "mansion-door-open.png")
    make_cl(crop_tile(collision_atlas, 6, 0)).save(FURN_DIR / "mansion-door-cl.png")
    make_cl(crop_tile(collision_atlas, 7, 0)).save(FURN_DIR / "mansion-door-open-cl.png")

    write_json(
        FURN_DIR / "mansion-door.furniture.json",
        {
            "id": "mansion-door.furniture",
            "name": "Internal Door",
            "tileSet": TILE_SET_DEFAULT,
            "category": "Doors",
            "description": [{"text": "A heavy internal wooden door on brass hinges."}],
            "renderable": {
                "default": {
                    "default": [{"imageId": "mansion-door"}],
                    "open": [{"imageId": "mansion-door-open"}],
                    "destroyed": [{"imageId": "mansion-door-open"}],
                },
                "FIRE_MODE": {
                    "default": [{"imageId": "mansion-door-cl"}],
                    "open": [{"imageId": "mansion-door-open-cl"}],
                    "destroyed": [{"imageId": "mansion-door-open-cl"}],
                },
            },
            "state": "closed",
            "materials": ["thin-wood.material", "thick-wood.material"],
            "hitPoints": {"max": 150},
            "pixelDestruction": True,
            "movementObstruction": {
                "default": {"default": 100},
                "open": {"default": 0},
                "destroyed": {"default": 0},
            },
            "actions": {
                "default": {
                    "openDoor": {"state": "open", "speedScaler": 0.5, "aptCost": 10},
                    "lock": {
                        "state": "locked",
                        "itemsToUse": ["front-door-key.item"],
                        "aptCost": 10,
                    },
                    "breach": {"state": "open", "speedScaler": 1.3, "aptCost": 12},
                },
                "closed": {
                    "openDoor": {"state": "open", "speedScaler": 0.5, "aptCost": 10},
                    "lock": {
                        "state": "locked",
                        "itemsToUse": ["front-door-key.item"],
                        "aptCost": 10,
                    },
                    "breach": {"state": "open", "speedScaler": 1.3, "aptCost": 12},
                },
                "open": {"closeDoor": {"state": "default", "aptCost": 10}},
                "locked": {
                    "unlock": {
                        "state": "default",
                        "itemsToUse": ["front-door-key.item"],
                        "aptCost": 10,
                    },
                    "breach": {"state": "destroyed", "speedScaler": 1.5, "aptCost": 20},
                },
            },
        },
    )


def convert_mansion_2() -> None:
    extract_mansion_door()
    map_obj = convert_map_file(
        OLD_ROOT / "public" / "HostageCrisis" / "Mansion.json",
        "ambassador-mansion-2.map",
        "Ambassador's Mansion 2",
    )
    dest = MAPS_DIR / "Ambassador_Mansion_2.map.json"
    write_json(dest, map_obj)
    print(json.dumps({"map": f"{map_obj['width']}x{map_obj['height']}", "output": str(dest)}, indent=2))


def main() -> None:
    furniture_atlas = Image.open(ATLAS_FURNITURE)
    terrain_atlas = Image.open(ATLAS_TERRAIN)

    photo_ids = extract_photo_terrain(terrain_atlas)
    extract_walls_and_furniture(furniture_atlas)
    update_palettes(photo_ids)

    map_obj = convert_map_file(
        OLD_MAP,
        "ambassadors-mansion.map",
        "Ambassador's Mansion",
    )
    write_json(MAPS_DIR / "Ambassadors_Mansion.map.json", map_obj)

    print(
        json.dumps(
            {
                "map": f"{map_obj['width']}x{map_obj['height']}",
                "photo_terrain": len(photo_ids),
                "walls": len(WALLS),
                "output": str(MAPS_DIR / "Ambassadors_Mansion.map.json"),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    import sys

    if "--mansion-2" in sys.argv:
        convert_mansion_2()
    else:
        main()
