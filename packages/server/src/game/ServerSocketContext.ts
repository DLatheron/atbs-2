import { ServerToClientMessage } from "@atbs/shared-data";

export interface ServerSocketContext {
    send: (message: ServerToClientMessage) => void;
}
