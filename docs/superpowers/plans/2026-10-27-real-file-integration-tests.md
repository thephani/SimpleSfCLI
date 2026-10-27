# Real-file Integration Tests and Daily CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. Use one implementer unless the user requests delegation.

**Goal:** Detect packaging and deployment-orchestration regressions using real source files, Git history, XML parsing, ZIP inspection, and the built CLI, on every pull request and once daily.

**Architecture:** Keep the existing Jest unit suite. Add a separate Jest integration suite that loads compiled production modules and launches `node dist/cli.js` in disposable Git repositories. Only Salesforce HTTP responses are simulated; Git, filesystem operations, authentication signing, conversion, archiving, and CLI exit behavior remain real.

**Tech Stack:** Existing Node.js 24 CI, TypeScript, Jest 29, Git, built-in Node process/filesystem/crypto APIs; proposed development-only `fast-xml-parser` and `adm-zip` for independent output inspection.

**Spec:** The scope and acceptance contracts below capture the user's request for realistic integration tests and daily runs. This is a proposed implementation plan, not approval to implement or connect to Salesforce.

## Scope and decisions

- Phase 1 is credential-free real-file integration testing. Run the same suite locally, on PRs, on pushes to `main`, manually, and daily. Keep existing unit tests.
- Ship regression tests with the smallest fixes needed to pass them. Do not merge a permanently failing suite, skip known failures, or mark a failed run successful.
- Phase 2, live Salesforce validation, is deferred until the user selects a dedicated test org. No production credentials, live deploys, quick deploys, org setup, or destructive org calls are part of Phase 1.
- Proposed daily schedule: `23 7 * * *`, explicitly **07:23 UTC**. This is a proposed daily cadence, not a promise of a particular Pacific local time or an exact start time.
- Proposed mixed-deletion contract: one ZIP with root `package.xml` and root `destructiveChangesPost.xml`, sent as one deployment. This makes additions/updates and post-deletions part of the same request. This behavior choice needs review with this plan.

### Approaches considered

1. **Recommended: real local integration tests now; live validation later.** Deterministic, available to contributor PRs without secrets, and directly covers the failures found in this repository. It does not prove Salesforce acceptance.
2. **Live sandbox tests only.** Proves server behavior but adds credentials, org prerequisites, and external failures; slower feedback and poor isolation of packaging faults.
3. **More mocked service tests only.** Lowest setup cost, but preserves the gap that allowed the current orchestration and payload failures.

## Global constraints

- Do not mock `fs`, Git execution, `MDAPIService`, `XmlHelper`, `ArchiverService`, or `SalesforceClient` in the new suite.
- Existing unit tests may retain their mocks. Label the existing authentication integration tests accurately: real signing/files with simulated HTTP, not live Salesforce tests.
- Run every production operation inside its own temporary repository or child process. Never change the Jest parent's working directory or the developer's repository state.
- Use built CLI paths resolved from the project root, never a globally linked executable. Build before running the integration suite.
- Use argument-array Git execution in helpers and production fixes. Give temporary repositories a local author identity and deterministic Git settings; do not depend on global configuration or commit hooks.
- The CLI child must not inherit real Salesforce credentials, CI PR branch-detection variables, `NODE_OPTIONS`, or Git directory/worktree overrides. Set only the fixture environment required for each case.
- Preserve the untracked `AGENTS.md`, unrelated work, existing auth flags, production test-level behavior, and unit-test command.
- No new runtime dependencies. Inspection libraries are dev dependencies, resolved and locked during implementation.
- Test/CI-only commits need documentation but no artificial runtime version bump. Every shipped runtime bug fix must update `CHANGELOG.md`, relevant README behavior, `package.json`, and the lockfile together, as required by `AGENTS.md`.

## Current repository evidence

- `npm test -- --runInBand --modulePathIgnorePatterns .kilo` previously passed 199 tests in this review; rerun at implementation start rather than treating that as a current baseline.
- Existing auth integration tests use real key files and mock `fetch`; most conversion tests mock Git/filesystem behavior.
- `src/SalesforceClient.ts` was about 13% line-covered during the review. The new acceptance goal is observable scenarios, not a higher coverage percentage.
- `src/services/MDAPIService.ts` generates field payloads before copying object metadata, and filters ignored/excluded metadata after generation.
- `src/cli.ts` reports completion without checking terminal deployment status.
- Main deployment returns before the separate destructive deployment path executes.
- `.github/workflows/npm-package.yml` combines tests and publishing, targets `main`, uses Node 24 and `npm install`, and has no scheduled trigger.
- `package-lock.json` exists locally but `.gitignore` ignores it. Track the reviewed lockfile before changing CI to `npm ci`.

