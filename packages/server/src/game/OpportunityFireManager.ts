import { Logger } from "@atbs/misc";
import type { ServerToClientMessage } from "@atbs/shared-data";
import type { Game } from "./Game.js";
import type { Unit } from "./Unit.js";
import { config } from "../config/config.schema.js";
import { ServerMessages } from "./ServerMessages.js";

export interface Opportunity {
    unit: Unit;
    speed: number;
}

export class OpportunityFireManager {
    static readonly Logger: Logger = new Logger(
        "OpportunityFireManager",
        config.logLevels?.opportunityFireManager
    );

    private readonly _game: Game;
    private _opportunities: Opportunity[];
    private _currentOpportunity: Opportunity | null;

    constructor(game: Game) {
        this._game = game;

        this._opportunities = [];
        this._currentOpportunity = null;
    }

    get game(): Game {
        return this._game;
    }

    get opportunity(): Opportunity | null {
        return this._currentOpportunity;
    }

    clear() {
        this._opportunities = [];
        this._currentOpportunity = null;
    }

    registerOpportunity(unit: Unit, speed: number) {
        // Don't register the same unit twice.
        if (this._opportunities.some((opportunity) => opportunity.unit === unit)) {
            return;
        }

        this._opportunities.push({ unit, speed });

        // Sort opportunities by speed, highest first.
        this._opportunities.sort((a, b) => b.speed - a.speed);

        OpportunityFireManager.Logger.info(
            `Registered opportunity for ${unit.name} with speed ${speed}`
        );
    }

    private _popOpportunity() {
        if (this._currentOpportunity) {
            throw new Error("An opportunity is already being handled");
        }

        let opportunity: Opportunity | null;

        while ((opportunity = this._opportunities.shift() ?? null)) {
            // Check that the unit can still opportunity fire -- e.g. it might have died!
            if (opportunity.unit.canOpportunityFire) {
                break;
            }
        }

        this._currentOpportunity = opportunity;
        if (!opportunity) {
            return;
        }
        OpportunityFireManager.Logger.info(
            `Popped opportunity for ${opportunity.unit.name} with speed ${opportunity.speed}`
        );
    }

    private _endOpportunity() {
        if (!this._currentOpportunity) {
            throw new Error("No opportunity is being handled");
        }

        OpportunityFireManager.Logger.info(
            `Ended opportunity for ${this._currentOpportunity.unit.name} with speed ${this._currentOpportunity.speed}`
        );
        this._currentOpportunity = null;
    }

