import fs from 'fs';
import path from 'path';
import { DEFAULT_API_VERSION } from '../../constants/metadata';
import { ToonAsset, ToonComponentSummary, ToonKind } from '../types/toon';
import { listFilesRecursive } from '../utils/fs';
import { gitShow } from '../utils/git';
import { sha256 } from '../utils/hash';
import { decodeToonFromGitContent, readToonFile } from '../utils/toonCodec';

const ROOT_TAG_TO_METADATA_TYPE: Record<string, string> = {
  ApexClass: 'ApexClass',
  ApexTrigger: 'ApexTrigger',
  ApexPage: 'ApexPage',
  ApexComponent: 'ApexComponent',
  LightningComponentBundle: 'LightningComponentBundle',
  AuraDefinitionBundle: 'AuraDefinitionBundle',
  CustomObject: 'CustomObject',
  CustomField: 'CustomField',
  Flow: 'Flow',
  Layout: 'Layout',
  FlexiPage: 'FlexiPage',
  CustomMetadata: 'CustomMetadata',
  Profile: 'Profile',
  PermissionSet: 'PermissionSet',
  StandardValueSet: 'StandardValueSet',
  Group: 'Group',
  CustomTab: 'CustomTab',
};

const TYPE_TO_META_SUFFIX: Record<string, string> = {
  ApexClass: '.cls-meta.toon',
  ApexTrigger: '.trigger-meta.toon',
  ApexPage: '.page-meta.toon',
  ApexComponent: '.component-meta.toon',
  LightningComponentBundle: '.js-meta.toon',
  AuraDefinitionBundle: '-meta.toon',
  CustomObject: '.object-meta.toon',
  CustomField: '.field-meta.toon',
  Flow: '.flow-meta.toon',
  Layout: '.layout-meta.toon',
  FlexiPage: '.flexipage-meta.toon',
  CustomMetadata: '.md-meta.toon',
  Profile: '.profile-meta.toon',
  PermissionSet: '.permissionset-meta.toon',
  StandardValueSet: '.standardValueSet-meta.toon',
  Group: '.group-meta.toon',
  CustomTab: '.tab-meta.toon',
};

const TYPE_TO_BODY_EXTENSION: Record<string, string> = {
  ApexClass: '.cls',
  ApexTrigger: '.trigger',
  ApexPage: '.page',
  ApexComponent: '.component',
};

export class ToonRepository {
  constructor(private readonly toonRoot: string) {}

  getToonRoot(): string {
    return this.toonRoot;
  }

  async listToonFiles(): Promise<string[]> {
    const files = await listFilesRecursive(this.toonRoot);
    return files
      .filter((file) => file.endsWith('.toon'))
      .map((file) => path.relative(this.toonRoot, file).replace(/\\/g, '/'))
      .sort((a, b) => a.localeCompare(b));
  }

  async loadToonPayloadFromFs(toonFilePath: string): Promise<unknown> {
    return readToonFile<unknown>(path.join(this.toonRoot, toonFilePath));
  }

  async loadToonPayloadFromGitRef(ref: string, toonFilePath: string): Promise<unknown> {
    const relativeRepoPath = path.join(this.toonRoot, toonFilePath).replace(/\\/g, '/');
    const content = gitShow(ref, relativeRepoPath);
    return decodeToonFromGitContent<unknown>(content);
  }

  async loadComponentSummaryFromFs(toonFilePath: string): Promise<ToonComponentSummary> {
    const payload = await this.loadToonPayloadFromFs(toonFilePath);
    return this.createSummaryFromPayload(toonFilePath, payload, true);
  }

  async loadComponentSummaryFromGitRef(ref: string, toonFilePath: string): Promise<ToonComponentSummary> {
    const payload = await this.loadToonPayloadFromGitRef(ref, toonFilePath);
    return this.createSummaryFromPayload(toonFilePath, payload, false);
  }

