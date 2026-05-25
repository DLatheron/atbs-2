interface Message {
    type: string;
    payload: unknown;
}

/**
 * NOTE: K parameter is special because it allows registerHandle to tightly specific the type of the handler function
 * it sends to be the same as the type. Without it, in this circumstance, typescript cannot sufficiently narrow the type.
 */
type MessageHandler<
    CONTEXT extends object,
    MESSAGE extends Message,
    FROM,
    K extends MESSAGE["type"] = MESSAGE["type"]
> = (
    context: CONTEXT,
    payload: Extract<MESSAGE, { type: K }>["payload"],
    from: FROM
) => void | Promise<void>;

export class MessageManager<
    CONTEXT extends object,
    MESSAGE extends Message,
    FROM extends object = never
> {
    private readonly _received: { message: MESSAGE; from: FROM }[];
    private readonly _context: CONTEXT;
    private readonly _messageHandlers: Map<MESSAGE["type"], MessageHandler<CONTEXT, MESSAGE, FROM>>;

    private _processingMessages: boolean;

    constructor(context: CONTEXT) {
        this._received = [];
        this._context = context;
        this._messageHandlers = new Map<MESSAGE["type"], MessageHandler<CONTEXT, MESSAGE, FROM>>();
        this._processingMessages = false;
    }

    get isProcessing() {
        return this._processingMessages;
    }

    get length() {
        return this._received.length + (this.isProcessing ? 1 : 0);
    }

    private findMessageHandler(
        type: MESSAGE["type"]
    ): MessageHandler<CONTEXT, MESSAGE, FROM> | undefined {
        return this._messageHandlers.get(type);
    }

    private getMessageHandler(
        type: MESSAGE["type"]
    ): MessageHandler<CONTEXT, MESSAGE, FROM> | never {
        const messageHandler = this.findMessageHandler(type);
        if (!messageHandler) {
            throw new Error(`No message handler registered for ${type}`);
        }
        return messageHandler;
    }

    private async processNextMessage() {
        let entry: { message: MESSAGE; from: FROM } | undefined;

        while ((entry = this._received.pop())) {
            const { message, from } = entry;

            const { type } = message;
            const messageHandler = this.getMessageHandler(type);

            this._processingMessages = true;
            await messageHandler(this._context, message.payload, from);
            this._processingMessages = false;
        }
    }

    /**
     * Register a new message handler with the manager.
     */
    registerHandler<K extends MESSAGE["type"]>(
        type: K,
        handler: MessageHandler<CONTEXT, MESSAGE, FROM, K>
    ) {
        this._messageHandlers.set(type, handler);
    }

    /**
     * Unregister an existing handler with the manager (returns `true` is handler was found and removed, otherwise
     * `false`).
     */
    unregisterHandler(type: MESSAGE["type"]): boolean {
        return this._messageHandlers.delete(type);
    }

    /**
     * Queue a new message for processing.
     */
    enqueueMessage(message: MESSAGE, from: FROM) {
        this._received.push({ message, from });

        if (this.isProcessing === false) {
            // Intentionally not awaited!
            this.processNextMessage();
        }
    }
}
