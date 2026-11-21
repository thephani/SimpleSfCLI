# Simple SF CLI — Community Launch & Promotion Kit

This document contains ready-to-publish templates, checklists, and scripts to promote **Simple SF CLI** (`simple-sf-cli` on npm and `thephani/SimpleSfCLI` on GitHub Marketplace) across developer communities.

---

## 1. GitHub Repository Topics & Social Preview Checklist

### Recommended Repository Topics
Add these topics in **GitHub Repository → About (Gear Icon) → Topics** to maximize discoverability in GitHub Search and GitHub Actions Marketplace:

- `salesforce`
- `sfdx`
- `salesforce-cli`
- `salesforce-dx`
- `salesforce-deployments`
- `github-actions`
- `metadata-api`
- `delta-deployment`
- `ci-cd`
- `devops`
- `apex`
- `lwc`
- `nodejs`
- `typescript`

### Repository Settings & Marketplace Checklist
- [ ] **Website URL**: Set to `https://thephani.github.io/SimpleSfCLI/` in the repository About section.
- [ ] **Description**: `⚡ 19 KB Salesforce DX delta & metadata deployment CLI and GitHub Action — validate PRs in 5-7 seconds without installing @salesforce/cli.`
- [ ] **Social Preview Image (1280×640px)**:
  - Upload under **Settings → General → Social preview**.
  - Include headline: *"Simple SF CLI — 5s Salesforce PR Validations (19 KB vs 200+ MB)"*
  - Show side-by-side CI startup benchmark: `npx simple-sf-cli` (`~5-7s`) vs `npm i -g @salesforce/cli + sfdx-git-delta` (`~60-120s`).
- [ ] **GitHub Actions Marketplace Publication**:
  - Draft a new GitHub Release (e.g., `v2.8.0` and update floating `v2` tag).
  - Check **"Publish this Action to the GitHub Marketplace"** (uses root `action.yml` with `icon: 'zap'` and `color: 'purple'`).
  - Select Primary Category: **Deployment** and Secondary Category: **Continuous Integration**.
- [ ] **GitHub Discussions**: Ensure Q&A and Show and Tell categories are enabled for adopter feedback.

---

## 2. Reddit Launch Post (`r/salesforce` & `r/SalesforceDeveloper`)

**Title Options:**
- `I built an open-source 19 KB Salesforce deployment CLI + GitHub Action that cuts CI/CD cold-start times from ~90s to ~5s (built-in Git delta & destructive changes)`
- `[Open Source] Simple SF CLI v2: Validate Salesforce PRs in 5-7s without installing @salesforce/cli or sfdx-git-delta`

**Body (Markdown):**

```markdown
Hey r/SalesforceDeveloper,

Every time our CI pipeline ran a quick PR validation on GitHub Actions or Bitbucket Pipelines, we were spending **60 to 120 seconds** just installing `@salesforce/cli` (~200+ MB), installing `sfdx-git-delta`, accepting plugin prompts, and generating delta folders before the Metadata API even received a single byte.

To fix this, I built **[Simple SF CLI (`simple-sf-cli`)](https://github.com/thephani/SimpleSfCLI)** — a zero-bloat, TypeScript-native CLI and reusable GitHub Action that talks directly to the Salesforce Metadata & OAuth2 JWT APIs.

### Benchmarks: Simple SF CLI vs. Official Salesforce CLI in CI

| Metric | Simple SF CLI (`simple-sf-cli`) | Official `@salesforce/cli` + Plugins |
| :--- | :--- | :--- |
| **Package Size** | **~19 KB** (~81 KB unpacked) | **~200+ MB** |
| **Cold Install + Start Time** | **~5-7s** (`npx simple-sf-cli`) | **~60-120s** |
| **Built-in Git Delta** | **Yes** (PR-aware branch diffing) | **Requires `sfdx-git-delta` plugin** |
| **Dependencies** | **3** (`archiver`, `commander`, `xmlbuilder`) | **Hundreds** |
| **Destructive Changes** | **Automatic single-zip** (`destructiveChangesPost.xml`) | **Manual multi-step** |

### What it does out of the box:
1. **Native OAuth2 JWT Authentication** using Node's built-in `crypto` (no external OpenSSL or `sf org login jwt` required).
2. **Built-in Git Delta Packaging**: Automatically diffs your PR base/target branches, converts SFDX source (`CustomObject` + `CustomField` merges, LWC bundles, Apex, Flows, 50+ metadata types) into MDAPI format, and respects `.forceignore`.
3. **Single-ZIP Destructive Changes**: Automatically packages deleted metadata into `destructiveChangesPost.xml` alongside `package.xml` in one atomic deployment call (and smartly handles partial LWC file deletions by redeploying the surviving bundle).
4. **Official GitHub Action (`thephani/SimpleSfCLI@v2`)**: Pass your raw `SF_PRIVATE_KEY` secret directly—no manual `server.key` file plumbing needed.

### Example GitHub Action Usage:

```yaml
- uses: actions/checkout@v6
  with:
    fetch-depth: 0

