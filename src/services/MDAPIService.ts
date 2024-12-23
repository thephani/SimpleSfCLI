// src/services/MDAPIService.ts
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BaseService } from './BaseService.js';
import { GroupedData } from 'types/xml.type.js';
import { MetadataType } from 'types/index.type.js';
import { XmlHelper } from '../helper/xmlHelper.js';
import { CommandArgsConfig } from 'types/config.type.js';
import { MEMBERTYPE_REGEX, METADATA_TYPES } from '../helper/constants.js';

interface ChangedFilesResult {
	groupedData: GroupedData;
	changedFiles: string[];
	restChangedFiles: string[];
}

export class MDAPIService extends BaseService {
	private xmlHelper: XmlHelper;

	constructor(config: CommandArgsConfig) {
		super(config);
		this.xmlHelper = new XmlHelper();
	}
	/**
	 * Convert SFDX source to MDAPI format
	 */
	async convertToMDAPI(excludeList: string[] = []): Promise<string[]> {
		try {
			console.log(`🚀 Starting SFDX to MDAPI conversion...`);

			await this.initializeDirectories();

			const runTests: string[] = [];
			await this.handleDeletedMetadata(excludeList);
			await this.handleModifiedMetadata(excludeList, runTests);

			console.log('✅ Conversion completed successfully.');
			return runTests;
		} catch (error) {
			this.handleError('MDAPI conversion failed', error);
			throw error;
		}
	}

	/**
	 * Initialize and clean up directories
	 */
	private async initializeDirectories(): Promise<void> {
		try {
			if (fs.existsSync(this.config.cliOuputFolder)) {
				await fs.promises.rm(this.config.cliOuputFolder, { recursive: true, force: true });
				console.log(`🗑️  Cleaned existing directory: ${this.config.cliOuputFolder}`);
			}

			await fs.promises.mkdir(this.config.cliOuputFolder, { recursive: true });
			await fs.promises.mkdir(path.join(this.config.cliOuputFolder, 'destructiveChanges'), { recursive: true });
			console.log(`📁 Cleanedup directories`);
		} catch (error) {
			this.handleError('Failed to initialize directories', error);
		}
	}

	/**
	 * Handle deleted metadata files
	 */
	private async handleDeletedMetadata(excludeList: string[]): Promise<void> {
		const deletedFiles = await this.getDeletedFiles();

		if (deletedFiles.length === 0) {
			console.log('ℹ️  No deleted files detected');
			return;
		}

		console.log(`🗑️  Processing ${deletedFiles.length} deleted files...`);
		const metadataTypes: MetadataType[] = [];
		const excludedComponents: string[] = [];

		await this.processChangedFilesForPackage(deletedFiles, excludeList, metadataTypes, excludedComponents, []);

		if (metadataTypes.length === 0) {
			return;
		}

		await this.generateDestructiveChanges(metadataTypes);
	}

	private async generateDestructiveChanges(metadataTypes: MetadataType[]): Promise<void> {
		try {
			const destructiveFolder = path.join(this.config.cliOuputFolder, 'destructiveChanges');

			// Generate destructiveChanges.xml
			const destructiveXml = this.xmlHelper.createPackageXml(metadataTypes);
			const destructivePath = path.join(destructiveFolder, 'destructiveChanges.xml');

			console.log('\n🗑️  Generated destructiveChanges.xml:');
			console.log('----------------------------------');
			console.log(destructiveXml);
			console.log('----------------------------------\n');

			await fs.promises.writeFile(destructivePath, destructiveXml);

			// Generate empty package.xml
			const emptyPackageXml = this.xmlHelper.createEmptyPackageXml();
			const packagePath = path.join(destructiveFolder, 'package.xml');

			console.log('\n📦 Generated empty package.xml:');
			console.log('---------------------------');
			console.log(emptyPackageXml);
			console.log('---------------------------\n');

			await fs.promises.writeFile(packagePath, emptyPackageXml);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error('❌ Error generating destructive changes:', errorMessage);
			throw new Error(`Failed to generate destructive changes: ${errorMessage}`);
		}
	}

