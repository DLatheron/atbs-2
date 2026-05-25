interface Message {
    type: string;
    payload: unknown;
}

type MessageHandler<MESSAGE extends Message, K extends MESSAGE["type"], CONTEXT extends object> = 
    (payload: Extract<MESSAGE, { type: K }>["payload"], context: CONTEXT) => void | Promise<void>;

export class MessageManager<MESSAGE extends Message, CONTEXT extends object>{
    private readonly _messages: MESSAGE[];
    private readonly _context: CONTEXT;
    private readonly _messageHandlers: Map<MESSAGE["type"], MessageHandler<MESSAGE, MESSAGE["type"], CONTEXT>>;

    private _processingMessages: boolean;

    constructor(context: CONTEXT) {
        this._messages = [];
        this._context = context;
        this._messageHandlers = new Map<MESSAGE["type"], MessageHandler<MESSAGE, MESSAGE["type"], CONTEXT>>();
        this._processingMessages = false;
    }

    get isProcessing() {
        return this._processingMessages;
    }

    get length() {
        return this._messages.length + (this.isProcessing ? 1 : 0);
    }

    private findMessageHandler(type: MESSAGE["type"]): MessageHandler<MESSAGE, MESSAGE["type"], CONTEXT> | undefined {
        return this._messageHandlers.get(type);
    }

    private getMessageHandler(type: MESSAGE["type"]): MessageHandler<MESSAGE, MESSAGE["type"], CONTEXT> | never {
        const messageHandler = this.findMessageHandler(type);
        if (!messageHandler) {
            throw new Error(`No message handler registered for ${type}`);
        }
        return messageHandler;
    }

    private async processNextMessage() {
        let message: Message | undefined;

        // eslint-disable-next-line no-cond-assign
        while (message = this._messages.pop()) {
            const { type } = message;
            const messageHandler = this.getMessageHandler(type);
            
            this._processingMessages = true;
            await messageHandler(message.payload, this._context);
            this._processingMessages = false;
        }
    }

    /**
     * Register a new message handler with the manager.
     */
    registerHandler<K extends MESSAGE["type"]>(type: K, handler: MessageHandler<MESSAGE, K, CONTEXT>) {
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
    enqueueMessage(message: MESSAGE) {
        this._messages.push(message);

        if (this.isProcessing === false) {
            // Intentionally not awaited!
            this.processNextMessage();
        }
    }
};