## File map

| File | Responsibility |
| --- | --- |
| `jest.integration.config.cjs` | Discover only `test/integration/**/*.integration.test.cjs`; use Node environment and no TypeScript transform. |
| `test/support/project.cjs` | Temporary Git repos, fixture edits, deterministic environment, child execution, artifact retention. |
| `test/support/inspect.cjs` | Independently validate/parse XML and read ZIP entries. |
| `test/support/salesforce-fetch.cjs` | Test-only CLI preload that supplies scripted HTTP responses and captures actual deployment requests. |
| `test/fixtures/metadata/force-app/main/default/**` | Small readable Salesforce object, field, Apex, and LWC source examples. |
| `test/integration/harness.integration.test.cjs` | Fixture isolation, cleanup, HTTP script exhaustion, capture and timeout behavior. |
| `test/integration/packaging.integration.test.cjs` | Real Git-to-MDAPI-to-ZIP behavior. |
| `test/integration/cli-deploy.integration.test.cjs` | Real child-process CLI, request contents, statuses, stdout/stderr, exit codes. |
| `.github/workflows/integration-tests.yml` | Credential-free PR, push, manual and daily runs, with reports/artifacts. |
| `package.json`, `package-lock.json`, `.gitignore` | Scripts, dev inspection libraries, reproducible install, ignored generated reports. |
| `README.md`, `CHANGELOG.md` | Test commands, boundaries, schedule semantics, and runtime-fix notes. |

Production fixes are limited to `src/services/MDAPIService.ts`, `src/helper/xmlHelper.ts`, `src/SalesforceClient.ts`, `src/services/DeployService.ts`, and `src/cli.ts` where a failing acceptance case demonstrates the need. No general metadata-catalog rewrite or new deployment command.

## Review focus

1. Committed, staged, unstaged, and untracked metadata must all exercise real Git discovery; tests cannot replace the changed-file list.
2. Object settings plus fields must coexist, with one XML declaration, no lost nodes, and no nested raw SFDX fields directory.
3. Ignored/excluded components must be absent from both the manifest and ZIP, including fields and files inside copied LWC bundles.
4. Mixed and deletion-only changes must reach the submitted ZIP; failed/canceled results must fail the process.
5. A bad Git ref, shell metacharacters, unexpected HTTP call, timeout, or stale temporary state must not produce a false green test.

---

## Task 1: Build the real-file harness and inspection tools

**Estimate:** 2–3 engineer hours.

**Files:** Create the integration config, `test/support/*.cjs`, fixture source tree, and harness tests; modify `package.json`, `.gitignore`, and track `package-lock.json`.

**Interfaces:**

- `createProject(testName: string): Promise<TestProject>` returns `{ root, source, outputDir, zipPath, write(relativePath, text), remove(relativePath), git(args), dispose({ failed }) }`. Paths are inside a fresh `os.tmpdir()` directory; `git(args: string[]): string` uses `execFileSync` with explicit `cwd`.
- `runCli(project, { args: string[], responses: HttpStep[], timeoutMs?: number }): Promise<CliResult>` returns `{ exitCode, signal, stdout, stderr, requests, capturedZips, timedOut }`. Default timeout is 20,000 ms. Spawn asynchronously, collect bounded output, kill and reap the child on timeout, and report timeout as failure.
- `HttpStep` is `{ method: string, url: string, status: number, body: string, contentType: string }`. Match calls exactly in sequence. Unexpected calls throw and are recorded; the parent asserts both zero unmatched requests and complete script consumption.
- `readZip(zipPath: string): Map<string, Buffer>` exposes normalized archive entry names and uncompressed contents. `parseXml(xml: string): object` first calls an XML validator, then parses with stable array handling. Do not use production XML generation to generate expected results.

