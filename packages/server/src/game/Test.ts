// import { Colour, DebugGraphic, DebugGraphicType, IVec2, Vec2 } from "@atbs/maths";
// import { Projectile, ProjectileProps } from "./Projectile.js";
// import { Game } from "./Game.js";
// import { stepGrid } from "./GridHelpers.js";
// import { Material } from "./Material.js";
// import { DamageType } from "@atbs/shared-data";
// import { Client } from "./Client.js";

// export function test(
//     game: Game,
//     { srcWorldPos, dstWorldPos }: { srcWorldPos: IVec2; dstWorldPos: IVec2 },
//     from: Client
// ) {
//     const { map } = game;
//     const srcPos = new Vec2(srcWorldPos);
//     const dstPos = new Vec2(dstWorldPos);

//     const grid = { aabb: map.worldBounds, gridScale: map.tileSize, subGrid: false }; // TODO: <-- change soon.
//     const firingUnit = game.sides[0].units[0];
//     const firingWeapon = game.sides[0].units[0].itemInUse!;

//     const projectileProps: ProjectileProps = {
//         game,
//         firingUnit,
//         firingWeapon,

//         index: 0,
//         srcPos,
//         directionVector: dstPos.sub(srcPos).normalise(),
//         projectileRecipe: {
//             numProjectiles: 1,
//             maxRange: dstPos.sub(srcPos).length,
//             penetration: 0,
//             visual: {
//                 intensity: 1,
//                 velocity: 1000,
//                 length: 100,
//                 rangeFallOff: 10
//             },
//             damage: { type: DamageType.enum.default, default: 0 }
//         }
//     };
//     const projectile = new Projectile(projectileProps);

//     const debugGraphics: DebugGraphic[] = [];

//     debugGraphics.push({
//         type: DebugGraphicType.enum.line,
//         srcWorldPos: srcPos,
//         dstWorldPos: dstPos,
//         strokeColour: Colour.White,
//         strokeThickness: 2
//     });

//     stepGrid(
//         projectile,
//         grid,
//         (samplePos: Vec2) => {
//             console.info({ samplePos }, { depth: null });
//             const tile = map.sampleTile(map.worldToTile(samplePos));
//             if (tile === undefined) {
//                 return;
//             }
//             debugGraphics.push({
//                 type: DebugGraphicType.enum.tile,
//                 tilePos: tile.location,
//                 fillColour: new Colour({ ...Colour.Green, a: 0.25 }),
//                 strokeColour: new Colour({ ...Colour.Yellow, a: 0.25 })
//             });
//             return;
//         },
//         // eslint-disable-next-line @typescript-eslint/no-unused-vars
//         (_collisionPos: Vec2, _material: Material) => {
//             return false;
//         }
//     );

//     from.sendMessage({
//         type: "server:debug:graphics",
//         payload: debugGraphics
//     });
// }