    startOpportunityFire(): boolean {
        if (this._currentOpportunity) {
            return true;
        }

        this._popOpportunity();
        if (this.opportunity) {
            const { unit } = this.opportunity;
            const { itemInUse } = unit;

            if (!itemInUse) {
                throw new Error(`Unit ${unit.name} does not have a weapon`);
            }

            const byCurrentSide = this.game.turnsSideId === unit.side.id;
            const currentSideId = this.game.turnsSideId;
            const winnerSideId = unit.side.id;

            OpportunityFireManager.Logger.info(`Starting opportunity fire for ${unit.name}`);

            this.game.messageRouter.broadcast(
                [ServerMessages.StartOpportunityFire(unit.name)],
                undefined,
                true
            );

            // FOW tiles first, then sprites for every living enemy this side can
            // see. canSee alone is not enough: the client culls visibilityFilter
            // images unless the tile is in visibleTiles AND the render list has
            // the unit (hidden movers never got a map:update for their tile).
            const ofVisibilityMessages = (): ServerToClientMessage[] => {
                const visibleEnemyTileUpdates =
                    this.game.getVisibleOppositionTileUpdates(winnerSideId);
                return [
                    {
                        type: "server:visible:tiles",
                        payload: this.game.visibilityManager.getVisibilityUpdate(
                            unit.side.oppositionSideIds
                        )
                    },
                    ...(visibleEnemyTileUpdates.length > 0
                        ? [
                              {
                                  type: "server:map:update" as const,
                                  payload: visibleEnemyTileUpdates
                              }
                          ]
                        : [])
                ];
            };

            if (byCurrentSide) {
                // Same-side OF (mover newly sees someone): no queue to flush, but
                // still must push enemy sprites — _broadcastVisibleTiles may have
                // run, yet OF UI must not rely on that alone.
                this.game.messageRouter.send(
                    [
                        ...ofVisibilityMessages(),
                        ServerMessages.UnitMovementMode(unit),
                        ServerMessages.StartFireMode(unit),
                        {
                            type: "server:camera:move:to",
                            payload: {
                                target: "tile",
                                tilePos: unit.mapLocation,
                                trackingSpeed: 1
                            }
                        },
                        ServerMessages.EnableUI
                    ],
                    winnerSideId,
                    true
                );
            } else {
                const tile = this.game.map.getTile(unit.mapLocation);
                const currentSide = this.game.getSide(currentSideId);

                this.game.messageRouter.send(
                    [
                        {
                            type: "server:wait",
                            payload: null
                        },
                        ServerMessages.DisableUI
                    ],
                    winnerSideId,
                    true
                );

                // Flush queued move/map updates (including the unit that walked
                // into view and triggered OF) before OF UI takes over.
                this.game.messageRouter.resumeMessageSending(winnerSideId);

                // Send message to side currently playing.
                this.game.messageRouter.send(
                    [
                        ...(currentSide.canSee(tile)
                            ? [
                                  {
                                      type: "server:camera:move:to" as const,
                                      payload: {
                                          target: "tile" as const,
                                          tilePos: unit.mapLocation,
                                          trackingSpeed: 0.1
                                      }
                                  }
                              ]
                            : []),
                        ServerMessages.EndFireMode,
                        ServerMessages.DeselectUnit
                    ],
                    currentSideId,
                    true
                );

                // Send message to unit that won the opportunity fire.
                this.game.messageRouter.send(
                    [
                        ...ofVisibilityMessages(),
                        {
                            type: "server:camera:move:to",
                            payload: {
                                target: "tile",
                                tilePos: unit.mapLocation,
                                trackingSpeed: 1
                            }
                        },
                        ServerMessages.UnitMovementMode(unit),
                        ServerMessages.StartFireMode(unit),
                        ServerMessages.EnableUI
                    ],
                    winnerSideId,
                    true
                );
            }

            return true;
        }

        return false;
    }

    continueOpportunityFire(): boolean {
        if (this.opportunity) {
            const { unit } = this.opportunity;

            const byCurrentSide = this.game.turnsSideId === unit.side.id;
            const currentSideId = this.game.turnsSideId;
            const winnerSideId = unit.side.id;

            if (byCurrentSide) {
                // Send messages to the unit that won the opportunity fire.
                this.game.messageRouter.send(
                    [
                        {
                            type: "server:unit:mode:fire:end",
                            payload: null
                        }
                    ],
                    winnerSideId,
                    true
                );
            } else {
                this.game.messageRouter.send(
                    [
                        // Display waiting message.
                        {
                            type: "server:wait",
                            payload: {
                                phase: "action",
                                sides: [this.game.turnsSide.toSummary()]
                            }
                        },
                        ServerMessages.EndFireMode,
                        ServerMessages.DeselectUnit
                    ],
                    winnerSideId,
                    true
                );

                this.game.messageRouter.pauseMessageSending(unit.side.id);

                this.game.messageRouter.send(
                    [
                        ServerMessages.EnableUI,
                        ServerMessages.UnitMovementMode(
                            this.game.selectedUnit?.isAlive ? this.game.selectedUnit : null
                        )
                    ],
                    currentSideId,
                    true
                );
            }

            OpportunityFireManager.Logger.info(`Ending opportunity fire for ${unit.name}`);

            this._endOpportunity();

            if (!this.startOpportunityFire()) {
                this.game.messageRouter.broadcast(
                    [ServerMessages.EndOpportunityFire],
                    undefined,
                    true
                );

                return false;
            }

            return true;
        }

        return false;
    }
}
