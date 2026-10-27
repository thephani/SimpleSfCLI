const fs = require('node:fs');
const path = require('node:path');
const { withProject, source, fixtureRoot } = require('../support/project.cjs');
const { packageProject } = require('../support/package.cjs');
const { parseXml, readZip, members } = require('../support/inspect.cjs');
const object = `${source}/objects/Demo__c/Demo__c.object-meta.xml`;
const field = `${source}/objects/Demo__c/fields/Status__c.field-meta.xml`;
const cls = `${source}/classes/Keep.cls`;
const original = file => fs.readFileSync(path.join(fixtureRoot, file), 'utf8');
async function changed(p, file) { await p.write(file, original(file).replace('baseline', 'changed').replace('</label>', ' Updated</label>')); }
async function zip(p, overrides) {
  const result = await packageProject(p, overrides);
  expect(result.timedOut).toBe(false);
  expect({ code: result.exitCode, error: result.stderr }).toEqual({ code: 0, error: '' });
  return readZip(p.zipPath);
}

describe('real Git → MDAPI → ZIP', () => {
  test.each(['committed', 'staged', 'unstaged', 'untracked'])('packages field-only %s changes', state => withProject(`field-${state}`, async p => {
    if (state === 'untracked') {
      await p.remove(field); p.git(['add', '.']); p.git(['commit', '-qm', 'remove field baseline']); p.git(['tag', '-f', 'fixture-base']);
    }
    await changed(p, field);
    if (state === 'committed' || state === 'staged') p.git(['add', field]);
    if (state === 'committed') p.git(['commit', '-qm', 'field change']);
    const files = await zip(p);
    expect(members(files.get('package.xml'))).toEqual({ CustomField: ['Demo__c.Status__c'] });
    expect(parseXml(files.get('objects/Demo__c.object')).CustomObject.fields[0].fullName).toBe('Status__c');
    expect([...files.keys()].some(name => name.includes('/fields/'))).toBe(false);
  }));
  test('preserves object settings and changed fields in the same XML document', () => withProject('object-plus-field', async p => {
    await changed(p, object); await changed(p, field);
    const files = await zip(p);
    const xml = files.get('objects/Demo__c.object').toString();
    const payload = parseXml(xml).CustomObject;
    expect(payload.label).toBe('Demo & Example Updated');
    expect(payload.fields[0].fullName).toBe('Status__c');
    expect(payload.fields[0].label).toBe('Status & Stage Updated');
    expect(members(files.get('package.xml'))).toEqual({ CustomField: ['Demo__c.Status__c'], CustomObject: ['Demo__c'] });
    expect(xml.match(/<\?xml/g)).toHaveLength(1);
  }));
  test('packages a new object with its fields', () => withProject('new-object', async p => {
    await p.remove(`${source}/objects/Demo__c`); p.git(['add', '.']); p.git(['commit', '-qm', 'without object']); p.git(['tag', '-f', 'fixture-base']);
    await p.write(object, original(object)); await p.write(field, original(field));
    const files = await zip(p);
    expect(parseXml(files.get('objects/Demo__c.object')).CustomObject.fields[0].fullName).toBe('Status__c');
    expect(members(files.get('package.xml')).CustomObject).toEqual(['Demo__c']);
  }));
  test('packages object settings alone without adding unchanged fields', () => withProject('object-only', async p => {
    await changed(p, object);
    const files = await zip(p);
    expect(members(files.get('package.xml'))).toEqual({ CustomObject: ['Demo__c'] });
    expect(parseXml(files.get('objects/Demo__c.object')).CustomObject.fields).toBeUndefined();
  }));
  test('preserves repeated field properties and encoded entities', () => withProject('repeated-elements', async p => {
    await p.write(field, '<?xml version="1.0"?><CustomField xmlns="http://soap.sforce.com/2006/04/metadata"><fullName>Status__c</fullName><label>A &amp; B</label><referenceTo>Account</referenceTo><referenceTo>Contact</referenceTo><type>Lookup</type></CustomField>');
    const payload = parseXml((await zip(p)).get('objects/Demo__c.object')).CustomObject.fields[0];
    expect(payload.referenceTo).toEqual(['Account', 'Contact']);
    expect(payload.label).toBe('A & B');
  }));
  test.each(['ignore', 'exclude'])('removes %s fields from payload and manifest', mode => withProject(`${mode}-field`, async p => {
    await changed(p, field); await changed(p, cls);
    if (mode === 'ignore') await p.write('.forceignore', 'objects/**/fields/**\n');
    const files = await zip(p, mode === 'exclude' ? { exclude: ['CustomField'] } : {});
    expect(members(files.get('package.xml'))).toEqual({ ApexClass: ['Keep'] });
    expect(files.has('objects/Demo__c.object')).toBe(false);
  }));
  test('excludes profiles from archive bytes as well as manifest', () => withProject('exclude-profile', async p => {
    const profile = `${source}/profiles/Demo.profile-meta.xml`;
    await p.write(profile, original(profile).replace('true', 'false')); await changed(p, cls);
    const files = await zip(p, { exclude: ['Profile'] });
    expect([...files.keys()].some(name => name.startsWith('profiles/'))).toBe(false);
    expect(members(files.get('package.xml'))).toEqual({ ApexClass: ['Keep'] });
  }));
  test('copies an entire LWC bundle while filtering ignored nested test files', () => withProject('lwc-bundle', async p => {
    await p.write(`${source}/lwc/demo/demo.js`, original(`${source}/lwc/demo/demo.js`) + '\n// changed\n');
    await p.write(`${source}/lwc/demo/__tests__/demo.test.js`, 'ignored test source');
    await p.write('.forceignore', '**/__tests__/**\n');
    const files = await zip(p);
    expect([...files.keys()].filter(name => name.startsWith('lwc/')).sort()).toEqual(['lwc/demo/demo.html', 'lwc/demo/demo.js', 'lwc/demo/demo.js-meta.xml']);
    expect(members(files.get('package.xml'))).toEqual({ LightningComponentBundle: ['demo'] });
  }));
  test.each([{ baseBranch: 'missing-baseline' }, { targetBranch: 'HEAD; touch sentinel #' }])('fails closed for invalid refs %j', overrides => withProject('invalid-ref', async p => {
    await changed(p, cls);
    const result = await packageProject(p, overrides);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/git|ref|revision/i);
    expect(fs.existsSync(path.join(p.root, 'sentinel'))).toBe(false);
    expect(fs.existsSync(p.zipPath)).toBe(false);
  }));
  test('redeploys a surviving LWC bundle when an internal file is deleted', () => withProject('partial-lwc-delete', async p => {
    await p.write(`${source}/lwc/demo/helper.js`, 'export const helper = true;');
    p.git(['add', '.']); p.git(['commit', '-qm', 'bundle helper baseline']); p.git(['tag', '-f', 'fixture-base']);
    await p.remove(`${source}/lwc/demo/helper.js`);
    const files = await zip(p);
    expect(files.has('destructiveChangesPost.xml')).toBe(false);
    expect(members(files.get('package.xml'))).toEqual({ LightningComponentBundle: ['demo'] });
    expect(files.has('lwc/demo/demo.js')).toBe(true);
    expect(files.has('lwc/demo/helper.js')).toBe(false);
  }));
  test('deletes an LWC bundle only when the whole bundle was removed', () => withProject('whole-lwc-delete', async p => {
    await p.remove(`${source}/lwc/demo`);
    const files = await zip(p);
    expect(members(files.get('destructiveChangesPost.xml'))).toEqual({ LightningComponentBundle: ['demo'] });
    expect(members(files.get('package.xml'))).toEqual({});
  }));
  test('does not delete a committed deletion restored in the working tree', () => withProject('restored-deletion', async p => {
    await p.remove(cls); p.git(['add', '.']); p.git(['commit', '-qm', 'delete class']);
    await p.write(cls, original(cls));
    const files = await zip(p);
    expect(members(files.get('package.xml'))).toEqual({ ApexClass: ['Keep'] });
    expect(files.has('classes/Keep.cls')).toBe(true);
    expect(files.has('destructiveChangesPost.xml')).toBe(false);
  }));
});
