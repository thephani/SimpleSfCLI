# SimpleSfCLI (TOON-first)

`simple-sf-cli` is a Salesforce DevOps CLI for CI/CD that treats `TOON` as the canonical metadata format in your repository.

## What changed

- Canonical source is now `TOON` (`*.toon` + code assets), not SFDX XML metadata files.
- `SFDX -> TOON` conversion is built in.
- TOON serialization/deserialization is powered by `@toon-format/toon`.
- Incremental deployments are generated from git diff on TOON files.
- `TOON -> MDAPI` compilation creates `package.xml`, optional `destructiveChanges.xml`, and deploy zips.
- No Salesforce CLI dependency for metadata discovery or package generation.

## Command surface

```bash
simpleSfCli import   # SFDX -> TOON
simpleSfCli validate # Validate TOON documents
simpleSfCli plan     # Git diff -> deployment plan
simpleSfCli build    # Plan -> MDAPI files + zips
simpleSfCli deploy   # Plan + build + deploy
simpleSfCli quick-deploy
```

## Install / Run

```bash
npm install -g simple-sf-cli
# or
npx simple-sf-cli <command>
```

## TOON repository layout

```text
toon/
  apexClasses/
    InvoiceService.cls-meta.toon
    InvoiceService.cls
  objects/
    Invoice__c/
      Invoice__c.object-meta.toon
      fields/
        Amount__c.field-meta.toon
  flows/
    Invoice_Approval.flow-meta.toon
  profiles/
    Admin.profile-meta.toon
  lwc/
    invoiceTable/
      invoiceTable.js-meta.toon
      invoiceTable.js
      invoiceTable.html
```

## Pipeline usage

### 1) Convert existing SFDX metadata to TOON

```bash
simpleSfCli import --source force-app/main/default --toon-root toon --clean
```

`import` is merge/overwrite-only and does not delete existing files in `toon/` (even with `--clean`).

### 2) Validate TOON files

```bash
simpleSfCli validate --toon-root toon
```

### 3) Create deployment plan between commits

```bash
simpleSfCli plan \
  --toon-root toon \
  --from-ref "$BASE_SHA" \
  --to-ref "$HEAD_SHA" \
  --out .simpleSfCli/plans/plan.json
```

For local testing with uncommitted changes (including deletions):

```bash
simpleSfCli plan --toon-root toon --working-tree --out .simpleSfCli/plans/plan.json
```

### 4) Build deployment artifacts

```bash
simpleSfCli build \
  --plan .simpleSfCli/plans/plan.json \
  --build-root .simpleSfCli/build \
  --out deploy.zip
```

### 5) Deploy

```bash
simpleSfCli deploy \
  --username "$SF_USERNAME" \
  --client-id "$SF_CLIENT_ID" \
  --private-key ./server.key \
  --env SANDBOX \
  --toon-root toon \
  --from-ref "$BASE_SHA" \
  --to-ref "$HEAD_SHA"
```

For local deploy testing against uncommitted changes:

```bash
simpleSfCli deploy ... --toon-root toon --working-tree
```

## Supported metadata (initial TOON adapters)

- ApexClass
- ApexTrigger
- ApexPage
- ApexComponent
- LightningComponentBundle (LWC)
- AuraDefinitionBundle
- CustomObject
- CustomField
- Flow
- Layout
- FlexiPage
- CustomMetadata
- Profile
- PermissionSet
- StandardValueSet
- Group
- CustomTab

## Development

```bash
npm run build
npm test
```

Build output is generated in `lib/`.

## License

MIT
