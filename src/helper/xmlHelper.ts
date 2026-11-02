import fs from 'fs';
import path from 'path';
import defaultConfig from '../config.js';
import type { MetadataType } from '../types/index.type.js';
import type { GroupedData } from '../types/xml.type.js';

import xmlbuilder from 'xmlbuilder';

export class XmlHelper {
	private sourceDirectory: string;
	private outputDirectory: string;
	private apiVersion: string;

	constructor(
		outputDirectory: string = './.simpleSfCli_out',
		sourceDirectory: string = 'force-app/main/default',
		apiVersion: string = defaultConfig.sfVersion,
	) {
		this.sourceDirectory = sourceDirectory;
		this.outputDirectory = outputDirectory;
		this.apiVersion = this.normalizeVersion(apiVersion);
	}

	private normalizeVersion(version?: string): string {
		const rawVersion = (version || defaultConfig.sfVersion || '62.0').trim();
		return rawVersion.replace(/^v/i, '');
	}

	public createEmptyPackageXml(version: string = this.apiVersion): string {
		try {
			const packageXml = xmlbuilder.create('Package', { encoding: 'UTF-8' }).att('xmlns', 'http://soap.sforce.com/2006/04/metadata');

			packageXml.ele('version', this.normalizeVersion(version));

			return packageXml.end({ pretty: true });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			throw new Error(`Failed to create empty package.xml: ${errorMessage}`);
		}
	}

	/**
	 * Generates a package.xml file based on the provided metadata types and their members.
	 */
	public createPackageXml(metadataTypes: MetadataType[], version: string = this.apiVersion): string {
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

			packageXml.ele('version', this.normalizeVersion(version));
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

		//1. first captured group (object name) 2. second captured group (field name)
		const objectName = match[1];
		const fieldName = this.getFieldFullName(filePath) ?? match[2];

		return {
			name: 'CustomField',
			members: [fieldName.includes('.') ? fieldName : `${objectName}.${fieldName}`],
		};
	}

	/**
	 * Transforms XML structure to rename root node to `<CustomObject>` and nests content under `<fields>`.
	 */
	public generateCustomObjectForFields(groupedData: GroupedData): void {
		try {
			for (const [objectName, { fields }] of Object.entries(groupedData)) {
				const customObjectXml = xmlbuilder.create('CustomObject', { encoding: 'UTF-8' })
					.att('xmlns', 'http://soap.sforce.com/2006/04/metadata');
				for (const field of fields) {
					const sourceFilePath = path.join(this.sourceDirectory, 'objects', objectName, 'fields', `${field}.field-meta.xml`);
					const content = fs.readFileSync(sourceFilePath, 'utf-8');
					const match = content.match(/<CustomField[^>]*>([\s\S]*?)<\/CustomField>/);
					if (!match) throw new Error(`Invalid XML structure in file: ${sourceFilePath}`);
					// Preserve repeated elements, attributes and encoded XML content.
					customObjectXml.ele('fields').raw(match[1].trim());
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
		if (!xml || typeof xml !== 'string') {
			return false;
		}

		let working = xml.trim();
		if (!working.startsWith('<') || !working.endsWith('>')) {
			return false;
		}

		// Handle optional XML declaration at the beginning
		if (working.startsWith('<?xml')) {
			const declMatch = working.match(/^<\?xml(?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"]*"|'[^']*'))+\s*\?>\s*/);
			if (!declMatch) {
				return false;
			}
			working = working.slice(declMatch[0].length);
		}

		// Disallow any subsequent XML declarations
		if (/<\?xml\b/i.test(working)) {
			return false;
		}

		// Check for unclosed comments or CDATA sections, then strip valid ones
		const commentStarts = (working.match(/<!--/g) || []).length;
		const commentEnds = (working.match(/-->/g) || []).length;
		if (commentStarts !== commentEnds) {
			return false;
		}
		working = working.replace(/<!--[\s\S]*?-->/g, '');

		const cdataStarts = (working.match(/<!\[CDATA\[/g) || []).length;
		const cdataEnds = (working.match(/\]\]>/g) || []).length;
		if (cdataStarts !== cdataEnds) {
			return false;
		}
		working = working.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

		const stack: string[] = [];
		let hasRoot = false;
		let lastIndex = 0;
		const tagRegex = /<[^>]*>/g;
		const closingTagPattern = /^<\/([A-Za-z_][\w:.-]*)\s*>$/;
		const openTagPattern = /^<([A-Za-z_][\w:.-]*)((?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>$/;

		let match: RegExpExecArray | null;
		while ((match = tagRegex.exec(working)) !== null) {
			const betweenText = working.slice(lastIndex, match.index);
			if (betweenText.includes('<') || betweenText.includes('>')) {
				return false;
			}
			if (stack.length === 0 && betweenText.trim().length > 0) {
				return false;
			}

			const token = match[0];
			lastIndex = tagRegex.lastIndex;

			const closeMatch = token.match(closingTagPattern);
			if (closeMatch) {
				const tagName = closeMatch[1];
				if (stack.length === 0 || stack[stack.length - 1] !== tagName) {
					return false;
				}
				stack.pop();
				continue;
			}

			const openMatch = token.match(openTagPattern);
			if (!openMatch) {
				return false;
			}

			if (hasRoot && stack.length === 0) {
				// Extra root-level element after root closed
				return false;
			}

			const tagName = openMatch[1];
			const selfClosing = openMatch[3] === '/';
			hasRoot = true;

			if (!selfClosing) {
				stack.push(tagName);
			}
		}

		const trailingText = working.slice(lastIndex);
		if (trailingText.includes('<') || trailingText.includes('>') || trailingText.trim().length > 0) {
			return false;
		}

		return hasRoot && stack.length === 0;
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
