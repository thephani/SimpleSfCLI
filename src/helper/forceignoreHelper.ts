import fs from "fs";
import path from "path";

interface ForceIgnoreRule {
  negate: boolean;
  regex: RegExp;
}

export class ForceIgnoreHelper {
  private readonly rules: ForceIgnoreRule[];

  constructor(private readonly sourceDir: string) {
    this.rules = this.loadRules();
  }

  shouldIgnore(relativePath: string): boolean {
    const normalizedPath = this.normalizePath(relativePath);
    let ignored = false;

    for (const rule of this.rules) {
      if (!rule.regex.test(normalizedPath)) {
        continue;
      }

      ignored = !rule.negate;
    }

    return ignored;
  }

  private loadRules(): ForceIgnoreRule[] {
    const forceIgnorePath = path.resolve(process.cwd(), ".forceignore");
    if (!fs.existsSync(forceIgnorePath)) {
      return [];
    }

    const contents = fs.readFileSync(forceIgnorePath, "utf8");
    return contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((pattern) => {
        const negate = pattern.startsWith("!");
        const sanitizedPattern = negate ? pattern.slice(1) : pattern;

        return {
          negate,
          regex: this.buildRegex(sanitizedPattern),
        };
      });
  }

  private buildRegex(pattern: string): RegExp {
    const normalizedPattern = this.normalizePattern(pattern);
    const regexPattern = normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "__DOUBLE_STAR__")
      .replace(/\*/g, "[^/]*")
      .replace(/__/g, "__")
      .replace(/__DOUBLE_STAR__/g, ".*")
      .replace(/\?/g, "[^/]");

    return new RegExp(`^${regexPattern}$`);
  }

  private normalizePattern(pattern: string): string {
    const normalizedSourceDir = this.normalizePath(this.sourceDir).replace(
      /^\/+/,
      "",
    );
    let normalized = this.normalizePath(pattern).replace(/^\/+/, "");

    if (
      normalizedSourceDir &&
      (normalized === normalizedSourceDir ||
        normalized.startsWith(`${normalizedSourceDir}/`))
    ) {
      normalized = normalized.slice(normalizedSourceDir.length).replace(
        /^\/+/,
        "",
      );
    }

    if (!normalized) {
      return "^$";
    }

    return normalized.includes("/") ? normalized : `(?:.+/)?${normalized}`;
  }

  private normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
  }
}