- [x] Write harness tests: two projects never share paths/state; fixture Git commits work without global identity; a child can load built modules from a different `cwd`; unexpected HTTP calls and unused response steps fail; timeout kills/reaps the child.
- [x] Run `npm run test:integration -- --runTestsByPath test/integration/harness.integration.test.cjs`; expect failure before the harness exists.
- [x] Implement the helpers and preload. Generate a disposable RSA key with Node crypto for each project; preload replaces only `global.fetch` in the child. Return fake token/instance data, realistic SOAP initiation bodies, and scripted REST status bodies. Capture the real SOAP ZIP as bytes on submission. Assert `checkOnly` separately from payload correctness.
- [x] Add `test:integration` as `npm run build && jest --config jest.integration.config.cjs --runInBand`. Configure `.kilo` ignoring, JSON test reports under `test-results/`, and 30-second per-test limits. Keep current `npm test` unchanged. Preserve failed fixtures under `test-results/integration/<case>/`; remove success fixtures and all original temporary directories in `finally`.
- [x] Add dev-only XML/ZIP readers; remove the lockfile ignore entry, review the resulting lockfile, and track it. Exclude `test-results/` from Git. Run harness tests successfully and confirm `git status` has no generated output. Commit only this deliverable's files.

## Task 2: Add packaging acceptance cases and fix exposed conversion defects

**Estimate:** 4–6 engineer hours.

**Files:** Create `test/integration/packaging.integration.test.cjs`; modify fixture inputs, `MDAPIService.ts`, `xmlHelper.ts`, and corresponding nearby unit regressions where necessary.

**Interfaces:** Consume Task 1's fixture/Git/inspection helpers. Invoke compiled `MDAPIService.convertToMDAPI(excludeList)` and `ArchiverService.zipDirectory(sourceDir, zipPath)` in an isolated child with that fixture as `cwd`. Preserve the existing public method signatures.

- [x] Add table-driven real-file cases with explicit expected members and archive paths:
  - Field-only: `Demo__c.Status__c` is a `CustomField` member; `objects/Demo__c.object` contains the field; no `CustomObject` member or raw `objects/Demo__c/fields/` entry.
  - Object plus fields: `CustomObject: Demo__c` and `CustomField: Demo__c.Status__c` are listed; label/settings and field nodes both survive in one well-formed object document. Object-only retains its settings and contains no generated fields.
  - `.forceignore` and type exclusions: ignored field plus unrelated Apex change, excluded Profile plus included Apex change, and a copied LWC bundle with an ignored test file. Forbidden files and field names must be absent from manifests and payloads, not merely omitted from `package.xml`.
  - Git state matrix: apply the same field change as committed, staged, unstaged, and untracked; assert identical semantic output. Use explicit baseline/target refs for normal cases and clear CI auto-detection variables.
  - Invalid baseline fails conversion with an actionable ref error. A target string containing shell metacharacters is rejected without creating a harmless sentinel file in the fixture. A fixture directory with spaces works.
- [x] Run that file and record which assertions fail against current production code. Existing behaviors may pass; the object-plus-field and filter regressions must reproduce the reviewed defects.
- [x] Fix only demonstrated causes: merge changed field fragments after loading/copying object settings; preserve repeated XML nodes and entity content; filter before payload generation and copying; apply ignore rules inside bundles; execute Git with argument arrays and propagate comparison failures. Do not catch required Git comparison errors and turn them into empty changes. Keep optional remote-base detection fallback distinct from invalid explicit refs.
- [x] Run packaging tests, the focused XML/MDAPI unit tests required by `AGENTS.md`, and `npx tsc --noEmit`. Assert one XML declaration per document, independently valid XML, and exact expected members. Never compare ZIP bytes/timestamps or XML whitespace.
- [x] Add specific runtime-fix release notes and version/lockfile updates; commit the tests and their focused fixes together. Do not include unrelated version/API refactoring.

## Task 3: Test the built CLI and make deployment results trustworthy

**Estimate:** 3–5 engineer hours.

**Files:** Create `test/integration/cli-deploy.integration.test.cjs`; modify `SalesforceClient.ts`, `DeployService.ts`, `MDAPIService.ts`, and `cli.ts` only as required by these cases.

**Interfaces:** Consume `runCli`, `HttpStep`, and ZIP/XML inspectors from Task 1. The child runs the actual `dist/cli.js deploy` with disposable JWT credentials. No prototype/service stubs. Fake status bodies include the real `deployResult` wrapper and complete count/detail fields.

