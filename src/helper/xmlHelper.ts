import fs from 'fs';
import path from 'path';
import { MetadataType } from 'types/inde.type';
import { FieldProperties, GroupedData } from 'types/xml.type';

import xmlbuilder from "xmlbuilder";

export class XmlHelper {
	// private sourceDirectory: string;
	private outputDirectory: string;

	constructor(outputDirectory: string = './.simpleSfCli_out') {
		// this.sourceDirectory = sourceDirectory;
		this.outputDirectory = outputDirectory;
	}

	public createEmptyPackageXml(version: string = '62.0'): string {
		try {
			const packageXml = xmlbuilder
				.create('Package', { encoding: 'UTF-8' })
				.att('xmlns', 'http://soap.sforce.com/2006/04/metadata');
	
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
			console.log('Creating package.xml with metadata types:', metadataTypes);
			const packageXml = xmlbuilder.create('Package', { encoding: 'UTF-8' }).att('xmlns', 'http://soap.sforce.com/2006/04/metadata');

			// Sort metadata types for consistency
			const sortedTypes = [...metadataTypes].sort((a, b) => a.name.localeCompare(b.name));

			sortedTypes.forEach(({ name, members }) => {
				console.log(`Processing metadata type: ${name} with ${members.length} members ${members}`);
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
		const customFieldRegEx = /objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/;
		const match = filePath.match(customFieldRegEx);

		if (!match) {
			console.error('File path does not match the expected pattern:', filePath);
			return null;
		}

		const [objectName, fieldName] = match;
		return {
			name: 'CustomField',
			members: [`${objectName}.${fieldName}`],
		};
	}

	/**
	 * Transforms XML structure to rename root node to `<CustomObject>` and nests content under `<fields>`.
	 */
	public generateCustomObjectForFields(groupedData: GroupedData): void {
		try {
			Object.keys(groupedData).forEach((objectName) => {
				console.log(`Processing object: ${objectName}`);

				const fields = groupedData[objectName].fields;
				const customObjectXml = xmlbuilder.create('CustomObject', { encoding: 'UTF-8' }).att('xmlns', 'http://soap.sforce.com/2006/04/metadata');

				fields.forEach((field) => {
					const sourceFilePath = `force-app/main/default/objects/${objectName}/fields/${field}.field-meta.xml`;
					const existingXmlContent = fs.readFileSync(sourceFilePath, 'utf-8');

					const match = existingXmlContent.match(/<CustomField[^>]*>([\s\S]*?)<\/CustomField>/);
					if (!match) {
						console.error(`Invalid XML structure in file: ${sourceFilePath}`);
						return;
					}

					const customFieldContent = match[1];
					const fieldProperties = this.extractFieldProperties(customFieldContent);

					const fieldsNode = customObjectXml.ele('fields');
					Object.entries(fieldProperties).forEach(([key, value]) => {
						fieldsNode
							.ele(key)
							.raw(value as string)
							.up();
					});
				});

				const updatedXml = customObjectXml.end({ pretty: true });
				this.saveUpdatedXml(objectName, updatedXml);
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Error transforming XML files: ${errorMessage}`);
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
			xmlbuilder.create(xml);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Sets the source directory for XML operations.
	 */
	// public setSourceDirectory(directory: string): void {
	// 	// this.sourceDirectory = directory;
	// }

	/**
	 * Sets the output directory for XML operations.
	 */
	public setOutputDirectory(directory: string): void {
		this.outputDirectory = directory;
	}

	/**
	 * Extracts field properties from the given XML content.
	 */
	private extractFieldProperties(xmlContent: string): FieldProperties {
		const fieldProperties: FieldProperties = {};
		const propertyRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
		let match;

		while ((match = propertyRegex.exec(xmlContent)) !== null) {
			const [, key, value] = match;
			fieldProperties[key] = value.trim();
		}

		return fieldProperties;
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
			fs.writeFileSync(outputPath, updatedXml, 'utf-8');
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to save XML file for ${objectName}: ${errorMessage}`);
		}
	}
}
