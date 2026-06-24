import { beforeEach, describe, expect, it, vi } from "vitest";
import { Projectile, ProjectileProps } from "./Projectile.js";
import { Grid, stepGrid } from "./GridHelpers.js";
import { Item } from "./Item.js";
import { Unit } from "./Unit.js";
import { Game } from "./Game.js";
import { Aabb, Vec2 } from "@atbs/maths";
import { Material } from "./Material.js";
import { cloneDeep } from "lodash";

describe("GridHelpers", () => {
    describe("stepGrid", () => {
        let projectile: Projectile;
        let grid: Grid;
        let emptyGrid: number[][];
        let simpleGrid: number[][];
        let material: Material;

        let game: Game;
        let firingUnit: Unit;
        let firingWeapon: Item;
        let projectileProps: ProjectileProps;

        beforeEach(() => {
            emptyGrid = [
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            ];
            simpleGrid = cloneDeep(emptyGrid);

            grid = { aabb: new Aabb(0, 0, 10, 10), gridScale: 1 };
            material = vi.mocked(Material);
            game = vi.mocked(Game);
            firingUnit = vi.mocked(Unit);
            firingWeapon = vi.mocked(Item);

            projectileProps = {
                game,
                firingUnit,
                firingWeapon,

                index: 0,
                srcPos: new Vec2(0, 0),
                directionVector: new Vec2(1, 1).normalise(),
                projectileRecipe: {
                    numProjectiles: 1,
                    maxRange: 2000,
                    penetration: 0,
                    visual: {},
                    damage: { default: 0 }
                }
            };
            projectile = new Projectile(projectileProps);
        });

        function stepTracker(expectedMaterials: Material[]) {
            const samples: {
                samplePos: Vec2;
                sample: number;
            }[] = [];
            const collisions: {
                collisionPos: Vec2;
                material: Material;
            }[] = [];

            const hit = stepGrid(
                projectile,
                grid,
                (samplePos: Vec2) => {
                    const sample = simpleGrid[samplePos.y][samplePos.x];
                    samples.push({ samplePos, sample });
                    return sample === 0 ? undefined : expectedMaterials[collisions.length];
                },
                (collisionPos: Vec2, material: Material) => {
                    collisions.push({ collisionPos, material });
                    return collisions.length === expectedMaterials.length;
                }
            );

            return {
                hit,
                samples,
                collisions
            };
        }

        it("should the sample the grid and collide", () => {
            simpleGrid[1][1] = 1;

            expect(stepTracker([material])).toStrictEqual({
                hit: new Vec2(1, 1),
                samples: [
                    { samplePos: new Vec2(0, 0), sample: 0 },
                    { samplePos: new Vec2(1, 1), sample: 1 }
                ],
                collisions: [{ collisionPos: new Vec2(1, 1), material }]
            });
        });

        it("should the sample the grid and collide further away", () => {
            simpleGrid[9][9] = 1;

            expect(stepTracker([material])).toStrictEqual({
                hit: new Vec2(9, 9),
                samples: [
                    { samplePos: new Vec2(0, 0), sample: 0 },
                    { samplePos: new Vec2(1, 1), sample: 0 },
                    { samplePos: new Vec2(2, 2), sample: 0 },
                    { samplePos: new Vec2(3, 3), sample: 0 },
                    { samplePos: new Vec2(4, 4), sample: 0 },
                    { samplePos: new Vec2(5, 5), sample: 0 },
                    { samplePos: new Vec2(6, 6), sample: 0 },
                    { samplePos: new Vec2(7, 7), sample: 0 },
                    { samplePos: new Vec2(8, 8), sample: 0 },
                    { samplePos: new Vec2(9, 9), sample: 1 }
                ],
                collisions: [{ collisionPos: new Vec2(9, 9), material }]
            });
        });

        it("should the sample the grid and collide even if it doesn't start within the grid", () => {
            projectile = new Projectile({
                ...projectileProps,
                srcPos: new Vec2(-8, -8),
                directionVector: new Vec2(1, 1).normalise()
            });

            simpleGrid[5][5] = 1;

            expect(stepTracker([material])).toStrictEqual({
                hit: new Vec2(5, 5),
                samples: [
                    { samplePos: new Vec2(0, 0), sample: 0 },
                    { samplePos: new Vec2(1, 1), sample: 0 },
                    { samplePos: new Vec2(2, 2), sample: 0 },
                    { samplePos: new Vec2(3, 3), sample: 0 },
                    { samplePos: new Vec2(4, 4), sample: 0 },
                    { samplePos: new Vec2(5, 5), sample: 1 }
                ],
                collisions: [{ collisionPos: new Vec2(5, 5), material }]
            });
        });

        it("should the sample the grid and pass through multiple materials", () => {
            simpleGrid[2][2] = 1;
            simpleGrid[5][5] = 1;
            simpleGrid[7][7] = 1;

            expect(stepTracker([material, material, material])).toStrictEqual({
                hit: new Vec2(7, 7),
                samples: [
                    { samplePos: new Vec2(0, 0), sample: 0 },
                    { samplePos: new Vec2(1, 1), sample: 0 },
                    { samplePos: new Vec2(2, 2), sample: 1 },
                    { samplePos: new Vec2(3, 3), sample: 0 },
                    { samplePos: new Vec2(4, 4), sample: 0 },
                    { samplePos: new Vec2(5, 5), sample: 1 },
                    { samplePos: new Vec2(6, 6), sample: 0 },
                    { samplePos: new Vec2(7, 7), sample: 1 }
                ],
                collisions: [
                    { collisionPos: new Vec2(2, 2), material },
                    { collisionPos: new Vec2(5, 5), material },
                    { collisionPos: new Vec2(7, 7), material }
                ]
            });
        });

        it("should the sample the grid and not collide if there's nothing to hit", () => {
            expect(stepTracker([material])).toStrictEqual({
                hit: undefined,
                samples: [
                    { samplePos: new Vec2(0, 0), sample: 0 },
                    { samplePos: new Vec2(1, 1), sample: 0 },
                    { samplePos: new Vec2(2, 2), sample: 0 },
                    { samplePos: new Vec2(3, 3), sample: 0 },
                    { samplePos: new Vec2(4, 4), sample: 0 },
                    { samplePos: new Vec2(5, 5), sample: 0 },
                    { samplePos: new Vec2(6, 6), sample: 0 },
                    { samplePos: new Vec2(7, 7), sample: 0 },
                    { samplePos: new Vec2(8, 8), sample: 0 },
                    { samplePos: new Vec2(9, 9), sample: 0 }
                ],
                collisions: []
            });
        });

        it("should the not return a hit position if it reaches the end of its travel", () => {
            projectile = new Projectile({
                ...projectileProps,
                srcPos: new Vec2(-5, 4),
                directionVector: new Vec2(1, 0).normalise(),
                projectileRecipe: {
                    ...projectileProps.projectileRecipe,
                    maxRange: 10
                }
            });

            expect(stepTracker([material])).toStrictEqual({
                hit: undefined,
                samples: [
                    { samplePos: new Vec2(0, 4), sample: 0 },
                    { samplePos: new Vec2(1, 4), sample: 0 },
                    { samplePos: new Vec2(2, 4), sample: 0 },
                    { samplePos: new Vec2(3, 4), sample: 0 },
                    { samplePos: new Vec2(4, 4), sample: 0 }
                ],
                collisions: []
            });
        });

        it("should not sample the grid if the ray does not collide with it", () => {
            projectile = new Projectile({
                ...projectileProps,
                srcPos: new Vec2(-1, 0),
                directionVector: new Vec2(1, 0).normalise()
            });

            expect(stepTracker([])).toStrictEqual({
                hit: undefined,
                samples: [],
                collisions: []
            });
        });
    });
});
