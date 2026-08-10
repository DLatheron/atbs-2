import { mergeWith } from "lodash";

export type FieldMergeMode = "merge" | "replace";

/**
 * Deep-merge `source` into a clone of `target`, with per-field strategies.
 * Unspecified fields default to `"merge"`. Use `"replace"` to overwrite
 * a field wholesale instead of deep-merging it.
 */
export function selectiveMerge<T extends object>(
    target: T,
    source: object,
    fieldModes: Partial<Record<keyof T & string, FieldMergeMode>> = {}
): T {
    return mergeWith({}, target, source, (_objValue, srcValue, key) => {
        if (fieldModes[key as keyof T & string] === "replace") {
            return srcValue;
        }
        // undefined => lodash default deep-merge behaviour
    }) as T;
}
