function sortObject(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => sortObject(item));
  }

  if (input !== null && typeof input === 'object') {
    const entries = Object.entries(input as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, sortObject(value)]);

    return Object.fromEntries(entries);
  }

  return input;
}

export function stableStringify(input: unknown, spacing = 2): string {
  return JSON.stringify(sortObject(input), null, spacing);
}
