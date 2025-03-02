/**
 * Spec Manager for the Automated Development Task Manager
 *
 * Handles generation of YAML spec templates and parsing of filled-in specs.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';

// Define preset types
type PresetType = 'function' | 'test' | 'docs';

/**
 * Generate a project-level settings template
 * @returns Path to the generated settings file
 */
export async function generateProjectSettings(): Promise<string> {
  // Ensure specs directory exists
  const specsDir = path.join(process.cwd(), 'specs');
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  // Generate the settings template
  const templateContent = `# Project-level Aider configuration
# This will be merged with individual spec files
# Generated on: ${new Date().toISOString()}

aider_config:
  model: 'gpt-4' # Specify the default AI model to use
  architect_mode: false # Set to true for high-level architectural guidance by default
  editable_files: # List of files Aider can modify by default
    - 'src/**/*.ts'
    - 'src/**/*.js'
    - 'tests/**/*.ts'
  readonly_files: # List of files Aider can read but not modify by default
    - 'README.md'
    - 'LICENSE'
    - 'package.json'
  retries: 5 # Default number of retry attempts for failed tasks
  test_command: 'npm test' # Default command to run tests
`;

  // Write the template to a file
  const settingsFilePath = path.join(specsDir, 'settings.yml');
  await Bun.write(settingsFilePath, templateContent);

  return settingsFilePath;
}

/**
 * Generate a YAML spec template
 * @param specName Name of the spec (used for filename)
 * @param preset Optional preset type to include specialized tasks
 * @returns Path to the generated spec file
 */
export async function generateSpecTemplate(specName: string, preset?: PresetType): Promise<string> {
  // Ensure specs directory exists
  const specsDir = path.join(process.cwd(), 'specs');
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
  }

  // Generate the base template
  let templateContent = `# Automated Development Task Manager - Spec Template
# Generated on: ${new Date().toISOString()}

# The aider_config section below is OPTIONAL if you have a project-level settings.yml file.
# Any values specified here will override or be merged with the project settings.
aider_config:
  model: '' # Specify the AI model to use (e.g., 'gpt-4')
  architect_mode: false # Set to true for high-level architectural guidance
  editable_files: [] # List of files Aider can modify (e.g., ['src/*.js'])
  readonly_files: [] # List of files Aider can read but not modify (e.g., ['docs/*.md'])
  retries: 10 # Number of retry attempts for failed tasks
  test_command: '' # Optional command to run tests (e.g., 'npm test')

objective: |
  # Describe the high-level goal here.
  # Example: Implement a REST API for user management with authentication.

implementation_details: |
  # Add technical notes and requirements here.
  # Example: Use Express.js for routing, JWT for authentication, and MongoDB for storage.
  # Include any specific constraints or dependencies that apply to all tasks.

tasks:
  - name: 'task-1'
    done: false # The tool will mark this as true when completed
    prompt: |
      # Describe what to do for this task.
      # Be specific about the requirements and expected outcome.
      # Example: Create a user registration endpoint at POST /api/users that validates
      # email and password, hashes the password, and stores the user in MongoDB.
`;

  // Add preset-specific tasks if a preset is specified
  if (preset) {
    templateContent += getPresetTasks(preset);
  }

  // Write the template to a file
  const specFilePath = path.join(specsDir, `${specName}.yaml`);
  await Bun.write(specFilePath, templateContent);

  return specFilePath;
}

/**
 * Get preset-specific tasks based on the preset type
 * @param preset The preset type
 * @returns YAML string with preset-specific tasks
 */
function getPresetTasks(preset: PresetType): string {
  switch (preset) {
    case 'function':
      return `
  - name: 'implement-function'
    done: false
    prompt: |
      # Implement a new function with the following requirements:
      # - Function name: [specify name]
      # - Parameters: [list parameters and types]
      # - Return value: [describe return value and type]
      # - Functionality: [describe what the function should do]
      # - Error handling: [describe how errors should be handled]
      # - Tests: [describe how the function should be tested]
    evaluation:
      type: 'test'
      # Uses the test_command from aider_config
`;

    case 'test':
      return `
  - name: 'write-tests'
    done: false
    prompt: |
      # Write unit tests for the following code:
      # - Target file/function: [specify target]
      # - Test framework: [specify framework, e.g., Jest, Mocha]
      # - Test cases: [list specific test cases to cover]
      # - Coverage requirements: [specify expected coverage]
    evaluation:
      type: 'command'
      command: 'npm run test:coverage'
      check_prompt: 'Does the test coverage meet the requirements?'
`;

    case 'docs':
      return `
  - name: 'generate-documentation'
    done: false
    prompt: |
      # Generate documentation for the following code:
      # - Target file/component: [specify target]
      # - Documentation style: [specify style, e.g., JSDoc, Markdown]
      # - Required sections: [list sections like Overview, API, Examples]
      # - Output location: [specify where docs should be saved]
    evaluation:
      type: 'command'
      command: 'node validate-docs.js'
      check_prompt: 'Does the documentation follow the required format and cover all specified sections?'
`;

    default:
      return '';
  }
}

