const path = require('node:path');
const { repoRoot, runNode } = require('./project.cjs');
async function packageProject(project, overrides = {}) {
  const config = { source: project.source, output: project.zipPath, cliOuputFolder: project.outputDir, baseBranch: 'fixture-base', targetBranch: 'HEAD', ...overrides };
  const script = `const {MDAPIService}=require(${JSON.stringify(path.join(repoRoot, 'dist/services/MDAPIService.js'))});const {ArchiverService}=require(${JSON.stringify(path.join(repoRoot, 'dist/services/ArchiverService.js'))});const config=${JSON.stringify(config)};(async()=>{await new MDAPIService(config).convertToMDAPI(config.exclude);await new ArchiverService(config).zipDirectory(config.cliOuputFolder,config.output)})().catch(error=>{console.error(error);process.exitCode=1});`;
  return runNode(project, ['-e', script]);
}
module.exports = { packageProject };
