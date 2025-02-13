export default {
	preset: 'ts-jest', // Changed from 'ts-jest/preset/default-esm' to just 'ts-jest'
	testEnvironment: 'node',
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: 'tsconfig.json',
			},
		],
	},
	extensionsToTreatAsEsm: ['.ts'],
	testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
	setupFilesAfterEnv: ['./jest.setup.ts'],
};
