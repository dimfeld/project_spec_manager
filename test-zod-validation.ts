import { parseSpec } from './src/specManager';

async function testValidation() {
  try {
    // Create a valid spec file for testing
    console.log('Creating valid spec file...');
    const fs = await import('fs');
    const validSpecPath = './specs/valid-test-spec.yaml';
    
    const validSpecContent = `# Automated Development Task Manager - Spec Template
# Generated for testing

aider_config:
  model: 'gpt-4' # Non-empty model field
  architect_mode: false
  editable_files: []
  readonly_files: []
  retries: 10
  test_command: 'npm test'

objective: |
  Test objective for Zod validation.

implementation_details: |
  Implementation details for testing.

tasks:
  - name: 'task-1'
    done: false
    prompt: |
      This is a test task prompt.
`;
    
    fs.writeFileSync(validSpecPath, validSpecContent);
    
    // Test with the valid spec
    console.log('Testing valid spec...');
    const validSpec = await parseSpec(validSpecPath);
    console.log('Valid spec parsed successfully!');
    
    // Test with an invalid spec (we'll create a temporary invalid spec file)
    console.log('\nTesting invalid spec...');
    const invalidSpecPath = './specs/invalid-test-spec.yaml';
    
    // Create an invalid spec (missing required fields)
    const invalidSpecContent = `
aider_config:
  model: 'gpt-4'
  architect_mode: false
  editable_files: []
  readonly_files: []
  # Missing retries field
  
# Missing objective field

implementation_details: |
  Some implementation details

tasks:
  - name: 'task-1'
    # Missing prompt field
    done: false
`;
    
    fs.writeFileSync(invalidSpecPath, invalidSpecContent);
    
    try {
      await parseSpec(invalidSpecPath);
      console.log('Error: Invalid spec was parsed without errors!');
    } catch (error) {
      console.log('Invalid spec correctly failed validation:');
      console.log(error.message);
    }
    
    // Clean up the temporary files
    fs.unlinkSync(invalidSpecPath);
    fs.unlinkSync(validSpecPath);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testValidation();