/**
 * Type for a task evaluation, derived from Zod schema
 */
type TaskEvaluation = z.infer<typeof TaskEvaluationSchema>;

/**
 * Type for a task in the spec, derived from Zod schema
 */
type Task = z.infer<typeof TaskSchema>;

/**
 * Type for the complete aider configuration, derived from Zod schema
 */
type CompleteAiderConfig = z.infer<typeof CompleteAiderConfigSchema>;

/**
 * Type for the partial aider configuration, derived from Zod schema
 */
type PartialAiderConfig = z.infer<typeof AiderConfigSchema>;

/**
 * Type for the complete spec, derived from Zod schema
 */
type Spec = z.infer<typeof SpecSchema>;

/**
 * Read and validate the project-level settings file
 * @returns Parsed and validated settings object containing aider_config
 * @throws Error if the settings file is invalid
 */
export async function readProjectSettings(): Promise<{ aider_config: CompleteAiderConfig } | null> {
  const settingsPath = path.join(process.cwd(), 'specs', 'settings.yml');

  // Check if settings file exists
  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  try {
    // Read the settings file
    const fileContent = await Bun.file(settingsPath).text();

    // Parse YAML content
    const settings = yaml.load(fileContent) as any;

    // Check if settings is empty or invalid
    if (!settings) {
      console.warn('Warning: Empty settings file found at', settingsPath);
      return null;
    }

    // Create a schema just for the settings file
    const SettingsSchema = z.object({
      aider_config: CompleteAiderConfigSchema,
    });

    // Validate using Zod schema
    const result = SettingsSchema.safeParse(settings);

    if (!result.success) {
      // Format Zod errors for better readability
      const formattedError = formatZodError(result.error);
      throw new Error(`Settings validation failed: ${formattedError}`);
    }

    return result.data;
  } catch (error) {
    // Handle YAML parsing errors with line numbers
    if (error instanceof yaml.YAMLException) {
      const yamlError = error as yaml.YAMLException;
      const lineInfo = yamlError.mark
        ? ` at line ${yamlError.mark.line + 1}, column ${yamlError.mark.column + 1}`
        : '';
      console.error(`YAML parsing error in settings file${lineInfo}: ${yamlError.reason}`);
      throw new Error(`YAML parsing error in settings file${lineInfo}: ${yamlError.reason}`);
    }

    // Rethrow the error
    throw error;
  }
}

/**
 * Merge project settings with spec config
 * @param specConfig The spec's aider_config (may be undefined)
 * @param projectSettings The project-level settings
 * @returns Merged aider_config
 */
function mergeAiderConfig(
  specConfig: PartialAiderConfig | undefined,
  projectSettings: { aider_config: CompleteAiderConfig } | null
): CompleteAiderConfig {
  // If no project settings, use spec config or create default
  if (!projectSettings) {
    if (!specConfig) {
      throw new Error('No Aider configuration found in spec or project settings');
    }
    // Create a default complete config with spec values
    return {
      model: specConfig.model || '',
      architect_mode: specConfig.architect_mode ?? false,
      editable_files: specConfig.editable_files || [],
      readonly_files: specConfig.readonly_files || [],
      retries: specConfig.retries ?? 3,
      test_command: specConfig.test_command,
    };
  }

  // If no spec config, use project settings
  if (!specConfig) {
    return projectSettings.aider_config;
  }

  // Merge the configurations, with spec config taking precedence for defined fields
  const result: CompleteAiderConfig = {
    ...projectSettings.aider_config,
    // Only override if defined in spec config
    ...(specConfig.model !== undefined && { model: specConfig.model }),
    ...(specConfig.architect_mode !== undefined && { architect_mode: specConfig.architect_mode }),
    ...(specConfig.retries !== undefined && { retries: specConfig.retries }),
    ...(specConfig.test_command !== undefined && { test_command: specConfig.test_command }),
  };

  // Merge arrays if spec config has them defined
  if (specConfig.editable_files) {
    result.editable_files = [
      ...new Set([
        ...(projectSettings.aider_config.editable_files ?? []),
        ...specConfig.editable_files,
      ]),
    ];
  }

  if (specConfig.readonly_files) {
    result.readonly_files = [
      ...new Set([
        ...(projectSettings.aider_config.readonly_files ?? []),
        ...specConfig.readonly_files,
      ]),
    ];
  }

  return result;
}

