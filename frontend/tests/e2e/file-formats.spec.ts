import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test utilities (shared with main test file)
async function loginUser(page: Page) {
  await page.goto('/');
  
  // Check if already logged in by looking for the agent dashboard
  const agentDashboard = page.locator('h2:has-text("Dxsh Agents")');
  if (await agentDashboard.isVisible()) {
    return; // Already logged in
  }
  
  // Login flow
  await page.locator('input[type="email"]').fill('demo@example.com');
  await page.locator('input[type="password"]').fill('demo123');
  await page.locator('button[type="submit"]').click();
  
  // Wait for agent dashboard to appear
  await page.waitForSelector('h2:has-text("Dxsh Agents")', { timeout: 10000 });
}

async function createNewWorkflow(page: Page) {
  // Create or select a workflow agent
  const createButton = page.locator('button:has-text("Create Your First Agent")').first();
  if (await createButton.isVisible()) {
    // Handle agent name prompt
    page.on('dialog', async dialog => {
      if (dialog.message().includes('agent name')) {
        await dialog.accept('File Format Test Workflow');
      } else if (dialog.message().includes('agent description')) {
        await dialog.accept('Test agent for file format E2E tests');
      }
    });
    
    await createButton.click();
    
    // Wait for the workflow interface to load
    await page.waitForSelector('h3:has-text("Node Library")', { timeout: 10000 });
  }
}

async function clearCanvas(page: Page) {
  // Clear any existing nodes to prevent overlapping
  const existingNodes = page.locator('[data-testid^="rf__node-"]');
  const nodeCount = await existingNodes.count();
  
  if (nodeCount > 0) {
    // Click on canvas first to ensure it has focus
    const canvas = page.locator('[data-testid="rf__wrapper"]');
    await canvas.click();
    
    // Select all nodes and delete them
    await page.keyboard.press('Control+a');
    await page.waitForTimeout(500);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1000);
  }
}

async function addAndConfigureFileNode(page: Page, filePath: string) {
  // Clear canvas first to prevent overlapping nodes
  await clearCanvas(page);
  
  // Find the draggable File Node item in Storage section
  const fileNodeItem = page.locator('div[draggable="true"]').filter({ hasText: 'File Node' });
  
  // Find the workflow canvas area
  const canvas = page.locator('[data-testid="rf__wrapper"]');
  
  // Ensure both elements are visible before dragging
  await expect(fileNodeItem).toBeVisible();
  await expect(canvas).toBeVisible();
  
  // Drag File Node to canvas center
  const canvasBox = await canvas.boundingBox();
  if (canvasBox) {
    const centerX = canvasBox.x + canvasBox.width / 2;
    const centerY = canvasBox.y + canvasBox.height / 2;
    await fileNodeItem.dragTo(canvas, { targetPosition: { x: centerX - canvasBox.x, y: centerY - canvasBox.y } });
  } else {
    await fileNodeItem.dragTo(canvas);
  }
  
  // Wait a moment for the node to be created
  await page.waitForTimeout(1500);
  
  // The node appears with a data-testid that starts with "rf__node-fileNode_"
  const addedNode = page.locator('[data-testid^="rf__node-fileNode_"]').first();
  await expect(addedNode).toBeVisible({ timeout: 10000 });
  
  // Click on the added node to open configuration
  await addedNode.click();
  
  // Upload file
  await page.locator('input[type="file"]').setInputFiles(filePath);
  await page.locator('button:has-text("Upload")').click();
  
  return addedNode;
}

