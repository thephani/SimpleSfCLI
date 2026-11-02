import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { CommandArgsConfig } from "types/config.type.js";
import { MetadataType } from "types/index.type.js";
import { GroupedData } from "types/xml.type.js";
import {
  CUSTOM_OBJECT_CHILDREN,
  METADATA_EXTENSIONS,
  METADATA_TYPES,
} from "../helper/constants.js";
import { ForceIgnoreHelper } from "../helper/forceignoreHelper.js";
import { XmlHelper } from "../helper/xmlHelper.js";
import { BaseService } from "./BaseService.js";

const BUNDLE_DIRECTORIES = ["lwc", "aura", "experiences"] as const;

export class MDAPIService extends BaseService {
  private xmlHelper: XmlHelper;
  private forceIgnoreHelper: ForceIgnoreHelper;
  private readonly normalizedSource: string;

  constructor(config: CommandArgsConfig) {
    super(config);
    this.normalizedSource = this.normalizeRepoPath(config.source);
    this.xmlHelper = new XmlHelper(config.cliOuputFolder, this.normalizedSource);
    this.forceIgnoreHelper = new ForceIgnoreHelper(this.normalizedSource);
  }

  async convertToMDAPI(excludeList: string[] = []): Promise<string[]> {
    try {
      // console.log('🚀 Starting MDAPI conversion...');
      await this.initializeDirectories();

      const runTests: string[] = [];
      const survivingBundles = await this.processDeletedMetadata(excludeList);
      await this.processModifiedMetadata(excludeList, runTests, survivingBundles);

      // console.log('✅ Conversion completed successfully.');
      return runTests;
    } catch (error) {
      this.logError("MDAPI conversion failed", error);
      throw error;
    }
  }

  private async initializeDirectories(): Promise<void> {
    const { cliOuputFolder } = this.config;

    if (fs.existsSync(cliOuputFolder)) {
      await fs.promises.rm(cliOuputFolder, { recursive: true, force: true });
      console.log(
        `🗑️  Cleaned existing directory: ${this.config.cliOuputFolder}`,
      );
    }

    await fs.promises.mkdir(cliOuputFolder, { recursive: true });
    // console.log(`📁 Cleanedup directories`);
  }

  private async processDeletedMetadata(excludeList: string[]): Promise<string[]> {
    const survivingBundles: string[] = [];
    const candidateDeletedFiles = (await this.getGitFiles("D")).filter((file) => {
      // A committed/staged deletion can have been restored in the working tree.
      if (fs.existsSync(file)) return false;
      const relativePath = this.toRelativeSourcePath(file);
      const bundleRoot = BUNDLE_DIRECTORIES.find((dir) =>
        relativePath.startsWith(`${dir}/`),
      );
      if (bundleRoot) {
        const bundle = relativePath.split("/")[1];
        if (bundle && fs.existsSync(path.join(this.config.source, bundleRoot, bundle))) {
          survivingBundles.push(file);
          return false;
        }
      }
      return true;
    });

    const deletedObjects = new Set<string>();
    for (const file of candidateDeletedFiles) {
      const relativePath = this.toRelativeSourcePath(file);
      const objectMatch = relativePath.match(/^objects\/([^/]+)\/([^/]+)\.object-meta\.xml$/);
      if (objectMatch && objectMatch[1] === objectMatch[2]) {
        deletedObjects.add(objectMatch[1]);
      }
    }

    const deletedFiles = candidateDeletedFiles.filter((file) => {
      const relativePath = this.toRelativeSourcePath(file);
      const objectChildMatch = relativePath.match(/^objects\/([^/]+)\/(.+)$/);
      if (objectChildMatch && deletedObjects.has(objectChildMatch[1])) {
        return relativePath === `objects/${objectChildMatch[1]}/${objectChildMatch[1]}.object-meta.xml`;
      }
      return true;
    });

    if (!deletedFiles.length) {
      console.log("ℹ️  No deleted components detected");
      return survivingBundles;
    }

    const metadataTypes: MetadataType[] = [];
    const excludedComponents: string[] = [];
    console.log(`🗑️  Processing ${deletedFiles.length} deleted files...`);
    await this.processMetadataFiles(
      deletedFiles,
      excludeList,
      metadataTypes,
      excludedComponents,
      [],
    );

    if (metadataTypes.length) {
      await this.generateDestructivePackages(metadataTypes);
    }
    return survivingBundles;
  }

