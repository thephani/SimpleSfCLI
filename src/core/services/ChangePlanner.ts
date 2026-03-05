import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { DeploymentPlan, PlannedComponent } from '../types/plan';
import { ToonComponent } from '../types/toon';
import { gitDiffNameStatus } from '../utils/git';
import { ToonRepository } from './ToonRepository';

export interface ChangePlannerOptions {
  toonRoot: string;
  fromRef: string;
  toRef: string;
}

export class ChangePlanner {
  private readonly registry: AdapterRegistry;

  constructor(registry?: AdapterRegistry) {
    this.registry = registry || new AdapterRegistry();
  }

  async run(options: ChangePlannerOptions): Promise<DeploymentPlan> {
    const repository = new ToonRepository(options.toonRoot);
    const entries = gitDiffNameStatus(options.fromRef, options.toRef, options.toonRoot);

    const adds = new Map<string, PlannedComponent>();
    const modifies = new Map<string, PlannedComponent>();
    const deletes = new Map<string, PlannedComponent>();

    for (const entry of entries) {
      if (entry.status === 'R') {
        if (entry.oldPath) {
          await this.processPathChange('D', entry.oldPath, repository, options.fromRef, options.toRef, adds, modifies, deletes);
        }
        if (entry.newPath) {
          await this.processPathChange('A', entry.newPath, repository, options.fromRef, options.toRef, adds, modifies, deletes);
        }
        continue;
      }

      const effectivePath = entry.newPath || entry.oldPath;
      if (!effectivePath) {
        continue;
      }

      await this.processPathChange(entry.status, effectivePath, repository, options.fromRef, options.toRef, adds, modifies, deletes);
    }

    for (const id of adds.keys()) {
      modifies.delete(id);
      deletes.delete(id);
    }

    for (const id of deletes.keys()) {
      modifies.delete(id);
    }

    const packageMembers = this.collectMembers([...adds.values(), ...modifies.values()]);
    const destructiveMembers = this.collectMembers([...deletes.values()]);

    return {
      planVersion: '1.0',
      generatedAt: new Date().toISOString(),
      fromRef: options.fromRef,
      toRef: options.toRef,
      toonRoot: options.toonRoot,
      adds: [...adds.values()].sort(sortPlannedComponent),
      modifies: [...modifies.values()].sort(sortPlannedComponent),
      deletes: [...deletes.values()].sort(sortPlannedComponent),
      packageMembers,
      destructiveMembers,
    };
  }

  private processPathChange(
    gitStatus: string,
    changedRepoPath: string,
    repository: ToonRepository,
    fromRef: string,
    toRef: string,
    adds: Map<string, PlannedComponent>,
    modifies: Map<string, PlannedComponent>,
    deletes: Map<string, PlannedComponent>
  ): Promise<void> {
    return this.processPathChangeInternal(gitStatus, changedRepoPath, repository, fromRef, toRef, adds, modifies, deletes);
  }

  private async processPathChangeInternal(
    gitStatus: string,
    changedRepoPath: string,
    repository: ToonRepository,
    fromRef: string,
    toRef: string,
    adds: Map<string, PlannedComponent>,
    modifies: Map<string, PlannedComponent>,
    deletes: Map<string, PlannedComponent>
  ): Promise<void> {
    const toonFilePath = repository.inferComponentToonFilePath(changedRepoPath);
    if (!toonFilePath) {
      return;
    }

    const isComponentFile = changedRepoPath.endsWith('.toon');

    if (gitStatus === 'D' && isComponentFile) {
      const component = await repository.loadComponentFromGitRef(fromRef, toonFilePath);
      deletes.set(component.id, this.toPlannedComponent(component, toonFilePath, 'delete'));
      return;
    }

    const changeType = gitStatus === 'A' && isComponentFile ? 'add' : 'modify';
    const component = await repository.loadComponentFromGitRef(toRef, toonFilePath);
    const planned = this.toPlannedComponent(component, toonFilePath, changeType);

    if (changeType === 'add') {
      adds.set(component.id, planned);
      return;
    }

    if (!adds.has(component.id) && !deletes.has(component.id)) {
      modifies.set(component.id, planned);
    }
  }

  private toPlannedComponent(component: ToonComponent, toonFilePath: string, changeType: 'add' | 'modify' | 'delete'): PlannedComponent {
    return {
      id: component.id,
      metadataType: component.metadataType,
      fullName: component.fullName,
      toonFilePath: toonFilePath.replace(/\\/g, '/'),
      changeType,
    };
  }

  private collectMembers(components: PlannedComponent[]): Record<string, string[]> {
    const membersByType = new Map<string, Set<string>>();

    for (const component of components) {
      const adapter = this.registry.forType(component.metadataType);
      const member = adapter?.toPackageMember(component) || {
        type: component.metadataType,
        member: component.fullName,
      };

      if (!membersByType.has(member.type)) {
        membersByType.set(member.type, new Set<string>());
      }
      membersByType.get(member.type)?.add(member.member);
    }

    return Object.fromEntries(
      [...membersByType.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, members]) => [type, [...members].sort()])
    );
  }
}

function sortPlannedComponent(a: PlannedComponent, b: PlannedComponent): number {
  return `${a.metadataType}:${a.fullName}`.localeCompare(`${b.metadataType}:${b.fullName}`);
}
