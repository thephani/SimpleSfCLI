import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BaseService } from './BaseService.js';
import { GroupedData } from 'types/xml.type.js';
import { MetadataType } from 'types/index.type.js';
import { XmlHelper } from '../helper/xmlHelper.js';
import { CommandArgsConfig } from 'types/config.type.js';
import { MEMBERTYPE_REGEX, METADATA_EXTENSIONS, METADATA_TYPES, SUPPORTED_METADATA_TYPES, UNSUPPORTED_METADATA_TYPES } from '../helper/constants.js';

export class MDAPIService extends BaseService {
  private xmlHelper: XmlHelper;

  constructor(config: CommandArgsConfig) {
    super(config);
    this.xmlHelper = new XmlHelper(config.cliOuputFolder);
  }

  async convertToMDAPI(excludeList: string[] = []): Promise<string[]> {
    try {
      await this.initializeDirectories();

      const runTests: string[] = [];
      await this.processDeletedMetadata(excludeList);
      await this.processModifiedMetadata(excludeList, runTests);

      return runTests;
    } catch (error) {
      this.handleError('MDAPI conversion failed', error);
      throw error;
    }
  }

  private async initializeDirectories(): Promise<void> {
    const { cliOuputFolder } = this.config;

    if (fs.existsSync(cliOuputFolder)) {
      await fs.promises.rm(cliOuputFolder, { recursive: true, force: true });
      console.log(`🗑️  Cleaned existing directory: ${this.config.cliOuputFolder}`);
    }

    await fs.promises.mkdir(cliOuputFolder, { recursive: true });
    await fs.promises.mkdir(path.join(cliOuputFolder, 'destructiveChanges'), { recursive: true });
  }

  private async processDeletedMetadata(excludeList: string[]): Promise<void> {
    const deletedFiles = await this.getGitFiles('D');
    if (!deletedFiles.length) {
      console.log('ℹ️  No deleted files detected');
      return;
    }

    const metadataTypes: MetadataType[] = [];
    const excludedComponents: string[] = [];
    console.log(`🗑️  Processing ${deletedFiles.length} deleted files...`);

    await this.processMetadataFiles(deletedFiles, excludeList, metadataTypes, excludedComponents, []);

    if (metadataTypes.length) {
      await this.generateDestructivePackages(metadataTypes);
    }
  }

  private async processModifiedMetadata(excludeList: string[], runTests: string[]): Promise<void> {
    const changedFiles = await this.getGitFiles('AM');
    console.log(`🔄  Processing ${changedFiles.length} modified files...`, changedFiles);
    if (!changedFiles.length) {
      console.log('No modified files detected');
      return;
    }

    const { fieldData, otherFiles } = this.categorizeFiles(changedFiles);

    // Use xmlHelper to generate custom object for fields
    if (Object.keys(fieldData).length) {
      this.xmlHelper.generateCustomObjectForFields(fieldData);
    }

    await this.copyFiles(otherFiles);

    const metadataTypes: MetadataType[] = [];
    const excludedComponents: string[] = [];

    await this.processMetadataFiles(changedFiles, excludeList, metadataTypes, excludedComponents, runTests);

    if (!metadataTypes.length) {
      throw new Error(`No supported metadata found. Supported types: ${Object.values(METADATA_TYPES)}`);
    }

    await this.generatePackageXml(metadataTypes);
    this.logExcludedComponents(excludedComponents);
  }

  private async getGitFiles(filter: string): Promise<string[]> {
    try {
      return execSync(`git diff --diff-filter=${filter} --name-only HEAD~1 HEAD`, { encoding: 'utf8' })
        .split('\n')
        .filter(file => file.startsWith('force-app/main/default/') && file.trim());
    } catch (error) {
      this.handleError(`Failed to get git files with filter ${filter}`, error);
      return [];
    }
  }

