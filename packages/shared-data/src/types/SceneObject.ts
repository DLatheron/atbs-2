import { Orientation, rotateOrientation } from "@atbs/maths";
import { ImageId, isRenderImage, RenderImage, RenderList } from "./PrimitiveTypes.js";
import { RenderMode } from "./RenderMode.js";
import z from "zod";

const SceneLeafNode = z.array(RenderImage);
export type SceneLeafNode = z.infer<typeof SceneLeafNode>;

function isSceneLeafNode(node: unknown): node is SceneLeafNode {
    return Array.isArray(node) && node.every(isRenderImage);
}

// Recursive types: written by hand to break the inference cycle.
// Maps to the 9 different Orientations (NORTH..NORTH_WEST + CENTER).
export type SceneDirectionalNode = {
    directional: [
        SceneChildNode,
        SceneChildNode,
        SceneChildNode,
        SceneChildNode,
        SceneChildNode,
        SceneChildNode,
        SceneChildNode,
        SceneChildNode,
        SceneChildNode
    ];
};
export type SceneFramesNode = { frames: SceneChildNode[] };
export type SceneStateNode = { [key: string]: SceneChildNode } & {
    default: SceneChildNode;
};
export type SceneChildNode =
    | SceneLeafNode
    | SceneDirectionalNode
    | SceneFramesNode
    | SceneStateNode;

const SceneDirectionalNode: z.ZodType<SceneDirectionalNode> = z.object({
    directional: z.tuple([
        z.lazy(() => SceneChildNode), // NORTH
        z.lazy(() => SceneChildNode), // NORTH_EAST
        z.lazy(() => SceneChildNode), // EAST
        z.lazy(() => SceneChildNode), // SOUTH_EAST
        z.lazy(() => SceneChildNode), // SOUTH
        z.lazy(() => SceneChildNode), // SOUTH_WEST
        z.lazy(() => SceneChildNode), // WEST
        z.lazy(() => SceneChildNode), // NORTH_WEST
        z.lazy(() => SceneChildNode) // CENTER
    ])
});

function isSceneDirectionalNode(node: unknown): node is SceneDirectionalNode {
    return (
        typeof node === "object" && node !== null && !Array.isArray(node) && "directional" in node
    );
}

const SceneFramesNode: z.ZodType<SceneFramesNode> = z.object({
    frames: z.array(z.lazy(() => SceneChildNode)).min(1)
});

function isSceneFramesNode(node: unknown): node is SceneFramesNode {
    return typeof node === "object" && node !== null && !Array.isArray(node) && "frames" in node;
}

const SceneStateNode: z.ZodType<SceneStateNode> = z
    .object({
        default: z.lazy(() => SceneChildNode)
    })
    .catchall(z.lazy(() => SceneChildNode));

const SceneChildNode: z.ZodType<SceneChildNode> = z.union([
    SceneLeafNode,
    SceneDirectionalNode,
    SceneFramesNode,
    SceneStateNode
]);

export const SceneNode = z.object({
    [RenderMode.enum.UI_MODE]: SceneChildNode.optional(),
    [RenderMode.enum.MAP_MODE]: SceneChildNode.optional(),
    [RenderMode.enum.FIRE_MODE]: SceneChildNode.optional(),
    default: SceneChildNode
});
export type SceneNode = z.infer<typeof SceneNode>;

export interface SceneContext {
    renderMode: RenderMode;
    orientation?: Orientation;
    applyOrientation?: number;
    opacity?: number;
    frame?: number;
    states: string[];
    visibilityFilter?: boolean;
}

export class SceneObject {
    private readonly _sceneNode: SceneNode;

    constructor(sceneNodeNode: SceneNode) {
        this._sceneNode = sceneNodeNode;
    }

    getRenderList(context: SceneContext): RenderList {
        return SceneObject._ResolveSceneNode(this._sceneNode, context);
    }

