import path from 'path';
import { gitShow } from '../utils/git';
import { listFilesRecursive, writeJsonFile } from '../utils/fs';
import { ToonComponent, ToonIndex, ToonComponentSummary } from '../types/toon';
import { decodeToonFromGitContent, readToonFile } from '../utils/toonCodec';

export class ToonRepository {
  constructor(private readonly toonRoot: string) {}

  getToonRoot(): string {
    return this.toonRoot;
  }

  getAbsolutePath(relativePath: string): string {
    return path.join(this.toonRoot, relativePath);
  }

  async listToonFiles(): Promise<string[]> {
    const files = await listFilesRecursive(this.toonRoot);
    return files
      .filter((file) => file.endsWith('.toon'))
      .map((file) => path.relative(this.toonRoot, file).replace(/\\/g, '/'));
  }

  async loadComponentFromFs(toonFilePath: string): Promise<ToonComponent> {
    const absolutePath = this.getAbsolutePath(toonFilePath);
    return readToonFile<ToonComponent>(absolutePath);
  }

  async loadComponentFromGitRef(ref: string, toonFilePath: string): Promise<ToonComponent> {
    const relativeRepoPath = path.join(this.toonRoot, toonFilePath).replace(/\\/g, '/');
    const content = gitShow(ref, relativeRepoPath);
    return decodeToonFromGitContent<ToonComponent>(content);
  }

  inferComponentToonFilePath(changedPath: string): string | null {
    const normalized = changedPath.replace(/\\/g, '/');

    if (!normalized.startsWith(`${this.toonRoot}/`)) {
      return null;
    }

    const relative = normalized.slice(this.toonRoot.length + 1);

    if (relative.endsWith('.toon')) {
      return relative;
    }

    const directComponentFolders = ['apexClasses', 'apexTriggers', 'apexPages', 'apexComponents', 'flows'];
    for (const folder of directComponentFolders) {
      const match = relative.match(new RegExp(`^${folder}\/([^/]+)\/`));
      if (match) {
        return `${folder}/${match[1]}/component.toon`;
      }
    }

    const bundleFolders = ['lwc', 'aura'];
    for (const folder of bundleFolders) {
      const match = relative.match(new RegExp(`^${folder}\/([^/]+)\/`));
      if (match) {
        return `${folder}/${match[1]}/bundle.toon`;
      }
    }

    const objectFieldMatch = relative.match(/^objects\/([^/]+)\/fields\/([^/]+)\.toon$/);
    if (objectFieldMatch) {
      return relative;
    }

    const objectAssetMatch = relative.match(/^objects\/([^/]+)\/fields\/[^/]+$/);
    if (objectAssetMatch) {
      return `objects/${objectAssetMatch[1]}/object.toon`;
    }

    const objectMatch = relative.match(/^objects\/([^/]+)\/object\.toon$/);
    if (objectMatch) {
      return relative;
    }

    return null;
  }

  async writeIndex(indexPath = path.join(this.toonRoot, '_index', 'components.json')): Promise<ToonIndex> {
    const toonFiles = await this.listToonFiles();
    const components: ToonComponentSummary[] = [];

    for (const toonFile of toonFiles) {
      const component = await this.loadComponentFromFs(toonFile);
      components.push({
        id: component.id,
        metadataType: component.metadataType,
        fullName: component.fullName,
        toonFilePath: toonFile,
      });
    }

    components.sort((a, b) => a.id.localeCompare(b.id));

    const index: ToonIndex = {
      generatedAt: new Date().toISOString(),
      componentCount: components.length,
      components,
    };

    await writeJsonFile(indexPath, index);
    return index;
  }
}
