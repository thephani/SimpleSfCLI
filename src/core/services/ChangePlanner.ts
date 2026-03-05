import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { DeploymentPlan, PlannedComponent } from '../types/plan';
import { ToonComponentSummary, ToonIndex } from '../types/toon';
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

    const fromIndex = this.safeLoadIndex(repository, options.fromRef);
    const toIndex = this.safeLoadIndex(repository, options.toRef);

    const adds = new Map<string, PlannedComponent>();
    const modifies = new Map<string, PlannedComponent>();
    const deletes = new Map<string, PlannedComponent>();

    for (const entry of entries) {
      if (entry.status === 'R') {
        if (entry.oldPath) {
          this.collectDelete(entry.oldPath, repository, fromIndex, deletes);
        }
        if (entry.newPath) {
          this.collectAddOrModify('A', entry.newPath, repository, toIndex, adds, modifies, deletes);
        }
        continue;
      }

      const changedPath = entry.newPath || entry.oldPath;
      if (!changedPath) {
        continue;
      }

      if (entry.status === 'D') {
        this.collectDelete(changedPath, repository, fromIndex, deletes);
      } else {
        this.collectAddOrModify(entry.status, changedPath, repository, toIndex, adds, modifies, deletes);
      }
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

  private safeLoadIndex(repository: ToonRepository, ref: string): ToonIndex {
    try {
      return repository.loadIndexFromGitRef(ref);
    } catch {
      return {
        generatedAt: new Date().toISOString(),
        componentCount: 0,
        components: [],
      };
    }
  }

  private collectDelete(
    changedPath: string,
    repository: ToonRepository,
    fromIndex: ToonIndex,
    deletes: Map<string, PlannedComponent>
  ): void {
    const component = repository.resolveComponentByChangedPath(fromIndex, changedPath);
    if (!component) {
      return;
    }

    deletes.set(component.id, this.toPlannedComponent(component, 'delete'));
  }

  private collectAddOrModify(
    status: string,
    changedPath: string,
    repository: ToonRepository,
    toIndex: ToonIndex,
    adds: Map<string, PlannedComponent>,
    modifies: Map<string, PlannedComponent>,
    deletes: Map<string, PlannedComponent>
  ): void {
    const component = repository.resolveComponentByChangedPath(toIndex, changedPath);
    if (!component) {
      return;
    }

    const isToonFile = changedPath.endsWith('.toon');
    const changeType = status === 'A' && isToonFile ? 'add' : 'modify';
    const planned = this.toPlannedComponent(component, changeType);

    if (changeType === 'add') {
      adds.set(component.id, planned);
      return;
    }

    if (!adds.has(component.id) && !deletes.has(component.id)) {
      modifies.set(component.id, planned);
    }
  }

  private toPlannedComponent(component: ToonComponentSummary, changeType: 'add' | 'modify' | 'delete'): PlannedComponent {
    return {
      id: component.id,
      metadataType: component.metadataType,
      fullName: component.fullName,
      toonFilePath: component.toonFilePath.replace(/\\/g, '/'),
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
