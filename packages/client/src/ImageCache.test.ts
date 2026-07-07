import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockImage {
    src = "";
    decode = vi.fn(async () => undefined);
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
}

vi.hoisted(() => {
    vi.stubGlobal(
        "Image",
        vi.fn(function MockImageConstructor(this: MockImage) {
            return Object.assign(this, new MockImage());
        })
    );
});

const { ImageCache, PLACEHOLDER_IMAGE_SRC } = await import("./ImageCache.js");

type ImageCacheInstance = InstanceType<typeof ImageCache>;

describe("ImageCache", () => {
    let cache: ImageCacheInstance;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn(async () => ({
            ok: true,
            blob: async () => new Blob(["png"], { type: "image/png" })
        }));
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("URL", {
            createObjectURL: vi.fn(() => "blob:test-url"),
            revokeObjectURL: vi.fn()
        });

        cache = new ImageCache();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.stubGlobal(
            "Image",
            vi.fn(function MockImageConstructor(this: MockImage) {
                return Object.assign(this, new MockImage());
            })
        );
    });

    it("returns placeholder before load and real image after fetch completes", async () => {
        expect(cache.isLoaded("grass")).toBe(false);
        expect(cache.getSrc("grass")).toBe(PLACEHOLDER_IMAGE_SRC);

        cache.requestImage("grass");
        await cache.waitForLoad("grass");

        expect(cache.isLoaded("grass")).toBe(true);
        expect(cache.getSrc("grass")).toBe("blob:test-url");
        expect(cache.getImage("grass").src).toBe("blob:test-url");
    });

    it("dedupes concurrent requestImage calls", async () => {
        cache.requestImage("grass");
        cache.requestImage("grass");
        cache.requestImage("grass");

        await cache.waitForLoad("grass");

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("notifies subscribers when load completes", async () => {
        const listener = vi.fn();

        cache.subscribe("grass", listener);
        cache.requestImage("grass");

        expect(listener).not.toHaveBeenCalled();

        await cache.waitForLoad("grass");

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("keeps placeholder and does not throw when fetch fails", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 404,
            blob: async () => new Blob()
        });

        cache.requestImage("missing");
        await cache.waitForLoad("missing");

        expect(cache.isLoaded("missing")).toBe(false);
        expect(cache.getSrc("missing")).toBe(PLACEHOLDER_IMAGE_SRC);
        expect(() => cache.getImage("missing")).not.toThrow();
        expect(cache.getImage("missing").src).toBe(PLACEHOLDER_IMAGE_SRC);
    });

    it("getImage never throws for unknown ids", () => {
        expect(() => cache.getImage("unknown")).not.toThrow();
        expect(cache.getImage("unknown")).toBe(cache.placeholderImage);
    });

    it("reloadImage refetches an already loaded image with cache busting", async () => {
        cache.requestImage("grass");
        await cache.waitForLoad("grass");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe("/api/image/grass");

        cache.reloadImage("grass");
        await cache.waitForLoad("grass");

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toMatch(/^\/api\/image\/grass\?t=\d+$/);
        expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
    });
});
