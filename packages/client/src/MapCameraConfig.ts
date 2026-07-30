/**
 * Client map camera zoom settings.
 *
 * Zoom `1` is the default (maximum zoom-in) view. Zooming out is continuous and
 * capped by {@link MapCameraConfig.maxZoomOutFactor}.
 */
export const MapCameraConfig = {
    /** Maximum zoom-in level (current / default view). */
    maxZoom: 1,

    /** How many times the user may zoom out from {@link MapCameraConfig.maxZoom}. */
    maxZoomOutFactor: 4,

    /**
     * Per-frame lerp factor toward the target zoom (0–1).
     * Higher = snappier; lower = smoother.
     */
    zoomSmoothing: 0.18,

    /**
     * Scales wheel `deltaY` into a continuous multiplicative zoom change.
     * Uses an exponential mapping so zoom feels even across the range.
     */
    wheelZoomSensitivity: 0.0015
} as const;

export function getMinZoom(
    config: {
        maxZoom: number;
        maxZoomOutFactor: number;
    } = MapCameraConfig
): number {
    return config.maxZoom / config.maxZoomOutFactor;
}
