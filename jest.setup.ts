import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';

global.jest = jest;

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;
