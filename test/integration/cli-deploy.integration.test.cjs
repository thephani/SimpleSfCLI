const fs = require('node:fs');
const path = require('node:path');
const { withProject, runCli, source, fixtureRoot } = require('../support/project.cjs');
const { readZip, members } = require('../support/inspect.cjs');
const cls = `${source}/classes/Keep.cls`;
const profile = `${source}/profiles/Demo.profile-meta.xml`;
const fixture = file => fs.readFileSync(path.join(fixtureRoot, file), 'utf8');
const instance = 'https://fixture.my.salesforce.com';
const auth = { method: 'POST', url: 'https://test.salesforce.com/services/oauth2/token', status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'fixture-token', instance_url: instance }) };
function responses(status = 'Succeeded', details = { componentFailures: [] }) {
  return [auth,
    { method: 'POST', url: instance + '/services/Soap/m/62.0', status: 200, contentType: 'text/xml', body: '<Envelope><id>fixture-deploy</id></Envelope>' },
    { method: 'GET', url: instance + '/services/data/v60.0/metadata/deployRequest/fixture-deploy?includeDetails=true', status: 200, contentType: 'application/json', body: JSON.stringify({ deployResult: { id: 'fixture-deploy', done: true, status, numberComponentsDeployed: 1, numberComponentsTotal: 1, numberComponentErrors: status === 'Failed' ? 1 : 0, numberTestsCompleted: 0, numberTestsTotal: 0, numberTestErrors: 0, details } }) },
  ];
}
async function changed(p) { await p.write(cls, fixture(cls).replace('baseline', 'updated')); }
async function deploy(p, options = {}) {
  const result = await runCli(p, { args: ['deploy', '--baseBranch', 'fixture-base', ...(options.args || [])], responses: options.responses || responses(options.status, options.details) });
  expect(result.timedOut).toBe(false);
  expect(result.transportErrors).toEqual([]);
  return result;
}
function success(result) {
  expect({ code: result.exitCode, stderr: result.stderr }).toEqual({ code: 0, stderr: expect.any(String) });
}

describe('built deploy CLI with simulated Salesforce transport', () => {
  test('submits the actual archive and exits successfully', () => withProject('cli-success', async p => {
    await changed(p);
    const result = await deploy(p);
    success(result);
    expect(result.stdout).toContain('fixture-deploy');
    expect(result.capturedZips).toHaveLength(1);
    const files = readZip(result.capturedZips[0]);
    expect(members(files.get('package.xml'))).toEqual({ ApexClass: ['Keep'] });
    expect(files.get('classes/Keep.cls').toString()).toContain('updated');
    expect(files.has('classes/Keep.cls-meta.xml')).toBe(true);
  }));
  test.each(['Failed', 'Canceled', 'SucceededPartial'])('exits nonzero for terminal %s', status => withProject(`cli-${status}`, async p => {
    await changed(p);
    const result = await deploy(p, { status });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(status);
    expect(result.stdout).not.toContain('Deployment completed:');
  }));
  test('reports a failed test even without a failures array', () => withProject('missing-failure-array', async p => {
    await changed(p);
    const result = await deploy(p, { status: 'Failed', details: { componentFailures: [], runTestResult: { numFailures: 1, numTestsRun: 1 } } });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Failed');
    expect(result.stderr).not.toMatch(/Cannot read|TypeError/);
  }));
  test.each([false, true])('sends checkOnly=%s and transactional deployment flags', validateOnly => withProject(`validate-${validateOnly}`, async p => {
    await changed(p);
    const result = await deploy(p, { args: validateOnly ? ['--validateOnly'] : [] });
    success(result);
    const soap = result.requests[1].body;
    expect(soap).toContain(`<met:checkOnly>${validateOnly}</met:checkOnly>`);
    expect(soap).toContain('<met:rollbackOnError>true</met:rollbackOnError>');
    expect(soap).toContain('<met:singlePackage>true</met:singlePackage>');
  }));
  test.each([['Profile,CustomField'], ['Profile', 'CustomField']])('supports exclusions %j', (...types) => withProject('cli-exclude', async p => {
    // Jest expands each row into arguments; keep the documented comma and space forms.
    const exclude = types.flat();
    await changed(p);
    await p.write(profile, fixture(profile).replace('true', 'false'));
    const result = await deploy(p, { args: ['--exclude', ...exclude] });
    success(result);
    const files = readZip(result.capturedZips[0]);
    expect(members(files.get('package.xml'))).toEqual({ ApexClass: ['Keep'] });
    expect([...files.keys()].some(file => file.startsWith('profiles/'))).toBe(false);
  }));
  test('does not deploy after authentication fails', () => withProject('auth-failure', async p => {
    await changed(p);
    const result = await deploy(p, { responses: [{ ...auth, status: 400, body: '{"error":"invalid_grant"}' }] });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('invalid_grant');
    expect(result.capturedZips).toHaveLength(0);
  }));
  test('reports no changes without submitting a deployment', () => withProject('no-op', async p => {
    const result = await deploy(p, { responses: [auth] });
    success(result);
    expect(result.stdout).toMatch(/no.*changes/i);
    expect(result.capturedZips).toHaveLength(0);
  }));
  test('distinguishes invalid Git comparisons from a no-op', () => withProject('cli-invalid-ref', async p => {
    const result = await deploy(p, { args: ['--targetBranch', 'missing-target'], responses: [auth] });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/Git metadata discovery failed/);
    expect(result.stdout).not.toMatch(/no.*changes/i);
  }));
  test.each([false, true])('submits deletions with mixed=%s in one root-level archive', mixed => withProject(`destructive-${mixed}`, async p => {
    await p.remove(cls);
    if (mixed) {
      await p.write(`${source}/classes/Added.cls`, 'public class Added {}');
      await p.write(`${source}/classes/Added.cls-meta.xml`, fixture(`${cls}-meta.xml`));
    }
    const result = await deploy(p);
    success(result);
    expect(result.capturedZips).toHaveLength(1);
    const files = readZip(result.capturedZips[0]);
    expect(members(files.get('destructiveChangesPost.xml'))).toEqual({ ApexClass: ['Keep'] });
    expect(members(files.get('package.xml'))).toEqual(mixed ? { ApexClass: ['Added'] } : {});
    expect([...files.keys()].some(file => file.startsWith('destructiveChanges/'))).toBe(false);
    expect(files.has('classes/Keep.cls')).toBe(false);
  }));
  test('fails when the combined deployment request is rejected', () => withProject('combined-rejected', async p => {
    await p.remove(cls);
    await p.write(`${source}/classes/Added.cls`, 'public class Added {}');
    const scripted = responses().slice(0, 2);
    scripted[1] = { ...scripted[1], status: 500, body: 'fixture rejection' };
    const result = await deploy(p, { responses: scripted });
    expect(result.exitCode).not.toBe(0);
    expect(result.capturedZips).toHaveLength(1);
    expect(readZip(result.capturedZips[0]).has('destructiveChangesPost.xml')).toBe(true);
  }));
});
