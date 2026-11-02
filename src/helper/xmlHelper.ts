import fs from 'fs';
import path from 'path';
import { MetadataType } from 'types/index.type';
import { GroupedData } from 'types/xml.type';

import xmlbuilder from 'xmlbuilder';
import { CUSTOM_OBJECT_CHILDREN } from './constants.js';

export class XmlHelper {
	private sourceDirectory: string;
	private outputDirectory: string;

	constructor(outputDirectory: string = './.simpleSfCli_out', sourceDirectory: string = 'force-app/main/default') {
		this.sourceDirectory = sourceDirectory;
		this.outputDirectory = outputDirectory;
	}

	public createEmptyPackageXml(version: string = '62.0'): string {
		try {
			const packageXml = xmlbuilder.create('Package', { encoding: 'UTF-8' }).att('xmlns', 'http://soap.sforce.com/2006/04/metadata');

			packageXml.ele('version', version);

			return packageXml.end({ pretty: true });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to create empty package.xml: ${errorMessage}`);
		}
	}

	/**
	 * Generates a package.xml file based on the provided metadata types and their members.
	 */
	public createPackageXml(metadataTypes: MetadataType[]): string {
		try {
			// console.log('Creating package.xml with metadata types:', metadataTypes);
			const packageXml = xmlbuilder.create('Package', { encoding: 'UTF-8' }).att('xmlns', 'http://soap.sforce.com/2006/04/metadata');

			// Sort metadata types for consistency
			const sortedTypes = metadataTypes
				.filter(({ members }) => members.length > 0)
				.sort((a, b) => a.name.localeCompare(b.name));

			sortedTypes.forEach(({ name, members }) => {
				// console.log(`Processing metadata type: ${name} with ${members.length} members ${members}`);
				const types = packageXml.ele('types');

				// Sort members for consistency
				const sortedMembers = [...members].sort();
				sortedMembers.forEach((member) => {
					types.ele('members', member);
				});

				types.ele('name', name);
			});

			packageXml.ele('version', '58.0');
			return packageXml.end({ pretty: true });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to create package.xml: ${errorMessage}`);
		}
	}

	/**
	 * Generates package member details from a given file path.
	 */
	public generatePackageMember(filePath: string): MetadataType | null {
		for (const childConfig of CUSTOM_OBJECT_CHILDREN) {
			const match = filePath.match(childConfig.regex);
			if (match) {
				const objectName = match[1];
				const childName = this.getFieldFullName(filePath) ?? match[2];

				return {
					name: childConfig.typeName,
					members: [childName.includes('.') ? childName : `${objectName}.${childName}`],
				};
			}
		}

		console.error('File path does not match the expected pattern:', filePath);
		return null;
	}

	/**
	 * Transforms XML structure to rename root node to `<CustomObject>` and nests child content under its respective child elements.
	 */
	public generateCustomObjectForFields(groupedData: GroupedData): void {
		try {
			for (const [objectName, objectData] of Object.entries(groupedData)) {
				const customObjectXml = xmlbuilder.create('CustomObject', { encoding: 'UTF-8' })
					.att('xmlns', 'http://soap.sforce.com/2006/04/metadata');
				for (const childConfig of CUSTOM_OBJECT_CHILDREN) {
					const items = objectData[childConfig.folder];
					if (!Array.isArray(items)) continue;
					for (const itemName of items) {
						const sourceFilePath = path.join(
							this.sourceDirectory,
							'objects',
							objectName,
							childConfig.folder,
							`${itemName}${childConfig.extension}`,
						);
						const content = fs.readFileSync(sourceFilePath, 'utf-8');
						const tagRegex = new RegExp(`<${childConfig.typeName}[^>]*>([\\s\\S]*?)<\\/${childConfig.typeName}>`);
						const match = content.match(tagRegex);
						if (!match) throw new Error(`Invalid XML structure in file: ${sourceFilePath}`);
						// Preserve repeated elements, attributes and encoded XML content.
						customObjectXml.ele(childConfig.folder).raw(match[1].trim());
					}
				}
				this.saveUpdatedXml(objectName, customObjectXml.end({ pretty: true }));
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Error transforming XML files: ${message}`);
		}
	}

	/**
	 * Creates XML for a custom field.
	 */
	public createCustomFieldXml(fieldName: string, fieldType: string, properties: Record<string, string> = {}): string {
		try {
			const fieldXml = xmlbuilder.create('CustomField', { encoding: 'UTF-8' }).att('xmlns', 'http://soap.sforce.com/2006/04/metadata');

			fieldXml.ele('fullName', fieldName);
			fieldXml.ele('type', fieldType);

			Object.entries(properties).forEach(([key, value]) => {
				fieldXml.ele(key, value);
			});

			return fieldXml.end({ pretty: true });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to create custom field XML: ${errorMessage}`);
		}
	}

	/**
	 * Validates if a string is valid XML.
	 */
	public isValidXml(xml: string): boolean {
		try {
			// Parse out the root element name and use that for creation
			const rootMatch = xml.match(/<([^\s>/?]+)[\s>]/);
			if (!rootMatch) return false;
			
			const rootElement = rootMatch[1];
			xmlbuilder.create(rootElement);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Sets the source directory for XML operations.
	 */
	public setSourceDirectory(directory: string): void {
		this.sourceDirectory = directory;
	}

	/**
	 * Sets the output directory for XML operations.
	 */
	public setOutputDirectory(directory: string): void {
		this.outputDirectory = directory;
	}

	private getFieldFullName(filePath: string): string | null {
		if (!fs.existsSync(filePath)) {
			return null;
		}

		const xmlContent = fs.readFileSync(filePath, 'utf-8');
		const fullNameMatch = xmlContent.match(/<fullName>\s*([\s\S]*?)\s*<\/fullName>/);
		const fullName = fullNameMatch?.[1]?.trim();

		return fullName || null;
	}

	/**
	 * Saves the updated XML to a file.
	 */
	private saveUpdatedXml(objectName: string, updatedXml: string): void {
		try {
			const outputDir = path.join(this.outputDirectory, 'objects');

			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const outputPath = path.join(outputDir, `${objectName}.object`);
			if (fs.existsSync(outputPath)) {
				const objectXml = fs.readFileSync(outputPath, 'utf-8');
				const fieldsContent = updatedXml.match(/<CustomObject[^>]*>([\s\S]*)<\/CustomObject>/)?.[1];
				if (!fieldsContent || !/<\/CustomObject>\s*$/.test(objectXml)) {
					throw new Error(`Invalid CustomObject payload: ${outputPath}`);
				}
				updatedXml = objectXml.replace(/<\/CustomObject>\s*$/, `${fieldsContent}\n</CustomObject>`);
			}
			fs.writeFileSync(outputPath, updatedXml, 'utf-8');
			// console.log(`Saved updated XML for ${objectName} to: ${outputPath}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to save XML file for ${objectName}: ${errorMessage}`);
		}
	}
}