- name: Validate Salesforce PR Delta
  uses: thephani/SimpleSfCLI@v2
  with:
    username: ${{ secrets.SF_USERNAME }}
    client-id: ${{ secrets.SF_CLIENT_ID }}
    private-key: ${{ secrets.SF_PRIVATE_KEY }}
    env: SANDBOX
    validate-only: 'true'
    test-level: RunLocalTests
```

Or run it anywhere with zero install via `npx`:
```bash
npx simple-sf-cli -u "$SF_USERNAME" -c "$SF_CLIENT_ID" -k ./server.key --env SANDBOX --validateOnly
```

- **GitHub Repo & Action**: https://github.com/thephani/SimpleSfCLI
- **NPM Package**: https://www.npmjs.com/package/simple-sf-cli
- **Docs**: https://thephani.github.io/SimpleSfCLI/

It's MIT-licensed and tested with a real-file Git + ZIP packaging integration suite. I'd love feedback from anyone running Salesforce CI/CD pipelines—what metadata edge cases or CI pain points are biting your team right now?
```

---

## 3. LinkedIn / DEV.to / Medium Article Draft

### How to Cut Salesforce GitHub Actions PR Validation Time by 80%

*Tags: `#salesforce` `#devops` `#githubactions` `#cicd` `#sfdx`*

#### The Hidden Tax in Salesforce CI/CD Pipelines

If your team uses GitHub Actions, GitLab CI, or Bitbucket Pipelines for Salesforce development, look closely at your pull request validation logs.

When a developer pushes a one-line Apex or Custom Field change, how long does the runner spend *before* Salesforce even begins validating the deployment?

In most standard pipelines:
1. **Install `@salesforce/cli`**: 45–75 seconds (~200+ MB download + extraction)
2. **Install `sfdx-git-delta` (SGD)**: 15–30 seconds
3. **Authenticate via `sf org login jwt`**: 5–10 seconds
4. **Run SGD + assemble MDAPI zip**: 5–10 seconds

That is **60 to 120 seconds of pure runner overhead** on every single commit. Multiply that across 30 pull requests a day, and your team is burning hours of CI minutes and waiting for feedback on trivial changes.

#### Enter Simple SF CLI (`simple-sf-cli`)

