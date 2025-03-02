/**
 * Lessons Logger for the Automated Development Task Manager
 * 
 * Collects execution data, generates lessons with a language model, and appends them to LESSONS.md
 */

import { join } from 'path';
import { existsSync } from 'fs';
import { getFormattedTimestamp, queryLanguageModel } from './utils';

/**
 * Execution data for a task
 */
export interface TaskExecutionData {
  specName: string;
  taskName: string;
  attempts: number;
  success: boolean;
  error?: string;
  output?: string;
}

/**
 * Generate a lesson from task execution data using a language model
 * @param executionData Data from task execution
 * @returns Promise resolving to the generated lesson text
 */
export async function generateLesson(executionData: TaskExecutionData): Promise<string> {
  try {
    // Validate execution data
    if (!executionData.specName || !executionData.taskName) {
      const error = 'Missing required execution data fields (specName or taskName)';
      console.error(`Lesson generation error: ${error}`);
      return `Lesson generation skipped: ${error}. Please ensure all required execution data is provided.`;
    }

    // Construct a prompt for the language model
    const prompt = `
Please analyze the following task execution data and generate a concise lesson about any unexpected issues or corrections that were needed:

Spec: ${executionData.specName}
Task: ${executionData.taskName}
Attempts: ${executionData.attempts}
Outcome: ${executionData.success ? 'Success' : 'Failure'}
${executionData.error ? `Error: ${executionData.error}` : ''}

Task Output:
${executionData.output || 'No output available'}

Please provide a concise, specific lesson that would be valuable for future development. Focus on unexpected issues, corrections, or insights that would help avoid similar problems in the future. Keep your response under 200 words and make it directly applicable to this specific task.
`;

    console.log(`Generating lesson for task '${executionData.taskName}' in spec '${executionData.specName}'...`);
    
    try {
      // Query the language model
      const response = await queryLanguageModel(prompt);
      
      if (!response || response.trim().length === 0) {
        console.warn('Language model returned empty response for lesson generation');
        return 'No lesson could be generated. The language model returned an empty response. Please review the task execution manually.';
      }
      
      // Return the response as the lesson
      return response.trim();
    } catch (apiError) {
      // Handle language model API errors specifically
      console.error(`Language model API error during lesson generation: ${apiError.message}`);
      return `Lesson generation failed due to API error: ${apiError.message}. Please check your API key configuration and network connectivity.`;
    }
  } catch (error) {
    console.error(`Unexpected error during lesson generation: ${error.message}`);
    return `Lesson generation failed: ${error.message}. Manual review of task execution may be needed.`;
  }
}

/**
 * Format a lesson for appending to LESSONS.md
 * @param executionData Data from task execution
 * @param lessonText The generated lesson text
 * @returns Formatted markdown string
 */
export function formatLesson(executionData: TaskExecutionData, lessonText: string): string {
  const timestamp = getFormattedTimestamp();
  
  return `
## ${executionData.specName} - ${timestamp}

- **Task:** ${executionData.taskName}
- **Outcome:** ${executionData.success ? 'Success' : 'Failure'} (${executionData.attempts} attempt${executionData.attempts !== 1 ? 's' : ''})
- **Lesson:** ${lessonText}

---
`;
}

/**
 * Append a lesson to LESSONS.md
 * @param mainRepoRoot The root path of the main repository
 * @param formattedLesson The formatted lesson text to append
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function appendLesson(mainRepoRoot: string, formattedLesson: string): Promise<boolean> {
  // Validate inputs
  if (!mainRepoRoot) {
    console.error('Error appending lesson: mainRepoRoot is required');
    return false;
  }
  
  if (!formattedLesson || formattedLesson.trim().length === 0) {
    console.error('Error appending lesson: formattedLesson is empty');
    return false;
  }
  
  try {
    const lessonsFilePath = join(mainRepoRoot, 'LESSONS.md');
    
    // Create the file with a header if it doesn't exist
    if (!existsSync(lessonsFilePath)) {
      console.log(`Creating new LESSONS.md file at ${lessonsFilePath}`);
      const header = '# Development Task Lessons

This file contains automatically generated lessons from task executions, highlighting unexpected issues and corrections.

---
';
      
      try {
        await Bun.write(lessonsFilePath, header);
      } catch (writeError) {
        console.error(`Failed to create LESSONS.md file: ${writeError.message}`);
        if (writeError.message.includes('permission denied')) {
          console.error('Check file system permissions for the repository root directory');
        }
        return false;
      }
    }
    
    // Append the lesson to the file
    try {
      const file = Bun.file(lessonsFilePath);
      const existingContent = await file.text();
      await Bun.write(lessonsFilePath, existingContent + formattedLesson);
      
      console.log(`Lesson successfully appended to ${lessonsFilePath}`);
      return true;
    } catch (appendError) {
      console.error(`Failed to append to LESSONS.md: ${appendError.message}`);
      if (appendError.message.includes('permission denied')) {
        console.error('Check file system permissions for LESSONS.md');
      } else if (appendError.message.includes('no such file')) {
        console.error('LESSONS.md was not found or was deleted after creation check');
      }
      return false;
    }
  } catch (error) {
    console.error(`Unexpected error appending lesson: ${error.message}`);
    return false;
  }
}

/**
 * Log a lesson from task execution data
 * @param mainRepoRoot The root path of the main repository
 * @param executionData Data from task execution
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function logLesson(mainRepoRoot: string, executionData: TaskExecutionData): Promise<boolean> {
  try {
    // Generate a lesson
    const lessonText = await generateLesson(executionData);
    
    // Format the lesson
    const formattedLesson = formatLesson(executionData, lessonText);
    
    // Append the lesson to LESSONS.md
    return await appendLesson(mainRepoRoot, formattedLesson);
  } catch (error) {
    console.error(`Error logging lesson: ${error.message}`);
    return false;
  }
}

/**
 * Log lessons from multiple task execution data points
 * @param mainRepoRoot The root path of the main repository
 * @param executionDataArray Array of task execution data
 * @returns Promise resolving to the number of successfully logged lessons
 */
export async function logLessons(mainRepoRoot: string, executionDataArray: TaskExecutionData[]): Promise<number> {
  let successCount = 0;
  
  for (const executionData of executionDataArray) {
    const success = await logLesson(mainRepoRoot, executionData);
    if (success) {
      successCount++;
    }
  }
  
  return successCount;
}