	/**
	 * Handle modified metadata files
	 */
	private async handleModifiedMetadata(excludeList: string[], runTests: string[]): Promise<void> {
		const { groupedData, changedFiles, restChangedFiles } = await this.getChangedFiles();

		if (changedFiles.length === 0) {
			console.log('ℹ️  No modified files detected. Exiting...');
			return;
		}

		console.log(`📝 Processing ${changedFiles.length} modified files...`);

		if (Object.keys(groupedData).length > 0) {
			await this.generateCustomObjectForFields(groupedData);
		}

		await this.processFilesForCopy(restChangedFiles);

		const metadataTypes: MetadataType[] = [];
		const excludedComponents: string[] = [];

		await this.processChangedFilesForPackage(changedFiles, excludeList, metadataTypes, excludedComponents, runTests);

		if (metadataTypes.length === 0) {
			throw new Error('No metadata found for package.xml');
		}

		await this.generatePackageXml(metadataTypes);
		this.logExcludedComponents(excludedComponents);
	}

	/**
	 * Get modified files from git
	 */
	private async getChangedFiles(): Promise<ChangedFilesResult> {
		try {
			const changedFiles = this.executeGitCommand('diff --diff-filter=AM --name-only HEAD~1 HEAD');
			const groupedData = this.groupChangedFilesByObject(changedFiles);
			const restChangedFiles = changedFiles.filter((path) => !path.includes('objects') && !path.includes('fields'));

			return { groupedData, changedFiles, restChangedFiles };
		} catch (error) {
			this.handleError('Failed to get changed files', error);
			return { groupedData: {}, changedFiles: [], restChangedFiles: [] };
		}
	}

	/**
	 * Get deleted files from git
	 */
	private async getDeletedFiles(): Promise<string[]> {
		try {
			return this.executeGitCommand('diff --diff-filter=D --name-only HEAD~1 HEAD');
		} catch (error) {
			this.handleError('Failed to get deleted files', error);
			return [];
		}
	}

	/**
	 * Execute git command and filter results
	 */
	private executeGitCommand(command: string): string[] {
		return execSync(`git ${command}`, { encoding: 'utf8' })
			.split('\n')
			.filter((file) => file.startsWith('force-app/main/default/') && file.trim() !== '');
	}

	/**
	 * Process files for package.xml generation
	 */
	private async processChangedFilesForPackage(files: string[], excludeList: string[], metadataTypes: MetadataType[], excludedComponents: string[], runTests: string[]): Promise<void> {
		for (const file of files) {
			const type = this.getMetadataType(file);
			if (!type || excludeList.includes(type)) {
				if (type && !excludedComponents.includes(type)) {
					excludedComponents.push(type);
				}
				continue;
			}

			const memberName = await this.generateMemberName(file);
			if (memberName) {
				this.addMemberToMetadataTypes(type, memberName, metadataTypes);
			}

			if (type === 'ApexClass' && (await this.isTestClass(file))) {
				runTests.push(path.basename(file, '.cls'));
			}
		}
	}

	/**
	 * Group changed files by their object names
	 */
	private groupChangedFilesByObject(changedFiles: string[]): GroupedData {
		const groupedData: GroupedData = {};

		changedFiles.forEach((filePath) => {
			const pathParts = filePath.split('/');
			const objectIndex = pathParts.indexOf('objects') + 1;
			const fieldIndex = pathParts.indexOf('fields') + 1;

			if (objectIndex > 0 && fieldIndex > 0) {
				const objectName = pathParts[objectIndex];
				const fieldName = pathParts[fieldIndex].split('.')[0];

				if (!groupedData[objectName]) {
					groupedData[objectName] = { fields: [] };
				}

				groupedData[objectName].fields.push(fieldName);
			}
		});

		return groupedData;
	}

	/**
	 * Process files for copying to target directory
	 */
	private async processFilesForCopy(files: string[]): Promise<void> {
		for (const file of files) {
			console.log(`Copying file: ${file}`);
			await this.copyFileWithMetadata(file, this.config.cliOuputFolder);
		}
	}

	/**
	 * Log excluded components with proper formatting
	 */
	private logExcludedComponents(excludedComponents: string[]): void {
		if (excludedComponents.length === 0) {
			return;
		}

		console.log('\n⚠️  Excluded Components:');
		console.log('------------------------');
		excludedComponents.forEach((component) => {
			console.log(`  • ${component}`);
		});
		console.log('------------------------\n');
	}