  inferComponentToonFilePath(changedPath: string): string | null {
    const relative = this.toRelativeToToonRoot(changedPath);
    if (!relative) {
      return null;
    }

    if (relative.endsWith('.toon')) {
      return relative;
    }

    let match = relative.match(/^apexClasses\/([^/]+)\.cls$/);
    if (match) return `apexClasses/${match[1]}.cls-meta.toon`;

    match = relative.match(/^apexTriggers\/([^/]+)\.trigger$/);
    if (match) return `apexTriggers/${match[1]}.trigger-meta.toon`;

    match = relative.match(/^apexPages\/([^/]+)\.page$/);
    if (match) return `apexPages/${match[1]}.page-meta.toon`;

    match = relative.match(/^apexComponents\/([^/]+)\.component$/);
    if (match) return `apexComponents/${match[1]}.component-meta.toon`;

    match = relative.match(/^lwc\/([^/]+)\/[^/]+$/);
    if (match) return `lwc/${match[1]}/${match[1]}.js-meta.toon`;

    match = relative.match(/^aura\/([^/]+)\/[^/]+$/);
    if (match) {
      const localResolved = this.resolveAuraToonFromFs(match[1]);
      return localResolved || `aura/${match[1]}/${match[1]}.cmp-meta.toon`;
    }

    return null;
  }

  private toRelativeToToonRoot(changedPath: string): string | null {
    const normalized = changedPath.replace(/\\/g, '/');
    if (!normalized.startsWith(`${this.toonRoot}/`)) {
      return null;
    }

    return normalized.slice(this.toonRoot.length + 1);
  }

  private resolveAuraToonFromFs(bundleName: string): string | null {
    const auraDir = path.join(this.toonRoot, 'aura', bundleName);
    if (!fs.existsSync(auraDir)) {
      return null;
    }

    const toonFiles = fs.readdirSync(auraDir).filter((file) => file.endsWith('.toon'));
    if (toonFiles.length === 1) {
      return `aura/${bundleName}/${toonFiles[0]}`;
    }

    const preferred = toonFiles.find((file) => file.endsWith('.cmp-meta.toon'));
    if (preferred) {
      return `aura/${bundleName}/${preferred}`;
    }

    return toonFiles.length ? `aura/${bundleName}/${toonFiles[0]}` : null;
  }

  private async buildAssets(toonFilePath: string, metadataType: string, fullName: string): Promise<ToonAsset[] | undefined> {
    const bodyExtension = TYPE_TO_BODY_EXTENSION[metadataType];
    if (bodyExtension) {
      const relativePath = `${path.dirname(toonFilePath).replace(/\\/g, '/')}/${fullName}${bodyExtension}`.replace(/^\.\//, '');
      const absolutePath = path.join(this.toonRoot, relativePath);
      if (!fs.existsSync(absolutePath)) {
        return undefined;
      }

      const content = await fs.promises.readFile(absolutePath);
      return [{
        path: relativePath,
        role: 'source',
        sha256: sha256(content),
      }];
    }

    if (metadataType === 'LightningComponentBundle' || metadataType === 'AuraDefinitionBundle') {
      const bundleDir = path.join(this.toonRoot, path.dirname(toonFilePath));
      const entries = await fs.promises.readdir(bundleDir);
      const assets: ToonAsset[] = [];

      for (const entry of entries) {
        if (entry.endsWith('.toon')) {
          continue;
        }

        const relativePath = `${path.dirname(toonFilePath).replace(/\\/g, '/')}/${entry}`;
        const absolutePath = path.join(this.toonRoot, relativePath);
        const content = await fs.promises.readFile(absolutePath);
        assets.push({
          path: relativePath,
          role: 'bundle-asset',
          sha256: sha256(content),
        });
      }

      return assets.length ? assets : undefined;
    }

    return undefined;
  }

  private createSummaryFromPayload(toonFilePath: string, payload: unknown, includeAssets: boolean): ToonComponentSummary {
    const rootTag = this.findRootTag(payload);
    const metadataType = ROOT_TAG_TO_METADATA_TYPE[rootTag];

    if (!metadataType) {
      throw new Error(`Unsupported XML root tag for TOON file ${toonFilePath}: ${rootTag}`);
    }

    const fullName = this.deriveFullName(metadataType, toonFilePath);
    const apiVersion = this.extractApiVersion(payload, rootTag);
    const kind = this.deriveKind(metadataType);
    const parentId = metadataType === 'CustomField' ? `CustomObject:${fullName.split('.')[0]}` : undefined;

    const id = `${metadataType}:${fullName}`;

    const summary: ToonComponentSummary = {
      id,
      metadataType,
      fullName,
      apiVersion,
      kind,
      parentId,
      toonFilePath,
      spec: this.deriveSpec(metadataType, fullName, toonFilePath),
    };

    if (includeAssets) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      throwIfUsedSync();
    }

    return summary;
  }

