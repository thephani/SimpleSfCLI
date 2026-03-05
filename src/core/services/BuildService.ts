import path from 'path';
import { BuildArtifacts, DeploymentPlan } from '../types/plan';
import { MdapiCompiler } from './MdapiCompiler';
import { ZipService } from './ZipService';

export interface BuildOptions {
  plan: DeploymentPlan;
  buildRoot: string;
  mainZipPath: string;
  destructiveZipPath: string;
}

export class BuildService {
  private readonly compiler: MdapiCompiler;

  private readonly zipService: ZipService;

  constructor(compiler?: MdapiCompiler, zipService?: ZipService) {
    this.compiler = compiler || new MdapiCompiler();
    this.zipService = zipService || new ZipService();
  }

  async run(options: BuildOptions): Promise<BuildArtifacts> {
    const artifacts = await this.compiler.compile({
      plan: options.plan,
      buildRoot: options.buildRoot,
    });

    const hasMainPackage = Boolean(artifacts.packageXmlPath);
    const hasDestructivePackage = Boolean(artifacts.destructiveChangesPath);

    if (hasMainPackage) {
      const mainZipPath = path.resolve(options.mainZipPath);
      await this.zipService.zipDirectory(artifacts.mainDir, mainZipPath);
      artifacts.mainZipPath = mainZipPath;
    }

    if (hasDestructivePackage) {
      const destructiveZipPath = path.resolve(options.destructiveZipPath);
      await this.zipService.zipDirectory(artifacts.destructiveDir, destructiveZipPath);
      artifacts.destructiveZipPath = destructiveZipPath;
    }

    return artifacts;
  }
}
