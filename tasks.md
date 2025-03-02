Below is a detailed list of tasks to implement an **Automated Development Task Manager** based on the provided specification. The tool automates development tasks using a YAML specification, integrates with version control (Jujutsu or Git), executes tasks with Aider, evaluates outcomes, and logs lessons learned. The tasks are organized by component and include setup, implementation, testing, and documentation phases. Each task is broken down into actionable steps to guide development.

---

## Task List for Implementation

### 1. **Set Up Project Structure and Dependencies**

- **Task 1.1: Initialize Project**
  - Set up the `src/` directory with the following files:
    - `cli.ts`: Command-line interface logic.
    - `specManager.ts`: Spec template generation and parsing.
    - `vcsManager.ts`: Version control operations.
    - `taskExecutor.ts`: Task execution with Aider and evaluations.
    - `lessonsLogger.ts`: Lessons generation and logging.
    - `utils.ts`: Shared utility functions.
- **Task 1.2: Install Dependencies**
  - Install `js-yaml` for YAML parsing: `bun add js-yaml`.

### 2. **Implement CLI Interface**

- **Task 2.1: Parse Command-Line Arguments**
  - Use `process.argv` to detect and handle three commands:
    - `generate <spec-name>`: Generate a YAML spec template.
    - `run <spec-file>`: Execute the specified YAML spec.
    - `cleanup <spec-name>`: Remove associated branch and worktree.
  - Extract additional arguments (e.g., `<spec-name>`, `<spec-file>`).
- **Task 2.2: Add Help and Error Handling**
  - Display usage instructions if the command is invalid or arguments are missing (e.g., "Usage: bun run cli.ts [generate|run|cleanup] ...").
  - Handle extra or malformed arguments with descriptive error messages.

### 3. **Implement Spec Manager**

- **Task 3.1: Generate YAML Spec Templates**
  - Define a hardcoded YAML template string in `specManager.ts` with:
    ```yaml
    aider_config:
      model: ''
      architect_mode: false
      editable_files: []
      readonly_files: []
      retries: 10
      test_command: '' # Optional
    objective: |
      Describe the high-level goal here.
    implementation_details: |
      Add technical notes and requirements here.
    tasks:
      - name: 'task-1'
        prompt: |
          Describe what to do for this task.
        evaluation: # Optional
          type: 'test' # or "command"
          command: '' # for "command" type only
          check_prompt: '' # for "command" type only
    ```
  - Add inline comments in the template to guide users (e.g., "# Specify the AI model to use").
  - Support presets (e.g., `--preset function`) by appending pre-defined tasks to the `tasks` section.
- **Task 3.2: Parse and Validate Specs**
  - Write a `parseSpec(filePath)` function to:
    - Read the spec file using `Bun.file(filePath).text()`.
    - Parse it into a JavaScript object with `js-yaml`.
  - Validate the spec structure:
    - Ensure `aider_config`, `objective`, and `tasks` are present.
    - Check `aider_config` has required fields (`model`, `architect_mode`, `editable_files`, `readonly_files`, `retries`) and optional `test_command`.
    - Verify each task has `name` and `prompt`; if `evaluation` exists, it must have `type` ("test" or "command") and, for "command", `command` and `check_prompt`.
  - Throw errors with specific messages for validation failures (e.g., "Missing required field: aider_config.model").

### 4. **Implement Version Control Manager**

- **Task 4.1: Detect Version Control System**
  - In `vcsManager.ts`, write a `detectVC()` function to:
    - Check for a `.jj` directory or run `jj status` to detect Jujutsu.
    - Return "jj" if Jujutsu is initialized; otherwise, return "git".
- **Task 4.2: Create Branch and Worktree**
  - Write a `createBranch(specName)` function to:
    - For Jujutsu:
      - Run `jj branch create <specName>` to create a branch.
      - Run `jj worktree add ../worktrees/<specName> <specName>` to create a worktree outside the repo.
    - For Git:
      - Run `git branch <specName>` to create a branch.
      - Run `git worktree add ../worktrees/<specName> <specName>` to create a worktree.
    - Use `Bun.spawn` to execute commands and handle errors (e.g., branch already exists).
- **Task 4.3: Cleanup Branch and Worktree**
  - Write a `cleanupBranch(specName)` function to:
    - For Jujutsu:
      - Run `jj worktree remove ../worktrees/<specName>`.
      - Run `jj branch delete <specName>`.
    - For Git:
      - Run `git worktree remove ../worktrees/<specName>`.
      - Run `git branch -d <specName>`.
    - Catch errors (e.g., worktree not found) and log them to the user.

### 5. **Implement Task Executor**

