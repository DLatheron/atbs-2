/**
 * Stricter keyof. Assumes type T exhaustively declares all possible named
 * properties!
 */
export type RecordKey<T> =
    T extends Partial<infer R> ? (R extends Record<infer K, unknown> ? K : never) : never;

/**
 * Stricter type for members of Object.entries(t). Assumes type T exhaustively
 * declares all possible named properties!
 */
export type RecordEntry<T> = {
    [K in RecordKey<T>]: [K, Required<T>[K]];
}[RecordKey<T>];

/**
 * An invocation of Object.keys that strongly assumes the only possible keys are
 * those explicitly declared by the type. This is unsafe if the object may have
 * excess properties that are not declared by the type, which is allowed in a
 * structural typing system.
 */
export function unsafeKeys<T extends Readonly<NonNullable<unknown>>>(obj: T) {
    return Object.keys(obj) as RecordKey<T>[];
}

/**
 * An invocation of Object.entries that strongly assumes the only possible
 * entries are those explicitly declared by the type. This is unsafe if the
 * object may have excess properties that are not declared by the type, which is
 * allowed in a structural typing system.
 */
export function unsafeEntries<T extends Readonly<NonNullable<unknown>>>(obj: T) {
    return Object.entries(obj) as RecordEntry<T>[];
}
