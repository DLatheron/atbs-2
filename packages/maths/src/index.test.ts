import { sum } from './index.js';

describe('sum', () => {
	it('adds numbers', () => {
		expect(sum([1, 2, 3])).toBe(6);
	});
});
