import { stableStringify } from '../stableStringify';

describe('stableStringify', () => {
  it('sorts object keys recursively', () => {
    const payload = {
      z: 1,
      a: {
        d: 4,
        b: 2,
      },
    };

    const result = stableStringify(payload, 0);
    expect(result).toBe('{"a":{"b":2,"d":4},"z":1}');
  });
});
