import fs from 'fs';
import path from 'path';
import { ensureDir } from './fs';

interface ToonModule {
  encode(input: unknown): string;
  decode(input: string): unknown;
}

let modulePromise: Promise<ToonModule> | null = null;

async function getToonModule(): Promise<ToonModule> {
  if (!modulePromise) {
    const dynamicImporter = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<ToonModule>;
    modulePromise = dynamicImporter('@toon-format/toon');
  }

  return modulePromise;
}

export async function encodeToon(input: unknown): Promise<string> {
  const module = await getToonModule();
  return module.encode(input);
}

export async function decodeToon<T>(content: string): Promise<T> {
  const module = await getToonModule();
  return module.decode(content) as T;
}

export async function writeToonFile(filePath: string, payload: unknown): Promise<void> {
  const content = await encodeToon(payload);
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, `${content.trimEnd()}\n`, 'utf8');
}

export async function readToonFile<T>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, 'utf8');
  return decodeToon<T>(content);
}

export async function decodeToonFromGitContent<T>(content: string): Promise<T> {
  return decodeToon<T>(content);
}