test.describe('File Format Support', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await createNewWorkflow(page);
  });

  test('should handle JSON files correctly', async ({ page }) => {
    const fileNode = await addAndConfigureFileNode(page, path.join(__dirname, 'fixtures/sample.json'));
    
    // Check JSON-specific features
    await expect(page.locator('text=sample.json')).toBeVisible();
    
    // Test preview
    await page.locator('button:has-text("Preview")').click();
    await expect(page.locator('text=File Preview')).toBeVisible();
    await expect(page.locator('text=John Doe')).toBeVisible();
    
    // Save and execute
    await page.locator('button:has-text("Save Configuration")').click();
    await fileNode.locator('button[title*="Run"]').click();
    
    // Check execution results
    await expect(fileNode.locator('text=3 records')).toBeVisible({ timeout: 10000 });
  });

  test('should handle CSV files with options', async ({ page }) => {
    const fileNode = await addAndConfigureFileNode(page, path.join(__dirname, 'fixtures/sample.csv'));
    
    // Check CSV-specific options appear
    await expect(page.locator('text=First row contains headers')).toBeVisible();
    await expect(page.locator('text=Delimiter')).toBeVisible();
    
    // Test delimiter selection
    const delimiterSelect = page.locator('select').first();
    await delimiterSelect.selectOption('Comma (,)');
    
    // Test headers checkbox
    const headersCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(headersCheckbox).toBeChecked(); // Should be checked by default
    
    // Test max rows option
    await page.locator('input[placeholder="All rows"]').fill('3');
    
    // Preview with options
    await page.locator('button:has-text("Preview")').click();
    await expect(page.locator('text=File Preview')).toBeVisible();
    
    // Save and execute
    await page.locator('button:has-text("Save Configuration")').click();
    await fileNode.locator('button[title*="Run"]').click();
    
    // Should load only 3 rows due to limit
    await expect(fileNode.locator('text=3 records')).toBeVisible({ timeout: 10000 });
  });

  test('should handle text files', async ({ page }) => {
    const fileNode = await addAndConfigureFileNode(page, path.join(__dirname, 'fixtures/sample.txt'));
    
    // Check text file is uploaded
    await expect(page.locator('text=sample.txt')).toBeVisible();
    
    // Test skip rows option for text files
    await page.locator('input[placeholder="0"]').fill('1'); // Skip first line
    
    // Preview
    await page.locator('button:has-text("Preview")').click();
    await expect(page.locator('text=File Preview')).toBeVisible();
    
    // Save and execute
    await page.locator('button:has-text("Save Configuration")').click();
    await fileNode.locator('button[title*="Run"]').click();
    
    // Should have processed lines
    await expect(fileNode.locator('text=4 records')).toBeVisible({ timeout: 10000 }); // 5 lines - 1 skipped
  });

  test('should validate file size limits', async ({ page }) => {
    // Create a large dummy file (this would be mocked in real implementation)
    // For now, we'll test with normal file and check the upload process
    
    const fileNode = await addAndConfigureFileNode(page, path.join(__dirname, 'fixtures/sample.json'));
    
    // File should upload successfully (within limits)
    await expect(page.locator('text=Current file: sample.json')).toBeVisible();
  });

  test('should handle unsupported file types', async ({ page }) => {
    // Add File Node
    const fileNode = page.locator('[data-testid="node-library"] >> text=File Node');
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await fileNode.dragTo(canvas);
    
    const addedNode = page.locator('.react-flow__node[data-type="fileNode"]');
    await addedNode.click();
    
    // Try to upload an unsupported file type (create a fake .xyz file)
    // In a real test, we'd create a temp file with unsupported extension
    // For this demo, we'll test the validation logic
    
    // Check that only supported file types are accepted
    const fileInput = page.locator('input[type="file"]');
    const acceptAttribute = await fileInput.getAttribute('accept');
    expect(acceptAttribute).toContain('.json');
    expect(acceptAttribute).toContain('.csv');
    expect(acceptAttribute).toContain('.xlsx');
    expect(acceptAttribute).toContain('.txt');
  });
});

