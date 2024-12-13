export interface DeployOptions {
    allowMissingFiles: boolean;
    checkOnly: boolean;
    testLevel: 'NoTestRun' | 'RunSpecifiedTests' | 'RunLocalTests' | 'RunAllTestsInOrg';
    runTests?: string[];
    rollbackOnError: boolean;
    singlePackage: boolean;
  }
  
  export interface DeployResult {
    id: string;
    done: boolean;
    status: 'Pending' | 'InProgress' | 'Succeeded' | 'SucceededPartial' | 'Failed' | 'Canceled';
    numberComponentsDeployed: number;
    numberComponentsTotal: number;
    numberComponentErrors: number;
    numberTestsCompleted: number;
    numberTestsTotal: number;
    numberTestErrors: number;
    stateDetail?: string;
    details: {
      componentFailures: Array<{
        componentType: string;
        fileName: string;
        fullName: string;
        problem: string;
        problemType: string;
        success: boolean;
      }>;
      runTestResult?: {
        numFailures: number;
        numTestsRun: number;
        totalTime: number;
        failures: Array<{
          name: string;
          methodName: string;
          message: string;
          stackTrace: string;
        }>;
      };
    };
  }