import { ToonComponent, ToonComponentDraft } from './toon';

export interface AssetCopy {
  from: string;
  to: string;
  role: string;
}

export interface ImportResult {
  component: ToonComponentDraft;
  toonFilePath: string;
  assets: AssetCopy[];
}

export interface EmitContext {
  toonRoot: string;
  mdapiRoot: string;
  packageMembers: Map<string, Set<string>>;
  fieldFragmentsByObject: Map<string, string[]>;
  objectBaseInnerXmlByObject: Map<string, string>;
  objectApiVersionByObject: Map<string, string>;
}

export interface MetadataAdapter {
  readonly metadataType: string;
  isPrimarySfdxFile(relativePath: string): boolean;
  importFromSfdx(sourceRoot: string, relativePath: string): Promise<ImportResult | null>;
  emitMdapi(component: ToonComponent, toonFilePath: string, context: EmitContext): Promise<void>;
  toPackageMember(component: Pick<ToonComponent, 'metadataType' | 'fullName'>): { type: string; member: string } | null;
}
