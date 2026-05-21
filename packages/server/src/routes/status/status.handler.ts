import { sum } from '@atbs/maths';
import { StatusResponseBody } from '@atbs/shared-data';
import type { RequestHandler } from 'express';

export const getStatus: RequestHandler = (_req, res) => {
	const payload = StatusResponseBody.parse({
		status: 'ok',
		message: `Server is running (sample sum: ${sum([1, 2, 3])})`,
	});

	res.json(payload);
};
