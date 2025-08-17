# Dxsh Documentation Screenshot Guide

This guide lists all the screenshots needed for the Dxsh documentation. Please capture these screenshots and save them in the `/docs/images/` directory with the exact filenames specified.

## Prerequisites

1. Have all services running:
   - API Gateway (http://localhost:5000)
   - Workflow Engine (http://localhost:5001)
   - Dashboard Service (http://localhost:5002)
   - Workflow Frontend (http://localhost:3002)
   - Dashboard Frontend (http://localhost:3001)

2. Create a test user account if needed
3. Have some sample data ready for demonstrations

## Required Screenshots

### 1. General Platform Screenshots

#### platform-overview.png
- **What**: A composite/collage image showing both workflow builder and dashboard
- **How**: Take separate screenshots and combine them, or arrange windows side-by-side
- **Key elements**: Show a workflow on the left, dashboard with widgets on the right

#### login-screen.png
- **URL**: http://localhost:3001
- **What**: The login screen
- **Key elements**: Dxsh logo, email/password fields, "Sign in" button
- **Note**: Make sure to capture the dark theme styling

### 2. Workflow Builder Screenshots

#### workflow-builder-main.png
- **URL**: http://localhost:3002 (after login)
- **What**: Full workflow builder interface
- **Key elements**: 
  - Agent sidebar (left)
  - Node library sidebar 
  - Empty canvas with grid
  - Top header with "Run Workflow" button
  - User menu with sign out option

#### workflow-empty-canvas.png
- **What**: Empty workflow canvas
- **How**: Select an agent but don't add any nodes
- **Key elements**: "No workflow nodes yet" message

#### node-library.png
- **What**: Close-up of the node library
- **Key elements**: All node categories expanded showing:
  - Data Sources (Web Source, HTTP Request, PostgreSQL, File Node)
  - Data Processing (Data Structuring, AI Processor)
  - ML Models (Linear Regression, Random Forest)
  - Output (Chart Generator)

#### workflow-builder-demo.png
- **What**: A complete working workflow
- **How**: Create a workflow with:
  1. Web Source node → 
  2. Data Structuring node →
  3. Linear Regression node →
  4. Chart Generator node
- **Key elements**: All nodes connected with visible connections

### 3. Node Configuration Screenshots

#### web-source-config.png
- **What**: Web Source configuration modal
- **How**: Click on a Web Source node to open config
- **Key elements**:
  - URL input field (use a real website like example.com)
  - Visual selector iframe
  - Extracted data preview
  - Save/Cancel buttons

#### http-request-config.png
- **What**: HTTP Request configuration modal
- **Key elements**:
  - Method dropdown (GET/POST/PUT/DELETE)
  - URL field
  - Headers section
  - Body editor (for POST)
  - Test Request button

#### ai-processor-config.png
- **What**: AI Processor configuration modal
- **Key elements**:
  - Prompt template editor
  - Model selection dropdown
  - Temperature/token settings
  - Input data preview

#### linear-regression-config.png
- **What**: Linear Regression configuration modal
- **Key elements**:
  - Feature selection checkboxes
  - Target variable dropdown
  - Training split percentage
  - Model name field

#### input-nodes.png
- **What**: Workflow showing all input node types
- **How**: Create nodes for Web Source, HTTP Request, PostgreSQL, and File Node (don't need to connect them)

#### ml-nodes-workflow.png
- **What**: Workflow with ML nodes
- **How**: Connect a data source → Linear Regression → Random Forest

### 4. Workflow Execution Screenshots

#### workflow-execution.png
- **What**: Workflow during execution
- **How**: Click "Run Workflow" and capture while running
- **Key elements**:
  - "Running..." button state
  - Node execution indicators (green borders/checkmarks for completed)
  - Progress animation on currently executing node

#### workflow-results.png
- **What**: Results tab after execution
- **How**: Click "Results" tab after workflow completes
- **Key elements**:
  - List of executed nodes with results
  - Expanded view of at least one node's data
  - Execution timestamps

### 5. Dashboard Screenshots

#### dashboard-navigation.png
- **URL**: http://localhost:3001 (after login)
- **What**: Dashboard home page
- **Key elements**:
  - Sidebar with Dashboard/Workflow navigation
  - Main dashboard area
  - User profile menu

#### dashboard-main.png
- **What**: A dashboard with widgets
- **How**: Create a dashboard with at least 2-3 widgets
- **Key elements**:
  - Dashboard title
  - Grid layout with widgets
  - Add Widget button

#### add-widget-modal.png
- **What**: Add Widget modal
- **How**: Click "Add Widget" button
- **Key elements**:
  - Widget type selection
  - Configuration options
  - Preview area

#### chart-widget.png
- **What**: A configured chart widget
- **How**: Create a line or bar chart with sample data
- **Key elements**: Chart with data, title, and proper styling

#### chart-widget-config.png
- **What**: Chart widget configuration
- **How**: Click edit on a chart widget
- **Key elements**:
  - Chart type selection
  - Data source configuration
  - Axis mappings
  - Styling options

#### text-widget.png
- **What**: Text widget with content
- **How**: Create a text widget with markdown content
- **Include**: Headers, lists, and formatted text

### 6. Embedding Screenshots

#### embed-tokens.png
- **URL**: http://localhost:3001/embed-tokens
- **What**: Embed tokens management page
- **Key elements**:
  - Create Token button
  - List of existing tokens (create a few examples)
  - Token actions (copy, delete)

#### create-embed-token.png
- **What**: Create embed token modal
- **How**: Click "Create Token"
- **Key elements**:
  - Token name field
  - Resource type dropdown (Dashboard/Widget)
  - Resource selection
  - Expiration settings
  - Domain restrictions

#### embedded-dashboard.png
- **What**: embed-test.html showing embedded dashboard
- **How**: Open embed-test.html in browser, configure with valid token
- **Key elements**:
  - Embedded dashboard in iframe
  - Configuration fields filled in
  - "Dashboard loaded successfully" status

## Screenshot Tips

1. **Consistency**: Use the same browser and window size for all screenshots
2. **Data**: Use realistic but generic data (avoid personal information)
3. **Resolution**: Capture at high resolution, can be scaled down later
4. **Format**: Save as PNG for best quality
5. **Annotations**: Don't add arrows or annotations - keep screenshots clean
6. **Dark Theme**: Ensure the dark theme is properly displayed
7. **Loading States**: Avoid capturing loading spinners unless specifically needed

## File Naming Convention

Use lowercase with hyphens, exactly as specified in this guide. This ensures all documentation links work correctly.

## After Capturing Screenshots

1. Save all screenshots to `/docs/images/`
2. Verify all images are properly displayed in the documentation
3. Check that file sizes are reasonable (optimize if needed)
4. Ensure no sensitive data is visible in any screenshot