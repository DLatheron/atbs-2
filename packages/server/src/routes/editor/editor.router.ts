import { Router, type IRouter } from "express";
import { createEditorRouter } from "./create/create.router.js";
import { joinEditorRouter } from "./join/join.router.js";
import { saveEditorRouter } from "./save/save.router.js";

export const editorRouter: IRouter = Router();

editorRouter.use("/create", createEditorRouter);
editorRouter.use("/join", joinEditorRouter);
editorRouter.use("/save", saveEditorRouter);
