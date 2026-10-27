const fs = require('node:fs/promises');
const syncFs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { generateKeyPairSync } = require('node:crypto');

const repoRoot = path.resolve(__dirname, '../..');
const fixtureRoot = path.join(repoRoot, 'test/fixtures/metadata');
const cliPath = path.join(repoRoot, 'dist/cli.js');
const source = 'force-app/main/default';

function cleanEnv(extra = {}) {
  const env = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull, LANG: 'C.UTF-8' };
  for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'TMPDIR', 'TEMP', 'TMP']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return { ...env, ...extra };
}

async function createProject(testName) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'simpleSfCli real files '));
  const safeName = testName.replace(/[^a-zA-Z0-9-]/g, '-');
  const stateDir = path.join(root, '.harness');
  await fs.cp(fixtureRoot, root, { recursive: true });
  await fs.mkdir(stateDir);
  await fs.writeFile(path.join(root, '.gitignore'), '.harness/\n.simpleSfCli_out/\ndeploy.zip\n');
  const git = args => execFileSync('git', ['-c', 'core.hooksPath=' + os.devNull, '-c', 'commit.gpgsign=false', ...args], { cwd: root, env: cleanEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q', '-b', 'fixture']);
  git(['config', 'user.name', 'Integration Test']);
  git(['config', 'user.email', 'integration@example.invalid']);
  git(['config', 'core.autocrlf', 'false']);
  git(['config', 'diff.renames', 'false']);
  git(['add', '.']);
  git(['commit', '-qm', 'baseline']);
  git(['tag', 'fixture-base']);
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const privateKeyPath = path.join(stateDir, 'server.key');
  await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 });
  let disposed = false;
  return {
    root, source, stateDir, privateKeyPath,
    outputDir: path.join(root, '.simpleSfCli_out'),
    zipPath: path.join(root, 'deploy.zip'),
    git,
    async write(relativePath, text) {
      const target = path.join(root, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, text);
    },
    async remove(relativePath) { await fs.rm(path.join(root, relativePath), { recursive: true, force: true }); },
    async dispose({ failed = false } = {}) {
      if (disposed) return;
      disposed = true;
      let artifact;
      try {
        if (failed) {
          artifact = path.join(repoRoot, 'test-results/integration', safeName + '-' + path.basename(root).split(' ').pop());
          await fs.mkdir(path.dirname(artifact), { recursive: true });
          await fs.cp(root, artifact, { recursive: true, filter: entry => !['.git', 'server.key'].includes(path.basename(entry)) });
        }
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
      return artifact;
    },
  };
}

async function withProject(name, action) {
  const project = await createProject(name);
  let failed = true;
  try { const result = await action(project); failed = false; return result; }
  finally { await project.dispose({ failed }); }
}

function runNode(project, args, { timeoutMs = 20000, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: project.root, env: cleanEnv(env), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    const limit = 1024 * 1024;
    child.stdout.on('data', data => { stdout = (stdout + data).slice(-limit); });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-limit); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal, stdout, stderr, timedOut });
    });
  });
}

async function runCli(project, { args, responses, timeoutMs }) {
  const scenario = path.join(project.stateDir, 'scenario.json');
  const report = path.join(project.stateDir, 'transport.json');
  await fs.writeFile(scenario, JSON.stringify(responses));
  await fs.rm(report, { force: true });
  const authArgs = args.includes('--help') || args.includes('--version') ? [] : ['--username', 'fixture@example.invalid', '--clientId', 'fixture-client', '--privateKey', project.privateKeyPath];
  const result = await runNode(project, ['--require', path.join(__dirname, 'salesforce-fetch.cjs'), cliPath, ...args, ...authArgs], { timeoutMs, env: { SIMPLESFCLI_TEST_SCENARIO: scenario, SIMPLESFCLI_TEST_CAPTURE_DIR: project.stateDir } });
  const transport = syncFs.existsSync(report) ? JSON.parse(await fs.readFile(report, 'utf8')) : { requests: [], errors: ['Transport report missing'], capturedZips: [] };
  await fs.writeFile(path.join(project.stateDir, 'stdout.txt'), result.stdout);
  await fs.writeFile(path.join(project.stateDir, 'stderr.txt'), result.stderr);
  return { ...result, requests: transport.requests, capturedZips: transport.capturedZips, transportErrors: transport.errors };
}

module.exports = { createProject, withProject, runNode, runCli, repoRoot, fixtureRoot, source };