    // Visits every leaf imageId across all render modes, states, orientations and
    // frames, invoking the callback once per unique id. Independent of SceneContext,
    // so callers (e.g. the client cache pre-warm) receive the full set up front.
    forEachImageId(callback: (imageId: ImageId) => void): void {
        const seen = new Set<ImageId>();

        const visit = (imageId: ImageId): void => {
            if (!seen.has(imageId)) {
                seen.add(imageId);
                callback(imageId);
            }
        };

        const walk = (node: SceneChildNode): void => {
            if (isSceneLeafNode(node)) {
                for (const { imageId } of node) {
                    visit(imageId);
                }
            } else if (isSceneDirectionalNode(node)) {
                node.directional.forEach(walk);
            } else if (isSceneFramesNode(node)) {
                node.frames.forEach(walk);
            } else {
                for (const child of Object.values(node)) {
                    walk(child);
                }
            }
        };

        const modes = [
            RenderMode.enum.UI_MODE,
            RenderMode.enum.MAP_MODE,
            RenderMode.enum.FIRE_MODE,
            "default"
        ] as const;

        for (const mode of modes) {
            const child = this._sceneNode[mode];
            if (child) {
                walk(child);
            }
        }
    }

    // getRenderListAllModes(context: SceneContext): Record<RenderMode, RenderList> {
    //     return {
    //         [RenderMode.enum.UI_MODE]: this.getRenderList({
    //             ...context,
    //             renderMode: RenderMode.enum.UI_MODE
    //         }),
    //         [RenderMode.enum.MAP_MODE]: this.getRenderList({
    //             ...context,
    //             renderMode: RenderMode.enum.MAP_MODE
    //         }),
    //         [RenderMode.enum.FIRE_MODE]: this.getRenderList({
    //             ...context,
    //             renderMode: RenderMode.enum.FIRE_MODE
    //         })
    //     };
    // }

    private static _ResolveChildNodeRecursively(
        childNode: SceneChildNode,
        context: SceneContext,
        stateIndex: number
    ): RenderList {
        if (isSceneLeafNode(childNode)) {
            // Pre-rotate all of the images by the context's orientation.
            return childNode.map<RenderImage>(
                ({ imageId, orientation: originalOrientation, opacity: originalOpacity }) => {
                    const orientation = rotateOrientation(
                        originalOrientation ?? Orientation.NORTH,
                        context.applyOrientation ?? Orientation.NORTH
                    );
                    const opacity = (originalOpacity ?? 1) * (context.opacity ?? 1);
                    const visibilityFilter = context.visibilityFilter ?? false;

                    return {
                        imageId,
                        ...(orientation && { orientation }),
                        ...(opacity !== 1 && { opacity }),
                        ...(visibilityFilter ? { visibilityFilter } : {})
                    };
                }
            );
        }

        if (isSceneDirectionalNode(childNode)) {
            const orientation = context.orientation ?? Orientation.NORTH;
            return SceneObject._ResolveChildNodeRecursively(
                childNode.directional[orientation],
                context,
                stateIndex
            );
        }

        if (isSceneFramesNode(childNode)) {
            const frameCount = childNode.frames.length;
            const frameIndex =
                frameCount === 0
                    ? 0
                    : ((Math.floor(context.frame ?? 0) % frameCount) + frameCount) % frameCount;
            return SceneObject._ResolveChildNodeRecursively(
                childNode.frames[frameIndex],
                context,
                stateIndex
            );
        }

        const extractedState = context.states[stateIndex] ?? "default";
        const matchedChildNode =
            extractedState in childNode ? childNode[extractedState] : childNode.default;

        return SceneObject._ResolveChildNodeRecursively(matchedChildNode, context, stateIndex + 1);
    }

    private static _ResolveSceneNode(modeNode: SceneNode, context: SceneContext): RenderList {
        const childNode = modeNode[context.renderMode] ?? modeNode.default;

        return SceneObject._ResolveChildNodeRecursively(childNode, context, 0);
    }
}
