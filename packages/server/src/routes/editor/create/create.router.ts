import { Router, type IRouter } from "express";
import { createEditor } from "./create.handler.js";

export const createEditorRouter: IRouter = Router();

createEditorRouter.post("/", createEditor);
