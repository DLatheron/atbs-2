import z from "zod";

const trackingSpeed = {
    VERY_SLOW: 0.00001,
    SLOW: 0.01,
    MEDIUM: 0.2,
    FAST: 0.15,
    PRETTY_FAST: 0.25,
    VERY_FAST: 0.35,
    IMMEDIATE: 1.0
};

export const TrackingSpeed = z.enum(trackingSpeed);
export type TrackingSpeed = z.infer<typeof TrackingSpeed>;
