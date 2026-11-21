// Test-only preload. No real network fallback is allowed.
const fs = require('node:fs');
const path = require('node:path');
const steps = JSON.parse(fs.readFileSync(process.env.SIMPLESFCLI_TEST_SCENARIO, 'utf8'));
const captureDir = process.env.SIMPLESFCLI_TEST_CAPTURE_DIR;
const report = { requests: [], errors: [], capturedZips: [] };
let consumed = 0;
global.fetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body?.toString() || '';
  report.requests.push({ method, url: String(url), body });
  const expected = steps[consumed];
  if (!expected || expected.method !== method || expected.url !== String(url)) {
    const error = `Unexpected HTTP: ${method} ${url}`;
    report.errors.push(error);
    throw new Error(error);
  }
  consumed++;
  const zip = body.match(/<met:ZipFile>([\s\S]*?)<\/met:ZipFile>/);
  if (zip) {
    const target = path.join(captureDir, `submitted-${report.capturedZips.length}.zip`);
    fs.writeFileSync(target, Buffer.from(zip[1], 'base64'));
    report.capturedZips.push(target);
  }
  return new Response(expected.body, { status: expected.status, headers: { 'Content-Type': expected.contentType } });
};
process.on('exit', () => {
  if (consumed !== steps.length) report.errors.push(`Unused HTTP responses: ${steps.length - consumed}`);
  fs.writeFileSync(path.join(captureDir, 'transport.json'), JSON.stringify(report, null, 2));
});
