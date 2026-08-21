import { describe, expect, it } from "vitest";
import { ServerToClientMessage } from "./ServerToClientMessage.js";

const SPAS_DESCRIPTION = [
    {
        text: "Franchi SPAS-12 combat shotgun. The SPAS-12 is a dual-mode 12-gauge shotgun that can be fired in semi-automatic or pump-action mode."
    }
];

const ITEM_SUMMARY = {
    id: "spas-12.gun-1",
    name: "SPAS-12 Automatic Shotgun",
    shortName: "SPAS-12",
    description: SPAS_DESCRIPTION,
    quantity: 1,
    weight: 4.4,
    maxThrowRange: 10,
    uiImage: [{ imageId: "spas-12" }]
};

describe("ServerToClientMessage", () => {
    it("preserves item description text on selected-unit patches", () => {
        const message = ServerToClientMessage.parse({
            type: "server:unit:selected:update",
            payload: { itemInUse: ITEM_SUMMARY }
        });

        expect(message.payload.itemInUse?.description).toEqual(SPAS_DESCRIPTION);
    });

    it("still accepts nested attribute patches on selected-unit updates", () => {
        const message = ServerToClientMessage.parse({
            type: "server:unit:selected:update",
            payload: {
                attributes: {
                    actionPoints: { value: 39 }
                }
            }
        });

        expect(message.payload.attributes).toEqual({
            actionPoints: { value: 39 }
        });
    });

    it("preserves weapon description text on fire-mode patches", () => {
        const message = ServerToClientMessage.parse({
            type: "server:unit:weapon:update",
            payload: {
                description: SPAS_DESCRIPTION,
                weapons: [
                    {
                        id: "spas-12.gun-1",
                        name: "SPAS-12 Automatic Shotgun",
                        shortName: "SPAS-12",
                        description: SPAS_DESCRIPTION,
                        capacity: 7,
                        maxCapacity: 7,
                        sight: "iron",
                        fireSelector: "single",
                        fireModes: {
                            single: {
                                ammoUse: 1,
                                fireModeDetails: {
                                    aimed: { accuracy: 60, actionPoints: 25 },
                                    snapshot: { accuracy: 40, actionPoints: 13 }
                                }
                            }
                        },
                        uiImage: [{ imageId: "spas-12" }]
                    }
                ]
            }
        });

        expect(message.payload.description).toEqual(SPAS_DESCRIPTION);
        expect(message.payload.weapons?.[0]?.description).toEqual(SPAS_DESCRIPTION);
    });
});
