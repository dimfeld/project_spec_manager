/**
 * Version Control Manager for Project Spec Manager
 * Handles version control operations (Git/Jujutsu) for creating branches and worktrees
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { spawn, SpawnOptions } from 'bun';

/**
 * Detects which version control system is being used
 * @returns 'jj' if Jujutsu is initialized, otherwise 'git'
 */
export async function detectVC(): Promise<'jj' | 'git'> {
  // Check if .jj directory exists
  if (existsSync('.jj')) {
    return 'jj';
  }

  // Try running jj status to check if jj is initialized
  try {
    const process = spawn(['jj', 'status'], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    
    const exitCode = await process.exited;
    if (exitCode === 0) {
      return 'jj';
    } else {
      const stderr = await new Response(process.stderr).text();
      console.log(`Jujutsu command failed with exit code ${exitCode}: ${stderr}`);
      console.log('Defaulting to Git');
    }
  } catch (error) {
    // jj command failed or not found, will default to git
    console.log(`Jujutsu not detected (${error.message}), defaulting to Git`);
  }

  return 'git';
}

/**
 * Creates a branch and worktree for a specification
 * @param specName Name of the specification (used for branch and worktree names)
 * @returns Promise resolving to the path of the created worktree
 */
export async function createBranch(specName: string): Promise<string> {
  const vcs = await detectVC();
  const worktreePath = join('..', 'worktrees', specName);
  
  try {
    if (vcs === 'jj') {
      // Create branch with Jujutsu
      const branchProcess = spawn(['jj', 'branch', 'create', specName], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const branchExitCode = await branchProcess.exited;
      if (branchExitCode !== 0) {
        const stderr = await new Response(branchProcess.stderr).text();
        // If branch already exists, continue with worktree creation
        if (!stderr.includes('already exists')) {
          throw new Error(`Failed to create branch: ${stderr}`);
        }
        console.log(`Branch ${specName} already exists, continuing with worktree creation`);
      }
      
      // Create worktree with Jujutsu
      const worktreeProcess = spawn(['jj', 'worktree', 'add', worktreePath, specName], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const worktreeExitCode = await worktreeProcess.exited;
      if (worktreeExitCode !== 0) {
        const stderr = await new Response(worktreeProcess.stderr).text();
        throw new Error(`Failed to create worktree: ${stderr}`);
      }
    } else {
      // Create branch with Git
      const branchProcess = spawn(['git', 'branch', specName], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const branchExitCode = await branchProcess.exited;
      if (branchExitCode !== 0) {
        const stderr = await new Response(branchProcess.stderr).text();
        // If branch already exists, continue with worktree creation
        if (!stderr.includes('already exists')) {
          throw new Error(`Failed to create branch: ${stderr}`);
        }
        console.log(`Branch ${specName} already exists, continuing with worktree creation`);
      }
      
      // Create worktree with Git
      const worktreeProcess = spawn(['git', 'worktree', 'add', worktreePath, specName], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const worktreeExitCode = await worktreeProcess.exited;
      if (worktreeExitCode !== 0) {
        const stderr = await new Response(worktreeProcess.stderr).text();
        throw new Error(`Failed to create worktree: ${stderr}`);
      }
    }
    
    console.log(`Created branch and worktree for ${specName}`);
    return worktreePath;
  } catch (error) {
    // Provide more detailed error messages for common VCS errors
    let errorMessage = `Error creating branch and worktree: ${error.message}`;
    
    if (error.message.includes('already exists')) {
      errorMessage = `Branch '${specName}' already exists. Use a different name or clean up the existing branch first.`;
    } else if (error.message.includes('not a git repository')) {
      errorMessage = `Failed to create branch: Not a git repository. Ensure you're in the root of a valid git repository.`;
    } else if (error.message.includes('path already exists')) {
      errorMessage = `Worktree path '${worktreePath}' already exists. Remove it manually or use a different spec name.`;
    } else if (error.message.includes('Permission denied')) {
      errorMessage = `Permission denied when creating branch or worktree. Check your file system permissions.`;
    }
    
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Cleans up a branch and worktree for a specification
 * @param specName Name of the specification (used for branch and worktree names)
 */
export async function cleanupBranch(specName: string): Promise<void> {
  const vcs = await detectVC();
  const worktreePath = join('..', 'worktrees', specName);
  
  try {
    if (vcs === 'jj') {
      // Remove worktree with Jujutsu
      try {
        const worktreeProcess = spawn(['jj', 'worktree', 'remove', worktreePath], {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        
        const worktreeExitCode = await worktreeProcess.exited;
        if (worktreeExitCode !== 0) {
          const stderr = await new Response(worktreeProcess.stderr).text();
          let warningMessage = `Warning: Failed to remove worktree: ${stderr}`;
          
          if (stderr.includes('does not exist')) {
            warningMessage = `Worktree '${worktreePath}' does not exist. It may have been already removed.`;
          } else if (stderr.includes('not found')) {
            warningMessage = `Worktree '${worktreePath}' not found. It may have been already removed.`;
          }
          
          console.warn(warningMessage);
        } else {
          console.log(`Removed worktree for ${specName}`);
        }
      } catch (worktreeError) {
        console.warn(`Warning: Error removing worktree: ${worktreeError.message}`);
      }
      
      // Delete branch with Jujutsu
      try {
        const branchProcess = spawn(['jj', 'branch', 'delete', specName], {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        
        const branchExitCode = await branchProcess.exited;
        if (branchExitCode !== 0) {
          const stderr = await new Response(branchProcess.stderr).text();
          let warningMessage = `Warning: Failed to delete branch: ${stderr}`;
          
          if (stderr.includes('not found')) {
            warningMessage = `Branch '${specName}' not found. It may have been already deleted.`;
          } else if (stderr.includes('cannot delete')) {
            warningMessage = `Cannot delete branch '${specName}'. It may be checked out or have unmerged changes.`;
          }
          
          console.warn(warningMessage);
        } else {
          console.log(`Deleted branch ${specName}`);
        }
      } catch (branchError) {
        console.warn(`Warning: Error deleting branch: ${branchError.message}`);
      }
    } else {
      // Remove worktree with Git
      try {
        const worktreeProcess = spawn(['git', 'worktree', 'remove', worktreePath], {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        
        const worktreeExitCode = await worktreeProcess.exited;
        if (worktreeExitCode !== 0) {
          const stderr = await new Response(worktreeProcess.stderr).text();
          let warningMessage = `Warning: Failed to remove worktree: ${stderr}`;
          
          if (stderr.includes('does not exist')) {
            warningMessage = `Worktree '${worktreePath}' does not exist. It may have been already removed.`;
          } else if (stderr.includes('not found')) {
            warningMessage = `Worktree '${worktreePath}' not found. It may have been already removed.`;
          }
          
          console.warn(warningMessage);
        } else {
          console.log(`Removed worktree for ${specName}`);
        }
      } catch (worktreeError) {
        console.warn(`Warning: Error removing worktree: ${worktreeError.message}`);
      }
      
      // Delete branch with Git
      try {
        const branchProcess = spawn(['git', 'branch', '-d', specName], {
          stdout: 'pipe',
          stderr: 'pipe',
        });
        
        const branchExitCode = await branchProcess.exited;
        if (branchExitCode !== 0) {
          const stderr = await new Response(branchProcess.stderr).text();
          let warningMessage = `Warning: Failed to delete branch: ${stderr}`;
          
          if (stderr.includes('not found')) {
            warningMessage = `Branch '${specName}' not found. It may have been already deleted.`;
          } else if (stderr.includes('cannot delete')) {
            warningMessage = `Cannot delete branch '${specName}'. It may be checked out or have unmerged changes.`;
          }
          
          console.warn(warningMessage);
        } else {
          console.log(`Deleted branch ${specName}`);
        }
      } catch (branchError) {
        console.warn(`Warning: Error deleting branch: ${branchError.message}`);
      }
    }
  } catch (error) {
    console.error(`Error cleaning up branch and worktree: ${error.message}`);
    throw error;
  }
}