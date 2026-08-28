import { Router, type IRouter } from "express";
import { gameRouter } from "./game/game.router.js";
import { editorRouter } from "./editor/editor.router.js";
import { statusRouter } from "./status/status.router.js";
import { imageRouter } from "./image/image.router.js";

export const apiRouter: IRouter = Router();

apiRouter.use("/status", statusRouter);
apiRouter.use("/game", gameRouter);
apiRouter.use("/editor", editorRouter);
apiRouter.use("/image", imageRouter);
