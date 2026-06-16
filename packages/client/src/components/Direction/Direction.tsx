import {
    angleInDegreesToDirection,
    clampAngleInDegrees,
    degreesToRadians,
    directionToDegrees,
    Mat22,
    Orientation,
    radiansToDegrees,
    roundDegrees,
    Vec2
} from "@atbs/maths";
import { Box, SxProps, Typography } from "@mui/material";
import { JSX, useMemo } from "react";

export interface DirectionComponentProps {
    direction: Orientation;
    viewAngleInDegrees: number;
    disabled?: boolean;
    onDirectionChange: (orientation: Orientation) => void;
    sx?: SxProps;
}

/**
 * Helper function to create an SVG cone path (as the standard SVG arc function is pretty useless).
 * @param centerPoint Center of the ellipse.
 * @param radii Radii of the ellipse (major and minor).
 * @param anglesInRadians x: start angle (in radians), y: sweep angle (in radians).
 * @param rotationInRadians Rotation of the ellipse in radians.
 * @returns SVG path string.
 */
const svgEllipseArc = (
    centerPoint: Vec2,
    radii: Vec2,
    anglesInRadians: Vec2,
    rotationInRadians: number
) => {
    anglesInRadians.y = anglesInRadians.y % (2 * Math.PI);

    const rotMatrix = Mat22.MakeRotation(rotationInRadians);
    const s = centerPoint.add(
        rotMatrix.multiply(
            new Vec2(radii.x * Math.cos(anglesInRadians.x), radii.y * Math.sin(anglesInRadians.x))
        )
    );
    const e = centerPoint.add(
        rotMatrix.multiply(
            new Vec2(
                radii.x * Math.cos(anglesInRadians.x + anglesInRadians.y),
                radii.y * Math.sin(anglesInRadians.x + anglesInRadians.y)
            )
        )
    );
    const fA = anglesInRadians.y > Math.PI ? 1 : 0;
    const fS = anglesInRadians.y > 0 ? 1 : 0;

    return `M 48 48 L ${s.x} ${s.y} A ${radii.x} ${radii.y} ${(rotationInRadians / (2 * Math.PI)) * 360} ${fA} ${fS} ${e.x} ${e.y}`;
};

export function DirectionComponent({
    direction,
    viewAngleInDegrees,
    disabled = false,
    onDirectionChange,
    sx
}: DirectionComponentProps): JSX.Element {
    const center = useMemo(() => new Vec2(48, 48), []);
    const radii = useMemo(() => new Vec2(48, 48), []);

    const nonViewConePath = useMemo(
        () =>
            svgEllipseArc(
                center,
                radii,
                new Vec2(0, degreesToRadians(360 - viewAngleInDegrees)),
                0
            ),
        [center, radii, viewAngleInDegrees]
    );
    const viewConePath = useMemo(
        () => svgEllipseArc(center, radii, new Vec2(0, degreesToRadians(viewAngleInDegrees)), 0),
        [center, radii, viewAngleInDegrees]
    );

    const correctRotationToNorthInDegrees = -90;
    const halfViewConeInDegrees = viewAngleInDegrees / 2;
    const viewConeDirectionInDegrees = directionToDegrees(direction);
    const rotateNonViewConePath =
        viewConeDirectionInDegrees + correctRotationToNorthInDegrees + halfViewConeInDegrees;
    const rotateViewConePath =
        viewConeDirectionInDegrees + correctRotationToNorthInDegrees - halfViewConeInDegrees;

    const stroke = disabled ? "darkgrey" : "black";

    return (
        <Box
            data-testid="direction-component"
            sx={{
                borderRadius: 2,
                border: "1px black solid",
                display: "grid",
                backgroundColor: "beige",
                gridTemplateAreas: `
                    'title'
                    'direction'
                `,
                gridTemplateRows: "auto auto",
                rowGap: 1,
                p: 1,
                ...sx
            }}
        >
            <Typography variant="h6" sx={{ gridArea: "title", m: "auto" }}>
                Direction
            </Typography>
            <Box
                sx={{
                    gridArea: "direction",
                    m: "auto",
                    borderRadius: "10px",
                    backgroundColor: "white",
                    border: disabled ? "2px solid grey" : "2px solid black",
                    width: 96,
                    height: 96,
                    overflow: "hidden",
                    position: "relative",
                    cursor: disabled ? "not-allowed" : "pointer",
                    ...sx
                }}
                onClick={(event: React.MouseEvent<HTMLDivElement>) => {
                    const rect = (
                        event.target as HTMLDivElement
                    ).parentElement?.getBoundingClientRect();
                    if (!rect) {
                        return;
                    }
                    const pos = new Vec2(event.clientX - rect.x, event.clientY - rect.y);
                    if (pos.x < 0 || pos.x > rect.height || pos.y < 0 || pos.y > rect.height) {
                        console.info("Out of rect");
                        return;
                    }
                    const center = new Vec2(96 / 2, 96 / 2);
                    const up = new Vec2(0, 48).normalise();
                    const vec = pos.sub(center).normalise();
                    vec.y = -vec.y;
                    vec.x = -vec.x;

                    const angle = radiansToDegrees(Vec2.AngleBetweenInRadians(up, vec));
                    const roundedAngle = roundDegrees(angle);
                    const orientation = angleInDegreesToDirection(
                        clampAngleInDegrees(roundedAngle)
                    );

                    onDirectionChange(orientation);
                }}
            >
                <svg
                    className="direction-component--non-viewcone"
                    viewBox="0 0 96 96"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                        position: "absolute",
                        transformOrigin: "center",
                        transform: `rotate(${rotateNonViewConePath}deg)`
                    }}
                >
                    <path d={nonViewConePath} fill="rgb(240, 74, 99)" />
                </svg>
                <svg
                    className="direction-component--viewcone"
                    viewBox="0 0 96 96"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                        position: "absolute",
                        transformOrigin: "center",
                        transform: `rotate(${rotateViewConePath}deg)`
                    }}
                >
                    <path d={viewConePath} fill="rgb(30, 201, 104)" />
                </svg>
                <svg
                    className="direction-component--arrow"
                    viewBox="0 0 96 96"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                        transform: `translate(48px, 48px) rotate(${directionToDegrees(direction)}deg) translate(-48px, -48px)`,
                        position: "absolute",
                        transformOrigin: "top left"
                    }}
                >
                    <line
                        x1="48"
                        y1="48"
                        x2="48"
                        y2="10"
                        strokeWidth="2"
                        stroke={stroke}
                        style={{ pointerEvents: "none" }}
                    />
                    <line
                        x1="48"
                        y1="10"
                        x2="38"
                        y2="20"
                        strokeWidth="2"
                        stroke={stroke}
                        style={{ pointerEvents: "none" }}
                    />
                    <line
                        x1="48"
                        y1="10"
                        x2="58"
                        y2="20"
                        strokeWidth="2"
                        stroke={stroke}
                        style={{ pointerEvents: "none" }}
                    />
                    <ellipse
                        cx="48"
                        cy="48"
                        rx="10"
                        ry="10"
                        fill="lightgrey"
                        style={{ pointerEvents: "none" }}
                    />
                </svg>
            </Box>
        </Box>
    );
}