/**
 * Parse and validate a YAML spec file
 * @param filePath Path to the YAML spec file
 * @returns Parsed and validated spec object with merged aider_config
 * @throws Error if the spec is invalid or missing required fields
 */
export async function parseSpec(filePath: string): Promise<Spec> {
  try {
    // Read project settings first
    const projectSettings = await readProjectSettings();

    // Read the spec file
    const fileContent = await Bun.file(filePath).text();

    // Parse YAML content
    const spec = yaml.load(fileContent) as any;

    // Check if spec is empty or invalid
    if (!spec) {
      throw new Error('Empty or invalid YAML file');
    }

    // Validate using Zod schema
    const result = SpecSchema.safeParse(spec);

    if (!result.success) {
      // Format Zod errors for better readability
      const formattedError = formatZodError(result.error);
      throw new Error(`Spec validation failed: ${formattedError}`);
    }

    const validatedSpec = result.data as Spec;

    // Merge aider_config from project settings and spec
    const mergedConfig = mergeAiderConfig(validatedSpec.aider_config, projectSettings);

    // Return the spec with merged config
    return {
      ...validatedSpec,
      aider_config: mergedConfig,
    };
  } catch (error) {
    // Handle YAML parsing errors with line numbers
    if (error instanceof yaml.YAMLException) {
      const yamlError = error as yaml.YAMLException;
      const lineInfo = yamlError.mark
        ? ` at line ${yamlError.mark.line + 1}, column ${yamlError.mark.column + 1}`
        : '';
      console.error(`YAML parsing error${lineInfo}: ${yamlError.reason}`);
      throw new Error(`YAML parsing error${lineInfo}: ${yamlError.reason}`);
    }

    // Handle validation errors
    if (error instanceof Error) {
      console.error(`Spec validation error: ${error.message}`);
    }

    // Rethrow the error
    throw error;
  }
}

/**
 * Format Zod validation errors to provide clear and helpful error messages
 * @param error Zod validation error
 * @returns Formatted error message
 */
function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.join('.');
      return `${path ? path + ': ' : ''}${err.message}`;
    })
    .join('\n');
}

/**
 * Zod schema for task evaluation
 */
const TaskEvaluationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('test'),
  }),
  z.object({
    type: z.literal('command'),
    command: z.string().min(1, 'Command cannot be empty'),
    check_prompt: z.string().min(1, 'Check prompt cannot be empty'),
  }),
]);

/**
 * Zod schema for a task in the spec
 */
const TaskSchema = z.object({
  name: z.string().min(1, 'Task name cannot be empty'),
  done: z.boolean().optional(),
  prompt: z.string().min(1, 'Task prompt cannot be empty'),
  evaluation: TaskEvaluationSchema.optional(),
});

/**
 * Zod schema for the complete aider configuration (used for project settings)
 */
const CompleteAiderConfigSchema = z.object({
  model: z.string().min(1, 'Model name cannot be empty'),
  architect_mode: z.boolean().default(true),
  editable_files: z.array(z.string()).optional(),
  readonly_files: z.array(z.string()).optional(),
  retries: z.number().int().nonnegative('Retries must be a non-negative number').default(10),
  test_command: z.string().optional(),
});

/**
 * Zod schema for partial aider configuration (used in spec files)
 */
const AiderConfigSchema = z.object({
  model: z.string().min(1, 'Model name cannot be empty').optional(),
  architect_mode: z.boolean().optional(),
  editable_files: z.array(z.string()),
  readonly_files: z.array(z.string()).optional(),
  retries: z.number().int().nonnegative('Retries must be a non-negative number').optional(),
  test_command: z.string().optional(),
});

/**
 * Zod schema for the complete spec
 */
const SpecSchema = z.object({
  aider_config: AiderConfigSchema,
  objective: z.string(),
  implementation_details: z.string(),
  tasks: z.array(TaskSchema).min(1, 'At least one task is required'),
});
