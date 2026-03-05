import { execSync } from 'child_process';

export interface GitDiffEntry {
  status: string;
  oldPath?: string;
  newPath?: string;
}

export function gitDiffNameStatus(fromRef: string, toRef: string, scopePath: string): GitDiffEntry[] {
  const command = `git diff --name-status --find-renames=40% ${fromRef} ${toRef} -- ${scopePath}`;
  const output = execSync(command, { encoding: 'utf8' }).trim();

  if (!output) {
    return [];
  }

  return output
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const parts = line.split('\t');
      const statusCode = parts[0];

      if (statusCode.startsWith('R')) {
        return {
          status: 'R',
          oldPath: parts[1],
          newPath: parts[2],
        };
      }

      if (statusCode === 'D') {
        return { status: 'D', oldPath: parts[1] };
      }

      return {
        status: statusCode,
        newPath: parts[1],
      };
    });
}

export function gitShow(ref: string, relativePath: string): string {
  const escapedPath = relativePath.replace(/"/g, '\\"');
  const command = `git show ${ref}:"${escapedPath}"`;
  return execSync(command, { encoding: 'utf8' });
}
