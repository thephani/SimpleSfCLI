import path from 'path';
import { DEFAULT_MAIN_ZIP } from '../../constants/metadata';
import { DeployOptions, DeployAuthConfig, DeployResult } from '../types/deploy';
import { BuildArtifacts, DeploymentPlan } from '../types/plan';
import { AuthService } from '../../services/AuthService';
import { MetadataDeployService } from '../../services/MetadataDeployService';
import { BuildService } from './BuildService';
import { PlanService } from './PlanService';

export interface DeployWorkflowOptions {
  toonRoot: string;
  fromRef: string;
  toRef: string;
  planPath: string;
  buildRoot: string;
  outputZip: string;
  auth: DeployAuthConfig;
  deployOptions: Partial<DeployOptions>;
}

export interface DeployWorkflowResult {
  plan: DeploymentPlan;
  artifacts: BuildArtifacts;
  mainResult?: DeployResult;
  destructiveResult?: DeployResult;
}

export class DeployWorkflowService {
  private readonly planService: PlanService;

  private readonly buildService: BuildService;

  constructor(planService?: PlanService, buildService?: BuildService) {
    this.planService = planService || new PlanService();
    this.buildService = buildService || new BuildService();
  }

  async run(options: DeployWorkflowOptions): Promise<DeployWorkflowResult> {
    const plan = await this.planService.generate({
      toonRoot: options.toonRoot,
      fromRef: options.fromRef,
      toRef: options.toRef,
    });

    await this.planService.write(options.planPath, plan);

    const artifacts = await this.buildService.run({
      plan,
      buildRoot: options.buildRoot,
      mainZipPath: options.outputZip || DEFAULT_MAIN_ZIP,
      destructiveZipPath: path.join(options.buildRoot, 'destructive.zip'),
    });

    if (!artifacts.mainZipPath && !artifacts.destructiveZipPath) {
      return { plan, artifacts };
    }

    const authService = new AuthService(options.auth);
    await authService.authenticate();

    const deployService = new MetadataDeployService(options.auth);

    let mainResult: DeployResult | undefined;
    if (artifacts.mainZipPath) {
      const deployOptions: Partial<DeployOptions> = {
        allowMissingFiles: false,
        rollbackOnError: true,
        singlePackage: true,
        ...options.deployOptions,
      };

      if (deployOptions.testLevel === 'RunSpecifiedTests' && (!deployOptions.runTests || deployOptions.runTests.length === 0)) {
        deployOptions.runTests = inferRunSpecifiedTests(plan);
      }

      mainResult = await deployService.deployZip(artifacts.mainZipPath, deployOptions);
    }

    let destructiveResult: DeployResult | undefined;
    if (artifacts.destructiveZipPath) {
      destructiveResult = await deployService.deployZip(artifacts.destructiveZipPath, {
        ...options.deployOptions,
        checkOnly: false,
        rollbackOnError: true,
        singlePackage: true,
      });
    }

    return {
      plan,
      artifacts,
      mainResult,
      destructiveResult,
    };
  }
}

function inferRunSpecifiedTests(plan: DeploymentPlan): string[] {
  const candidates = [...plan.adds, ...plan.modifies]
    .filter((component) => component.metadataType === 'ApexClass')
    .map((component) => component.fullName)
    .filter((name) => /(test|tests)$/i.test(name));

  return [...new Set(candidates)];
}