  private async processModifiedMetadata(
    excludeList: string[],
    runTests: string[],
    survivingBundles: string[] = [],
  ): Promise<void> {
    const changedFiles = [...new Set([...(await this.getGitFiles("AM")), ...survivingBundles])];
    if (!changedFiles.length) {
      return;
    }

    const includedFiles = changedFiles.filter((file) => {
      const type = this.getMetadataType(file);
      return type !== null && !excludeList.includes(type);
    });
    const { fieldData, otherFiles } = this.categorizeFiles(includedFiles);

    await this.copyFiles(otherFiles);

    console.log(`Copying file: ${otherFiles}`);
    await this.copyFiles(otherFiles);

    if (Object.keys(fieldData).length) {
      this.xmlHelper.generateCustomObjectForFields(fieldData);
    }

    const metadataTypes: MetadataType[] = [];
    const excludedComponents: string[] = [];

    await this.processMetadataFiles(
      changedFiles,
      excludeList,
      metadataTypes,
      excludedComponents,
      runTests,
    );

    if (!metadataTypes.length) {
      this.logExcludedComponents(excludedComponents);
      return;
    }

    await this.generatePackageXml(metadataTypes);
    this.logExcludedComponents(excludedComponents);
  }

  private async getGitFiles(filter: string): Promise<string[]> {
    try {
      const diffRange = this.getDiffRange();
      const files = new Set<string>();

      this.collectFilesFromGitCommand(['diff', `--diff-filter=${filter}`, '--name-only', '-z', diffRange, '--'], files);
      this.collectFilesFromGitCommand(['diff', `--diff-filter=${filter}`, '--name-only', '-z', '--'], files);
      this.collectFilesFromGitCommand(['diff', '--cached', `--diff-filter=${filter}`, '--name-only', '-z', '--'], files);
      if (filter.includes("A")) {
        this.collectFilesFromGitCommand(['ls-files', '--others', '--exclude-standard', '-z'], files);
      }

      return [...files].filter(
        (file) => file.startsWith(`${this.normalizedSource}/`) && file.trim(),
      );
    } catch (error) {
      this.logError(`Failed to get git files with filter ${filter}`, error);
      throw error;
    }
  }

  private categorizeFiles(files: string[]): {
    fieldData: GroupedData;
    otherFiles: string[];
  } {
    const fieldData: GroupedData = {};
    const otherFiles = files.filter((file) => {
      const normalizedFile = this.normalizeRepoPath(file);
      const matchedChild = CUSTOM_OBJECT_CHILDREN.find((child) =>
        normalizedFile.match(child.regex),
      );
      if (!matchedChild) {
        return true;
      }

      const match = normalizedFile.match(matchedChild.regex);
      if (match) {
        const objectName = match[1];
        const childName = match[2];

        fieldData[objectName] = fieldData[objectName] || {};
        const existing =
          (fieldData[objectName][matchedChild.folder] as string[] | undefined) || [];
        existing.push(childName);
        fieldData[objectName][matchedChild.folder] = existing;
        return false;
      }
      return true;
    });

    return { fieldData, otherFiles };
  }

  private async copyFiles(files: string[]): Promise<void> {
    for (const file of files) {
      await this.copyFileWithMetadata(file);
    }
  }

  private async copyFileWithMetadata(file: string): Promise<void> {
    const relativePath = this.toRelativeSourcePath(file);

    if (this.shouldIgnoreFile(relativePath)) {
      console.log(`⏭️  Skipping ignored file: ${file}`);
      return;
    }

    if (/^(lwc|aura|experiences)\/[^/]+\//.test(relativePath)) {
      await this.copyBundleComponent(relativePath);
      return;
    }

    await this.copySingleFile(file, relativePath);
  }

  private async copyBundleComponent(relativePath: string): Promise<void> {
    const [bundleType, componentFolder] = relativePath.split("/");
    const componentDir = `${this.config.source}/${bundleType}/${componentFolder}`;
    await this.copyBundleDirectory(componentDir, `${bundleType}/${componentFolder}`);
  }

