import { Router, type IRouter } from "express";
import { joinEditor } from "./join.handler.js";

export const joinEditorRouter: IRouter = Router();

joinEditorRouter.post("/", joinEditor);
