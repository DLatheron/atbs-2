export const NO_ITEM_IN_USE_TEXT = "None";
export const INVENTORY_EMPTY_TEXT = "Empty";

const PANEL_BACKGROUND_COLOR = "Light Steel";

export const inventoryPanelSx = {
    border: "1px black solid",
    backgroundColor: PANEL_BACKGROUND_COLOR,
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