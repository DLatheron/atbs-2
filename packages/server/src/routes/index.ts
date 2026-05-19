import { Router, type IRouter } from 'express';
import { statusRouter } from './status/status.router.js';

export const apiRouter: IRouter = Router();

apiRouter.use('/status', statusRouter);
