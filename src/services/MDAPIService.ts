// src/services/MDAPIService.ts
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { BaseService } from './BaseService.js';
import { GroupedData } from 'types/xml.type.js';
import { MetadataType } from 'types/index.js';
import { MEMBERTYPE_REGEX, METADATA_TYPES } from '../helper/constants.js';
import { XmlHelper } from '../helper/xmlHelper.js';
import { CommandArgsConfig } from 'types/config.js';

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
	async convertToMDAPI(sourceDir: string, targetDir: string, excludeList: string[] = []): Promise<string[]> {
		try {
			console.log(`Starting conversion of SFDX source from ${sourceDir} to MDAPI format...`);

			// Ensure target directory exists
			await this.ensureDirectoryExists(targetDir);

			// Get changed files from git
			const { groupedData, changedFiles, restChangedFiles } = await this.getChangedFiles();

			console.log('Changed files:', changedFiles);

			if (changedFiles.length === 0) {
				console.log('No relevant files found in the Git diff. Exiting...');
				return [];
			}

			// Generate custom objects for fields if needed
			await this.generateCustomObjectForFields(groupedData);

			const metadataTypes: MetadataType[] = [];
			const excludedComponents: string[] = [];
			const runTests: string[] = [];

			// Copy files and their metadata
			await this.processFilesForCopy(targetDir, restChangedFiles);

			// Process changed files for package.xml
			await this.processChangedFilesForPackage(changedFiles, excludeList, metadataTypes, excludedComponents, runTests);

			// Generate package.xml
			if (metadataTypes.length > 0) {
				await this.generatePackageXmlFile(metadataTypes, targetDir);
			} else {
				throw new Error('No metadata found for package.xml');
			}

			// Display excluded components if any
			if (excludedComponents.length > 0) {
				console.log('The following components were excluded:');
				excludedComponents.forEach((type) => console.log(`- ${type}`));
			}

			console.log('Conversion to MDAPI format completed successfully.');
			return runTests;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error during MDAPI conversion';
			throw new Error(`MDAPI conversion failed: ${errorMessage}`);
		}
	}

	/**
	 * Ensure the target directory exists
	 */
	private async ensureDirectoryExists(dir: string): Promise<void> {
		try {
			await fs.promises.mkdir(dir, { recursive: true });
		} catch (error) {
			throw new Error(`Failed to create directory ${dir}: ${error}`);
		}
	}

	/**
	 * Get files changed in the latest Git commit
	 */
	private async getChangedFiles(): Promise<ChangedFilesResult> {
		try {
			const changedFiles = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' })
				.split('\n')
				.filter((file) => file.startsWith('force-app/main/default/') && file.trim() !== '');

			const groupedData = this.groupChangedFilesByObject(changedFiles);
			const restChangedFiles = changedFiles.filter((path) => !path.includes('objects') && !path.includes('fields'));

			return { groupedData, changedFiles, restChangedFiles };
		} catch (error) {
			throw new Error('Failed to get changed files from git');
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
	private async processFilesForCopy(targetDir: string, files: string[]): Promise<void> {
		for (const file of files) {
			await this.copyFileWithMetadata(file, targetDir);
		}
	}

	/**
	 * Process changed files for package.xml generation
	 */
	private async processChangedFilesForPackage(changedFiles: string[], excludeList: string[], metadataTypes: MetadataType[], excludedComponents: string[], runTests: string[]): Promise<void> {
		for (const file of changedFiles) {
			const relativePath = path.relative('force-app/main/default', file);
			const folder = this.getMetadataFolder(relativePath);

			if (!folder) {
				console.log(`Skipping file: ${file} (unknown metadata type)`);
				continue;
			}

			const type = METADATA_TYPES[folder];

			if (excludeList.includes(type)) {
				if (!excludedComponents.includes(type)) {
					excludedComponents.push(type);
				}
				continue;
			}

			const memberName = this.generateMemberName(file);
			if (memberName) {
				this.addMemberToMetadataTypes(type, memberName, metadataTypes);
			}

			// Handle Apex test classes
			if (type === 'ApexClass') {
				const baseFileName = path.basename(file, '.cls');
				if (await this.isTestClass(file)) {
					runTests.push(baseFileName);
				}
			}
		}
	}

	/**
	 * Get metadata folder from file path
	 */
	private getMetadataFolder(relativePath: string): string | null {
		if (relativePath.match(MEMBERTYPE_REGEX.CUSTOM_FIELD)) {
			return 'fields';
		}

		return Object.keys(METADATA_TYPES).find((folder) => relativePath.startsWith(folder)) || null;
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
	private async generatePackageXmlFile(metadataTypes: MetadataType[], targetDir: string): Promise<void> {
		const xmlHelper = new XmlHelper();
		const packageXmlContent = xmlHelper.createPackageXml(metadataTypes);
		const packageXmlPath = path.join(targetDir, 'package.xml');
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
			const content = await fs.promises.readFile(filePath, 'utf8');
			return content.includes('@isTest') || content.includes('testMethod');
		} catch (error) {
			console.error(`Error reading file ${filePath}:`, error);
			return false;
		}
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
}
