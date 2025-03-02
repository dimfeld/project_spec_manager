/**
 * Task Executor for the Automated Development Task Manager
 * 
 * Handles task prompt preparation, Aider execution, and evaluation of task results
 */

import { join } from 'path';
import { spawn } from 'bun';
import { existsSync } from 'fs';
import { createBranch } from './vcsManager';
import { getFormattedTimestamp, safeExecute } from './utils';

// Import interfaces from specManager (these should match the spec file structure)
interface TaskEvaluation {
  type: 'test' | 'command';
  command?: string;
  check_prompt?: string;
}

interface Task {
  name: string;
  done?: boolean;
  prompt: string;
  evaluation?: TaskEvaluation;
}

interface AiderConfig {
  model: string;
  architect_mode: boolean;
  editable_files: string[];
  readonly_files: string[];
  retries: number;
  test_command?: string;
}

interface Spec {
  aider_config: AiderConfig;
  objective: string;
  implementation_details: string;
  tasks: Task[];
}

/**
 * Result of a task execution
 */
interface TaskResult {
  success: boolean;
  attempts: number;
  error?: string;
  output?: string;
}

/**
 * Prepare a task prompt by concatenating objective, implementation details, and task prompt
 * @param spec The complete spec object
 * @param task The specific task to prepare a prompt for
 * @returns Formatted prompt string for Aider
 */
export function prepareTaskPrompt(spec: Spec, task: Task): string {
  return `Objective:
${spec.objective}

Technical Notes:
${spec.implementation_details}

Task Prompt:
${task.prompt}`;
}

/**
 * Execute a task using Aider
 * @param spec The complete spec object
 * @param task The specific task to execute
 * @param specName The name of the spec (used for worktree path)
 * @returns Promise resolving to the task execution result
 */
