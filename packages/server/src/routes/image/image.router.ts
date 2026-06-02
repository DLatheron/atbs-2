import { Router, type IRouter } from "express";
import { getImage } from "./image.handler.js";

export const imageRouter: IRouter = Router();

imageRouter.get("/:id", getImage);
