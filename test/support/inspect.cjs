const AdmZip = require('adm-zip');
const { XMLValidator, XMLParser } = require('fast-xml-parser');
function parseXml(xml) {
  const text = Buffer.isBuffer(xml) ? xml.toString('utf8') : xml;
  if (typeof text !== 'string') throw new Error('Expected XML payload is missing');
  const validation = XMLValidator.validate(text);
  if (validation !== true) throw new Error(`Invalid XML: ${validation.err.msg}`);
  if ((text.match(/<\?xml\s/g) || []).length > 1) throw new Error('Nested XML declaration');
  return new XMLParser({ ignoreAttributes: false, parseTagValue: false, isArray: name => ['types', 'members', 'fields', 'referenceTo'].includes(name) }).parse(text);
}
function readZip(zipPath) {
  return new Map(new AdmZip(zipPath).getEntries().filter(entry => !entry.isDirectory).map(entry => [entry.entryName.replace(/\\/g, '/'), entry.getData()]));
}
function members(xml) {
  const types = parseXml(xml).Package.types || [];
  return Object.fromEntries(types.map(type => [type.name, type.members]));
}
module.exports = { parseXml, readZip, members };
