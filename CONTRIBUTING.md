# Contributing to Dxsh

Thank you for your interest in contributing to Dxsh! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment following the [Local Development Guide](docs/development/local-setup.md)
4. Create a feature branch for your work

## Development Process

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:
- `feature/add-csv-export`
- `fix/workflow-execution-error`
- `docs/update-api-guide`

### 2. Make Your Changes

Follow the coding standards for the language you're working with:

**Python (Backend Services):**
- Follow PEP 8
- Use type hints where appropriate
- Add docstrings to functions and classes
- Run Black formatter: `black .`

**TypeScript/React (Frontend Services):**
- Use TypeScript strict mode
- Follow ESLint rules
- Use functional components with hooks
- Run Prettier: `npm run format`

### 3. Write Tests

All new features should include tests:

**Backend Tests:**
```bash
cd services/workflow-engine
python -m pytest tests/
```

**Frontend Tests:**
```bash
cd services/workflow-frontend
npm test
```

### 4. Update Documentation

- Update relevant documentation in the `docs/` directory
- Add JSDoc comments for TypeScript functions
- Update README if adding new features

### 5. Commit Your Changes

Follow conventional commit format:

```bash
git commit -m "feat: add CSV export to workflow results"
git commit -m "fix: resolve database connection timeout"
git commit -m "docs: update API authentication guide"
```

Commit types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or modifications
- `chore`: Build process or auxiliary tool changes

### 6. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub with:
- Clear description of changes
- Link to related issues
- Screenshots for UI changes
- Test results

## Project Structure

```
dxsh/
├── services/
│   ├── workflow-engine/      # Core workflow execution
│   ├── dashboard-service/    # Dashboard management
│   ├── workflow-frontend/    # Workflow builder UI
│   └── dashboard-frontend/   # Dashboard UI
├── docs/                     # Documentation
├── scripts/                  # Development scripts
└── docker/                   # Docker configurations
```

## Adding New Features

### Creating a New Node

See the [Node Development Guide](docs/development/creating-nodes.md) for detailed instructions.

Quick checklist:
1. Create node class in `services/workflow-engine/src/nodes/`
2. Add to node registry
3. Create frontend configuration
4. Add tests
5. Update documentation

### Creating a New Widget

See the [Widget Development Guide](docs/development/creating-widgets.md) for detailed instructions.

Quick checklist:
1. Create React component in `services/dashboard-frontend/src/widgets/`
2. Define widget configuration
3. Register widget
4. Add styling
5. Test in dashboard

## Code Review Process

All pull requests require:
1. Passing CI/CD checks
2. Code review from maintainers
3. Tests for new functionality
4. Documentation updates

### Review Criteria

- Code quality and style
- Test coverage
- Performance impact
- Security considerations
- Documentation completeness

## Testing Guidelines

### Unit Tests

Test individual components and functions:

```python
# Backend example
def test_workflow_execution():
    workflow = create_test_workflow()
    result = workflow.execute()
    assert result.status == 'completed'
```

```typescript
// Frontend example
test('renders workflow node', () => {
  render(<WorkflowNode type="http_request" />);
  expect(screen.getByText('HTTP Request')).toBeInTheDocument();
});
```

### Integration Tests

Test component interactions:
- API endpoint tests
- Database operations
- Service communication
- UI workflows

### End-to-End Tests

Test complete user flows:
- Create and execute workflow
- Build and share dashboard
- User authentication flow

## Security Guidelines

### Reporting Security Issues

Do not create public issues for security vulnerabilities. Instead, email security@dxsh.dev with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices

- Never commit secrets or API keys
- Validate all user inputs
- Use parameterized queries
- Follow OWASP guidelines
- Keep dependencies updated

## Performance Considerations

When contributing, consider:
- Query optimization for large datasets
- Efficient data structures
- Caching opportunities
- Memory usage
- API response times

## Documentation Standards

### Code Documentation

**Python:**
```python
def process_data(input_data: List[Dict]) -> Dict[str, Any]:
    """
    Process input data and return aggregated results.
    
    Args:
        input_data: List of dictionaries containing raw data
        
    Returns:
        Dictionary with processed results and metadata
    """
```

**TypeScript:**
```typescript
/**
 * Renders a workflow node on the canvas
 * @param props - Node properties including type and position
 * @returns React component
 */
export const WorkflowNode: React.FC<NodeProps> = (props) => {
```

### User Documentation

- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Keep formatting consistent

## Release Process

1. Features are developed in feature branches
2. Merged to `develop` branch after review
3. Released to `main` branch periodically
4. Tagged with semantic version numbers

## Getting Help

- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: General questions and discussions
- Development chat: Join our Discord server

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- Project documentation

Thank you for contributing to Dxsh!