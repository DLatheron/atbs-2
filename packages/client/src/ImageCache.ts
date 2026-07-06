/** Visible grey placeholder shown while an image is loading or failed to load. */
export const PLACEHOLDER_IMAGE_SRC =
    "data:image/svg+xml," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
            '<rect width="100" height="100" fill="#808080"/>' +
            "</svg>"
    );

/** @deprecated Use PLACEHOLDER_IMAGE_SRC */
export const embeddedBlankImage = PLACEHOLDER_IMAGE_SRC;

export type ImageLoadState = "idle" | "loading" | "loaded" | "error";

interface ImageEntry {
    state: ImageLoadState;
    image?: HTMLImageElement;
    dataString?: string;
    blob?: Blob;
}

async function fetchImage(id: string): Promise<Blob> {
    const url = `/api/image/${id}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
        throw new Error(`Failed to fetch image "${id}": ${res.status}`);
    }

    return res.blob();
}

async function decodeImage(image: HTMLImageElement, src: string): Promise<void> {
    image.src = src;

    if (typeof image.decode === "function") {
        await image.decode();
        return;
    }

    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Failed to decode image"));
    });
}

function createPlaceholderImage(): HTMLImageElement {
    const image = new Image();
    image.src = PLACEHOLDER_IMAGE_SRC;
    return image;
}

export class ImageCache {
    private readonly _entries: Record<string, ImageEntry> = {};
    private readonly _inFlight = new Map<string, Promise<void>>();
    private readonly _listenersById = new Map<string, Set<() => void>>();
    private readonly _anyListeners = new Set<() => void>();
    private readonly _placeholderImage: HTMLImageElement;

    constructor() {
        this._placeholderImage = createPlaceholderImage();
    }

    isLoaded(id: string): boolean {
        return this._entries[id]?.state === "loaded";
    }

    requestImage(id: string): void {
        if (!id) {
            return;
        }

        const entry = this._entries[id];
        if (entry?.state === "loaded" || entry?.state === "loading" || entry?.state === "error") {
            return;
        }

        this._entries[id] = { state: "loading" };

        const loadPromise = this._load(id);
        this._inFlight.set(id, loadPromise);
        void loadPromise.finally(() => {
            this._inFlight.delete(id);
        });
    }

    private async _load(id: string): Promise<void> {
        try {
            const blob = await fetchImage(id);
            const dataString = URL.createObjectURL(blob);
            const image = new Image();

            await decodeImage(image, dataString);

            this._entries[id] = {
                state: "loaded",
                image,
                dataString,
                blob
            };
        } catch (error) {
            console.warn(`Failed to load image "${id}"`, error);
            this._entries[id] = { state: "error" };
        }

        this._notify(id);
    }

    getImage(id: string): HTMLImageElement {
        this.requestImage(id);

        const entry = this._entries[id];
        if (entry?.state === "loaded" && entry.image) {
            return entry.image;
        }

        return this._placeholderImage;
    }

    getSrc(id: string | null | undefined): string {
        if (!id) {
            return PLACEHOLDER_IMAGE_SRC;
        }

        this.requestImage(id);

        const entry = this._entries[id];
        if (entry?.state === "loaded" && entry.dataString) {
            return entry.dataString;
        }

        return PLACEHOLDER_IMAGE_SRC;
    }

    /** @deprecated Use getSrc instead */
    getDataSafe(id: string | null): string {
        return this.getSrc(id);
    }

    subscribe(id: string, listener: () => void): () => void {
        let listeners = this._listenersById.get(id);
        if (!listeners) {
            listeners = new Set();
            this._listenersById.set(id, listeners);
        }

        listeners.add(listener);

        return () => {
            listeners?.delete(listener);
        };
    }

    subscribeAny(listener: () => void): () => void {
        this._anyListeners.add(listener);

        return () => {
            this._anyListeners.delete(listener);
        };
    }

    private _notify(id: string): void {
        this._listenersById.get(id)?.forEach((listener) => listener());
        this._anyListeners.forEach((listener) => listener());
    }

    /** Visible placeholder element for canvas rendering before load completes. */
    get placeholderImage(): HTMLImageElement {
        return this._placeholderImage;
    }

    /** Wait for an in-flight load to finish. Useful in tests. */
    async waitForLoad(id: string): Promise<void> {
        const inFlight = this._inFlight.get(id);
        if (inFlight) {
            await inFlight;
        }
    }

    private static readonly _singleton = new ImageCache();
    static GetSingleton(): ImageCache {
        return ImageCache._singleton;
    }
}
