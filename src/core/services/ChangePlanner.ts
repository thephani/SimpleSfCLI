import { AdapterRegistry } from '../adapters/AdapterRegistry';
import { DeploymentPlan, PlannedComponent } from '../types/plan';
import { ToonComponentSummary } from '../types/toon';
import { gitDiffNameStatus, WORKTREE_REF } from '../utils/git';
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
          await this.collectDelete(repository, options.fromRef, entry.oldPath, deletes);
        }
        if (entry.newPath) {
          await this.collectAddOrModify(repository, options.toRef, 'A', entry.newPath, adds, modifies, deletes);
        }
        continue;
      }

      const changedPath = entry.newPath || entry.oldPath;
      if (!changedPath) {
        continue;
      }

      if (entry.status === 'D') {
        await this.collectDelete(repository, options.fromRef, changedPath, deletes);
      } else {
        await this.collectAddOrModify(repository, options.toRef, entry.status, changedPath, adds, modifies, deletes);
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

  private async collectDelete(
    repository: ToonRepository,
    fromRef: string,
    changedPath: string,
    deletes: Map<string, PlannedComponent>
  ): Promise<void> {
    const summary = await this.resolveComponent(repository, fromRef, changedPath);
    if (!summary) {
      return;
    }

    deletes.set(summary.id, this.toPlannedComponent(summary, 'delete'));
  }

  private async collectAddOrModify(
    repository: ToonRepository,
    toRef: string,
    status: string,
    changedPath: string,
    adds: Map<string, PlannedComponent>,
    modifies: Map<string, PlannedComponent>,
    deletes: Map<string, PlannedComponent>
  ): Promise<void> {
    const summary = await this.resolveComponent(repository, toRef, changedPath);
    if (!summary) {
      return;
    }

    const isToonFile = changedPath.endsWith('.toon');
    const changeType = status === 'A' && isToonFile ? 'add' : 'modify';
    const planned = this.toPlannedComponent(summary, changeType);

    if (changeType === 'add') {
      adds.set(summary.id, planned);
      return;
    }

    if (!adds.has(summary.id) && !deletes.has(summary.id)) {
      modifies.set(summary.id, planned);
    }
  }

  private async resolveComponent(repository: ToonRepository, ref: string, changedPath: string): Promise<ToonComponentSummary | null> {
    const toonFilePath = repository.inferComponentToonFilePath(changedPath);
    if (!toonFilePath) {
      return null;
    }

    try {
      if (ref === WORKTREE_REF) {
        return await repository.loadComponentSummaryFromFs(toonFilePath);
      }
      return await repository.loadComponentSummaryFromGitRef(ref, toonFilePath);
    } catch {
      return null;
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
