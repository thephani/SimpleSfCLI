# Changelog

All notable changes to `simple-sf-cli` are documented in this file.

## 2.7.8 - 2026-10-27

- Added real-file integration tests using disposable Git repositories, built CLI processes, parsed XML and inspected ZIP archives. Salesforce HTTP responses are simulated.
- Added a separate credential-free PR/push/manual/daily integration workflow at 07:23 UTC, seven-day diagnostics, and an integration gate before NPM publishing.
- Integration runs clear stale reports and preserve serializable Git diagnostics when fixture setup fails.
- Tracks the dependency lockfile for reproducible `npm ci` installs.
- Fixed object-plus-field deltas losing field payloads when object settings were copied afterward; preserves repeated field XML nodes and encoded content without nested XML declarations.
- Applies `.forceignore` and metadata-type exclusions before writing payloads, including ignored files inside LWC bundles.
- Uses argument-array Git execution and fails explicitly on invalid comparison refs instead of silently packaging a partial delta.
- Failed, canceled, and partially successful deployments now exit nonzero; no deployable changes return success without a deployment request.
- Mixed updates/deletions and deletion-only deltas now use one ZIP with root `package.xml` and `destructiveChangesPost.xml`; deletions run after additions/updates. This replaces the nested destructive package handling.
- Handles partial LWC file deletions by redeploying the surviving bundle, and avoids destructive entries for files restored in the working tree.
- Accepts comma-separated and space-separated metadata-type exclusions consistently.
- Handles missing test failure arrays without masking the deployment result.
- Corrected the CLI version display to match the package version.

## 2.7.7 - 2026-06-24

- Fixed MDAPI conversion for deployments that add a new custom object and fields in the same delta by copying the object payload first, then merging changed fields into `objects/<Object>.object`.
- Fixed field-only deployments for existing objects so changed fields are emitted as declaration-free `<fields>` nodes inside generated MDAPI object payloads.
- Fixed object settings-only deployments so they continue to package only the parent `CustomObject` without invoking field generation.
- Resolved Salesforce parser failures such as `The processing instruction target matching "[xX][mM][lL]" is not allowed` by stripping nested XML declarations from generated field fragments before merging.
- Added regression coverage for new object plus fields, field-only existing object changes, object settings-only changes, and XML declaration-free field merging.

## 2.7.5 - 2026-05-13

- Fixed `auth:token --env PROD` and `--env PRODUCTION` so production JWT auth uses `https://login.salesforce.com` instead of falling back to the sandbox login URL.
- Added support for `PROD`/`PRODUCTION` and `SBX`/`SANDBOX` environment aliases with validation for invalid environment values.
- Replaced the `jsonwebtoken` dependency with Node's built-in `crypto` signing for RS256 JWT assertions.
- Switched OAuth token requests to `URLSearchParams` form encoding.
- Improved Salesforce authentication errors to include the token URL and Salesforce `error` / `error_description` details when available.
- Added successful command duration logging to stderr for `auth:token`, `quick-deploy`, and `deploy`.
- Added integration coverage for `auth:token --json` in both sandbox and production modes, including JWT audience validation.
- Expanded auth service coverage for JWT generation, local private-key loading, response parsing, and error-body handling.

## 2.7.4 - 2026-04-27

- Fixed field-only delta deployments so changed custom fields remain `CustomField` package members instead of being rewritten as parent `CustomObject` members.
- Fixed `package.xml` generation to use the custom field metadata `<fullName>` when it differs from the field file name, keeping MDAPI object payloads and manifest members aligned.
- Resolved deployment failures where adding only a field could report `Must specify a non-empty label for the CustomObject`.
- Resolved deployment failures where generated `objects/<Object>.object` payloads could report `<Object>.<Field> Not in package.xml`.
- Added regression coverage for field-only object delta package generation and mismatched field filename versus XML `<fullName>` handling.
- Documented that JWT authentication stores the returned access token and instance URL on the shared runtime config for subsequent deploy, quick deploy, and polling calls.
- Added `auth:token` to export JWT auth results to JSON stdout or a local `0600` token file for trusted automation.

## 2.6.x - 2.7.3 - 2026-04-07

- Added CI-aware pull request diff resolution using GitHub and Bitbucket environment variables when available.
- Preferred PR base and target branches directly from CI metadata before falling back to git-based branch inference.
- Improved branch resolution so PR source refs can use remote branch names when present and fall back to `HEAD` only when necessary.
- Added regression tests for GitHub PR branch detection and Bitbucket PR branch detection.
- Removed the `/bin/zsh` dependency from remote default-branch detection so Linux CI runners can execute branch inference without shell path errors.
- Replaced shell-pipeline branch lookup with portable git commands.
- Reduced non-fatal PR base detection noise in CI environments that do not expose a local shell pipeline.
- Clarified delta comparison behavior for PR-style deployments by documenting branch-aware diff usage.
- Fixed custom field detection when `--source` contains prefixes like `./` or trailing slashes.
- Expanded delta collection to include branch diff results, unstaged changes, staged changes, and untracked files.
- Updated default diff-range behavior to prefer PR-style comparison against the remote default branch instead of only `HEAD~1...HEAD`.
- Removed empty metadata sections from generated `package.xml` output.
- Added regression tests for source normalization, uncommitted field detection, and PR-base diff selection.
- Added initial coverage around uncommitted and untracked metadata detection during local development.
- Improved MDAPI service tests for path normalization and git diff collection.

## 2.5.1

- Bug fixes and performance improvements.
- Enhanced error handling.
- Improved test coverage.

## 2.5.0

- Added quick deploy support.
- Added delta deployment support.
- Enhanced deployment logging.
