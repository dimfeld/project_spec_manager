import { parseSpec, readProjectSettings } from './src/specManager';

async function testConfigMerge() {
  try {
    // First, read and display project settings
    console.log('Reading project settings...');
    const settings = await readProjectSettings();
    console.log('Project settings:', settings ? JSON.stringify(settings, null, 2) : 'No settings found');
    
    // Parse spec with partial config
    console.log('\nParsing spec with partial config...');
    const specPath = './specs/test-merge-spec.yaml';
    const spec = await parseSpec(specPath);
    
    // Display merged config
    console.log('\nMerged aider_config:');
    console.log(JSON.stringify(spec.aider_config, null, 2));
    
    // Verify merging behavior
    console.log('\nVerifying merge behavior:');
    if (spec.aider_config.model === 'gpt-4') {
      console.log('✓ Model correctly overridden from spec (gpt-4)');
    } else {
      console.log('✗ Model not correctly overridden, got:', spec.aider_config.model);
    }
    
    if (spec.aider_config.retries === 10) {
      console.log('✓ Retries correctly overridden from spec (10)');
    } else {
      console.log('✗ Retries not correctly overridden, got:', spec.aider_config.retries);
    }
    
    if (spec.aider_config.test_command === 'bun test') {
      console.log('✓ Test command correctly inherited from project settings');
    } else {
      console.log('✗ Test command not correctly inherited, got:', spec.aider_config.test_command);
    }
    
    // Check array merging
    const hasProjectFiles = spec.aider_config.editable_files.includes('src/**/*.ts');
    const hasSpecFiles = spec.aider_config.editable_files.includes('src/specManager.ts');
    
    if (hasProjectFiles && hasSpecFiles) {
      console.log('✓ Editable files correctly merged from both sources');
      console.log('  Editable files:', spec.aider_config.editable_files);
    } else {
      console.log('✗ Editable files not correctly merged');
      console.log('  Editable files:', spec.aider_config.editable_files);
    }
    
    // Now test a spec with no aider_config
    console.log('\nTesting spec with no aider_config...');
    // Create a temporary spec with no aider_config
    const fs = await import('fs');
    const noConfigSpecPath = './specs/no-config-spec.yaml';
    
    const noConfigContent = `
objective: |
  Test spec with no aider_config.

implementation_details: |
  This spec has no aider_config and should use project settings.

tasks:
  - name: 'test-task'
    done: false
    prompt: |
      This is a test task for a spec with no config.
`;
    
    fs.writeFileSync(noConfigSpecPath, noConfigContent);
    
    // Parse the spec
    const noConfigSpec = await parseSpec(noConfigSpecPath);
    
    // Display the config
    console.log('\nConfig from project settings:');
    console.log(JSON.stringify(noConfigSpec.aider_config, null, 2));
    
    // Verify it uses project settings
    if (noConfigSpec.aider_config.model === 'gpt-4-turbo') {
      console.log('✓ Model correctly inherited from project settings');
    } else {
      console.log('✗ Model not correctly inherited, got:', noConfigSpec.aider_config.model);
    }
    
    // Clean up
    fs.unlinkSync(noConfigSpecPath);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testConfigMerge();
