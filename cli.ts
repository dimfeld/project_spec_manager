#!/usr/bin/env bun
import { generateSpecTemplate, generateProjectSettings, parseSpec } from './src/specManager';
import chalk from 'chalk';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'init':
        // Initialize project settings
        console.log(chalk.blue('Generating project settings template...'));
        const settingsPath = await generateProjectSettings();
        console.log(chalk.green(`Project settings template created at: ${settingsPath}`));
        break;
        
      case 'new':
        // Generate a new spec
        if (!args[1]) {
          console.error(chalk.red('Error: Missing spec name. Usage: bun cli.ts new <spec-name> [preset]'));
          process.exit(1);
        }
        
        const specName = args[1];
        const preset = args[2] as 'function' | 'test' | 'docs' | undefined;
        
        console.log(chalk.blue(`Generating spec template for "${specName}"...`));
        const specPath = await generateSpecTemplate(specName, preset);
        console.log(chalk.green(`Spec template created at: ${specPath}`));
        break;
        
      case 'validate':
        // Validate a spec
        if (!args[1]) {
          console.error(chalk.red('Error: Missing spec path. Usage: bun cli.ts validate <spec-path>'));
          process.exit(1);
        }
        
        const specToValidate = args[1];
        console.log(chalk.blue(`Validating spec: ${specToValidate}`));
        
        const spec = await parseSpec(specToValidate);
        console.log(chalk.green('Spec is valid!'));
        console.log(chalk.yellow('Using aider_config:'));
        console.log(JSON.stringify(spec.aider_config, null, 2));
        break;
        
      default:
        console.log(chalk.yellow('Project Spec Manager CLI'));
        console.log(chalk.white('Available commands:'));
        console.log(chalk.white('  init                  - Generate project settings template'));
        console.log(chalk.white('  new <name> [preset]   - Generate a new spec template'));
        console.log(chalk.white('  validate <spec-path>  - Validate a spec file'));
    }
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

main();
