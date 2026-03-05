# TOON-first Architecture

## High-level flow

1. `import`: Parse SFDX source and convert metadata into TOON components.
2. `plan`: Use git diff between refs to resolve changed TOON components.
3. `build`: Compile changed TOON components into MDAPI deploy artifacts.
4. `deploy`: Authenticate with Salesforce and deploy generated zip files.

## Core modules

- `src/core/adapters/*`
  - Metadata-type plugins for import/build.
  - Each adapter handles:
    - SFDX primary file detection
    - TOON component generation
    - MDAPI emission
    - package.xml member mapping

- `src/core/services/ToonImporter.ts`
  - Orchestrates SFDX -> TOON conversion.
  - Converts each metadata XML file into a TOON document (XML object form).
  - Renames XML files to TOON naming (`Admin.profile-meta.xml` -> `Admin.profile-meta.toon`).
  - Copies source assets.

- `src/core/services/ChangePlanner.ts`
  - Reads git changes (`fromRef` -> `toRef`).
  - Resolves component-level changes from TOON files/assets.
  - Produces deployment plan with package/destructive members.

- `src/core/services/MdapiCompiler.ts`
  - Emits MDAPI files for changed components.
  - Handles `CustomField` aggregation into `CustomObject` XML.
  - Generates `package.xml` and `destructiveChanges.xml`.

- `src/core/services/BuildService.ts`
  - Zips compiled artifacts.

- `src/core/services/DeployWorkflowService.ts`
  - End-to-end plan + build + deploy orchestration.

- `src/services/AuthService.ts`
  - JWT bearer authentication.

- `src/services/MetadataDeployService.ts`
  - Metadata API deploy and status polling.

## CLI commands

- `import`
- `validate`
- `plan`
- `build`
- `deploy`
- `quick-deploy`

## Extensibility model

To add a new metadata type:

1. Add a new adapter under `src/core/adapters` implementing `MetadataAdapter`.
2. Register it in `AdapterRegistry`.
3. Add sample fixtures/tests for import + build behavior.
