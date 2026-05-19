/** @type {import('jest').Config} */
export default {
	preset: 'ts-jest/presets/default-esm',
	testEnvironment: 'node',
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
		'^@atbs/maths$': '<rootDir>/packages/maths/src/index.ts',
		'^@atbs/misc$': '<rootDir>/packages/misc/src/index.ts',
		'^@atbs/shared-data$': '<rootDir>/packages/shared-data/src/index.ts',
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: '<rootDir>/tsconfig.jest.json',
			},
		],
	},
	testMatch: ['**/*.test.ts'],
	collectCoverageFrom: ['packages/**/src/**/*.ts', '!**/*.d.ts'],
};
