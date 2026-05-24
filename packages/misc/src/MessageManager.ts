interface Message {
    type: string
}

type MessageHandler<MESSAGE_TYPE extends Message, CONTEXT extends object> = (messageType: MESSAGE_TYPE, context: CONTEXT) => Promise<void>;

export class MessageManager<MESSAGE_TYPE extends Message, CONTEXT extends object> {
    private readonly _messages: MESSAGE_TYPE[];
    private readonly _context: CONTEXT;
    private readonly _messageHandlers: Map<string, MessageHandler<MESSAGE_TYPE, CONTEXT>>;

    private _processingMessages: boolean;

    constructor(context: CONTEXT) {
        this._messages = [];
        this._context = context;
        this._messageHandlers = new Map<string, MessageHandler<MESSAGE_TYPE, CONTEXT>>();
        this._processingMessages = false;
    }

    get isProcessing() {
        return this._processingMessages;
    }

    get length() {
        return this._messages.length + (this.isProcessing ? 1 : 0);
    }

    private findMessageHandler(type: string): MessageHandler<MESSAGE_TYPE, CONTEXT> | undefined {
        return this._messageHandlers.get(type);
    }

    private getMessageHandler(type: string): MessageHandler<MESSAGE_TYPE, CONTEXT> | never {
        const messageHandler = this.findMessageHandler(type);
        if (!messageHandler) {
            throw new Error(`No message handler registered for ${type}`);
        }
        return messageHandler;
    }

    private async processNextMessage() {
        let message: MESSAGE_TYPE | undefined;

        // eslint-disable-next-line no-cond-assign
        while (message = this._messages.pop()) {
            const { type } = message;
            const messageHandler = this.getMessageHandler(type);
            
            this._processingMessages = true;
            await messageHandler(message, this._context);
            this._processingMessages = false;
        }
    }

    /**
     * Register a new message handler with the manager.
     */
    registerHandler(type: string, handler: MessageHandler<MESSAGE_TYPE, CONTEXT>) {
        this._messageHandlers.set(type, handler);
    }

    /**
     * Unregister an existing handler with the manager (returns `true` is handler was found and removed, otherwise
     * `false`).
     */
    unregisterHandler(type: string): boolean {
        return this._messageHandlers.delete(type);
    }

    /**
     * Queue a new message for processing.
     */
    enqueueMessage(message: MESSAGE_TYPE) {
        this._messages.push(message);

        if (this.isProcessing === false) {
            // Intentionally not awaited!
            this.processNextMessage();
        }
    }
};
