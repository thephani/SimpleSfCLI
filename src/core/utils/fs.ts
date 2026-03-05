import fs from 'fs';
import path from 'path';
import { stableStringify } from './stableStringify';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function cleanDir(dirPath: string): Promise<void> {
  if (await pathExists(dirPath)) {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  }
  await ensureDir(dirPath);
}

export async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

export async function copyFileWithDirs(sourcePath: string, targetPath: string): Promise<void> {
  await ensureDir(path.dirname(targetPath));
  await fs.promises.copyFile(sourcePath, targetPath);
}

export async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, stableStringify(payload) + '\n', 'utf8');
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(content) as T;
}
