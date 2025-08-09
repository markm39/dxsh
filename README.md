# Dxsh

An open-source visual workflow automation engine for data science, ML, and general automation tasks.

![Dxsh Demo](docs/images/demo.gif)

## ✨ Features

- 🎨 **Visual Workflow Builder** - Intuitive drag-and-drop interface using React Flow
- 🐍 **Python Script Nodes** - Execute custom Python code in sandboxed Docker containers
- 🤖 **ML Nodes** - Built-in Linear Regression, Random Forest, and more coming soon
- 🌐 **Web Scraping** - Visual element selector with Playwright backend
- 📊 **Data Processing** - Transform, structure, and analyze data
- 🗄️ **Database Integration** - PostgreSQL support with visual query builder
- 🔄 **Real-time Execution** - See results as workflows run
- 📦 **Extensible** - Easy to add custom nodes
- 🔒 **Secure** - Sandboxed execution environments

## 🚀 Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/workflow-engine.git
cd workflow-engine

# Start with Docker Compose
docker-compose up

# Visit http://localhost:3000
```

### Manual Installation

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (in another terminal)
cd backend
pip install -r requirements.txt
python run.py
```

## 📚 Documentation

- [Getting Started](docs/getting-started.md)
- [Adding Custom Nodes](docs/ADDING_NEW_NODES.md)
- [API Reference](docs/api-reference.md)
- [Self-Hosting Guide](docs/self-hosting.md)
- [Architecture Overview](docs/architecture.md)

## 🎯 Use Cases

- **Data Science Workflows** - ETL pipelines, data analysis, ML model training
- **Web Scraping** - Monitor websites, extract structured data
- **API Integration** - Connect multiple APIs, transform data
- **Automation** - Schedule and run complex workflows
- **Research** - Reproducible data analysis pipelines

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Flow    │────▶│   Flask API     │────▶│   PostgreSQL    │
│   Frontend      │     │   Backend       │     │   Database      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ Docker Executor │
                        │ (Python Scripts) │
                        └─────────────────┘
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Install development dependencies
npm install --save-dev
pip install -r requirements-dev.txt

# Run tests
npm test
pytest

# Run linting
npm run lint
flake8
```

## 📦 Examples

Check out the `examples/` directory for sample implementations:
- [Chatmark](examples/chatmark) - Sports analytics platform
- [Stock Predictor](examples/stock-predictor) - Financial analysis workflows
- [Web Scraper](examples/web-scraper) - Automated data collection
- [ML Pipeline](examples/ml-pipeline) - End-to-end ML workflows

## 🛣️ Roadmap

- [ ] More ML nodes (XGBoost, Neural Networks)
- [ ] Scheduling and cron jobs
- [ ] Team collaboration features
- [ ] Cloud deployment options
- [ ] Plugin marketplace
- [ ] Mobile app

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- [React Flow](https://reactflow.dev/) - Flow diagram library
- [Playwright](https://playwright.dev/) - Web automation
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor
- [Flask](https://flask.palletsprojects.com/) - Python web framework

## 💬 Community

- [Discord](https://discord.gg/workflow-engine)
- [GitHub Discussions](https://github.com/yourusername/workflow-engine/discussions)
- [Twitter](https://twitter.com/workflowengine)

---

Made with ❤️ by the Workflow Engine community
