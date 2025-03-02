/**
 * CLI Interface for the Automated Development Task Manager
 * 
 * Handles command-line arguments for three main commands:
 * - generate <spec-name>: Generate a YAML spec template
 * - run <spec-file>: Execute the specified YAML spec
 * - cleanup <spec-name>: Remove associated branch and worktree
 */

import path from 'path';

// Define command types
type Command = 'generate' | 'run' | 'cleanup';

// Interface for parsed CLI arguments
interface ParsedArgs {
  command: Command;
  specName?: string;
  specFile?: string;
  preset?: string; // Preset option for generate command
}

/**
 * Parse command line arguments
 * @returns ParsedArgs object with command and arguments
 * @throws Error if command or required arguments are missing
 */
export function parseArgs(): ParsedArgs {
  // Skip the first two arguments (node/bun and script path)
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    throw new Error('No command specified');
  }

  const command = args[0].toLowerCase() as Command;
  
  // Validate command
  if (command !== 'generate' && command !== 'run' && command !== 'cleanup') {
    throw new Error(`Invalid command: ${command}. Must be one of: generate, run, cleanup`);
  }
  
  // Validate arguments based on command
  if (args.length < 2) {
    throw new Error(`Missing argument for command: ${command}`);
  }

  const result: ParsedArgs = { command };
  
  // Extract additional arguments based on command
  switch (command) {
    case 'generate':
      result.specName = args[1];
      
      // Check for --preset option
      const presetIndex = args.findIndex(arg => arg === '--preset');
      if (presetIndex !== -1 && presetIndex + 1 < args.length) {
        result.preset = args[presetIndex + 1];
      }
      break;
    case 'run':
      result.specFile = args[1];
      // Extract spec name from file path (without extension)
      result.specName = path.basename(args[1], path.extname(args[1]));
      break;
    case 'cleanup':
      result.specName = args[1];
      break;
  }
  
  return result;
}

/**
 * Main CLI entry point
 */
export async function runCli() {
  try {
    const args = parseArgs();
    
    // Import the necessary functions from specManager
    const { generateSpecTemplate, parseSpec } = await import('./specManager');
    
    // Execute the appropriate command
    switch (args.command) {
      case 'generate':
        if (!args.specName) {
          throw new Error('Spec name is required for generate command');
        }
        
        const specFilePath = await generateSpecTemplate(args.specName, args.preset as any);
        console.log(`Spec template generated: ${specFilePath}`);
        break;
        
      case 'run':
        if (!args.specFile) {
          throw new Error('Spec file is required for run command');
        }
        
        try {
          // Parse and validate the spec file
          const spec = await parseSpec(args.specFile);
          console.log(`Spec '${args.specName}' validated successfully`);
          console.log(`Objective: ${spec.objective.split('\n')[0].substring(0, 50)}...`);
          console.log(`Tasks: ${spec.tasks.length}`);
          // Actual execution will be implemented in subsequent tasks
        } catch (error) {
          throw new Error(`Spec validation failed: ${error.message}`);
        }
        break;
        
      case 'cleanup':
        // Will be implemented in subsequent tasks
        console.log(`Command: ${args.command}`);
        console.log(`Spec Name: ${args.specName}`);
        break;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    displayUsage();
    process.exit(1);
  }
}

/**
 * Display usage instructions
 */
function displayUsage() {
  console.log(`
Usage: bun run cli.ts <command> <arguments>

Commands:
  generate <spec-name> [--preset <preset-type>]   Generate a YAML spec template
  run <spec-file>                                Execute the specified YAML spec
  cleanup <spec-name>                            Remove associated branch and worktree
  
Preset Types:
  function    Template for implementing a function
  test        Template for writing tests
  docs        Template for generating documentation
  
Examples:
  bun run cli.ts generate my-feature
  bun run cli.ts generate my-function --preset function
  bun run cli.ts run specs/my-feature.yaml
  bun run cli.ts cleanup my-feature
`);
}

// If this file is executed directly (not imported)
if (import.meta.main) {
  runCli();
}