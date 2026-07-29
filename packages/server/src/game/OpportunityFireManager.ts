import { Logger } from "@atbs/misc";
import type { Game } from "./Game.js";
import type { Unit } from "./Unit.js";
import { config } from "../config/config.schema.js";

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

    popOpportunity() {
        if (this._currentOpportunity) {
            throw new Error("An opportunity is already being handled");
        }

        let opportunity: Opportunity | undefined;

        while (opportunity = this._opportunities.shift()) {
            // Check that the unit can still opportunity fire -- e.g. it might have died!
            if (opportunity.unit.canOpportunityFire) {
                break;
            }
        }
        
        this._currentOpportunity = opportunity ?? null;
        if (!opportunity) {
            return;
        }
    OpportunityFireManager.Logger.info(
            `Popped opportunity for ${opportunity.unit.name} with speed ${opportunity.speed}`
        );
    }

    endOpportunity() {
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

        this.popOpportunity();
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

            if (byCurrentSide) {
                // Send messages to the unit that won the opportunity fire.
                this.game.messageRouter.send(
                    [
                        {
                            type: "server:opportunity:fire:start",
                            payload: null
                        },
                        {
                            type: "server:unit:mode:move",
                            payload: unit.toSummary()
                        },
                        {
                            type: "server:unit:mode:fire",
                            payload: itemInUse.getFireModeItemSummary(unit)
                        },
                        {
                            type: "server:camera:move:to",
                            payload: {
                                target: "tile",
                                tilePos: unit.mapLocation,
                                trackingSpeed: 1
                            }
                        },
                        {
                            type: "server:ui:disabled",
                            payload: false
                        }
                    ],
                    winnerSideId,
                    true
                );
            } else {
                const tile = this.game.map.getTile(unit.mapLocation);

                this.game.messageRouter.send(
                    [
                        {
                            type: "server:opportunity:fire:start",
                            payload: null
                        },
                        {
                            type: "server:wait",
                            payload: null
                        },
                        {
                            type: "server:ui:disabled" as const,
                            payload: true
                        }
                    ],
                    winnerSideId,
                    true
                );
                
                this.game.messageRouter.resumeMessageSending(winnerSideId);

                // Send message to side currently playing.
                this.game.messageRouter.send(
                    [
                        ...(unit.side.canSee(tile)
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
                        {
                            type: "server:unit:mode:fire:end" as const,
                            payload: null
                        },
                        {
                            type: "server:unit:mode:move" as const,
                            payload: null
                        }
                    ],
                    currentSideId,
                    true
                );

                // Send message to unit that won the opportunity fire.
                this.game.messageRouter.send(
                    [
                        {
                            type: "server:visible:tiles",
                            payload: this.game.visibilityManager.getVisibilityUpdate(
                                unit.side.oppositionSideIds
                            )
                        },
                        {
                            type: "server:camera:move:to",
                            payload: {
                                target: "tile",
                                tilePos: unit.mapLocation,
                                trackingSpeed: 1
                            }
                        },
                        {
                            type: "server:unit:mode:move",
                            payload: unit.toSummary()
                        },
                        {
                            type: "server:unit:mode:fire",
                            payload: itemInUse.getFireModeItemSummary(unit)
                        },
                        {
                            type: "server:ui:disabled" as const,
                            payload: false
                        }
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

            // Finishing the opportunity fire for the side currently playing.
            if (this.game.turnsSideId === unit.side.id) {
                // Send messages to the unit that won the opportunity fire.
                this.game.messageRouter.send(
                    [
                        {
                            type: "server:unit:mode:fire:end",
                            payload: null
                        }
                    ],
                    unit.side.id,
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
                        {
                            type: "server:unit:mode:fire:end",
                            payload: null
                        }
                    ],
                    unit.side.id,
                    true
                );

                this.game.messageRouter.pauseMessageSending(unit.side.id);

                this.game.messageRouter.send(
                    [
                        {
                            type: "server:ui:disabled" as const,
                            payload: false
                        },
                        {
                            type: "server:unit:mode:move" as const,
                            payload: this.game.selectedUnit?.toSummary() ?? null
                        }
                    ],
                    this.game.turnsSideId,
                    true
                );
            }

            OpportunityFireManager.Logger.info(`Ending opportunity fire for ${unit.name}`);

            this.endOpportunity();

            return this.startOpportunityFire();
        }

        return false;
    }
}
