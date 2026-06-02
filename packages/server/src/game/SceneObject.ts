import { Orientation, rotateOrientation } from "@atbs/maths";
import { isRenderImage, RenderImage, RenderList, RenderMode } from "@atbs/shared-data";
import z from "zod";

const SceneLeafNode = z.array(RenderImage);
export type SceneLeafNode = z.infer<typeof SceneLeafNode>;

function isSceneLeafNode(node: unknown): node is SceneLeafNode {
    return Array.isArray(node) && node.every(isRenderImage);
}

// Maps to the 9 different Orientations.
const SceneDirectionalNode = z.tuple([
    SceneLeafNode, // NORTH
    SceneLeafNode, // NORTH_EAST
    SceneLeafNode, // EAST
    SceneLeafNode, // SOUTH_EAST
    SceneLeafNode, // SOUTH
    SceneLeafNode, // SOUTH_WEST
    SceneLeafNode, // WEST
    SceneLeafNode, // NORTH_WEST
    SceneLeafNode // CENTER
]);
export type SceneDirectionalNode = z.infer<typeof SceneDirectionalNode>;

function isSceneDirectionalNode(node: unknown): node is SceneDirectionalNode {
    return Array.isArray(node) && node.length === 9;
}

// Recursive types: written by hand to break the inference cycle.
type SceneStateNode = { [key: string]: SceneChildNode } & {
    default: SceneChildNode;
};
type SceneChildNode = SceneLeafNode | SceneDirectionalNode | SceneStateNode;

const SceneStateNode: z.ZodType<SceneStateNode> = z
    .object({
        default: z.lazy(() => SceneChildNode)
    })
    .catchall(z.lazy(() => SceneChildNode));

const SceneChildNode: z.ZodType<SceneChildNode> = z.union([
    SceneLeafNode,
    SceneDirectionalNode,
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
    states: string[];
}

export class SceneObject {
    private readonly _sceneNode: SceneNode;

    constructor(sceneNodeNode: SceneNode) {
        this._sceneNode = sceneNodeNode;
    }

    getRenderList(context: SceneContext): RenderList {
        return SceneObject._ResolveSceneNode(this._sceneNode, context);
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
                    // TODO: Implement visibility filtering when visibilty is added.
                    const visibilityFilter = true;

                    return {
                        imageId,
                        ...(orientation && { orientation }),
                        ...(opacity !== 1 && { opacity }),
                        ...(visibilityFilter ? {} : { visibilityFilter })
                    };
                }
            );
        }

        if (isSceneDirectionalNode(childNode)) {
            const orientation = context.orientation ?? Orientation.NORTH;
            return SceneObject._ResolveChildNodeRecursively(
                childNode[orientation],
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
