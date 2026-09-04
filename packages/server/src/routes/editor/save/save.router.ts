import { Router, type IRouter } from "express";
import { saveEditor } from "./save.handler.js";

export const saveEditorRouter: IRouter = Router();

saveEditorRouter.post("/", saveEditor);
