# Real-file integration implementation validation

Date: 2026-10-27. Branch: `feat/real-file-integration-tests`.

## Local evidence

- Runtime: official Node.js 24.22.1 macOS arm64 binary; downloaded archive matched the published SHA256. Existing CI targets Node 24 on Ubuntu; Linux hosted execution remains unverified.
- `npm ci`: passed using the tracked lockfile. A task-specific cache was used because the user's default cache had permission-denied entries; no global configuration or ownership changes were made.
- `npm test -- --runInBand --modulePathIgnorePatterns .kilo`: 8 suites, 199 tests passed.
- Focused XML/MDAPI unit tests: 48 passed during implementation; final full unit run also includes these cases.
- `npm run test:integration`: 3 suites, 37 tests passed with zero skipped tests. Breakdown: 5 harness, 17 packaging, 15 built CLI tests. Approximately 14 seconds after build.
- `npx tsc --noEmit`, build, `node dist/cli.js --help`, and version display `2.7.7`: passed.
- Both workflow YAML documents parsed successfully; workflow summary code was exercised with missing, passing and failing report inputs.
- `git diff --check`: passed.

## Regression evidence

The first packaging run on baseline behavior had 9 failing cases and 5 passing
cases. The first CLI run had 9 failing cases and 6 passing cases. Independent review
then reproduced two additional deletion issues; both failed before their fixes and
passed afterward, alongside a complete-bundle-deletion control.

A mutation check temporarily disabled terminal-status rejection and Git-error
propagation in generated `dist` modules. The three terminal-result cases and
invalid-ref CLI case each failed because the defective CLI exited 0. Original
generated modules were restored and the complete normal suite passed afterward.
No production source was left mutated.

One repeated packaging run timed out after the host showed an elapsed interval of
about 595 seconds in its first case; the other 13 cases passed. A fresh unchanged
run passed all 14 in about six seconds. Timeouts were retained rather than raised
or suppressed. A later run hit a bounded Git fixture setup timeout; Node's process error contained
circular properties and prevented Jest JSON serialization. The harness now wraps
Git errors as plain diagnostic errors, cleans failed setup directories, and removes
the previous JSON report before each integration command. A new regression checks
the Git-error diagnostic. No timeout was increased or disabled. Subsequent full
Node 24 verification passed with a freshly written report.

## Boundaries and outstanding hosted checks

Git repositories, source files, JWT signing, XML conversion, archives, submitted
ZIP capture and child CLI exit codes are real local operations. Salesforce HTTP
responses are scripted. Unexpected requests never fall through to real fetch.
This proves local integration behavior, not Salesforce metadata acceptance.

The separate workflow has PR/main-push/manual/daily triggers and a proposed daily
cadence of 07:23 UTC. Its reports and failure fixtures are retained seven days.
The publishing workflow runs integration tests before its existing publish step.

No branch was pushed and no PR, merge, publish, live Salesforce validation or org
mutation was performed. Actual PR/manual/scheduled CI execution and branch
protection are not verified. After separately authorized publication of the
branch, record real run links here; after merge, verify a true scheduled event
before claiming daily execution works.
