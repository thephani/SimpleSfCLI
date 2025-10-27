import fs from 'fs';
import path from 'path';
import xmlbuilder from 'xmlbuilder';
import { MetadataType } from 'types/index.type';
import { FieldProperties, GroupedData } from 'types/xml.type';

export class XmlHelper {
    private outputDirectory: string;

    constructor(outputDirectory: string = './.simpleSfCli_out') {
        this.outputDirectory = outputDirectory;
    }

    /**
     * Creates a package XML with optional version
     * @param metadataTypes Optional array of metadata types
     * @param version Salesforce API version
     */
    public createPackageXml(metadataTypes?: MetadataType[], version: string = '62.0'): string {
        try {
            const packageXml = this.createBaseXml('Package', {
                xmlns: 'http://soap.sforce.com/2006/04/metadata'
            });

            if (metadataTypes) {
                const sortedTypes = [...metadataTypes].sort((a, b) => a.name.localeCompare(b.name));

                sortedTypes.forEach(({ name, members }) => {
                    const types = packageXml.ele('types');
                    const sortedMembers = [...members].sort();

                    sortedMembers.forEach((member) => {
                        types.ele('members', member);
                    });

                    types.ele('name', name);
                });
            }

            packageXml.ele('version', version);
            return packageXml.end({ pretty: true });
        } catch (error) {
            this.handleError(error, 'Failed to create package.xml');
        }
    }

    /**
     * Creates an empty package.xml with only version
     * @param version Salesforce API version (default 62.0 for tests)
     */
    public createEmptyPackageXml(version: string = '62.0'): string {
        try {
            const packageXml = this.createBaseXml('Package', {
                xmlns: 'http://soap.sforce.com/2006/04/metadata'
            });

            packageXml.ele('version', version);
            return packageXml.end({ pretty: true });
        } catch (error) {
            this.handleError(error, 'Failed to create empty package.xml');
        }
    }

    /**
     * Generates package member details from a file path
     */
    public generatePackageMember(filePath: string): MetadataType | null {
        const customFieldRegEx = /objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/;
        const recordTypeRegEx = /objects\/([^/]+)\/recordTypes\/([^/]+)\.recordType-meta\.xml$/;
        const listViewRegEx = /objects\/([^/]+)\/listViews\/([^/]+)\.listView-meta\.xml$/;
        const fieldSetRegEx = /objects\/([^/]+)\/fieldSets\/([^/]+)\.fieldSet-meta\.xml$/;
        const compactLayoutRegEx = /objects\/([^/]+)\/compactLayouts\/([^/]+)\.compactLayout-meta\.xml$/;
        const validationRuleRegEx = /objects\/([^/]+)\/validationRules\/([^/]+)\.validationRule-meta\.xml$/;
        const webLinkRegEx = /objects\/([^/]+)\/webLinks\/([^/]+)\.webLink-meta\.xml$/;
        const businessProcessRegEx = /objects\/([^/]+)\/businessProcesses\/([^/]+)\.businessProcess-meta\.xml$/;

        const patterns: Array<{ type: string; regex: RegExp }> = [
            { type: 'CustomField', regex: customFieldRegEx },
            { type: 'RecordType', regex: recordTypeRegEx },
            { type: 'ListView', regex: listViewRegEx },
            { type: 'FieldSet', regex: fieldSetRegEx },
            { type: 'CompactLayout', regex: compactLayoutRegEx },
            { type: 'ValidationRule', regex: validationRuleRegEx },
            { type: 'WebLink', regex: webLinkRegEx },
            { type: 'BusinessProcess', regex: businessProcessRegEx },
        ];

        for (const { type, regex } of patterns) {
            const match = filePath.match(regex);
            if (match) {
                return {
                    name: type,
                    members: [`${match[1]}.${match[2]}`]
                };
            }
        }

        const prefix = "force-app/main/default/";
        if (filePath.startsWith(prefix)) {
            const remainingPath = filePath.substring(prefix.length).split("/");
            console.log('generatePackageMember', remainingPath);
            return remainingPath.length > 0 ? { name: remainingPath[0], members: [] } : null;
        }

        return null;
    }

    /**
     * Transforms XML structure for custom objects
     */
    public generateCustomObjectForFields(groupedData: GroupedData): void {
        try {
            Object.keys(groupedData).forEach((objectName) => {
                const customObjectXml = this.createBaseXml('CustomObject', {
                    xmlns: 'http://soap.sforce.com/2006/04/metadata'
                });

                groupedData[objectName].fields.forEach((field) => {
                    const sourceFilePath = `force-app/main/default/objects/${objectName}/fields/${field}.field-meta.xml`;
                    const existingXmlContent = fs.readFileSync(sourceFilePath, 'utf-8');

                    const match = existingXmlContent.match(/<CustomField[^>]*>([\s\S]*?)<\/CustomField>/);
                    if (!match) {
                        throw new Error(`Invalid XML structure in file: ${sourceFilePath}`);
                    }

                    const fieldProperties = this.extractFieldProperties(match[1]);
                    const fieldsNode = customObjectXml.ele('fields');

                    Object.entries(fieldProperties).forEach(([key, value]) => {
                        fieldsNode.ele(key).raw(value as string).up();
                    });
                });

                this.saveUpdatedXml(objectName, customObjectXml.end({ pretty: true }));
            });
        } catch (error) {
            this.handleError(error, 'Error transforming XML files');
        }
    }

    /**
     * Creates XML for a custom field
     */
    public createCustomFieldXml(fieldName: string, fieldType: string, properties: Record<string, string> = {}): string {
        try {
            const fieldXml = this.createBaseXml('CustomField', {
                xmlns: 'http://soap.sforce.com/2006/04/metadata'
            });

            fieldXml.ele('fullName', fieldName);
            fieldXml.ele('type', fieldType);

            Object.entries(properties).forEach(([key, value]) => {
                fieldXml.ele(key, value);
            });

            return fieldXml.end({ pretty: true });
        } catch (error) {
            this.handleError(error, 'Failed to create custom field XML');
        }
    }

    /**
     * Validates if a string is valid XML
     */
    public isValidXml(xml: string): boolean {
        try {
            const rootMatch = xml.match(/<([^\s>/?]+)[\s>]/);
            if (!rootMatch) return false;

            xmlbuilder.create(rootMatch[1]);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sets the output directory
     */
    public setOutputDirectory(directory: string): void {
        this.outputDirectory = directory;
    }

    /**
     * Creates a base XML with optional attributes
     */
    private createBaseXml(rootName: string, attributes: Record<string, string> = {}): xmlbuilder.XMLElement {
        const xmlBuilder = xmlbuilder.create(rootName, { encoding: 'UTF-8' });
        
        Object.entries(attributes).forEach(([key, value]) => {
            xmlBuilder.att(key, value);
        });

        return xmlBuilder;
    }

    /**
     * Extracts field properties from XML content
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
     * Saves updated XML to a file
     */
    private saveUpdatedXml(objectName: string, updatedXml: string): void {
        try {
            const outputDir = path.join(this.outputDirectory, 'objects');
            fs.mkdirSync(outputDir, { recursive: true });

            const outputPath = path.join(outputDir, `${objectName}.object`);
            fs.writeFileSync(outputPath, updatedXml, 'utf-8');
        } catch (error) {
            this.handleError(error, `Failed to save XML file for ${objectName}`);
        }
    }

    /**
     * Handles error with consistent error messaging
     */
    private handleError(error: unknown, message: string): never {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`${message}: ${errorMessage}`);
    }
}
