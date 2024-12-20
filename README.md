# 🚀 Simple SF CLI

## Supercharge Your Salesforce Deployments in Just Seconds!

**Simple SF CLI** is a lightweight, 11.0 kB Node.js-powered command-line tool (unpacked size: 33.3 kB) crafted to streamline your Salesforce DX (SF) workflows. Convert, package, and deploy your SFDX projects to Salesforce in record-breaking 5-7 seconds—all without Salesforce CLI or plugins.


## 🛠 Features That Stand Out

- ⚡ Lightning-Fast Deployments: Push your SFDX projects to Sandbox or Production faster than it takes to install Salesforce CLI.
- 📄 Automated package.xml Generation: Leverage Metadata API for seamless deployments.
- ✂️ Selective Deployments: Exclude specific metadata components with ease.
- 🤝 CI/CD Ready: Integrates smoothly with tools like GitHub Actions, Bitbucket, and more.
- 📑 Comprehensive Logs: Detailed error tracking for hassle-free debugging.

## 🎯 Why Choose Simple SF CLI?
- No Salesforce CLI Required: Say goodbye to additional dependencies and complex configurations.
- Zero Installation Overhead: Use it directly with npx—no local installations needed.
- Blazing Fast Setup: Set up in 3-5 seconds, making it perfect for CI/CD pipelines.
- Built from Scratch: Fully customized for reliability and speed.


## ⚡ Get Started in Seconds!
Run the CLI with npx—no need for installation!
bash
Copy code
npx simple-sf-cli [options]
Watch as your deployment completes in record time.

## 📦 Package Details
| Detail                | Value   |
|-----------------------|---------|
| Package Size          | 11.0 kB |
| Unpacked Size         | 33.3 kB |

## 📦 Supported Components
Version 0.7.1 of Simple SF CLI supports the following components:
- ApexClass
- ApexTrigger
- ApexPage
- CustomField
- CustomMetadata
- ApexComponent
- Workflow
- StandardValueSet


Elevate your Salesforce deployment game with `Simple SF CLI` — the ultimate tool for developers on the move.

Try it now:

### Option 1: Traditional Installation (Global NPM Install)
Install globally via NPM for repeated use:

```bash
npm install -g simple-sf-cli
```

```bash
simpleSfCli \
    --username myUser@example.com \
    --clientId myClientId \
    --privateKey ./server.key \
    --env PRODUCTION \
    --exclude Profile,NamedCredential
```

### Option 2: Recommended (Zero Installation)
Skip the installation hassle and use `npx` for instant execution:

```bash
npx simple-sf-cli \
    --username myUser@example.com \
    --clientId myClientId \
    --privateKey ./server.key \
    --env PRODUCTION \
    --exclude Profile,NamedCredential
```

### Command Options for `simpleSfCli --help`
```bash
simpleSfCli --help

Options:
  -V, --version                  output the version number
  -u, --username* <username>      Salesforce username
  -c, --clientId* <clientId>      Salesforce client ID
  -k, --privateKey* <privateKey>  Salesforce private key
  -e, --env* <environment>        Production or Sandbox [Default]
  -e, --exclude <types...>        List of metadata types to exclude, e.g.,NamedCredential, Profile
  -s, --source <sourceDir>       Path to the SFDX source directory, unless "force-app/main/default"
  -h, --help                     display help for command

<<<<<<< HEAD
   '*' Required option
=======
   Note: * is a Required option

>>>>>>> afb9ae8a0c95c384bdd93e4a9719eee79bce299a
```

### Exclude Specific Metadata Types
You can exclude specific metadata types from the deployment using the `--exclude` option:
```bash
simple-sf-cli --source <sourceDir> --output <outputZip> --exclude NamedCredential,Profile
```

### Command Options for simpleSfCli

### **Available Options**  

| **Option**                   | **Description**                                                                                       |
|------------------------------|-------------------------------------------------------------------------------------------------------|
| `-V, --version`              | Outputs the current version of `simpleSfCli`.                                                        |
| `-u, --username* <username>` | **Required**. Specifies the Salesforce username.                                                     |
| `-c, --clientId* <clientId>` | **Required**. Specifies the Salesforce Client ID.                                                    |
| `-k, --privateKey* <privateKey>` | **Required**. Specifies the path to the Salesforce private key file.                              |
| `-e, --env* <environment>`   | **Required**. Sets the target Salesforce environment. Can be `Production` or `Sandbox` (default).     |
| `-e, --exclude <types...>`   | Excludes specific metadata types from deployment. List metadata types separated by commas.            |
| `-s, --source <sourceDir>`   | Specifies the path to the SFDX source directory. Defaults to `force-app/main/default` if not provided. |
| `-h, --help`                 | Displays detailed help for the command.                                                              |

Note: * is a Required option
---

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