	/**
	 * Get metadata type from file path
	 */
	private getMetadataType(filePath: string): string | null {
		try {
			const relativePath = path.relative('force-app/main/default', filePath);

			// Check for custom fields first
			if (relativePath.match(MEMBERTYPE_REGEX.CUSTOM_FIELD)) {
				return 'CustomField';
			}

			// Check other metadata types
			const folder = Object.keys(METADATA_TYPES).find((folder) => relativePath.startsWith(folder));

			if (!folder) {
				console.log(`⚠️  Unknown metadata type for file: ${filePath}`);
				return null;
			}

			return METADATA_TYPES[folder];
		} catch (error) {
			console.error(`❌ Error determining metadata type for ${filePath}:`, error);
			return null;
		}
	}

	/**
	 * Generate member name for package.xml
	 */
	private generateMemberName(file: string): string | null {
		const baseFileName = path.basename(file);

		const extensionMap: Record<string, string> = {
			'.cls': '',
			'.trigger': '',
			'.page': '',
			'.component': '',
			'.md-meta.xml': '',
			'.workflow-meta.xml': '',
			'.standardValueSet-meta.xml': '',
		};

		for (const [ext, replacement] of Object.entries(extensionMap)) {
			if (file.endsWith(ext)) {
				return baseFileName.replace(ext, replacement);
			}
		}

		const xmlHelper = new XmlHelper();

		const packageMember = xmlHelper.generatePackageMember(file);
		return packageMember?.members?.[0] || null;
	}

	/**
	 * Add member to metadata types array
	 */
	private addMemberToMetadataTypes(type: string, memberName: string, metadataTypes: MetadataType[]): void {
		const existingType = metadataTypes.find((item) => item.name === type);
		if (existingType) {
			if (!existingType.members.includes(memberName)) {
				existingType.members.push(memberName);
			}
		} else {
			metadataTypes.push({ name: type, members: [memberName] });
		}
	}

	/**
	 * Generate package.xml file
	 */
	private async generatePackageXml(metadataTypes: MetadataType[]): Promise<void> {
		const xmlHelper = new XmlHelper();
		const packageXmlContent = xmlHelper.createPackageXml(metadataTypes);
		console.log('\n📦 Generated package.xml:');
		console.log('---------------------------');
		console.log(packageXmlContent);
		console.log('---------------------------\n');
		const packageXmlPath = path.join(this.config.cliOuputFolder, 'package.xml');
		await fs.promises.writeFile(packageXmlPath, packageXmlContent);
	}

	/**
	 * Copy file and its metadata to target directory
	 */
	private async copyFileWithMetadata(file: string, targetDir: string): Promise<void> {
		const relativePath = path.relative('force-app/main/default', file);
		let targetFilePath = path.join(targetDir, relativePath);

		// Create target directory if it doesn't exist
		await fs.promises.mkdir(path.dirname(targetFilePath), { recursive: true });

		// Handle .md-meta.xml files
		if (relativePath.endsWith('.md-meta.xml')) {
			targetFilePath = targetFilePath.replace('.md-meta.xml', '.md');
		}

		// Copy main file
		await fs.promises.copyFile(file, targetFilePath);

		// Copy metadata file if it exists
		const metadataFilePath = `${file}-meta.xml`;
		if (fs.existsSync(metadataFilePath)) {
			const targetMetadataFilePath = `${targetFilePath}-meta.xml`;
			await fs.promises.copyFile(metadataFilePath, targetMetadataFilePath);
		}
	}

	/**
	 * Check if a file is an Apex test class
	 */
	private async isTestClass(filePath: string): Promise<boolean> {
		try {
			if (fs.existsSync(filePath)) {
				const content = await fs.promises.readFile(filePath, 'utf8');
				return content.includes('@isTest') || content.includes('testMethod');
			}
		} catch (error) {
			console.error(`Error reading file ${filePath}:`, error);
		}
		return false;
	}

	/**
	 * Generate custom objects for fields
	 */
	private async generateCustomObjectForFields(groupedData: GroupedData): Promise<void> {
		try {
			await this.xmlHelper.generateCustomObjectForFields(groupedData);
		} catch (error) {
			throw new Error(`Failed to generate custom objects: ${error}`);
		}
	}

	/**
	 * Handle errors consistently
	 */
	private handleError(message: string, error: unknown): void {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error(`❌ ${message}: ${errorMessage}`);
		if (error instanceof Error && error.stack) {
			console.debug('Stack trace:', error.stack);
		}
	}
}
