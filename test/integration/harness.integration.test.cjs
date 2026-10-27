const fs = require('node:fs');
const path = require('node:path');
const { createProject, runCli, runNode } = require('../support/project.cjs');

describe('real-file harness', () => {
  const projects = [];
  afterEach(async () => {
    for (const p of projects.splice(0)) await p.dispose({ failed: expect.getState().assertionCalls === 0 });
  });
  async function project(name) {
    const p = await createProject(name);
    projects.push(p);
    return p;
  }
  test('isolates repositories, creates commits, and loads the built CLI from another cwd', async () => {
    const a = await project('first project with spaces');
    const b = await project('second');
    expect(a.root).not.toBe(b.root);
    expect(a.git(['log', '-1', '--format=%s']).trim()).toBe('baseline');
    await a.write('only-a.txt', 'isolated');
    expect(fs.existsSync(path.join(b.root, 'only-a.txt'))).toBe(false);
    const result = await runCli(a, { args: ['--help'], responses: [] });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Salesforce CLI');
  });
  test('rejects an unrecognized HTTP call and records the mismatch', async () => {
    const p = await project('unexpected-http');
    const result = await runCli(p, { args: ['auth:token'], responses: [] });
    expect(result.exitCode).not.toBe(0);
    expect(result.transportErrors.join(' ')).toContain('Unexpected HTTP');
    expect(result.requests).toHaveLength(1);
  });
  test('fails if expected responses were never consumed', async () => {
    const p = await project('unused-http');
    const result = await runCli(p, { args: ['--help'], responses: [{ method: 'POST', url: 'https://unused.invalid', status: 200, body: '{}', contentType: 'application/json' }] });
    expect(result.exitCode).toBe(0);
    expect(result.transportErrors.join(' ')).toContain('Unused HTTP responses: 1');
  });
  test('kills and reaps a timed-out child', async () => {
    const p = await project('timeout');
    const result = await runNode(p, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 100 });
    expect(result.timedOut).toBe(true);
    expect(result.signal).toBe('SIGKILL');
  });
  test('cleans successful fixtures and retains diagnostics for failed fixtures', async () => {
    const p = await project('retention');
    await p.write('.simpleSfCli_out/marker.txt', 'diagnostic');
    const artifact = await p.dispose({ failed: true });
    expect(fs.existsSync(p.root)).toBe(false);
    expect(fs.readFileSync(path.join(artifact, '.simpleSfCli_out/marker.txt'), 'utf8')).toBe('diagnostic');
    fs.rmSync(artifact, { recursive: true, force: true });
    const clean = await project('cleanup');
    await clean.dispose({ failed: false });
    expect(fs.existsSync(clean.root)).toBe(false);
  });
});
