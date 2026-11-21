import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { CommandArgsConfig } from "../types/config.type.js";
import type { MetadataType } from "../types/index.type.js";
import type { GroupedData } from "../types/xml.type.js";
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
    this.xmlHelper = new XmlHelper(config.cliOuputFolder, this.normalizedSource, config.sfVersion);
    this.forceIgnoreHelper = new ForceIgnoreHelper(this.normalizedSource);
  }

  async convertToMDAPI(excludeList: string[] = []): Promise<string[]> {
    try {
      // console.log('🚀 Starting MDAPI conversion...');
      await this.initializeDirectories();

      const runTests: string[] = [];
      if (this.config.manifest) {
        await this.processManifestMetadata(excludeList, runTests);
        return runTests;
      }

      const survivingBundles = await this.processDeletedMetadata(excludeList);
      await this.processModifiedMetadata(excludeList, runTests, survivingBundles);

      // console.log('✅ Conversion completed successfully.');
      return runTests;
    } catch (error) {
      this.logError("MDAPI conversion failed", error);
      throw error;
    }
  }

  private async processManifestMetadata(
    excludeList: string[],
    runTests: string[],
  ): Promise<void> {
    const manifestPath = path.resolve(this.config.manifest as string);
    const manifestContent = await fs.promises.readFile(manifestPath, "utf8");
    const { metadataTypes, apiVersion } =
      this.xmlHelper.parseManifestXml(manifestContent);
    const metadataMap = new Map(
      metadataTypes.map((metadataType) => [metadataType.name, metadataType]),
    );

    const sourceFiles = await this.getFilesRecursively(this.normalizedSource);
    const copiedFiles = new Set<string>();
    const missingMembers: string[] = [];
    const excludedTypes: string[] = [];

    for (const metadataType of metadataTypes) {
      if (excludeList?.includes(metadataType.name)) {
        excludedTypes.push(metadataType.name);
        continue;
      }

      for (const member of metadataType.members) {
        const matches = sourceFiles.filter((file) => {
          const type = this.getMetadataType(file);
          if (type !== metadataType.name) {
            return false;
          }

          if (member === "*") {
            return true;
          }

          const memberName = this.getMemberName(file);
          const relativePath = this.toRelativeSourcePath(file);
          const comparableMember = this.getManifestComparableMember(
            metadataType.name,
            memberName,
            relativePath,
          );

          return comparableMember === member;
        });

        if (!matches.length) {
          missingMembers.push(`${metadataType.name}:${member}`);
          continue;
        }

        for (const file of matches) {
          await this.copyFileWithMetadata(file);
          copiedFiles.add(file);

          if (metadataType.name === "ApexClass" && (await this.isTestClass(file))) {
            const testClassName = path.basename(file, ".cls");
            if (!runTests.includes(testClassName)) {
              runTests.push(testClassName);
            }
          }
        }
      }
    }

    if (missingMembers.length) {
      throw new Error(
        `Manifest members not found in source: ${missingMembers.join(", ")}`,
      );
    }

    if (copiedFiles.size === 0) {
      throw new Error("Manifest resolved to zero deployable metadata.");
    }

    const filteredTypes = [...metadataMap.values()]
      .filter((metadataType) => !excludeList?.includes(metadataType.name))
      .map((metadataType) => ({
        ...metadataType,
        members: [...metadataType.members],
      }));

    await this.generatePackageXml(filteredTypes, apiVersion);
    this.logExcludedComponents(excludedTypes);
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
        const type = this.getMetadataType(file);
        if (type && !excludeList?.includes(type)) {
          deletedObjects.add(objectMatch[1]);
        }
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
    const entries = (await fs.promises.readdir(directory, { withFileTypes: true })) as Array<fs.Dirent | string>;
    for (const entry of entries) {
      const entryName = typeof entry === "string" ? entry : entry.name;
      const relativePath = `${relativeDirectory}/${entryName}`;
      if (this.shouldIgnoreFile(relativePath)) continue;
      const sourcePath = path.join(directory, entryName);
      const isDir = typeof entry !== "string" && typeof entry.isDirectory === "function" && entry.isDirectory();
      const isFile = typeof entry === "string" || (typeof entry.isFile === "function" ? entry.isFile() : !isDir);
      if (isDir) {
        await this.copyBundleDirectory(sourcePath, relativePath);
      } else if (isFile) {
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

    const folderedMatch = relativePath.match(
      /^(reports|Report|dashboards|Dashboard|email|EmailTemplate|documents|Document)\/(.+)$/,
    );
    if (folderedMatch) {
      const subPath = folderedMatch[2];
      for (const [ext, replacement] of Object.entries(METADATA_EXTENSIONS)) {
        if (subPath.endsWith(ext)) {
          return `${subPath.slice(0, -ext.length)}${replacement}`;
        }
      }
      return subPath;
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

  private async generatePackageXml(
    types: MetadataType[],
    apiVersion?: string,
  ): Promise<void> {
    const packageXml =
      apiVersion !== undefined
        ? this.xmlHelper.createPackageXml(types, apiVersion)
        : this.xmlHelper.createPackageXml(types);
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
    const rawBaseRef = this.stripRefsHeads(
      process.env.GITHUB_BASE_REF ||
      process.env.BITBUCKET_PR_DESTINATION_BRANCH ||
      process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME ||
      process.env.SYSTEM_PULLREQUEST_TARGETBRANCH,
    );
    const rawTargetRef = this.stripRefsHeads(
      process.env.GITHUB_HEAD_REF ||
      process.env.BITBUCKET_PR_SOURCE_BRANCH ||
      process.env.BITBUCKET_BRANCH ||
      process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME ||
      process.env.SYSTEM_PULLREQUEST_SOURCEBRANCH,
    );

    const baseRef = this.resolveGitRef(rawBaseRef, { remoteOnly: true });
    if (!baseRef) {
      return null;
    }

    const targetRef = this.resolveGitRef(rawTargetRef) ?? "HEAD";
    return { base: baseRef, target: targetRef };
  }

  private stripRefsHeads(ref: string | undefined): string | undefined {
    if (!ref) {
      return undefined;
    }
    return ref.trim().replace(/^refs\/heads\//, "");
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

  private async getFilesRecursively(directory: string): Promise<string[]> {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.getFilesRecursively(fullPath)));
      } else {
        files.push(this.normalizeRepoPath(fullPath));
      }
    }

    return files;
  }

  private getManifestComparableMember(
    metadataType: string,
    memberName: string | null,
    relativePath: string,
  ): string | null {
    if (!memberName) {
      return null;
    }

    if (metadataType === "LightningComponentBundle") {
      const segments = relativePath.split("/");
      return segments.length >= 2 ? segments[1] : memberName;
    }

    if (metadataType === "AuraDefinitionBundle") {
      const segments = relativePath.split("/");
      return segments.length >= 2 ? segments[1] : memberName;
    }

    return memberName;
  }
}
