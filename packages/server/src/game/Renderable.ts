import { Orientation, rotateOrientation } from "@atbs/maths";
import { isRenderImage, RenderImage, RenderList, RenderMode } from "@atbs/shared-data";
import z from "zod";

const LeafNodeSchema = z.array(RenderImage);
export type LeafNode = z.infer<typeof LeafNodeSchema>;

function isLeafNode(node: unknown): node is LeafNode {
    return Array.isArray(node) && node.every(isRenderImage);
}

const DirectionalNodeSchema = z.tuple([
    LeafNodeSchema,
    LeafNodeSchema,
    LeafNodeSchema,
    LeafNodeSchema,
    LeafNodeSchema,
    LeafNodeSchema,
    LeafNodeSchema,
    LeafNodeSchema,
    LeafNodeSchema
]);
export type DirectionalNode = z.infer<typeof DirectionalNodeSchema>;

function isDirectionNode(node: unknown): node is DirectionalNode {
    return Array.isArray(node) && node.length === 9;
}

// Recursive types: written by hand to break the inference cycle.
type StateNode = { [key: string]: ChildNode } & { default: ChildNode };
type ChildNode = LeafNode | DirectionalNode | StateNode;

const StateNodeSchema: z.ZodType<StateNode> = z
    .object({
        default: z.lazy(() => ChildNodeSchema)
    })
    .catchall(z.lazy(() => ChildNodeSchema));

const ChildNodeSchema: z.ZodType<ChildNode> = z.union([
    LeafNodeSchema,
    DirectionalNodeSchema,
    StateNodeSchema
]);

export const ModeNode = z.object({
    [RenderMode.enum.UI_MODE]: ChildNodeSchema.optional(),
    [RenderMode.enum.MAP_MODE]: ChildNodeSchema.optional(),
    [RenderMode.enum.FIRE_MODE]: ChildNodeSchema.optional(),
    default: ChildNodeSchema
});
export type ModeNode = z.infer<typeof ModeNode>;

export interface RenderableContext {
    renderMode: RenderMode;
    orientation?: Orientation;
    applyOrientation?: number;
    opacity?: number;
    states: string[];
}

export class Renderable {
    private readonly _modeNode: ModeNode;

    constructor(modeNode: ModeNode) {
        this._modeNode = modeNode;
    }

    getRenderList(context: RenderableContext): RenderList {
        return Renderable.ResolveModeNode(this._modeNode, context);
    }

    getRenderListAllModes(context: RenderableContext): Record<RenderMode, RenderList> {
        return {
            [RenderMode.enum.UI_MODE]: this.getRenderList({
                ...context,
                renderMode: RenderMode.enum.UI_MODE
            }),
            [RenderMode.enum.MAP_MODE]: this.getRenderList({
                ...context,
                renderMode: RenderMode.enum.MAP_MODE
            }),
            [RenderMode.enum.FIRE_MODE]: this.getRenderList({
                ...context,
                renderMode: RenderMode.enum.FIRE_MODE
            })
        };
    }

    private static ResolveChildNodeRecursively(
        childNode: ChildNode,
        context: RenderableContext
    ): RenderList {
        if (isLeafNode(childNode)) {
            // Pre-rotate all of the images by the context's orientation.
            return childNode.map<RenderImage>(
                ({ imageId, orientation: originalOrientation, opacity: originalOpacity }) => {
                    const orientation = rotateOrientation(
                        originalOrientation ?? Orientation.NORTH,
                        context.applyOrientation ?? Orientation.NORTH
                    );
                    const opacity = (originalOpacity ?? 1) * (context.opacity ?? 1);

                    return {
                        imageId,
                        ...(orientation && { orientation }),
                        ...(opacity !== 1 && { opacity })
                    };
                }
            );
        }

        if (isDirectionNode(childNode)) {
            const orientation = context.orientation ?? Orientation.NORTH;
            return Renderable.ResolveChildNodeRecursively(childNode[orientation], context);
        }

        const extractedState = context.states.shift() ?? "default";
        const matchedChildNode =
            extractedState in childNode ? childNode[extractedState] : childNode.default;

        return Renderable.ResolveChildNodeRecursively(matchedChildNode, context);
    }

    private static ResolveModeNode(modeNode: ModeNode, context: RenderableContext): RenderList {
        // Duplicate to avoid side-effects on the states array.
        const localContext = { ...context, states: [...context.states ] };
        const childNode = modeNode[context.renderMode] ?? modeNode.default;

        return Renderable.ResolveChildNodeRecursively(childNode, localContext);
    }
}