- **Task 5.1: Prepare Task Prompt**
  - Write a function to concatenate `objective`, `implementation_details`, and `task.prompt` with separators (e.g., "Objective:\n...\nTechnical Notes:\n...\nTask Prompt:\n...").
- **Task 5.2: Execute Aider**
  - Change the working directory to the worktree path using `process.chdir(path.join(process.cwd(), '../worktrees', specName))`.
  - Construct an Aider command with `aider_config` settings (e.g., `aider --model <model> --architect <architect_mode> --files <editable_files> --readonly <readonly_files> "<prompt>"`).
  - Use `Bun.spawn` to run Aider, capture output, and handle errors.
- **Task 5.3: Handle Evaluations and Retries**
  - For each task with an `evaluation`:
    - **"test" type**: Run the `test_command` from `aider_config` (e.g., `npm test`) and check the exit code (0 for success).
    - **"command" type**: Run the specified `command`, capture output, and send it with `check_prompt` to a language model API; expect a "yes" or "no" response.
  - Implement a retry loop:
    - Retry up to `retries` times if evaluation fails.
    - Track attempts and stop with an error if retries are exceeded.

### 6. **Implement Lessons Logger**

- **Task 6.1: Collect Execution Data**
  - Store data during task execution: task name, retry count, outcome (success/failure), and error messages.
- **Task 6.2: Generate Lessons with Language Model**
  - Write a `queryLanguageModel(prompt)` function to send prompts to a language model API, using an API key from `process.env.LANGUAGE_MODEL_API_KEY`. Use the `ai` package for this.
  - Construct a prompt with execution data (e.g., "Task: <name>, Retries: <count>, Outcome: <result>, Errors: <errors>").
  - Parse the response for a concise lessons summary.
- **Task 6.3: Append to LESSONS.md**
  - Use the main repo root path (stored at startup as `const mainRepoRoot = process.cwd()`) to locate `LESSONS.md`.
  - Format lessons with a header (e.g., `## <specName> - <timestamp>`) and bullet points or a paragraph.
  - Append atomically using `Bun.write` with append mode.

### 7. **Add Error Handling and Logging**

- **Task 7.1: Spec Errors**
  - Catch YAML parsing errors and report line numbers; log validation failures with field-specific messages.
- **Task 7.2: Version Control Errors**
  - Handle failures in branch/worktree creation or cleanup (e.g., "Branch already exists" or "Worktree not found").
- **Task 7.3: Aider Errors**
  - Log Aider execution failures with suggestions (e.g., "Ensure Aider is installed and accessible").
- **Task 7.4: Evaluation and Lessons Errors**
  - Handle evaluation command failures or API unavailability with fallback messages (e.g., "Evaluation skipped; review manually").

### 8. **Write Unit Tests**

- **Task 8.1: Spec Manager Tests**
  - Test template generation with and without presets.
  - Test parsing and validation with valid and invalid YAML files.
- **Task 8.2: Version Control Tests**
  - Mock `Bun.spawn` to test Jujutsu/Git detection, branch creation, and cleanup.
- **Task 8.3: Task Executor Tests**
  - Mock Aider and evaluation commands to test prompt concatenation, retries, and evaluation logic.
- **Task 8.4: Lessons Logger Tests**
  - Mock language model responses to verify lessons formatting and file appending.

### 9. **Write Integration Tests**

- **Task 9.1: Full Workflow Test**
  - Create a test repo, generate a sample spec, run it, and verify:
    - Branch and worktree creation.
    - Task execution and evaluation.
    - Lessons appended to `LESSONS.md`.
  - Test failure cases (e.g., retries exceeded).

### 10. **Document Code and Usage**

- **Task 10.1: Code Comments**
  - Add inline comments to key functions in all source files explaining logic and parameters.
- **Task 10.2: User Documentation**
  - Create `README.md` with:
    - Installation steps (e.g., `bun install`).
    - Configuration (e.g., setting `LANGUAGE_MODEL_API_KEY`).
    - Usage examples for all CLI commands.

---

## Implementation Notes

- **Presets**: Define in `specManager.ts` (e.g., `function`, `test`, `docs`) to add sample tasks like generating a function or writing tests.
- **Worktree Paths**: Use `../worktrees/<specName>` relative to the repo root for isolation; resolve paths with `path.join`.
- **Aider Integration**: Confirm Aider’s CLI flags for model, files, etc., in its documentation.
- **Language Model**: Use a configurable API endpoint and key with the `ai` package.
- **Concurrency**: Ensure `LESSONS.md` updates are atomic to avoid conflicts in concurrent runs.

This task list provides a comprehensive roadmap to build the Automated Development Task Manager. Each task is actionable and builds toward a fully functional tool that meets the specification requirements. Let me know if you need clarification or further breakdown!
