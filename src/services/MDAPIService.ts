import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { CommandArgsConfig } from "types/config.type.js";
import { MetadataType } from "types/index.type.js";
import { GroupedData } from "types/xml.type.js";
import {
  MEMBERTYPE_REGEX,
  METADATA_EXTENSIONS,
  METADATA_TYPES,
} from "../helper/constants.js";
import { ForceIgnoreHelper } from "../helper/forceignoreHelper.js";
import { XmlHelper } from "../helper/xmlHelper.js";
import { BaseService } from "./BaseService.js";

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
      await this.processDeletedMetadata(excludeList);
      await this.processModifiedMetadata(excludeList, runTests);

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
    await fs.promises.mkdir(path.join(cliOuputFolder, "destructiveChanges"), {
      recursive: true,
    });
    // console.log(`📁 Cleanedup directories`);
  }

  private async processDeletedMetadata(excludeList: string[]): Promise<void> {
    const deletedFiles = await this.getGitFiles("D");
    if (!deletedFiles.length) {
      console.log("ℹ️  No deleted files detected");
      return;
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
  }

  private async processModifiedMetadata(
    excludeList: string[],
    runTests: string[],
  ): Promise<void> {
    const changedFiles = await this.getGitFiles("AM");
    if (!changedFiles.length) {
      console.log("if no deleted files detected, exit here");
      return;
    }

    const { fieldData, otherFiles } = this.categorizeFiles(changedFiles);

    if (Object.keys(fieldData).length) {
      this.xmlHelper.generateCustomObjectForFields(fieldData);
    }

    console.log(`Copying file: ${otherFiles}`);
    await this.copyFiles(otherFiles);

    const metadataTypes: MetadataType[] = [];
    const excludedComponents: string[] = [];

      await this.processMetadataFiles(
        changedFiles,
        excludeList,
        metadataTypes,
        excludedComponents,
        runTests,
      );

    this.reconcileFieldMetadataWithGeneratedObjects(fieldData, metadataTypes);

    if (!metadataTypes.length) {
      throw new Error(
        `No supported metadata found. Supported types: ${Object.values(METADATA_TYPES)}`,
      );
    }

    await this.generatePackageXml(metadataTypes);
    this.logExcludedComponents(excludedComponents);
  }

  private async getGitFiles(filter: string): Promise<string[]> {
    try {
      const diffRange = this.getDiffRange();
      const files = new Set<string>();

      this.collectFilesFromGitCommand(
        `git diff --diff-filter=${filter} --name-only ${diffRange}`,
        files,
      );
      this.collectFilesFromGitCommand(
        `git diff --diff-filter=${filter} --name-only`,
        files,
      );
      this.collectFilesFromGitCommand(
        `git diff --cached --diff-filter=${filter} --name-only`,
        files,
      );

      if (filter.includes("A")) {
        this.collectFilesFromGitCommand(
          "git ls-files --others --exclude-standard",
          files,
        );
      }

      return [...files].filter(
        (file) => file.startsWith(`${this.normalizedSource}/`) && file.trim(),
      );
    } catch (error) {
      this.logError(`Failed to get git files with filter ${filter}`, error);
      return [];
    }
  }

  private categorizeFiles(files: string[]): {
    fieldData: GroupedData;
    otherFiles: string[];
  } {
    const fieldData: GroupedData = {};
    const otherFiles = files.filter((file) => {
      const normalizedFile = this.normalizeRepoPath(file);
      if (!normalizedFile.match(MEMBERTYPE_REGEX.CUSTOM_FIELD)) {
        return true;
      }

      const parts = normalizedFile.split("/");
      const objectIndex = parts.indexOf("objects") + 1;
      const fieldIndex = parts.indexOf("fields") + 1;

      if (objectIndex > 0 && fieldIndex > 0) {
        const objectName = parts[objectIndex];
        const fieldName = parts[fieldIndex].split(".")[0];

        fieldData[objectName] = fieldData[objectName] || { fields: [] };
        fieldData[objectName].fields.push(fieldName);
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

    if (file.includes("/lwc/")) {
      await this.copyLWCComponent(relativePath);
      return;
    }

    await this.copySingleFile(file, relativePath);
  }

  private async copyLWCComponent(relativePath: string): Promise<void> {
    const componentFolder = relativePath.split("/")[1];
    const componentDir = `${this.config.source}/lwc/${componentFolder}`;
    const files = await fs.promises.readdir(componentDir);

    for (const file of files) {
      const sourcePath = path.join(componentDir, file);
      const targetPath = path.join(
        this.config.cliOuputFolder,
        path.relative(this.config.source, sourcePath),
      );

      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.copyFile(sourcePath, targetPath);
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

    const metadataPath = `${file}-meta.xml`;
    if (fs.existsSync(metadataPath)) {
      await fs.promises.copyFile(metadataPath, `${targetPath}-meta.xml`);
    }
  }

  private async generateDestructivePackages(
    types: MetadataType[],
  ): Promise<void> {
    const destructiveDir = path.join(
      this.config.cliOuputFolder,
      "destructiveChanges",
    );

    const destructiveXml = this.xmlHelper.createPackageXml(types);
    await fs.promises.writeFile(
      path.join(destructiveDir, "destructiveChanges.xml"),
      destructiveXml,
    );

    console.log("\n🗑️  Generated destructiveChanges.xml:");
    console.log("----------------------------------");
    console.log(destructiveXml);
    console.log("----------------------------------\n");

    const emptyXml = this.xmlHelper.createEmptyPackageXml();
    await fs.promises.writeFile(
      path.join(destructiveDir, "package.xml"),
      emptyXml,
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

    if (relativePath.match(MEMBERTYPE_REGEX.CUSTOM_FIELD)) {
      return "CustomField";
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

  private reconcileFieldMetadataWithGeneratedObjects(
    fieldData: GroupedData,
    types: MetadataType[],
  ): void {
    const objectNames = Object.keys(fieldData);
    if (!objectNames.length) {
      return;
    }

    const customFieldType = types.find((type) => type.name === "CustomField");
    if (customFieldType) {
      const generatedFieldMembers = new Set(
        objectNames.flatMap((objectName) =>
          fieldData[objectName].fields.map((field) => `${objectName}.${field}`),
        ),
      );

      customFieldType.members = customFieldType.members.filter(
        (member) => !generatedFieldMembers.has(member),
      );
    }

    objectNames.forEach((objectName) => {
      this.addMember("CustomObject", objectName, types);
    });

    for (let index = types.length - 1; index >= 0; index -= 1) {
      if (types[index].members.length === 0) {
        types.splice(index, 1);
      }
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

  private collectFilesFromGitCommand(command: string, files: Set<string>): void {
    try {
      const output = execSync(command, { encoding: "utf8" });
      output
        .split("\n")
        .map((file) => this.normalizeRepoPath(file))
        .filter(Boolean)
        .forEach((file) => files.add(file));
    } catch (error) {
      this.logError(`Failed to collect files from command: ${command}`, error);
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
        execSync("git branch --show-current", { encoding: "utf8" }),
      );
      const originHeadRef = this.normalizeGitRef(
        execSync("git symbolic-ref refs/remotes/origin/HEAD", {
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
    return value.trim();
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
        execSync(`git rev-parse --verify --quiet ${candidate}`, {
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
