import { MetadataAdapter } from '../types/adapter';
import { AuraBundleAdapter } from './AuraBundleAdapter';
import { CodeWithMetaAdapter } from './CodeWithMetaAdapter';
import { CustomFieldAdapter } from './CustomFieldAdapter';
import { CustomObjectAdapter } from './CustomObjectAdapter';
import { LwcBundleAdapter } from './LwcBundleAdapter';
import { XmlFileAdapter } from './XmlFileAdapter';

export class AdapterRegistry {
  private readonly adapters: MetadataAdapter[];

  constructor() {
    this.adapters = [
      new CustomFieldAdapter(),
      new CustomObjectAdapter(),
      new LwcBundleAdapter(),
      new AuraBundleAdapter(),
      new CodeWithMetaAdapter({
        metadataType: 'ApexClass',
        rootTag: 'ApexClass',
        sfdxFolder: 'classes',
        toonFolder: 'apexClasses',
        bodyExtension: '.cls',
        metaExtension: '.cls-meta.xml',
      }),
      new CodeWithMetaAdapter({
        metadataType: 'ApexTrigger',
        rootTag: 'ApexTrigger',
        sfdxFolder: 'triggers',
        toonFolder: 'apexTriggers',
        bodyExtension: '.trigger',
        metaExtension: '.trigger-meta.xml',
      }),
      new CodeWithMetaAdapter({
        metadataType: 'ApexPage',
        rootTag: 'ApexPage',
        sfdxFolder: 'pages',
        toonFolder: 'apexPages',
        bodyExtension: '.page',
        metaExtension: '.page-meta.xml',
      }),
      new CodeWithMetaAdapter({
        metadataType: 'ApexComponent',
        rootTag: 'ApexComponent',
        sfdxFolder: 'components',
        toonFolder: 'apexComponents',
        bodyExtension: '.component',
        metaExtension: '.component-meta.xml',
      }),
      new XmlFileAdapter({
        metadataType: 'Flow',
        sfdxFolder: 'flow',
        toonFolder: 'flows',
        extension: '.flow-meta.xml',
        directoryStyle: true,
      }),
      new XmlFileAdapter({
        metadataType: 'Layout',
        sfdxFolder: 'layouts',
        toonFolder: 'layouts',
        extension: '.layout-meta.xml',
      }),
      new XmlFileAdapter({
        metadataType: 'FlexiPage',
        sfdxFolder: 'flexipages',
        toonFolder: 'flexipages',
        extension: '.flexipage-meta.xml',
      }),
      new XmlFileAdapter({
        metadataType: 'CustomMetadata',
        sfdxFolder: 'customMetadata',
        toonFolder: 'customMetadata',
        extension: '.md-meta.xml',
      }),
      new XmlFileAdapter({
        metadataType: 'Profile',
        sfdxFolder: 'profiles',
        toonFolder: 'profiles',
        extension: '.profile-meta.xml',
      }),
      new XmlFileAdapter({
        metadataType: 'PermissionSet',
        sfdxFolder: 'permissionsets',
        toonFolder: 'permissionSets',
        extension: '.permissionset-meta.xml',
      }),
      new XmlFileAdapter({
        metadataType: 'StandardValueSet',
        sfdxFolder: 'standardValueSets',
        toonFolder: 'standardValueSets',
        extension: '.standardValueSet-meta.xml',
      }),
      new XmlFileAdapter({
        metadataType: 'Group',
        sfdxFolder: 'groups',
        toonFolder: 'groups',
        extension: '.group-meta.xml',
      }),
      new XmlFileAdapter({
        metadataType: 'CustomTab',
        sfdxFolder: 'tabs',
        toonFolder: 'tabs',
        extension: '.tab-meta.xml',
      }),
    ];
  }

  getAll(): MetadataAdapter[] {
    return this.adapters;
  }

  forType(metadataType: string): MetadataAdapter | undefined {
    return this.adapters.find((adapter) => adapter.metadataType === metadataType);
  }

  findImportAdapter(relativePath: string): MetadataAdapter | undefined {
    return this.adapters.find((adapter) => adapter.isPrimarySfdxFile(relativePath));
  }
}