[**Simple SF CLI**](https://github.com/thephani/SimpleSfCLI) was designed around a simple question: *What if a Salesforce CI deployment tool only contained what CI actually needs?*

By stripping away interactive org management, Scratch Org commands, and heavy plugin frameworks, `simple-sf-cli` ships as a **~19 KB npm package** with only **3 runtime dependencies** (`archiver`, `commander`, and `xmlbuilder`).

| Capability | Simple SF CLI (`simple-sf-cli`) | Official Salesforce CLI (`@salesforce/cli`) |
| :--- | :--- | :--- |
| **Package Size** | `~19 KB` | `~200+ MB` |
| **Cold Install + Start Time** | `~5-7s` | `~60-120s` |
| **Built-in Git Delta** | `Yes` | `Requires sfdx-git-delta plugin` |
| **Dependencies** | `3` | `Hundreds` |
| **Destructive Changes** | `Automatic single-zip` | `Manual multi-step` |

#### Drop-In GitHub Action in 12 Lines of YAML

With the official composite GitHub Action (`thephani/SimpleSfCLI@v2`), you don't need to write bash scripts to manage temporary `server.key` files, install plugins, or wire together delta folders:

```yaml
name: Validate Salesforce PR

on:
  pull_request:
    branches: [ main ]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v6
        with:
          node-version: '24'

      - name: Validate Delta on Sandbox
        uses: thephani/SimpleSfCLI@v2
        with:
          username: ${{ secrets.SF_USERNAME }}
          client-id: ${{ secrets.SF_CLIENT_ID }}
          private-key: ${{ secrets.SF_PRIVATE_KEY }}
          env: SANDBOX
          validate-only: 'true'
          test-level: RunLocalTests
```

#### What Happens Under the Hood in those 5–7 Seconds?

1. **In-Memory JWT Signing**: Uses Node's native `crypto` module to sign RS256 JWT assertions and authenticate against `test.salesforce.com` or `login.salesforce.com`. If you pass raw PEM content in `private-key`, the GitHub Action writes a `0600` temporary key file and guarantees cleanup in an `always()` step.
2. **PR-Aware Git Delta Detection**: Automatically detects GitHub Actions and Bitbucket PR branches (`GITHUB_BASE_REF`, `BITBUCKET_PR_DESTINATION_BRANCH`), diffs changed files, and filters against `.forceignore` and `--exclude`.
3. **Smart Metadata Packaging**:
   - Merges `CustomObject` settings and changed `CustomField` XML fragments cleanly without duplicate XML declarations.
   - Packages additions, modifications, and `destructiveChangesPost.xml` deletions into a **single `deploy.zip`**.
   - Recognizes when a single file inside an LWC bundle is deleted and redeploys the surviving bundle rather than deleting the whole component.
4. **Quick Deploy Ready**: Once validated, promote your validation ID to Production in ~5 seconds using `command: quick-deploy` and `quick-deploy-id`.

#### Try It Today

You can test `simple-sf-cli` locally or in CI immediately with `npx`:

```bash
npx simple-sf-cli --help
```

Check out the repository, star it on GitHub, and let us know how much CI time you save:
👉 **GitHub**: [https://github.com/thephani/SimpleSfCLI](https://github.com/thephani/SimpleSfCLI)
👉 **NPM**: [https://www.npmjs.com/package/simple-sf-cli](https://www.npmjs.com/package/simple-sf-cli)

---

## 4. SFXD Discord & Trailblazer Community DevOps Announcement Blurb

### Discord (`#tools-and-releases` / `#devops` on SFXD)

> ⚡ **New Release: Simple SF CLI (`simple-sf-cli`) + Official GitHub Action (`thephani/SimpleSfCLI@v2`)**
>
> Tired of waiting 90+ seconds for `@salesforce/cli` + `sfdx-git-delta` to install on every GitHub Actions / Bitbucket / GitLab CI run?
>
> **Simple SF CLI** is an open-source, **19 KB** Node.js CLI (only 3 dependencies) that handles JWT Auth, Git Delta branch diffing, `.forceignore` filtering, single-zip `destructiveChangesPost.xml` packaging, and Quick Deploys in **5–7 seconds** cold start.
>
> **Highlights:**
> • **Package Size:** `~19 KB` vs `~200+ MB`
> • **Cold Start:** `~5-7s` via `npx simple-sf-cli` or `uses: thephani/SimpleSfCLI@v2`
> • **Smart Packaging:** Handles `CustomObject` + `CustomField` delta merges, LWC partial file deletions, and automatic `destructiveChangesPost.xml` in a single zip.
>
> 🔗 **GitHub & Action:** <https://github.com/thephani/SimpleSfCLI>
> 📦 **NPM:** <https://www.npmjs.com/package/simple-sf-cli>

### Trailblazer Community (Salesforce DevOps / Release Management Groups)

> **Sharing an open-source accelerator for Salesforce CI/CD: Simple SF CLI (`simple-sf-cli`)**
>
> Hi Trailblazers! For teams using GitHub Actions, GitLab CI, or Bitbucket Pipelines, installing the full Salesforce CLI and delta plugins on ephemeral runners often takes longer than the metadata validation itself.
>
> I've released **Simple SF CLI** (`thephani/SimpleSfCLI`), a lightweight (~19 KB) CLI and composite GitHub Action built specifically for fast, stateless CI/CD metadata deployments:
> - **5–7 second cold start** with `npx simple-sf-cli` or `uses: thephani/SimpleSfCLI@v2`
> - **Built-in Git delta calculation** (no extra plugins needed)
> - **Automatic single-zip destructive changes** (`destructiveChangesPost.xml`)
> - **Native OAuth2 JWT authentication** & Quick Deploy support
>
> Full documentation and CI recipes for GitHub Actions, GitLab CI, and Bitbucket Pipelines are available at: https://github.com/thephani/SimpleSfCLI. Feedback and feature requests are welcome!

---

## 5. Terminal GIF Recording Script (`docs/promotion/demo.tape` for Charmbracelet `vhs`)

Use [Charmbracelet `vhs`](https://github.com/charmbracelet/vhs) to record a reproducible benchmark GIF from [`docs/promotion/demo.tape`](./demo.tape).

### How to Record the GIF

```bash
# Install vhs (macOS Homebrew)
brew install vhs

# Generate docs/promotion/simple-sf-cli-benchmark.gif
vhs docs/promotion/demo.tape
```

### Tape Script (`docs/promotion/demo.tape`)

```tape
# Charmbracelet VHS Tape: Simple SF CLI vs Official Salesforce CLI Benchmark
# Usage: vhs docs/promotion/demo.tape

Output docs/promotion/simple-sf-cli-benchmark.gif

Require npx
Require git

Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 650
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms
Set WindowBar Colorful

Type "# Simple SF CLI (~19 KB, 3 dependencies) vs Official @salesforce/cli (~200+ MB)"
Enter
Sleep 800ms

Type "# 1. Check package footprint and cold start speed"
Enter
Sleep 400ms

Type "time npx --yes simple-sf-cli --version"
Enter
Sleep 2500ms

Type "# 2. Run a Git Delta Validation with Destructive Changes in a single command"
Enter
Sleep 500ms

Type "npx simple-sf-cli \"
Enter
Type "  --username ci-bot@acme.com.sandbox \"
Enter
Type "  --clientId 3MVG9_CONNECTED_APP_ID \"
Enter
Type "  --privateKey ./server.key \"
Enter
Type "  --env SANDBOX \"
Enter
Type "  --baseBranch origin/main \"
Enter
Type "  --targetBranch HEAD \"
Enter
Type "  --validateOnly \"
Enter
Type "  --testLevel RunLocalTests"
Enter
Sleep 4s

Type "# Deployed delta + destructiveChangesPost.xml in ~6 seconds (saved 90+ seconds of CI setup)!"
Enter
Sleep 3s
```
