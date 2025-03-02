/**
 * Spec Manager for the Automated Development Task Manager
 * 
 * Handles generation of YAML spec templates and parsing of filled-in specs.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Define preset types
type PresetType = 'function' | 'test' | 'docs';

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
 * Interface for a task evaluation
 */
interface TaskEvaluation {
  type: 'test' | 'command';
  command?: string;
  check_prompt?: string;
}

/**
 * Interface for a task in the spec
 */
interface Task {
  name: string;
  done?: boolean;
  prompt: string;
  evaluation?: TaskEvaluation;
}

/**
 * Interface for the aider configuration
 */
interface AiderConfig {
  model: string;
  architect_mode: boolean;
  editable_files: string[];
  readonly_files: string[];
  retries: number;
  test_command?: string;
}

/**
 * Interface for the complete spec
 */
interface Spec {
  aider_config: AiderConfig;
  objective: string;
  implementation_details: string;
  tasks: Task[];
}

/**
 * Parse and validate a YAML spec file
 * @param filePath Path to the YAML spec file
 * @returns Parsed and validated spec object
 * @throws Error if the spec is invalid or missing required fields
 */
export async function parseSpec(filePath: string): Promise<Spec> {
  try {
    // Read the spec file
    const fileContent = await Bun.file(filePath).text();
    
    // Parse YAML content
    const spec = yaml.load(fileContent) as any;
    
    // Check if spec is empty or invalid
    if (!spec) {
      throw new Error('Empty or invalid YAML file');
    }
    
    // Validate required top-level fields
    validateRequiredFields(spec, ['aider_config', 'objective', 'tasks'], 'spec');
    
    // Validate aider_config structure
    validateAiderConfig(spec.aider_config);
    
    // Validate tasks
    validateTasks(spec.tasks);
    
    return spec as Spec;
  } catch (error) {
    // Handle YAML parsing errors with line numbers
    if (error instanceof yaml.YAMLException) {
      const yamlError = error as yaml.YAMLException;
      const lineInfo = yamlError.mark ? ` at line ${yamlError.mark.line + 1}, column ${yamlError.mark.column + 1}` : '';
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
 * Validate that an object has all required fields
 * @param obj Object to validate
 * @param requiredFields Array of required field names
 * @param objectName Name of the object for error messages
 * @throws Error if any required field is missing
 */
function validateRequiredFields(obj: any, requiredFields: string[], objectName: string): void {
  for (const field of requiredFields) {
    if (obj[field] === undefined) {
      throw new Error(`Missing required field: ${objectName}.${field}`);
    }
  }
}

/**
 * Validate the aider_config section of the spec
 * @param config The aider_config object to validate
 * @throws Error if the config is invalid
 */
function validateAiderConfig(config: any): void {
  // Check required fields
  validateRequiredFields(
    config, 
    ['model', 'architect_mode', 'editable_files', 'readonly_files', 'retries'],
    'aider_config'
  );
  
  // Validate field types
  if (typeof config.model !== 'string') {
    throw new Error('aider_config.model must be a string');
  }
  
  if (config.model.trim() === '') {
    throw new Error('aider_config.model cannot be empty');
  }
  
  if (typeof config.architect_mode !== 'boolean') {
    throw new Error('aider_config.architect_mode must be a boolean');
  }
  
  if (!Array.isArray(config.editable_files)) {
    throw new Error('aider_config.editable_files must be an array');
  }
  
  if (!Array.isArray(config.readonly_files)) {
    throw new Error('aider_config.readonly_files must be an array');
  }
  
  if (typeof config.retries !== 'number' || config.retries < 0) {
    throw new Error('aider_config.retries must be a non-negative number');
  }
  
  // Validate optional fields if present
  if (config.test_command !== undefined && typeof config.test_command !== 'string') {
    throw new Error('aider_config.test_command must be a string if provided');
  }
}

/**
 * Validate the tasks section of the spec
 * @param tasks The tasks array to validate
 * @throws Error if any task is invalid
 */
function validateTasks(tasks: any): void {
  // Check if tasks is an array
  if (!Array.isArray(tasks)) {
    throw new Error('tasks must be an array');
  }
  
  // Check if tasks array is empty
  if (tasks.length === 0) {
    throw new Error('tasks array cannot be empty');
  }
  
  // Validate each task
  tasks.forEach((task, index) => {
    validateTask(task, index);
  });
}

/**
 * Validate a single task
 * @param task The task object to validate
 * @param index The index of the task in the tasks array (for error messages)
 * @throws Error if the task is invalid
 */
function validateTask(task: any, index: number): void {
  // Check required fields
  validateRequiredFields(task, ['name', 'prompt'], `tasks[${index}]`);
  
  // Validate field types
  if (typeof task.name !== 'string' || task.name.trim() === '') {
    throw new Error(`tasks[${index}].name must be a non-empty string`);
  }
  
  if (typeof task.prompt !== 'string' || task.prompt.trim() === '') {
    throw new Error(`tasks[${index}].prompt must be a non-empty string`);
  }
  
  // If done is provided, it must be a boolean
  if (task.done !== undefined && typeof task.done !== 'boolean') {
    throw new Error(`tasks[${index}].done must be a boolean if provided`);
  }
  
  // Validate evaluation if present
  if (task.evaluation !== undefined) {
    validateTaskEvaluation(task.evaluation, index);
  }
}

/**
 * Validate a task evaluation
 * @param evaluation The evaluation object to validate
 * @param taskIndex The index of the task in the tasks array (for error messages)
 * @throws Error if the evaluation is invalid
 */
function validateTaskEvaluation(evaluation: any, taskIndex: number): void {
  // Check required fields
  validateRequiredFields(evaluation, ['type'], `tasks[${taskIndex}].evaluation`);
  
  // Validate type field
  if (evaluation.type !== 'test' && evaluation.type !== 'command') {
    throw new Error(`tasks[${taskIndex}].evaluation.type must be either 'test' or 'command'`);
  }
  
  // For 'command' type, additional fields are required
  if (evaluation.type === 'command') {
    validateRequiredFields(
      evaluation, 
      ['command', 'check_prompt'], 
      `tasks[${taskIndex}].evaluation`
    );
    
    if (typeof evaluation.command !== 'string' || evaluation.command.trim() === '') {
      throw new Error(`tasks[${taskIndex}].evaluation.command must be a non-empty string`);
    }
    
    if (typeof evaluation.check_prompt !== 'string' || evaluation.check_prompt.trim() === '') {
      throw new Error(`tasks[${taskIndex}].evaluation.check_prompt must be a non-empty string`);
    }
  }
}
