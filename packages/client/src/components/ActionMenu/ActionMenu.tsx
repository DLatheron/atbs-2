import { Orientation } from "@atbs/maths";
import { UnitAction, UnitActionGrid } from "@atbs/shared-data";
import Box from "@mui/material/Box";
import { forwardRef } from "react";
import { ActionButtonComponent } from "../ActionButton";
import { SxProps } from "@mui/material/styles";

const gridSquares: Orientation[] = [
    Orientation.NORTH_WEST,
    Orientation.NORTH,
    Orientation.NORTH_EAST,
    Orientation.WEST,
    Orientation.CENTER,
    Orientation.EAST,
    Orientation.SOUTH_WEST,
    Orientation.SOUTH,
    Orientation.SOUTH_EAST
];

export interface ActionMenuComponentProps {
    unitActionGrid?: UnitActionGrid;
    tileSize: number;
    onAction: (action: string, orientation: Orientation) => void;
}

export const ActionMenuComponent = forwardRef(function (
    { unitActionGrid, tileSize, onAction }: ActionMenuComponentProps,
    ref: React.Ref<HTMLDivElement>
) {
    if (!unitActionGrid) {
        return null;
    }

    // unitActionGrid = {
    //     [Orientation.NORTH]: [
    //         { action: "openDoor", disabled: false },
    //         { action: "closeDoor", disabled: false },
    //         { action: "breach", disabled: false },
    //         { action: "purchase", disabled: false }
    //     ],
    //     [Orientation.SOUTH_WEST]: [
    //         { action: "openDoor", disabled: false },
    //         { action: "breach", disabled: false },
    //         { action: "purchase", disabled: false }
    //     ],
    //     [Orientation.SOUTH_EAST]: [
    //         { action: "breach", disabled: false },
    //         { action: "purchase", disabled: false }
    //     ],
    //     [Orientation.EAST]: [
    //         { action: "breach", disabled: false },
    //     ]
    // };

    return (
        <Box
            ref={ref}
            data-testid="action-menu"
            sx={{
                pointerEvents: "none",
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "grid",
                gridTemplateAreas: `
                    'nw  n  ne'
                    'w   c   e'
                    'sw  s  se'
                `,
                gridTemplateColumns: `${tileSize}px ${tileSize}px ${tileSize}px`,
                gridTemplateRows: `${tileSize}px ${tileSize}px ${tileSize}px`,
                transition: "opacity 0.3s ease-in-out",
                
                ".orientation-7": {
                    gridArea: "nw"
                },
                ".orientation-0": {
                    gridArea: "n"
                },
                ".orientation-1": {
                    gridArea: "ne"
                },
                ".orientation-6": {
                    gridArea: "w"
                },
                ".orientation-8": {
                    gridArea: "c"
                },
                ".orientation-2": {
                    gridArea: "e"
                },
                ".orientation-5": {
                    gridArea: "sw"
                },
                ".orientation-4": {
                    gridArea: "s"
                },
                ".orientation-3": {
                    gridArea: "se"
                },
                backgroundColor: "transparent",
            }}
        >
            {gridSquares.map((orientation) => {
                const actions = unitActionGrid[orientation];
                const numActions = actions?.length ?? 0;

                let boxSx: SxProps = {
                    display: "grid",
                    m: "auto",
                };
                let buttonSx: SxProps = {
                    "&:nth-child(1)": {
                        gridArea: "button-1"
                    },
                    "&:nth-child(2)": {
                        gridArea: "button-2"
                    },
                    "&:nth-child(3)": {
                        gridArea: "button-3"
                    },
                    "&:nth-child(4)": {
                        gridArea: "button-4"
                    }
                };

                switch (numActions) {
                    case 0:
                        boxSx = {
                            ...boxSx,
                            display: "none",
                            pointerEvents: "none"
                        };
                        break;

                    case 1:
                        boxSx = {
                            ...boxSx,
                            gridTemplateAreas: "'button-1'"
                        };
                        break;

                    case 2:
                        boxSx = {
                            ...boxSx,
                            gridTemplateAreas: "'button-1 button-2'",
                            ".button-1": {
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                                borderRightWidth: 0.5
                            },
                            ".button-2": {
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                borderLeftWidth: 0.5,
                            }
                        };
                        break;

                    case 3:
                        boxSx = {
                            ...boxSx,
                            gridTemplateAreas: `
                                'button-1 button-1'
                                'button-2 button-3'
                            `,
                            ".button-1": {
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                borderBottom: "none",
                            },
                            ".button-2": {
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                            },
                            ".button-3": {
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                            }
                        };
                        break;

                    case 4:
                        boxSx = {
                            ...boxSx,
                            gridTemplateAreas: `
                                'button-1 button-2'
                                'button-3 button-4'
                            `,
                            ".button-1": {
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                                borderBottomLeftRadius: 0,
                                borderRightWidth: 0.5,
                                borderBottomWidth: 0.5,
                            },
                            ".button-2": {
                                borderTopLeftRadius: 0,
                                borderBottomLeftRadius: 0,
                                borderBottomRightRadius: 0,
                                borderLeftWidth: 0.5,
                                borderBottomWidth: 0.5,
                            },
                            ".button-3": {
                                borderTopLeftRadius: 0,
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                                borderTopWidth: 0.5,
                                borderRightWidth: 0.5,
                            },
                            ".button-4": {
                                borderTopLeftRadius: 0,
                                borderTopRightRadius: 0,
                                borderBottomLeftRadius: 0,
                                borderLeftWidth: 0.5,
                                borderTopWidth: 0.5,
                            }
                        };
                        break;

                    default:
                        break;
                }

                return (
                    <Box
                        key={`orientation-${orientation}`}
                        className={`orientation-${orientation}`}
                        sx={{ ...boxSx }}
                    >
                        {unitActionGrid[orientation]?.map(({ action, disabled }: UnitAction, index: number) => (
                            <ActionButtonComponent
                                key={`button-${action}`}
                                className={`button-${index + 1}`}
                                tileSize={tileSize}
                                name={action}
                                disabled={disabled}
                                onClick={() => onAction(action, orientation)}
                                sx={buttonSx}
                            />
                        ))}
                    </Box>
                );
            })}
        </Box>
    );
});