- [x] Add success/failure cases: `Succeeded` exits 0; terminal `Failed`, `Canceled`, and `SucceededPartial` exit nonzero; auth HTTP failure exits nonzero and never submits a deployment. A failed-test response lacking a `failures` list must report failure without masking it with a property-access exception.
- [x] Add request/payload cases: `--validateOnly` sends `checkOnly=true`; default sends false; comma-separated and space-separated `--exclude` forms produce the same filtered ZIP; excluded content is absent. A no-source-change run exits 0 with an explicit no-changes message and no deploy submission, distinct from a Git-comparison failure.
- [x] Add mixed and deletion-only cases from real Git deletions. Mixed case submits exactly one ZIP with root `package.xml`, root `destructiveChangesPost.xml`, changed source payloads, and no nested `destructiveChanges/` directory. Deletion-only includes an empty root package manifest plus post-deletion manifest. Deleted members appear only in the destructive manifest. A rejected combined request exits nonzero.
- [x] Run these tests to capture current failures. Implement terminal-status checking, safe missing-failure diagnostics, exclusion normalization, explicit no-op handling, and the proposed single-package post-deletion layout. Preserve `rollbackOnError=true`, `singlePackage=true`, authentication flags and production test-level behavior. Poll the one submitted request to completion.
- [x] Run the CLI and packaging suites, all existing tests, TypeScript checks, build, and `node dist/cli.js --help`. Add release notes describing changed mixed-deletion ordering and CLI exit behavior; update version/lockfile for the release. Commit this independently reviewable behavior change.

## Task 4: Run the suite on PRs and daily without publishing

**Estimate:** 1–2 engineer hours, plus waiting for the first actual scheduled event.

**Files:** Create `.github/workflows/integration-tests.yml`; update the existing package workflow only to include the integration gate before publishing; update README commands.

**Interfaces:** The workflow consumes `npm run test:integration`; artifacts are under `test-results/`. Tests require no Salesforce or NPM secrets. Job name is stable: `real-file-integration`.

- [x] Add workflow triggers: `pull_request` targeting `main`, `push` to `main`, `workflow_dispatch`, and `schedule: [{ cron: '23 7 * * *' }]`. Do not use path filters initially: avoid silently missing fixture, lockfile, or harness changes.
- [x] Use Ubuntu and Node 24 to match existing CI. Use `contents: read`, `npm ci`, a 15-minute job timeout, and no publish step or NPM token. Use the existing supported checkout/setup action majors; verify the artifact action's supported version at implementation time. Separate concurrent runs by event/ref so PR cancellation cannot cancel a daily run.
- [x] Run existing tests and `npm run test:integration`. Upload the integration JSON report on every outcome and diagnostic fixtures/captured packages on failures, retaining artifacts for seven days and including hidden `.simpleSfCli_out` content intentionally. Summarize case counts and failures in the GitHub job summary. Never use `continue-on-error` for the test job.
- [x] Put the same integration command before the existing publish step so pushing to `main` cannot publish while that run's integration tests fail. Keep the dedicated scheduled workflow separate; do not add schedules to the publishing workflow. Keep PR publish dry-run behavior.
- [ ] Validate workflow syntax; run local commands with Node 24; verify one real PR run. After merge, manually run the workflow and record its run URL, then verify the first genuine scheduled run's event type and UTC timestamp. Before that event, report “configured; scheduled execution unverified.” Do not claim a manual run proves scheduling. Making the check required in branch protection is a separate repository-setting action, not assumed done by adding YAML.

## Task 5: Document the operating routine and close the acceptance gate

**Estimate:** 1 engineer hour.

**Files:** Modify `README.md`, `CHANGELOG.md`, and this plan's checkboxes as tasks finish.

**Interfaces:** Document existing `npm test` and new `npm run test:integration` without introducing another test runner or deployment command.