export async function executeTask(spec: Spec, task: Task, specName: string): Promise<TaskResult> {
  const result: TaskResult = {
    success: false,
    attempts: 0,
  };
  
  try {
    // Create branch and worktree if they don't exist
    const worktreePath = await createBranch(specName);
    
    // Store the original working directory to return to later
    const originalCwd = process.cwd();
    
    // Change to the worktree directory
    const absoluteWorktreePath = join(process.cwd(), worktreePath);
    if (!existsSync(absoluteWorktreePath)) {
      throw new Error(`Worktree directory does not exist: ${absoluteWorktreePath}`);
    }
    process.chdir(absoluteWorktreePath);
    
    // Prepare the task prompt
    const prompt = prepareTaskPrompt(spec, task);
    
    // Maximum number of retries from config
    const maxRetries = spec.aider_config.retries;
    
    // Retry loop
    let success = false;
    let attempts = 0;
    let lastError = '';
    let lastOutput = '';
    
    while (!success && attempts < maxRetries) {
      attempts++;
      result.attempts = attempts;
      
      try {
        console.log(`Executing task '${task.name}' (attempt ${attempts}/${maxRetries})...`);
        
        // Construct Aider command
        const aiderArgs = [
          '--model', spec.aider_config.model,
        ];
        
        // Add architect mode if enabled
        if (spec.aider_config.architect_mode) {
          aiderArgs.push('--architect');
        }
        
        // Add editable files
        if (spec.aider_config.editable_files && spec.aider_config.editable_files.length > 0) {
          aiderArgs.push('--files', ...spec.aider_config.editable_files);
        }
        
        // Add readonly files
        if (spec.aider_config.readonly_files && spec.aider_config.readonly_files.length > 0) {
          aiderArgs.push('--readonly', ...spec.aider_config.readonly_files);
        }
        
        // Add the prompt
        aiderArgs.push(prompt);
        
        // Execute Aider
        const aiderProcess = spawn(['aider', ...aiderArgs], {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        
        // Capture output
        const stdout = await new Response(aiderProcess.stdout).text();
        const stderr = await new Response(aiderProcess.stderr).text();
        lastOutput = stdout;
        
        // Check exit code
        const exitCode = await aiderProcess.exited;
        if (exitCode !== 0) {
          // Provide more detailed error messages for common Aider failures
          if (stderr.includes('command not found')) {
            lastError = `Aider is not installed or not in PATH. Please ensure Aider is installed and accessible.`;
          } else if (stderr.includes('API key')) {
            lastError = `Aider API key error: ${stderr}. Please check your API key configuration.`;
          } else if (stderr.includes('rate limit')) {
            lastError = `API rate limit exceeded: ${stderr}. Please try again later.`;
          } else if (stderr.includes('timeout')) {
            lastError = `Aider execution timed out: ${stderr}. Consider simplifying the task or increasing timeout limits.`;
          } else {
            lastError = `Aider exited with code ${exitCode}: ${stderr}`;
          }
          
          console.error(lastError);
          continue; // Try again
        }
        
        // If task has an evaluation, run it
        if (task.evaluation) {
          const evaluationResult = await evaluateTask(spec, task, stdout);
          success = evaluationResult.success;
          if (!success) {
            lastError = evaluationResult.error || 'Evaluation failed without specific error';
            console.error(`Evaluation failed: ${lastError}`);
            continue; // Try again
          }
        } else {
          // No evaluation, assume success
          success = true;
        }
        
      } catch (error) {
        // Provide more detailed error messages for common execution failures
        if (error.message.includes('ENOENT')) {
          lastError = `Aider executable not found. Please ensure Aider is installed and in your PATH.`;
        } else if (error.message.includes('EACCES')) {
          lastError = `Permission denied when executing Aider. Check file permissions.`;
        } else if (error.message.includes('ETIMEDOUT')) {
          lastError = `Connection timed out when executing Aider. Check your network connection.`;
        } else {
          lastError = `Error executing Aider: ${error.message}`;
        }
        
        console.error(lastError);
      }
    }
    
    // Return to original directory
    process.chdir(originalCwd);
    
    // Set result properties
    result.success = success;
    if (!success) {
      result.error = `Task failed after ${attempts} attempts. Last error: ${lastError}`;
    }
    result.output = lastOutput;
    
    return result;
    
  } catch (error) {
    // Provide more detailed error messages for task execution failures
    if (error.message.includes('Worktree directory does not exist')) {
      result.error = `Failed to access worktree: ${error.message}. Check if the worktree was properly created.`;
    } else if (error.message.includes('Branch')) {
      result.error = `Branch error: ${error.message}. Check version control system status.`;
    } else if (error.message.includes('chdir')) {
      result.error = `Failed to change directory: ${error.message}. Check if the directory exists and is accessible.`;
    } else {
      result.error = `Error in task execution: ${error.message}`;
    }
    
    console.error(result.error);
    return result;
  }
}

/**
 * Evaluate a task result
 * @param spec The complete spec object
 * @param task The specific task to evaluate
 * @param aiderOutput The output from Aider execution
 * @returns Promise resolving to the evaluation result
 */
async function evaluateTask(spec: Spec, task: Task, aiderOutput: string): Promise<{ success: boolean; error?: string }> {
  if (!task.evaluation) {
    return { success: true };
  }
  
  try {
    if (task.evaluation.type === 'test') {
      // Run test command from config
      const testCommand = spec.aider_config.test_command;
      if (!testCommand) {
        const error = 'Test command not specified in aider_config.test_command';
        console.error(`Evaluation error: ${error}`);
        return { success: false, error };
      }
      
      // Split the test command into command and args
      const [cmd, ...args] = testCommand.split(' ');
      
      // Run the test command
      const testProcess = spawn([cmd, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      // Check exit code
      const exitCode = await testProcess.exited;
      const stderr = await new Response(testProcess.stderr).text();
      
      if (exitCode !== 0) {
        const error = `Test command failed with exit code ${exitCode}: ${stderr}`;
        console.error(`Evaluation error: ${error}`);
        return { success: false, error };
      }
      
      return { success: true };
      
    } else if (task.evaluation.type === 'command') {
      // Run custom command
      if (!task.evaluation.command) {
        const error = 'Command not specified in task.evaluation.command';
        console.error(`Evaluation error: ${error}`);
        return { success: false, error };
      }
      
      // Split the command into command and args
      const [cmd, ...args] = task.evaluation.command.split(' ');
      
      // Run the command
      const commandProcess = spawn([cmd, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      // Capture output
      const stdout = await new Response(commandProcess.stdout).text();
      const stderr = await new Response(commandProcess.stderr).text();
      
      // Check exit code
      const exitCode = await commandProcess.exited;
      if (exitCode !== 0) {
        const error = `Command failed with exit code ${exitCode}: ${stderr}`;
        console.error(`Evaluation error: ${error}`);
        return { success: false, error };
      }
      
      // If check_prompt is specified, use language model to evaluate
      if (task.evaluation.check_prompt) {
        return await evaluateWithLanguageModel(task.evaluation.check_prompt, stdout);
      }
      
      // No check_prompt, assume success
      return { success: true };
    }
    
    // Unknown evaluation type
    return { success: false, error: `Unknown evaluation type: ${(task.evaluation as any).type}` };
    
  } catch (error) {
    return { success: false, error: `Error in evaluation: ${error.message}` };
  }
}

/**
 * Evaluate command output using a language model
 * @param checkPrompt The prompt to send to the language model
 * @param commandOutput The output from the command to evaluate
 * @returns Promise resolving to the evaluation result
 */
async function evaluateWithLanguageModel(checkPrompt: string, commandOutput: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Construct the prompt
    const fullPrompt = `${checkPrompt}\n\nCommand output:\n${commandOutput}\n\nPlease respond with only 'yes' or 'no'.`;
    
    // Use the language model utility function
    console.log('Evaluating with language model...');
    
    try {
      // Import the utility function
      const { queryLanguageModel } = await import('./utils');
      
      // Query the language model
      const response = await queryLanguageModel(fullPrompt);
      
      // Parse response
      const normalizedResponse = response.toLowerCase().trim();
      if (normalizedResponse !== 'yes' && normalizedResponse !== 'no') {
        console.warn(`Language model returned unexpected response: "${response}". Expected 'yes' or 'no'.`);
        // Attempt to interpret the response
        const success = normalizedResponse.includes('yes') || 
                      normalizedResponse.includes('pass') || 
                      normalizedResponse.includes('succeed') || 
                      normalizedResponse.includes('correct');
        
        return { 
          success, 
          error: success ? undefined : `Language model evaluation could not confirm success. Response: "${response.substring(0, 100)}..."` 
        };
      }
      
      const success = normalizedResponse === 'yes';
      if (!success) {
        console.error(`Language model evaluation failed with response: "${response}"`);
      }
      
      return { success, error: success ? undefined : 'Language model evaluation returned "no"' };
    } catch (apiError) {
      // Handle language model API errors specifically
      console.error(`Language model API error: ${apiError.message}`);
      
      // Provide a fallback evaluation message
      return { 
        success: false, 
        error: `Language model evaluation skipped due to API error: ${apiError.message}. Please review the task output manually.` 
      };
    }
    
  } catch (error) {
    console.error(`Unexpected error in language model evaluation: ${error.message}`);
    return { 
      success: false, 
      error: `Error in language model evaluation: ${error.message}. Evaluation skipped; please review the task output manually.` 
    };
  }
}

/**
 * Execute all tasks in a spec
 * @param spec The complete spec object
 * @param specName The name of the spec (used for worktree path)
 * @param mainRepoRoot The root path of the main repository (for lessons logging)
 * @returns Promise resolving to an array of task results
 */
export async function executeAllTasks(spec: Spec, specName: string, mainRepoRoot: string): Promise<TaskResult[]> {
  const results: TaskResult[] = [];
  const executionDataArray: any[] = [];
  
  for (const task of spec.tasks) {
    // Skip tasks that are already done
    if (task.done) {
      console.log(`Skipping task '${task.name}' (already done)`);
      continue;
    }
    
    console.log(`Executing task '${task.name}'...`);
    const result = await executeTask(spec, task, specName);
    results.push(result);
    
    // Collect execution data for lessons logger
    const executionData = {
      specName,
      taskName: task.name,
      attempts: result.attempts,
      success: result.success,
      error: result.error,
      output: result.output
    };
    executionDataArray.push(executionData);
    
    // Mark task as done if successful
    if (result.success) {
      task.done = true;
      console.log(`Task '${task.name}' completed successfully`);
    } else {
      console.error(`Task '${task.name}' failed: ${result.error}`);
      // Stop execution on first failure
      break;
    }
  }
  
  // Log lessons for all executed tasks
  try {
    const { logLessons } = await import('./lessonsLogger');
    const loggedCount = await logLessons(mainRepoRoot, executionDataArray);
    console.log(`Logged lessons for ${loggedCount} task(s)`);
  } catch (error) {
    console.error(`Error logging lessons: ${error.message}`);
  }
  
  return results;
}