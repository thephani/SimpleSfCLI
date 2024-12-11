import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;
global.fetch = jest.fn(() =>
	Promise.resolve({
		ok: true,
		status: 200,
		json: async () => ({}),
	} as Response)
);
