export type ChangeType = 'add' | 'modify' | 'delete';

export interface PlannedComponent {
  id: string;
  metadataType: string;
  fullName: string;
  toonFilePath: string;
  changeType: ChangeType;
}

export interface DeploymentPlan {
  planVersion: '1.0';
  generatedAt: string;
  fromRef: string;
  toRef: string;
  toonRoot: string;
  adds: PlannedComponent[];
  modifies: PlannedComponent[];
  deletes: PlannedComponent[];
  packageMembers: Record<string, string[]>;
  destructiveMembers: Record<string, string[]>;
}

export interface BuildArtifacts {
  buildRoot: string;
  mainDir: string;
  destructiveDir: string;
  mainZipPath?: string;
  destructiveZipPath?: string;
  packageXmlPath?: string;
  destructiveChangesPath?: string;
}
