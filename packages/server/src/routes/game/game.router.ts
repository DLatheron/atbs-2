import { Router, type IRouter } from 'express';
import { createGameRouter } from './create/create.router.js';

export const gameRouter: IRouter = Router();

gameRouter.use('/create', createGameRouter);
