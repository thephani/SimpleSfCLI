// src/types/xml.ts
/**
 * Represents metadata type and its members
 */
export interface MetadataType {
	name: string;
	members: string[];
  }
  
  /**
   * Represents grouped data for custom objects and their fields
   */
  export interface GroupedData {
	[objectName: string]: {
	  fields: string[];
	  [key: string]: unknown;  // For any additional object data
	};
  }
  
  /**
   * Represents field properties in XML structure
   */
  export interface FieldProperties {
	[key: string]: string;
  }
  
  /**
   * Represents the structure for changed files result
   */
  export interface ChangedFilesResult {
	groupedData: GroupedData;
	changedFiles: string[];
	restChangedFiles: string[];
  }
  
  /**
   * Represents custom field definition
   */
  export interface CustomField {
	fullName: string;
	type: string;
	label?: string;
	required?: boolean;
	unique?: boolean;
	externalId?: boolean;
	length?: number;
	precision?: number;
	scale?: number;
	relationshipName?: string;
	referenceTo?: string;
	defaultValue?: string;
	description?: string;
	[key: string]: unknown;
  }
  
  /**
   * Represents XML generation options
   */
  export interface XmlOptions {
	encoding?: string;
	pretty?: boolean;
	indent?: string;
  }
  
  /**
   * Represents package.xml configuration
   */
  export interface PackageConfig {
	version: string;
	types: MetadataType[];
  }
  
  /**
   * Represents metadata file paths structure
   */
  export interface MetadataFilePaths {
	sourcePath: string;
	metadataPath?: string;
	outputPath: string;
  }