  private categorizeFiles(files: string[]): { fieldData: GroupedData; otherFiles: string[] } {
    const fieldData: GroupedData = {};
    const otherFiles = files.filter(file => {
      const parts = file.split('/');
      const objectIndex = parts.indexOf('objects') + 1;
      const fieldIndex = parts.indexOf('fields') + 1;

      if (objectIndex > 0 && fieldIndex > 0) {
        const objectName = parts[objectIndex];
        const fieldName = parts[fieldIndex].split('.')[0];

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
      console.log('Copying file:', file);
      await this.copyFileWithMetadata(file);
    }
  }

  private async copyFileWithMetadata(file: string): Promise<void> {
    const relativePath = path.relative(this.config.source, file);

    if (file.includes('/lwc/')) {
      await this.copyLWCComponent(relativePath);
      return;
    }

    if (file.includes('/aura/')) {
      await this.copyAuraComponent(relativePath);
      return;
    }

    await this.copySingleFile(file, relativePath);
  }

  private async copyLWCComponent(relativePath: string): Promise<void> {
    const componentFolder = relativePath.split('/')[1];
    const componentDir = `${this.config.source}/lwc/${componentFolder}`;
    const files = await fs.promises.readdir(componentDir);

    for (const file of files) {
      const sourcePath = path.join(componentDir, file);
      const targetPath = path.join(
        this.config.cliOuputFolder,
        path.relative(this.config.source, sourcePath)
      );

      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.copyFile(sourcePath, targetPath);
    }
  }

  private async copyAuraComponent(relativePath: string): Promise<void> {
    const bundleFolder = relativePath.split('/')[1];
    const bundleDir = `${this.config.source}/aura/${bundleFolder}`;
    const files = await fs.promises.readdir(bundleDir);

    for (const file of files) {
      const sourcePath = path.join(bundleDir, file);
      const targetPath = path.join(
        this.config.cliOuputFolder,
        path.relative(this.config.source, sourcePath)
      );

      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.copyFile(sourcePath, targetPath);
    }
  }

  private async copySingleFile(file: string, relativePath: string): Promise<void> {
    let targetPath = path.join(this.config.cliOuputFolder, relativePath);

    if (relativePath.endsWith('.md-meta.xml')) {
      targetPath = targetPath.replace('.md-meta.xml', '.md');
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(file, targetPath);

    const metadataPath = `${file}-meta.xml`;
    if (fs.existsSync(metadataPath)) {
      await fs.promises.copyFile(
        metadataPath,
        `${targetPath}-meta.xml`
      );
    }
  }

  private async generateDestructivePackages(types: MetadataType[]): Promise<void> {
    const destructiveDir = path.join(this.config.cliOuputFolder, 'destructiveChanges');

    // Use xmlHelper's createPackageXml method
    const destructiveXml = this.xmlHelper.createPackageXml(types);
    await fs.promises.writeFile(
      path.join(destructiveDir, 'destructiveChanges.xml'),
      destructiveXml
    );

    console.log('\n🗑️  Generated destructiveChanges.xml:');
    console.log('----------------------------------');
    console.log(destructiveXml);
    console.log('----------------------------------\n');

    // Use xmlHelper's createEmptyPackageXml method
    const emptyXml = this.xmlHelper.createPackageXml(); // Defaults to empty package
    await fs.promises.writeFile(
      path.join(destructiveDir, 'package.xml'),
      emptyXml
    );
  }

  private async processMetadataFiles(files: string[], excludeList: string[], types: MetadataType[], excluded: string[], runTests: string[]): Promise<void> {
    // console.log('Processing metadata files...', files);
    for (const file of files) {
      console.log('Processing Metadata file:', file);
      const type = this.getMetadataType(file);
      console.log('Metadata Type:', type);
      if (!type || excludeList?.includes(type)) {
        if (type && !excluded.includes(type)) {
          excluded.push(type);
        }
        continue;
      }


      const memberName = this.getMemberName(file);
      if (memberName) {
        this.addMember(type, memberName, types);
      }

      if (type === 'ApexClass' && await this.isTestClass(file)) {
        runTests.push(path.basename(file, '.cls'));
      }
    }
  }

  private getMetadataType(file: string): string | null {
    const relativePath = path.relative('force-app/main/default', file);
    console.log('Relative Path:', relativePath);

    // Object child metadata patterns
    if (relativePath.match(MEMBERTYPE_REGEX.CUSTOM_FIELD)) return 'CustomField';
    if (relativePath.match(MEMBERTYPE_REGEX.RECORD_TYPE)) return 'RecordType';
    if (relativePath.match(MEMBERTYPE_REGEX.LIST_VIEW)) return 'ListView';
    if (relativePath.match(MEMBERTYPE_REGEX.FIELD_SET)) return 'FieldSet';
    if (relativePath.match(MEMBERTYPE_REGEX.COMPACT_LAYOUT)) return 'CompactLayout';
    if (relativePath.match(MEMBERTYPE_REGEX.VALIDATION_RULE)) return 'ValidationRule';
    if (relativePath.match(MEMBERTYPE_REGEX.WEB_LINK)) return 'WebLink';
    if (relativePath.match(MEMBERTYPE_REGEX.BUSINESS_PROCESS)) return 'BusinessProcess';
    if (relativePath.match(MEMBERTYPE_REGEX.SHARING_REASON)) return 'SharingReason';

    const folder = Object.keys(METADATA_TYPES)
      .find(folder => relativePath.startsWith(folder));

    let derived: string | null = null;
    if (folder) derived = METADATA_TYPES[folder];
    if (!derived) derived = this.inferTypeFromMetaXml(file);

    if (!derived) return null;
    if (UNSUPPORTED_METADATA_TYPES.has(derived)) return null;
    if (!SUPPORTED_METADATA_TYPES.has(derived)) return null;
    return derived;
  }

  private getMemberName(file: string): string | null {
    const fileName = path.basename(file);
    const relativePath = path.relative('force-app/main/default', file);

    // Object child metadata: return ObjectName.MemberName
    const objectChildPatterns: Array<{ regex: RegExp }> = [
      { regex: MEMBERTYPE_REGEX.CUSTOM_FIELD },
      { regex: MEMBERTYPE_REGEX.RECORD_TYPE },
      { regex: MEMBERTYPE_REGEX.LIST_VIEW },
      { regex: MEMBERTYPE_REGEX.FIELD_SET },
      { regex: MEMBERTYPE_REGEX.COMPACT_LAYOUT },
      { regex: MEMBERTYPE_REGEX.VALIDATION_RULE },
      { regex: MEMBERTYPE_REGEX.WEB_LINK },
      { regex: MEMBERTYPE_REGEX.BUSINESS_PROCESS },
      { regex: MEMBERTYPE_REGEX.SHARING_REASON },
    ];
    for (const { regex } of objectChildPatterns) {
      const m = relativePath.match(regex);
      if (m) return `${m[1]}.${m[2]}`;
    }

    // Folder-based types where member should include folder path (Folder/Member)
    const folderBased = ['reports', 'dashboards', 'documents', 'email'];
    const folder = folderBased.find(f => relativePath.startsWith(f + '/'));
    if (folder) {
      const parts = relativePath.split('/');
      // parts: [folder, subfolder, filename]
      if (parts.length >= 3) {
        const subfolder = parts[1];
        const base = this.stripKnownExtensions(path.basename(relativePath));
        return `${subfolder}/${base}`;
      }
    }

    for (const [ext, replacement] of Object.entries(METADATA_EXTENSIONS)) {
      if (file.endsWith(ext)) return fileName.replace(ext, replacement);
    }

    const packageMember = this.xmlHelper.generatePackageMember(file);
    return packageMember?.members?.[0] || null;
  }

  private stripKnownExtensions(name: string): string {
    for (const ext of Object.keys(METADATA_EXTENSIONS)) {
      if (name.endsWith(ext)) return name.slice(0, -ext.length);
    }
    // Fallback to remove common meta suffixes
    return name.replace(/-meta\.xml$/, '').replace(/\.[^.]+$/, '');
  }

  private addMember(type: string, name: string, types: MetadataType[]): void {
    const existingType = types.find(t => t.name === type);
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
      const content = await fs.promises.readFile(file, 'utf8');
      return content.includes('@isTest') || content.includes('testMethod');
    } catch {
      return false;
    }
  }

  private async generatePackageXml(types: MetadataType[]): Promise<void> {
    // Use xmlHelper's createPackageXml method
    const packageXml = this.xmlHelper.createPackageXml(types);
    await fs.promises.writeFile(
      path.join(this.config.cliOuputFolder, 'package.xml'),
      packageXml
    );

    console.log('\n📦 Generated package.xml:');
    console.log('---------------------------');
    console.log(packageXml);
    console.log('---------------------------\n');
  }

  private inferTypeFromMetaXml(file: string): string | null {
    try {
      let metaPath = file;
      if (!file.endsWith('-meta.xml')) {
        const candidate = `${file}-meta.xml`;
        if (fs.existsSync(candidate)) metaPath = candidate;
      }

      if (!metaPath.endsWith('-meta.xml')) return null;

      const content = fs.readFileSync(metaPath, 'utf8');
      const root = content.match(/<([A-Za-z0-9_:-]+)[\s>]/);
      if (root && root[1]) {
        // Remove namespace prefixes like met:Type
        const type = root[1].includes(':') ? root[1].split(':')[1] : root[1];
        return type;
      }
    } catch (e) {
      // ignore and return null
    }
    return null;
  }

  // Logging method for excluded components
  private logExcludedComponents(components: string[]): void {
    if (!components.length) return;

    console.log('\n⚠️  Excluded Components:');
    console.log('------------------------');
    components.forEach(c => console.log(`  • ${c}`));
    console.log('------------------------\n');
  }

  // Error handling method
  private handleError(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ ${message}: ${errorMessage}`);

    if (error instanceof Error && error.stack) {
      console.debug('Stack trace:', error.stack);
    }
  }
}
