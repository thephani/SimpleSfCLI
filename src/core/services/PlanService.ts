import path from 'path';
import { ChangePlanner, ChangePlannerOptions } from './ChangePlanner';
import { DeploymentPlan } from '../types/plan';
import { ensureDir, readJsonFile, writeJsonFile } from '../utils/fs';

export class PlanService {
  private readonly planner: ChangePlanner;

  constructor(planner?: ChangePlanner) {
    this.planner = planner || new ChangePlanner();
  }

  async generate(options: ChangePlannerOptions): Promise<DeploymentPlan> {
    return this.planner.run(options);
  }

  async write(planPath: string, plan: DeploymentPlan): Promise<void> {
    await ensureDir(path.dirname(planPath));
    await writeJsonFile(planPath, plan);
  }

  async read(planPath: string): Promise<DeploymentPlan> {
    return readJsonFile<DeploymentPlan>(planPath);
  }
}
