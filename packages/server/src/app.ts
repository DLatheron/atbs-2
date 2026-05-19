import express, { type Application } from 'express';
import { apiRouter } from './routes/index.js';

export function createApp(): Application {
	const app = express();

	app.use(express.json());
	app.use('/api', apiRouter);

	return app;
}
