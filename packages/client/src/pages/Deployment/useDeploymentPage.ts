import { useCallback, useEffect, useState } from "react";
import { useServerMessageManager, useWorld } from "../../hooks";
import {
    ClientMap,
    DeploymentZoneSummaryWire,
    SideSummary,
    UnitId,
    UnitSummary
} from "@atbs/shared-data";
import { ITilePos, toTilePosString } from "@atbs/maths";

export function useDeploymentPage() {
    const { messageManager, sendMessage } = useServerMessageManager();
    const { world } = useWorld();
    const [map, setMap] = useState<ClientMap | null>(null);
    const [side, setSide] = useState<SideSummary | null>(null);
    const [units, setUnits] = useState<UnitSummary[]>([]);
    const [unitDeployment, setUnitDeployment] = useState<Record<UnitId, ITilePos | null>>({});
    const [disabled /*, setDisabled*/] = useState<boolean>(false);
    const [canEndDeployment /*, setCanEndDeployment*/] = useState<boolean>(true);

    useEffect(() => {
        console.info("Mounting DeploymentPage Message Handlers");

        const handlerHandles = [
            messageManager.registerHandler("server:map", (_context, payload) => {
                console.info("$$$ Received map message $$$", payload.width, "x", payload.height);

                world.map = payload;
                setMap(payload);
            }),

            messageManager.registerHandler("server:deployment:side:start", (_context, payload) => {
                console.info("$$$ Received deployment side start message $$$", payload);

                setSide(payload.side);
                setUnits(payload.units);
            }),

            messageManager.registerHandler("server:deployment:markers", (_context, payload) => {
                console.info("$$$ Received deployment markers message $$$", payload);

                world.deploymentMarker = payload.marker;
                world.deploymentMarkers = payload.deploymentZones.map(
                    (deploymentZone: DeploymentZoneSummaryWire[0]) => ({
                        id: deploymentZone.id,
                        minUnits: deploymentZone.minUnits,
                        maxUnits: deploymentZone.maxUnits,
                        disabled: deploymentZone.disabled,
                        tiles: new Set(
                            deploymentZone.tiles.map((tile: ITilePos) => toTilePosString(tile))
                        )
                    })
                );
                setUnitDeployment(payload.units);
            })
        ];

        return () => {
            console.info("Unmounting ActionPage Message Handlers");
            messageManager.unregisterHandlers(handlerHandles);
        };
    }, [messageManager, world]);

    const onEndDeploymentPhase = useCallback(() => {
        sendMessage({
            type: "client:deployment:end",
            payload: null
        });
    }, [sendMessage]);

    return {
        map,
        side,
        units,
        unitDeployment,
        disabled,
        canEndDeployment,
        onEndDeploymentPhase
    };
}