  private async copyBundleDirectory(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (this.shouldIgnoreFile(relativePath)) continue;
      const sourcePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.copyBundleDirectory(sourcePath, relativePath);
      } else if (entry.isFile()) {
        const targetPath = path.join(this.config.cliOuputFolder, relativePath);
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.promises.copyFile(sourcePath, targetPath);
      }
    }
  }

  private async copySingleFile(
    file: string,
    relativePath: string,
  ): Promise<void> {
    let targetPath = path.join(this.config.cliOuputFolder, relativePath);

    if (relativePath.endsWith(".md-meta.xml")) {
      targetPath = targetPath.replace(".md-meta.xml", ".md");
    } else if (relativePath.match(/^objects\/[^/]+\/[^/]+\.object-meta\.xml$/)) {
      targetPath = path.join(
        this.config.cliOuputFolder,
        "objects",
        `${path.basename(relativePath, ".object-meta.xml")}.object`,
      );
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(file, targetPath);

    if (file.endsWith("-meta.xml")) {
      const primaryFile = file.replace(/-meta\.xml$/, "");
      const primaryTargetPath = targetPath.replace(/-meta\.xml$/, "");
      if (primaryTargetPath !== targetPath && fs.existsSync(primaryFile)) {
        await fs.promises.copyFile(primaryFile, primaryTargetPath);
      }
    } else {
      const metadataPath = `${file}-meta.xml`;
      if (fs.existsSync(metadataPath)) {
        await fs.promises.copyFile(metadataPath, `${targetPath}-meta.xml`);
      }
    }
  }

  private async generateDestructivePackages(types: MetadataType[]): Promise<void> {
    await fs.promises.writeFile(
      path.join(this.config.cliOuputFolder, "destructiveChangesPost.xml"),
      this.xmlHelper.createPackageXml(types),
    );
    // Modified metadata may replace this with a populated manifest afterward.
    await fs.promises.writeFile(
      path.join(this.config.cliOuputFolder, "package.xml"),
      this.xmlHelper.createEmptyPackageXml(),
    );
  }

  private async processMetadataFiles(
    files: string[],
    excludeList: string[],
    types: MetadataType[],
    excluded: string[],
    runTests: string[],
  ): Promise<void> {
    for (const file of files) {
      const type = this.getMetadataType(file);
      if (!type) {
        console.log(`⏭️  Skipping unsupported or ignored metadata: ${file}`);
        continue;
      }

      if (excludeList?.includes(type)) {
        console.log(`⏭️  Skipping excluded metadata type ${type}: ${file}`);
        if (!excluded.includes(type)) {
          excluded.push(type);
        }
        continue;
      }

      const memberName = this.getMemberName(file);
      if (memberName) {
        this.addMember(type, memberName, types);
      }

      if (type === "ApexClass" && (await this.isTestClass(file))) {
        runTests.push(path.basename(file, ".cls"));
      }
    }
  }

  private getMetadataType(file: string): string | null {
    const relativePath = this.toRelativeSourcePath(file);

    if (this.shouldIgnoreFile(relativePath)) {
      return null;
    }

    for (const childConfig of CUSTOM_OBJECT_CHILDREN) {
      if (relativePath.match(childConfig.regex)) {
        return childConfig.typeName;
      }
    }

    // Prefer the most specific folder match so prefixes like "Bot" do not
    // swallow more specific types such as "BotBlock" or "BotVersion".
    const folder = Object.keys(METADATA_TYPES)
      .sort((left, right) => right.length - left.length)
      .find((candidate) => relativePath.startsWith(candidate));

    return folder ? METADATA_TYPES[folder] : null;
  }

  private shouldIgnoreFile(relativePath: string): boolean {
    return (
      relativePath === "lwc/jsconfig.json" ||
      this.forceIgnoreHelper.shouldIgnore(relativePath)
    );
  }

  private getMemberName(file: string): string | null {
    const relativePath = this.toRelativeSourcePath(file);
    if (/^(lwc|aura|experiences)\/[^/]+\//.test(relativePath)) {
      return relativePath.split("/")[1] || null;
    }

    for (const childConfig of CUSTOM_OBJECT_CHILDREN) {
      const match = relativePath.match(childConfig.regex);
      if (match) {
        const packageMember = this.xmlHelper.generatePackageMember(file);
        return packageMember?.members?.[0] || `${match[1]}.${match[2]}`;
      }
    }

    const fileName = path.basename(file);

    for (const [ext, replacement] of Object.entries(METADATA_EXTENSIONS)) {
      if (file.endsWith(ext)) {
        return fileName.replace(ext, replacement);
      }
    }

    const packageMember = this.xmlHelper.generatePackageMember(file);
    return packageMember?.members?.[0] || null;
  }

  private addMember(type: string, name: string, types: MetadataType[]): void {
    const existingType = types.find((t) => t.name === type);
    if (existingType) {
      if (!existingType.members.includes(name)) {
        existingType.members.push(name);
      }
    } else {
      types.push({ name: type, members: [name] });
    }
  }

  private async isTestClass(file: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(file, "utf8");
      return content.includes("@isTest") || content.includes("testMethod");
    } catch {
      return false;
    }
  }

  private async generatePackageXml(types: MetadataType[]): Promise<void> {
    const packageXml = this.xmlHelper.createPackageXml(types);
    await fs.promises.writeFile(
      path.join(this.config.cliOuputFolder, "package.xml"),
      packageXml,
    );
    console.log("\n📦 Generated package.xml:");
    console.log("---------------------------");
    console.log(packageXml);
    console.log("---------------------------\n");
  }

  private logExcludedComponents(components: string[]): void {
    if (!components.length) return;

    console.log("\n⚠️  Excluded Components:");
    console.log("------------------------");
    components.forEach((c) => console.log(`  • ${c}`));
    console.log("------------------------\n");
  }

  private logError(message: string, error: unknown): void {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ ${message}: ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      console.debug("Stack trace:", error.stack);
    }
  }

  private collectFilesFromGitCommand(args: string[], files: Set<string>): void {
    try {
      const output = execFileSync('git', args, { encoding: "utf8" });
      output.split("\0").filter(Boolean).map((file) => this.normalizeRepoPath(file)).forEach((file) => files.add(file));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Git metadata discovery failed (${args.join(' ')}): ${detail}`);
    }
  }

  private getDiffRange(): string {
    const configuredBase = this.normalizeGitRef(this.config.baseBranch);
    const configuredTarget = this.normalizeGitRef(this.config.targetBranch);

    if (configuredBase && configuredBase !== "HEAD~1") {
      return `${configuredBase}...${configuredTarget}`;
    }

    const pullRequestRange = this.detectPullRequestRangeFromEnv();
    if (pullRequestRange) {
      return `${pullRequestRange.base}...${pullRequestRange.target}`;
    }

    const prBase = this.detectPullRequestBaseBranch();
    return `${prBase ?? "HEAD~1"}...${configuredTarget}`;
  }

  private detectPullRequestRangeFromEnv(): {
    base: string;
    target: string;
  } | null {
    const rawBaseRef =
      process.env.GITHUB_BASE_REF ||
      process.env.BITBUCKET_PR_DESTINATION_BRANCH;
    const rawTargetRef =
      process.env.GITHUB_HEAD_REF ||
      process.env.BITBUCKET_PR_SOURCE_BRANCH ||
      process.env.BITBUCKET_BRANCH;

    const baseRef = this.resolveGitRef(rawBaseRef, { remoteOnly: true });
    if (!baseRef) {
      return null;
    }

    const targetRef = this.resolveGitRef(rawTargetRef) ?? "HEAD";
    return { base: baseRef, target: targetRef };
  }

  private detectPullRequestBaseBranch(): string | null {
    try {
      const currentBranch = this.normalizeGitRef(
        execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }),
      );
      const originHeadRef = this.normalizeGitRef(
        execFileSync("git", ["symbolic-ref", "refs/remotes/origin/HEAD"], {
          encoding: "utf8",
        }),
      );
      const defaultBranch = originHeadRef.split("/").pop() ?? "";

      if (!currentBranch || !defaultBranch || currentBranch === defaultBranch) {
        return null;
      }

      return `origin/${defaultBranch}`;
    } catch (error) {
      this.logError("Failed to detect PR base branch", error);
      return null;
    }
  }

  private normalizeGitRef(value: string): string {
    const ref = value.trim();
    if (ref.startsWith("-")) throw new Error(`Invalid Git ref: ${ref}`);
    return ref;
  }

  private resolveGitRef(
    rawRef: string | undefined,
    options: { remoteOnly?: boolean } = {},
  ): string | null {
    const normalizedRef = this.normalizeGitRef(rawRef ?? "");
    if (!normalizedRef) {
      return null;
    }

    const candidates = options.remoteOnly
      ? [`origin/${normalizedRef}`]
      : [`origin/${normalizedRef}`, normalizedRef];

    for (const candidate of candidates) {
      try {
        execFileSync("git", ["rev-parse", "--verify", "--quiet", "--end-of-options", candidate], {
          encoding: "utf8",
          stdio: "ignore",
        });
        return candidate;
      } catch {
        continue;
      }
    }

    return null;
  }

  private toRelativeSourcePath(file: string): string {
    const normalizedFile = this.normalizeRepoPath(file);
    const sourcePrefix = `${this.normalizedSource}/`;

    return normalizedFile.startsWith(sourcePrefix)
      ? normalizedFile.slice(sourcePrefix.length)
      : normalizedFile;
  }

  private normalizeRepoPath(value: string): string {
    return value.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
  }
}
