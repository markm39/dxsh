# 🤝 Contributing to Dxsh

Thank you for your interest in contributing to Dxsh! We welcome contributions from the community and are excited to see what amazing workflows and features you'll help us build.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Creating Custom Nodes](#creating-custom-nodes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Community](#community)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [support@dxsh.dev](mailto:support@dxsh.dev).

**In short: Be respectful, inclusive, and collaborative.**

## 🚀 Getting Started

### What Can You Contribute?

- 🐛 **Bug Reports**: Help us identify and fix issues
- 💡 **Feature Requests**: Suggest new capabilities and improvements
- 📝 **Documentation**: Improve our docs, tutorials, and examples
- 🔧 **Code**: Fix bugs, add features, create new workflow nodes
- 🎨 **UI/UX**: Enhance the user interface and experience
- 🧪 **Testing**: Write tests and improve our testing infrastructure
- 📦 **Examples**: Create workflow templates and use case examples

### Ways to Get Involved

1. **Star the repository** ⭐ to show your support
2. **Join our discussions** 💬 to share ideas and ask questions
3. **Report bugs** 🐛 to help improve stability
4. **Submit pull requests** 🔄 to contribute code
5. **Write tutorials** 📚 to help other users

## 🛠️ Development Setup

### Prerequisites

- **Docker & Docker Compose** - For containerized development
- **Node.js 18+** - For frontend development
- **Python 3.11+** - For backend development
- **Git** - For version control

### Quick Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/yourusername/dxsh.git
cd dxsh

# 2. Set up environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start development environment
docker-compose up -d

# 4. Access the applications
# Workflow Builder: http://localhost:3000
# Dashboard: http://localhost:3001
# API: http://localhost:5000
```

### Manual Development Setup

If you prefer to run services individually:

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
flask db upgrade
python run.py

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# Dashboard setup (new terminal)
cd dashboard
npm install
npm run dev
```

## 🎯 Contributing Guidelines

### Before You Start

1. **Check existing issues** to see if your bug/feature is already tracked
2. **Create an issue** to discuss major changes before implementing
3. **Follow our coding standards** outlined below
4. **Write tests** for new functionality
5. **Update documentation** as needed

### Coding Standards

#### Python (Backend)
- Follow **PEP 8** style guidelines
- Use **type hints** where appropriate
- Write **docstrings** for functions and classes
- Maximum line length: **88 characters** (Black formatter)
- Use **meaningful variable names**

```python
# Good
def execute_workflow(workflow_id: int, user_id: int) -> ExecutionResult:
    """
    Execute a workflow for a specific user.
    
    Args:
        workflow_id: The ID of the workflow to execute
        user_id: The ID of the user executing the workflow
        
    Returns:
        ExecutionResult containing success status and output data
    """
    pass

# Bad
def exec_wf(w_id, u_id):
    pass
```

#### TypeScript/React (Frontend)
- Use **TypeScript** for all new code
- Follow **React best practices** (hooks, functional components)
- Use **meaningful component names**
- **Export types** and interfaces
- Prefer **composition over inheritance**

```typescript
// Good
interface WorkflowNodeProps {
  nodeId: string;
  data: NodeData;
  onUpdate: (nodeId: string, data: NodeData) => void;
}

export const WorkflowNode: React.FC<WorkflowNodeProps> = ({ 
  nodeId, 
  data, 
  onUpdate 
}) => {
  // Component implementation
};

// Bad
export const Node = (props: any) => {
  // Component implementation
};
```

#### General Guidelines
- **Write clear commit messages** following conventional commits
- **Keep commits focused** - one logical change per commit
- **Rebase before merging** to maintain clean history
- **Remove debugging code** before submitting

### Commit Message Format

We use [Conventional Commits](https://conventionalcommits.org/) for clear commit history:

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Examples:**
```bash
feat(nodes): add XGBoost machine learning node
fix(backend): resolve workflow execution timeout issue
docs(readme): update installation instructions
refactor(frontend): simplify node connection logic
```

## 🔧 Creating Custom Nodes

One of the most valuable contributions is creating new workflow nodes! See our [Adding New Nodes Guide](docs/ADDING_NEW_NODES.md) for detailed instructions.

### Quick Node Creation Checklist

- [ ] Backend API endpoint in `/backend/app/api/`
- [ ] Frontend React component in `/frontend/src/components/nodes/`
- [ ] Node configuration component in `/frontend/src/components/node-configs/`
- [ ] Add to node library in `/frontend/src/components/workflow-builder/components/NodeLibrary.tsx`
- [ ] Write tests for both frontend and backend
- [ ] Update documentation with usage examples

## 🧪 Testing

We maintain high code quality through comprehensive testing:

### Running Tests

```bash
# Frontend tests
cd frontend
npm test

# Backend tests
cd backend
source venv/bin/activate
pytest

# Integration tests
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

### Test Requirements

- **Unit tests** for new functions and classes
- **Integration tests** for API endpoints
- **Component tests** for React components
- **End-to-end tests** for critical workflows

### Test Guidelines

- Write **descriptive test names**
- **Mock external dependencies**
- Test **both success and failure cases**
- Maintain **high test coverage** (aim for >80%)

## 📝 Submitting Changes

### Pull Request Process

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feat/awesome-new-feature
   ```

2. **Make your changes** following our coding standards

3. **Test your changes** thoroughly
   ```bash
   npm test && pytest
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "feat(nodes): add awesome new feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feat/awesome-new-feature
   ```

6. **Create a pull request** with:
   - Clear title and description
   - Screenshots/GIFs for UI changes
   - Links to related issues
   - Testing instructions

### Pull Request Template

```markdown
## Description
Brief description of the changes and their purpose.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots or GIFs to demonstrate UI changes.

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No sensitive information committed
```

### Review Process

1. **Automated checks** must pass (tests, linting, security)
2. **Code review** by at least one maintainer
3. **Manual testing** for significant changes
4. **Documentation review** if applicable
5. **Final approval** and merge

## 📚 Documentation

Help us improve our documentation:

- **README updates** for new features
- **API documentation** for backend changes
- **Component documentation** for frontend changes
- **Tutorial creation** for complex workflows
- **Example workflows** for real-world use cases

## 🎉 Recognition

Contributors are recognized in several ways:

- **Contributors list** in README
- **Release notes** mention significant contributions
- **Community highlights** in discussions
- **Special badges** for significant contributors

## ❓ Getting Help

Need help with your contribution?

- 💬 **GitHub Discussions**: Ask questions and get help
- 📧 **Email**: [support@dxsh.dev](mailto:support@dxsh.dev)
- 🐛 **Issues**: Create an issue for bugs or feature requests

## 🏢 Contributor License Agreement

By contributing to Dxsh, you agree that your contributions will be licensed under the same MIT License that covers the project. You also confirm that you have the right to make these contributions.

---

**Thank you for contributing to Dxsh!** 🎉

Your contributions help make data workflow automation accessible to everyone. Together, we're building something amazing! 🚀