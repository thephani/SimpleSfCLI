import { extractXmlInner } from '../xml';

describe('extractXmlInner', () => {
  it('returns inner xml for root tag', () => {
    const xml = '<?xml version="1.0"?><CustomField xmlns="http://soap.sforce.com/2006/04/metadata"><label>Amount</label><type>Currency</type></CustomField>';
    const inner = extractXmlInner(xml, 'CustomField');

    expect(inner).toContain('<label>Amount</label>');
    expect(inner).toContain('<type>Currency</type>');
  });
});
