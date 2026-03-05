export type ToonKind = 'atomic' | 'bundle' | 'child';

export interface ToonAsset {
  path: string;
  role: string;
  sha256: string;
}

export interface ToonComponent {
  toonVersion: '1.0';
  id: string;
  metadataType: string;
  fullName: string;
  apiVersion: string;
  kind: ToonKind;
  parentId?: string;
  spec: Record<string, unknown>;
  assets?: ToonAsset[];
  hash: string;
}

export type ToonComponentDraft = Omit<ToonComponent, 'assets' | 'hash'>;

export interface ToonComponentSummary {
  id: string;
  metadataType: string;
  fullName: string;
  toonFilePath: string;
}

export interface ToonIndex {
  generatedAt: string;
  componentCount: number;
  components: ToonComponentSummary[];
}
