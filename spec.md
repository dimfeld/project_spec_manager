# Specification: Automated Development Task Manager

## Overview

The **Automated Development Task Manager** is a terminal-based application designed to automate software development tasks—specifically code generation, testing, and documentation—using the Aider tool. It generates YAML specification templates for users to define tasks, executes those specifications in isolated version control branches, and logs lessons learned about unexpected issues or corrections in a `LESSONS.md` file using a language model.

- **Primary Function:** Automate development tasks (code generation, testing, documentation) by generating and executing YAML specifications.
- ** Tech Stack:** Bun JavaScript runtime, Jujutsu (`jj`) for version control (Git as fallback), YAML for specifications, Markdown for lessons learned.
- **Date:** March 01, 2025 (current context).

---

## Requirements

### Functional Requirements

1. **Specification Template Generation:**

   - Generate a YAML template for users to define tasks.
   - Support presets for common task types (e.g., "generate a function," "write unit tests," "create API docs").

2. **Specification Execution:**

   - Parse and execute a user-filled YAML spec file.
   - Create a new worktree and branch named after the spec file using Jujutsu (`jj`) or Git if `jj` isn’t initialized.
   - Run tasks using Aider with configurations from the spec.
   - Retry failed tasks up to a customizable limit (default: 10), stopping with an error if exceeded.

3. **Lessons Learned Logging:**

   - Automatically generate lessons about unexpected issues or corrections after execution.
   - Use a language model to analyze execution data and write entries to `LESSONS.md`.

4. **Cleanup Command:**
   - Provide a separate CLI command to clean up worktrees and branches.

### Non-Functional Requirements

- **Performance:** Execute tasks efficiently using Bun’s fast runtime.
- **Usability:** Simple CLI interface for generating templates, running specs, and cleaning up.
- **Extensibility:** Allow customization of retry limits and easy addition of new Aider settings.

---

## Architecture

### Tech Stack

- **Runtime:** Bun (JavaScript) for fast execution and built-in file system APIs.
- **Version Control:** Jujutsu (`jj`) for worktree/branch management; Git as fallback.
- **Data Storage:**
  - YAML files for specifications (stored in a `specs/` directory).
  - Markdown file (`LESSONS.md`) for lessons learned.
- **External Tools:** Aider for task execution, integrated via command-line spawning.

### Components

1. **CLI Interface:**

   - Commands: `generate <spec-name>` (create YAML template), `run <spec-file>` (execute spec), `cleanup <spec-name>` (remove branch/worktree).

2. **Spec Manager:**

   - Generates YAML templates with presets.
   - Parses and validates user-filled spec files.

3. **Version Control Manager:**

   - Detects `jj` or Git usage.
   - Creates and manages worktrees/branches.

4. **Task Executor:**

   - Concatenates spec sections for Aider.
   - Runs tasks with retry logic and evaluation.

5. **Lessons Logger:**
   - Uses a language model to generate lessons.
   - Appends formatted entries to `LESSONS.md`.

### Workflow

1. User runs `generate <spec-name>` → Tool creates `specs/<spec-name>.yaml`.
2. User fills in the YAML spec.
3. User runs `run specs/<spec-name>.yaml` → Tool:
   - Creates a branch/worktree named `<spec-name>`.
   - Executes tasks with Aider, retrying up to 10 times (configurable).
   - Generates lessons and updates `LESSONS.md`.
4. If retries are exceeded, tool stops and raises an error.
5. User runs `cleanup <spec-name>` to remove the branch/worktree.

---

## Data Handling

### YAML Specification Format

Each spec file (`specs/<spec-name>.yaml`) follows this structure:

```yaml
aider_config:
  model: "gpt-4"          # Aider model to use
  architect_mode: false   # Enable/disable architect mode
  editable_files:         # Files Aider can modify
    - "src/*.js"
  readonly_files:         # Files Aider can read but not modify
    - "docs/*.md"
  retries: 10             # Optional, defaults to 10
objective: |
  Free-form text describing the high-level goal.
implementation_details: |
  Free-form technical notes and requirements for all tasks.
tasks:
  - name: "task-1"
    # The tool marks a task as done after it completes it.
    done: false
    prompt: |
      A few sentences describing what to do for this task.
    evaluation:           # Optional
      type: "test"        # Runs project’s test command
      # OR
      type: "command"     # Custom command evaluation
      command: "node check.js"
      check_prompt: "Does the output match expected behavior?"
```

- **Objective:** Free-form text, concatenated with task prompts.
- **Implementation Details:** Free-form technical notes, applies to all tasks.
- **Tasks:** List of named tasks with prompts (multi-sentence) and optional evaluation (test or command-based).

### Concatenation for Aider

For each task, the tool concatenates:

```
Objective: <objective text>
Technical Notes: <implementation_details text>
Task Prompt: <task prompt text>
```

Passed as a single input to Aider with clear labels for context.

### LESSONS.md Format

Entries are appended as Markdown:

```markdown
## <spec-name> - <timestamp>

- **Task:** <task-name>
- **Lesson:** <language model-generated text about unexpected issues or corrections>
```

---

## Error Handling Strategies

1. **YAML Parsing Errors:**

   - Validate spec structure (required fields: `aider_config`, `objective`, `tasks`).
   - Throw descriptive error with line number if invalid.

2. **Version Control Failures:**

   - If `jj` or Git commands fail (e.g., repo not initialized), log error and exit with a user-friendly message.

3. **Task Execution Failures:**

   - Retry up to the specified limit (default 10).
   - On exceeding retries, stop execution, log the failure, and raise an error with the task name and retry count.

4. **Aider Integration Issues:**

   - Catch spawn errors (e.g., Aider not installed) and suggest installation steps.

5. **Lessons Generation Failures:**
   - If the language model fails (e.g., API unavailable), log a fallback entry like "Lesson generation failed; manual review needed."

---

## Testing Plan

### Unit Tests

1. **Spec Manager:**

   - Test YAML template generation with presets.
   - Test parsing and validation of valid/invalid specs.

2. **Version Control Manager:**

   - Test branch/worktree creation with `jj` in a mock repo.
   - Test Git fallback in a non-`jj` repo.

3. **Task Executor:**

   - Mock Aider runs to verify concatenation and retry logic.
   - Test evaluation types (test command, custom command).

4. **Lessons Logger:**
   - Mock language model responses to test Markdown formatting and appending.

### Integration Tests

1. **Full Workflow:**

   - Generate a spec, fill it, run it in a test repo, and verify branch creation, task execution, and `LESSONS.md` updates.
   - Test failure case (exceed retries) and ensure error is raised.

2. **CLI Commands:**
   - Test `generate`, `run`, and `cleanup` with valid/invalid inputs.

### Manual Tests

1. **Real Aider Execution:**
   - Run a sample spec with Aider in a real project to confirm integration.
2. **Lessons Quality:**
   - Review generated lessons for accuracy and relevance.

---

## Implementation Notes

- **Bun APIs:** Use `Bun.file` for YAML and Markdown I/O, `Bun.spawn` for Aider and version control commands.
- **Language Model:** Assume xAI’s API (or similar) for lessons generation; include a configurable endpoint.
- **Presets:** Hardcode initial presets (e.g., "function generation," "unit test creation") in `src/presets.js`.
- **Dependencies:** `js-yaml` for parsing, no SQLite unless future persistence is needed.
