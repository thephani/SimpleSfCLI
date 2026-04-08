export interface RetrieveCommandOptions {
  manifestPath?: string;
  metadataFilter?: string;
  outputDir: string;
  targetLayout?: 'mdapi';
}

export interface RetrieveRequestPayload {
  apiVersion: string;
  singlePackage: boolean;
  unpackaged?: string | RetrieveUnpackaged;
}

export interface RetrieveUnpackaged {
  types: Array<{
    name: string;
    members: string[];
  }>;
  version: string;
}

export interface RetrieveStatusResult {
  id: string;
  done: boolean;
  status: 'Pending' | 'InProgress' | 'Succeeded' | 'Failed' | 'Canceled';
  errorMessage?: string;
  zipFile?: string;
}
