import { DEFAULT_API_VERSION } from '../../constants/metadata';

export function extractApiVersion(xmlContent: string): string {
  const match = xmlContent.match(/<apiVersion>([^<]+)<\/apiVersion>/);
  return match?.[1]?.trim() || DEFAULT_API_VERSION;
}

export function extractXmlInner(xmlContent: string, rootTag: string): string {
  const openPattern = new RegExp(`<${rootTag}[^>]*>`);
  const openMatch = xmlContent.match(openPattern);
  const closeTag = `</${rootTag}>`;

  if (!openMatch || typeof openMatch.index !== 'number') {
    throw new Error(`Unable to find opening tag <${rootTag}>`);
  }

  const openIndex = openMatch.index;
  const start = openIndex + openMatch[0].length;
  const end = xmlContent.lastIndexOf(closeTag);

  if (openIndex === -1 || end === -1 || end < start) {
    throw new Error(`Unable to extract inner XML for <${rootTag}>`);
  }

  return xmlContent.slice(start, end).trim();
}

export function xmlDeclaration(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>';
}

export function wrapMetadataXml(rootTag: string, innerXml: string): string {
  return `${xmlDeclaration()}\n<${rootTag} xmlns="http://soap.sforce.com/2006/04/metadata">\n${innerXml}\n</${rootTag}>\n`;
}

export function sanitizePathSegment(name: string): string {
  return encodeURIComponent(name).replace(/%20/g, '+');
}

export function desanitizePathSegment(name: string): string {
  return decodeURIComponent(name.replace(/\+/g, '%20'));
}
