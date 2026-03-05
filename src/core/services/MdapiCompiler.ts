import fs from 'fs';
import path from 'path';
import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { BuildArtifacts, DeploymentPlan, PlannedComponent } from '../types/plan';
import { ToonComponent, ToonComponentSummary } from '../types/toon';
import { buildEmptyPackageXml, buildPackageXml } from '../utils/packageXml';
import { cleanDir, ensureDir, writeJsonFile } from '../utils/fs';
import { ToonRepository } from './ToonRepository';
import { EmitContext } from '../types/adapter';
import { wrapMetadataXml } from '../utils/xml';
import { DEFAULT_API_VERSION } from '../../constants/metadata';
import { buildXmlFromToonPayload } from '../utils/xmlToToon';

export interface CompileOptions {
  plan: DeploymentPlan;
  buildRoot: string;
}

const META_XML_TYPES = new Set<string>([
  'ApexClass',
  'ApexTrigger',
  'ApexPage',
  'ApexComponent',
  'LightningComponentBundle',
  'AuraDefinitionBundle',
]);

export class MdapiCompiler {
  private readonly registry: AdapterRegistry;

  constructor(registry?: AdapterRegistry) {
    this.registry = registry || new AdapterRegistry();
  }

  async compile(options: CompileOptions): Promise<BuildArtifacts> {
    const { plan, buildRoot } = options;
    const mainDir = path.join(buildRoot, 'main');
    const destructiveDir = path.join(buildRoot, 'destructive');

    await cleanDir(buildRoot);
    await ensureDir(mainDir);

    const context: EmitContext = {
      toonRoot: plan.toonRoot,
      mdapiRoot: mainDir,
      packageMembers: toMemberMap(plan.packageMembers),
      fieldFragmentsByObject: new Map<string, string[]>(),
      objectBaseInnerXmlByObject: new Map<string, string>(),
      objectApiVersionByObject: new Map<string, string>(),
    };

    const repository = new ToonRepository(plan.toonRoot);
    const index = await repository.loadIndex();
    const componentById = new Map(index.components.map((component) => [component.id, component]));

    const changedComponents = [...plan.adds, ...plan.modifies];

    for (const plannedComponent of changedComponents) {
      await this.emitComponent(repository, componentById, plannedComponent, context);
    }

    await this.flushCustomObjects(context);

    let packageXmlPath: string | undefined;
    if (Object.keys(plan.packageMembers).length > 0) {
      packageXmlPath = path.join(mainDir, 'package.xml');
      await fs.promises.writeFile(packageXmlPath, buildPackageXml(plan.packageMembers), 'utf8');
    }

    let destructiveChangesPath: string | undefined;
    if (Object.keys(plan.destructiveMembers).length > 0) {
      await ensureDir(destructiveDir);
      destructiveChangesPath = path.join(destructiveDir, 'destructiveChanges.xml');
      await fs.promises.writeFile(destructiveChangesPath, buildPackageXml(plan.destructiveMembers), 'utf8');
      await fs.promises.writeFile(path.join(destructiveDir, 'package.xml'), buildEmptyPackageXml(), 'utf8');
    }

    await writeJsonFile(path.join(buildRoot, 'build-plan.json'), plan);

    return {
      buildRoot,
      mainDir,
      destructiveDir,
      packageXmlPath,
      destructiveChangesPath,
    };
  }

  private async emitComponent(
    repository: ToonRepository,
    componentById: Map<string, ToonComponentSummary>,
    plannedComponent: PlannedComponent,
    context: EmitContext
  ): Promise<void> {
    const indexComponent = componentById.get(plannedComponent.id);
    if (!indexComponent) {
      throw new Error(`Component ${plannedComponent.id} not found in TOON index`);
    }

    const payload = await repository.loadToonPayloadFromFs(indexComponent.toonFilePath);
    const xml = buildXmlFromToonPayload(payload);

    const component: ToonComponent = {
      toonVersion: '1.0',
      id: indexComponent.id,
      metadataType: indexComponent.metadataType,
      fullName: indexComponent.fullName,
      apiVersion: indexComponent.apiVersion,
      kind: indexComponent.kind,
      parentId: indexComponent.parentId,
      assets: indexComponent.assets,
      spec: {
        ...(indexComponent.spec || {}),
      },
      hash: '',
    };

    if (META_XML_TYPES.has(component.metadataType)) {
      component.spec.metaXml = xml;
    } else {
      component.spec.xml = xml;
    }

    const adapter = this.registry.forType(component.metadataType);

    if (!adapter) {
      throw new Error(`No adapter registered for metadata type ${component.metadataType}`);
    }

    await adapter.emitMdapi(component, indexComponent.toonFilePath, context);
  }

  private async flushCustomObjects(context: EmitContext): Promise<void> {
    const objectNames = new Set<string>([
      ...context.objectBaseInnerXmlByObject.keys(),
      ...context.fieldFragmentsByObject.keys(),
    ]);

    for (const objectName of objectNames) {
      const parts: string[] = [];
      const baseInner = context.objectBaseInnerXmlByObject.get(objectName);
      const fieldFragments = context.fieldFragmentsByObject.get(objectName) || [];

      if (baseInner && baseInner.trim().length > 0) {
        parts.push(baseInner.trim());
      }

      if (fieldFragments.length > 0) {
        parts.push(fieldFragments.join('\n'));
      }

      const inner = parts.join('\n').trim();
      if (!inner) {
        continue;
      }

      const apiVersion = context.objectApiVersionByObject.get(objectName) || DEFAULT_API_VERSION;
      const objectXml = wrapMetadataXml('CustomObject', `${inner}\n  <apiVersion>${apiVersion}</apiVersion>`);
      const outputPath = path.join(context.mdapiRoot, 'objects', `${objectName}.object`);
      await ensureDir(path.dirname(outputPath));
      await fs.promises.writeFile(outputPath, objectXml, 'utf8');
    }
  }
}

function toMemberMap(members: Record<string, string[]>): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [type, values] of Object.entries(members)) {
    map.set(type, new Set(values));
  }
  return map;
}
