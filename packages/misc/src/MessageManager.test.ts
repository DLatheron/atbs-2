import { describe, beforeEach, expect, it, vi, MockInstance } from "vitest";

import { MessageManager } from "./MessageManager.js";

function sleep(timeInMs: number) {
    return new Promise(resolve => setTimeout(resolve, timeInMs));
}

function makeResolver() {
    let resolve: ((value?: unknown) => void) | undefined;
    
    const promise = new Promise((localResolver) => {
        resolve = localResolver;
    });

    if (!resolve) {
        throw new Error(`resolver not defined`);
    }

    return { promise, resolve };
}

describe("MessageManager", () => {
    interface TestMessage {
        type: string;
        payload: number;
    }

    interface Context {
        system: string;
    }

    const minimalSleepInMs = 100;

    let context: Context;
    let messageManager: MessageManager<TestMessage, Context>;
    let processNextMessage: MockInstance<() => Promise<void>>;

    beforeEach(() => {
        context = { system: "my-system" };
        messageManager = new MessageManager<TestMessage, Context>(context);

        processNextMessage = vi.spyOn(messageManager as never, "processNextMessage");
    });

    it("should execute enqueued message when first inserted", async () => {
        const { resolve, promise } = makeResolver();

        const handler = vi.fn(async () => {
            await sleep(minimalSleepInMs);
            resolve();
        });

        messageManager.registerHandler("message", handler);

        const message = { type: "message", payload: 1234 };
        messageManager.enqueueMessage(message);

        await promise;

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(message, context);

        expect(processNextMessage).toHaveBeenCalledTimes(1);
        expect(processNextMessage).toHaveBeenCalledWith()

        return promise;
    });

    it("should not execute enqueued message if a message is already in flight", async () => {
        const { resolve: resolve0, promise: promise0 } = makeResolver();
        const { resolve: resolve1, promise: promise1 } = makeResolver();

        const handler0 = vi.fn(async () => await promise0);
        const handler1 = vi.fn(async () => resolve1());

        messageManager.registerHandler("message0", handler0);
        messageManager.registerHandler("message1", handler1);

        const message0 = { type: "message0", payload: 1234 };
        const message1 = { type: "message1", payload: 5678 };

        /* Message 0 is enqueued and executed executed immediately - but blocks on the promise */
        messageManager.enqueueMessage(message0);
        expect(handler0).toHaveBeenCalledTimes(1);
        expect(handler0).toHaveBeenCalledWith(message0, context);
        expect(processNextMessage).toHaveBeenCalledTimes(1);
        expect(processNextMessage).toHaveBeenCalledWith()

        /* Message 1 is not executed because message 0 is still blocking */
        messageManager.enqueueMessage(message1);
        expect(handler1).not.toHaveBeenCalled();
        expect(processNextMessage).toHaveBeenCalledTimes(1);

        /* Message 0 is unblocked, meaning that Message 1 can immediately execute. */
        resolve0();

        /* Wait for the second message to have been processed */
        await promise1;

        /* Message 1 has not been executed */
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler1).toHaveBeenCalledWith(message1, context);
        expect(processNextMessage).toHaveBeenCalledTimes(1);
    });

    it("should after processing messages and emptying the queue, new messages should start the processing loop again", async () => {
        const { resolve: resolve0, promise: promise0 } = makeResolver();
        const { resolve: resolve1, promise: promise1 } = makeResolver();

        const handler0 = vi.fn(async () => resolve0());
        const handler1 = vi.fn(async () => resolve1());

        messageManager.registerHandler("message0", handler0);
        messageManager.registerHandler("message1", handler1);

        const message0 = { type: "message0", payload: 1234 };
        const message1 = { type: "message1", payload: 5678 };

        /* Message 0 is enqueued and executed immediately - then the promise is resolved and completes */
        messageManager.enqueueMessage(message0);
        expect(handler0).toHaveBeenCalledTimes(1);
        expect(handler0).toHaveBeenCalledWith(message0, context);
        expect(processNextMessage).toHaveBeenCalledTimes(1);
        expect(processNextMessage).toHaveBeenCalledWith()
        expect(messageManager).toHaveLength(1);
        await promise0;

        /* Message queue processing is complete */
        expect(messageManager).toHaveLength(0);
        await sleep(minimalSleepInMs);
        expect(messageManager).toHaveLength(0);

        /* Message 1 is enqueued and executed immediately - then the promise is resolved and completes */
        messageManager.enqueueMessage(message1);
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler1).toHaveBeenCalledWith(message1, context);
        expect(processNextMessage).toHaveBeenCalledTimes(2);
        expect(processNextMessage).toHaveBeenCalledWith()
        expect(messageManager).toHaveLength(1);
        await promise1;
    });
});
