export const INVENTORY_MODEL_TITLE = "Inventory";
export const ACTION_POINTS_TITLE = "Action Points:";

export const IN_USE_TITLE = "In Use";
export const ON_GROUND_TITLE = "On Ground";
export const CONTENTS_TITLE = "Contents";

export const NO_ITEM_IN_USE_TEXT = "None";
export const INVENTORY_EMPTY_TEXT = "Empty";

export const INVENTORY_PANEL_BACKGROUND_COLOR = "211, 211, 211";

export const INVENTORY_BACKGROUND_COLOR = "128, 128, 128";

export const inventoryPanelSx = {
    border: "1px black solid",
    backgroundColor: `rgb(${INVENTORY_PANEL_BACKGROUND_COLOR})`,
    p: 1
} as const;

export const backgroundBannerAnchorSx = {
    position: "relative"
} as const;

export const backgroundBannerSx = {
    // color: "#666",
    transform: "translate(-50%, -50%) rotate(45deg);",
    position: "absolute",
    top: "50%",
    left: "50%",
    fontSize: "2rem",
    textTransform: "uppercase"
    // fontFamily: "Courier",
    // mixBlendMode: "multiply",
    // maskImage: "url('/public/misc/grunge.png')",
    // maskSize: "944px 604px",
    // maskPosition: "2rem 3rem"
} as const;

export const ON_GROUND_BACKGROUND_COLOR = "144, 238, 144";
export const groundBackgroundSx = {
    backgroundColor: `rgb(${ON_GROUND_BACKGROUND_COLOR})`
} as const;
export const groundSlideTimeInMs = 300;

export const MODAL_BACKGROUND_COLOR = "rgb(169, 169, 169)";

export const MODAL_BACKGROUND_COLOR_TRANSPARENT = "169, 169, 169";
const MODAL_TEXT_COLOR = "#222";

/** Chasing selection outline on item tiles — tweak colour / dash here. */
export const ITEM_SELECTION_BORDER_COLOR = "#1e90ff";
export const ITEM_SELECTION_BORDER_WIDTH = 3;
/** Dash length and gap along the perimeter (SVG user units). */
export const ITEM_SELECTION_DASH_ARRAY = "90 90";
export const ITEM_SELECTION_CHASE_DURATION_MS = 2000;

export const cutoutTextSx = (background: string) =>
    ({
        userSelect: "none",
        color: "transparent",
        background: MODAL_TEXT_COLOR,
        backgroundClip: "text",
        textShadow: `0px 3px 3px rgba(${background}, 0.5)}`
    }) as const;