  async hydrateAssets(summary: ToonComponentSummary): Promise<ToonComponentSummary> {
    const assets = await this.buildAssets(summary.toonFilePath, summary.metadataType, summary.fullName);
    if (!assets) {
      return summary;
    }

    return {
      ...summary,
      assets,
    };
  }

  private findRootTag(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      throw new Error('TOON payload is not an object');
    }

    const keys = Object.keys(payload as Record<string, unknown>).filter((key) => key !== '?xml');
    if (!keys.length) {
      throw new Error('TOON payload does not contain XML root element');
    }

    return keys[0];
  }

  private extractApiVersion(payload: unknown, rootTag: string): string {
    if (!payload || typeof payload !== 'object') {
      return DEFAULT_API_VERSION;
    }

    const root = (payload as Record<string, unknown>)[rootTag];
    if (!root || typeof root !== 'object') {
      return DEFAULT_API_VERSION;
    }

    const value = (root as Record<string, unknown>).apiVersion;
    if (value === undefined || value === null) {
      return DEFAULT_API_VERSION;
    }

    return String(value);
  }

  private deriveKind(metadataType: string): ToonKind {
    if (metadataType === 'LightningComponentBundle' || metadataType === 'AuraDefinitionBundle') {
      return 'bundle';
    }

    if (metadataType === 'CustomField') {
      return 'child';
    }

    return 'atomic';
  }

  private deriveFullName(metadataType: string, toonFilePath: string): string {
    const fileName = path.basename(toonFilePath);

    if (metadataType === 'CustomField') {
      const objectName = path.basename(path.dirname(path.dirname(toonFilePath)));
      const fieldName = fileName.replace('.field-meta.toon', '');
      return `${objectName}.${fieldName}`;
    }

    if (metadataType === 'CustomObject') {
      return fileName.replace('.object-meta.toon', '');
    }

    if (metadataType === 'LightningComponentBundle' || metadataType === 'AuraDefinitionBundle') {
      return path.basename(path.dirname(toonFilePath));
    }

    const suffix = TYPE_TO_META_SUFFIX[metadataType];
    if (!suffix) {
      return fileName.replace(/\.toon$/i, '');
    }

    return fileName.endsWith(suffix) ? fileName.slice(0, -suffix.length) : fileName.replace(/\.toon$/i, '');
  }

  private deriveSpec(metadataType: string, fullName: string, toonFilePath: string): Record<string, unknown> | undefined {
    if (TYPE_TO_BODY_EXTENSION[metadataType]) {
      return { bodyFile: `${fullName}${TYPE_TO_BODY_EXTENSION[metadataType]}` };
    }

    if (metadataType === 'AuraDefinitionBundle') {
      const toonFileName = path.basename(toonFilePath);
      return { metaFileName: toonFileName.replace(/\.toon$/i, '.xml') };
    }

    return undefined;
  }
}

function throwIfUsedSync(): never {
  throw new Error('Internal error: synchronous asset hydration is not supported');
}
