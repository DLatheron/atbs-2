export const INVENTORY_MODEL_TITLE = "Inventory";
export const ACTION_POINTS_TITLE = "Action Points:";

export const IN_USE_TITLE = "In Use";
export const ON_GROUND_TITLE = "On Ground";
export const CONTENTS_TITLE = "Contents";

export const NO_ITEM_IN_USE_TEXT = "None";
export const INVENTORY_EMPTY_TEXT = "Empty";

export const inventoryPanelSx = {
    border: "1px black solid",
    backgroundColor: "Light Steel",
    p: 1
} as const;

export const backgroundBannerAnchorSx = {
    position: "relative"
} as const;

export const backgroundBannerSx = {
    color: "#666",
    transform: "translate(-50%, -50%) rotate(45deg);",
    position: "absolute",
    top: "50%",
    left: "50%",
    fontSize: "2rem",
    textTransform: "uppercase",
    fontFamily: "Courier",
    mixBlendMode: "multiply",
    maskImage: "url('/public/misc/grunge.png')",
    maskSize: "944px 604px",
    maskPosition: "2rem 3rem"
} as const;

export const groundBackgroundSx = {
    backgroundColor: "lightGreen"
} as const;

export const groundSlideTimeInMs = 300;