- [x] Document what is real versus simulated, Git/Node requirements, fixture layout, the daily UTC schedule, and how to download failure artifacts and rerun one case with `--runTestsByPath`.
- [x] Require each future packaging bug fix to include a small real-file scenario reproducing the user's metadata shape, without customer data or credentials. Run scenarios every PR; add cases when behavior changes, rather than manufacturing one new test each day.
- [x] Run the final verification commands below from the exact final branch. Check the diff for unrelated changes, generated `dist` output, temporary artifacts, disabled tests and unexpected dependencies. Confirm a failing simulated deployment and an invalid ref each actually make the test command fail when their safeguards are removed, then restore safeguards and rerun affected tests.
- [x] Record commands, counts, actual durations and CI run links. Keep local, simulated HTTP, PR CI, manual CI and scheduled CI evidence separately labeled. Record live Salesforce validation as not performed.
- [x] Hand over the reviewed branch/PR if separately requested. Do not merge, publish or change orgs as part of implementing this test plan.

## Final verification commands

```bash
npm ci
npm test -- --runInBand --modulePathIgnorePatterns .kilo
npm test -- --runTestsByPath src/helper/__tests__/xmlHelper.test.ts src/services/__tests__/MDAPIService.test.ts --modulePathIgnorePatterns .kilo
npx tsc --noEmit
npm run test:integration
node dist/cli.js --help
git diff --check
git status --short
```

Acceptance requires zero unexpected failures/skips, the known defects covered by passing regression tests, no leaked child processes or temporary files, and a successful PR CI run. Target local integration runtime is under 60 seconds after build; measure it rather than promise it. The daily-run acceptance item stays open until a real scheduled event is observed on the default branch.

## Deferred Phase 2: Live Salesforce validation

This is a follow-up plan, not a hidden dependency of Phase 1. First select a dedicated test org and establish its identity and metadata prerequisites. Start with authenticated `--validateOnly` on an additive self-contained fixture; retain deployment IDs and terminal results, never bearer tokens or private keys. Existing-object field cases need an approved baseline object. Delete/quick-deploy lifecycles require separately approved setup, mutation and cleanup. A fake transport test is never evidence of Salesforce acceptance.

## Estimated effort and first milestone

Phase 1 estimate: **11–17 engineer hours**, depending on conversion fixes exposed by real fixtures. First milestone: Tasks 1–2's object-plus-field case, approximately **3–5 hours**, demonstrating an actual failure before the focused fix and a passing parsed ZIP afterward. Live-org setup and waiting for daily CI are excluded.

## References checked during planning

- [GitHub workflow syntax: schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule): default UTC schedule and default-branch execution.
- [GitHub scheduled workflow troubleshooting](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows): delayed schedules and operational checks.
- [Salesforce deletion manifests](https://developer.salesforce.com/docs/platform/salesforce-migration-guide/guide/daas-destructive-changes.html): root sibling manifests and pre/post deletion semantics.
- [Jest 29 CLI](https://jestjs.io/docs/29.7/cli): focused execution and diagnosing open handles; do not hide leaks with `--forceExit`.

## Plan self-review

- All five review-focus conditions map to named cases in Tasks 1–3.
- Helper signatures and test paths are consistent; integration tests consume built CommonJS output without expanding production TypeScript compilation to test files.
- Lockfile tracking precedes `npm ci`; the daily job cannot publish; publishing has its own integration gate.
- Daily execution, live validation, version release and branch protection are not claimed complete by a local test run.
- Proposed scope and post-deletion ordering are visible for user review. No implementation, deployment or scheduling has been performed while writing this plan.


## Execution status — 2026-10-27

Implemented on `feat/real-file-integration-tests` in the native isolated worktree.
The original checkout and its untracked `AGENTS.md` were preserved. Existing unit
tests were retained. Independent review found and reproduced two deletion cases;
new red/green regressions now cover partial LWC deletion and committed deletion
followed by local restoration.

Local acceptance: Node 24.22.1, clean `npm ci`, 199 existing tests and 37 integration
tests passing, zero skipped integration cases, TypeScript/build/help/version checks
passing. The integration suite takes approximately 14 seconds. Mutation checks
confirmed that removing failure-status and Git-error safeguards makes four
regression tests fail; generated modules were restored afterward.

Task 4's hosted execution item remains open: no push, PR, merge, manual CI run,
scheduled CI run, branch-protection update, NPM publish or live Salesforce call was
performed. The workflow is configured for 07:23 UTC; actual scheduling is unverified.
Detailed evidence is in `docs/testing/real-file-integration-validation.md`.