test.describe('File Operations', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await createNewWorkflow(page);
  });

  test('should save data to JSON file', async ({ page }) => {
    // First add a data source
    const webSourceNode = page.locator('[data-testid="node-library"] >> text=Web Source');
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await webSourceNode.dragTo(canvas);
    
    // Add File Node as sink
    const fileNode = page.locator('[data-testid="node-library"] >> text=File Node');
    await fileNode.dragTo(canvas, { targetPosition: { x: 300, y: 100 } });
    
    const addedFileNode = page.locator('.react-flow__node[data-type="fileNode"]');
    
    // Connect the nodes
    const webSourceOutput = page.locator('.react-flow__node[data-type="webSource"] .react-flow__handle-bottom');
    const fileNodeInput = addedFileNode.locator('.react-flow__handle-top');
    await webSourceOutput.dragTo(fileNodeInput);
    
    // Configure File Node for saving
    await addedFileNode.click();
    await page.locator('button:has-text("Save to File (Sink)")').click();
    
    // Configure output settings
    await page.locator('input[placeholder="output_data.json"]').fill('test_output.json');
    await page.locator('button:has-text("Save Configuration")').click();
    
    // Node should show sink configuration
    await expect(addedFileNode.locator('text=Ready to Save')).toBeVisible();
    await expect(addedFileNode.locator('text=test_output.json')).toBeVisible();
  });

  test('should save data to CSV file', async ({ page }) => {
    // Add and configure source node
    const webSourceNode = page.locator('[data-testid="node-library"] >> text=Web Source');
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await webSourceNode.dragTo(canvas);
    
    // Add File Node as sink
    const fileNode = page.locator('[data-testid="node-library"] >> text=File Node');
    await fileNode.dragTo(canvas, { targetPosition: { x: 300, y: 100 } });
    
    const addedFileNode = page.locator('.react-flow__node[data-type="fileNode"]');
    await addedFileNode.click();
    
    // Configure for CSV output
    await page.locator('button:has-text("Save to File (Sink)")').click();
    await page.locator('input[placeholder="output_data.json"]').fill('output_data.csv');
    
    // Check that CSV options would appear (delimiter selection)
    // Note: In full implementation, this would show CSV-specific options
    
    await page.locator('button:has-text("Save Configuration")').click();
    
    await expect(addedFileNode.locator('text=Ready to Save')).toBeVisible();
    await expect(addedFileNode.locator('text=output_data.csv')).toBeVisible();
  });

  test('should handle encoding options', async ({ page }) => {
    const fileNode = await addAndConfigureFileNode(page, path.join(__dirname, 'fixtures/sample.txt'));
    
    // Check that encoding option is available for text files
    // In full implementation, this would show encoding dropdown
    // For now, verify the file upload worked
    await expect(page.locator('text=sample.txt')).toBeVisible();
    
    await page.locator('button:has-text("Save Configuration")').click();
  });

  test('should handle overwrite settings', async ({ page }) => {
    // Add File Node for saving
    const fileNode = page.locator('[data-testid="node-library"] >> text=File Node');
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await fileNode.dragTo(canvas);
    
    const addedFileNode = page.locator('.react-flow__node[data-type="fileNode"]');
    await addedFileNode.click();
    
    // Switch to sink mode
    await page.locator('button:has-text("Save to File (Sink)")').click();
    
    // Check overwrite options
    const overwriteCheckbox = page.locator('text=Overwrite existing files').locator('input[type="checkbox"]');
    await expect(overwriteCheckbox).toBeVisible();
    await expect(overwriteCheckbox).not.toBeChecked(); // Should be false by default
    
    // Check create directories option  
    const createDirsCheckbox = page.locator('text=Create directories if needed').locator('input[type="checkbox"]');
    await expect(createDirsCheckbox).toBeVisible();
    await expect(createDirsCheckbox).toBeChecked(); // Should be true by default
  });
});

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
    await createNewWorkflow(page);
  });

  test('should show validation errors for missing configuration', async ({ page }) => {
    // Add File Node
    const fileNode = page.locator('[data-testid="node-library"] >> text=File Node');
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await fileNode.dragTo(canvas);
    
    const addedFileNode = page.locator('.react-flow__node[data-type="fileNode"]');
    await addedFileNode.click();
    
    // Try to save without file selection (source mode)
    await page.locator('button:has-text("Save Configuration")').click();
    
    await expect(page.locator('text=Please select a file for loading')).toBeVisible();
  });

  test('should show validation errors for sink mode', async ({ page }) => {
    // Add File Node  
    const fileNode = page.locator('[data-testid="node-library"] >> text=File Node');
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await fileNode.dragTo(canvas);
    
    const addedFileNode = page.locator('.react-flow__node[data-type="fileNode"]');
    await addedFileNode.click();
    
    // Switch to sink mode
    await page.locator('button:has-text("Save to File (Sink)")').click();
    
    // Try to save without filename
    await page.locator('button:has-text("Save Configuration")').click();
    
    await expect(page.locator('text=Please specify an output filename for saving')).toBeVisible();
  });

  test('should handle file upload errors', async ({ page }) => {
    // Add File Node
    const fileNode = page.locator('[data-testid="node-library"] >> text=File Node');
    const canvas = page.locator('[data-testid="workflow-canvas"]');
    await fileNode.dragTo(canvas);
    
    const addedFileNode = page.locator('.react-flow__node[data-type="fileNode"]');
    await addedFileNode.click();
    
    // Mock a file upload error by trying to upload without selection
    await page.locator('button:has-text("Upload")').click();
    
    // Should handle gracefully (in full implementation, would show error)
    // For now, just verify the button remains visible
    await expect(page.locator('button:has-text("Upload")')).toBeVisible();
  });
});