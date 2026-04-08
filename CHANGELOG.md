# Changelog

All notable changes to `simple-sf-cli` are documented in this file.

## 2.7.1 - 2026-04-07

- Clarified delta comparison behavior for PR-style deployments by documenting branch-aware diff usage.
- Documented today's metadata packaging fixes and release notes in a dedicated changelog.
- Kept the release line focused on the field-detection and package-generation fixes introduced in `2.7.0`.

## 2.7.0 - 2026-04-07

- Fixed custom field detection when `--source` contains prefixes like `./` or trailing slashes.
- Expanded delta collection to include branch diff results, unstaged changes, staged changes, and untracked files.
- Updated default diff-range behavior to prefer PR-style comparison against the remote default branch instead of only `HEAD~1...HEAD`.
- Fixed package generation for field-driven object payloads so generated object deltas are declared as `CustomObject` members.
- Removed empty metadata sections from generated `package.xml` output.
- Added regression tests for source normalization, uncommitted field detection, PR-base diff selection, and field/object package reconciliation.

## 2.6.20 - 2026-04-07

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
