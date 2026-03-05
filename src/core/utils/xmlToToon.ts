import { XMLBuilder, XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: true,
  trimValues: true,
  numberParseOptions: {
    // Keep numeric-looking strings as strings (e.g. apiVersion "62.0")
    hex: false,
    leadingZeros: true,
    skipLike: /^[-+]?\d+(\.\d+)?$/,
  },
});

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  suppressEmptyNode: false,
  format: true,
});

export function parseXmlToToonPayload(xmlContent: string): unknown {
  return parser.parse(xmlContent);
}

export function buildXmlFromToonPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid TOON payload for XML build');
  }

  const xml = builder.build(payload as Record<string, unknown>);
  return `${xml.trim()}\n`;
}
