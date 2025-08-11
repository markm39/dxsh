# 🚀 Dxsh - Visual Workflow Automation Platform

> **Self-hostable visual workflow automation platform for data science, analytics, and mathematical operations**

Dxsh is a powerful, Docker-containerized visual workflow builder that transforms complex data operations into intuitive drag-and-drop workflows. Born from the workflow system originally developed within the Chatmark sports analytics platform, Dxsh represents a complete reimagining of data processing automation.

## ✨ Features

### Core Capabilities
- 🎨 **Visual Workflow Builder** - Intuitive drag-and-drop interface powered by React Flow
- 🐍 **Python Script Execution** - Run custom Python code in secure, sandboxed Docker containers  
- 🤖 **Machine Learning** - Built-in Linear Regression, Random Forest, and expanding ML toolkit
- 🌐 **Web Scraping** - Visual element selector with robust Playwright backend
- 📊 **Data Processing** - Transform, structure, and analyze data with powerful nodes
- 🗄️ **Database Integration** - PostgreSQL support with visual query builder
- 📈 **Real-time Dashboards** - Interactive charts and metrics visualization
- 🔄 **Live Execution** - Watch workflows run in real-time with live results
- 📦 **Extensible Architecture** - Easy custom node development
- 🔒 **Security-First** - Sandboxed execution environments and secure by design

### Workflow Types
- **Data Collection**: Web scraping, API integration, database queries, file imports
- **Data Processing**: Statistical analysis, ML models, transformations, validations  
- **AI Integration**: GPT-powered analysis, natural language processing, intelligent insights
- **Visualization**: Dynamic chart generation, dashboard feeds, export capabilities
- **Automation**: Scheduled execution, parameter looping, conditional logic

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Using Docker (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/markmiller/dxsh.git
cd dxsh

# 2. Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Configure your settings (optional)
# Edit backend/.env to add your OpenAI API key, database settings, etc.

# 4. Start the platform
docker-compose up

# 5. Access the applications
# Workflow Builder: http://localhost:3000
# Dashboard: http://localhost:3001
# API: http://localhost:5000
```

The platform will automatically:
- Set up PostgreSQL database with required tables
- Install all dependencies
- Start all services in the correct order

### Manual Development Setup

If you prefer to run components individually for development:

```bash
# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
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

## 📚 Documentation

- [Adding Custom Nodes](docs/ADDING_NEW_NODES.md) - Extend Dxsh with custom workflow nodes
- [Dashboard Architecture](docs/DASHBOARD_ARCHITECTURE.md) - Understanding the dashboard system
- [Playwright Service Guide](backend/docs/playwright_service.md) - Web scraping capabilities

## 🎯 Use Cases

### Data Science & Analytics
- **ETL Pipelines** - Extract, transform, and load data from multiple sources
- **ML Model Training** - Build and train machine learning models visually
- **Statistical Analysis** - Perform complex statistical operations on datasets
- **Data Validation** - Automated data quality checks and cleaning

### Web Automation & Monitoring  
- **Web Scraping** - Extract structured data from websites with visual selectors
- **Site Monitoring** - Track website changes and performance metrics
- **Content Aggregation** - Collect and organize data from multiple web sources
- **Competitive Intelligence** - Monitor competitor websites and pricing

### Business Intelligence
- **Interactive Dashboards** - Real-time data visualization and KPI tracking
- **Automated Reports** - Scheduled data reports with custom visualizations
- **Multi-source Analytics** - Combine data from APIs, databases, and files
- **Performance Tracking** - Monitor business metrics across different systems

### AI & Machine Learning
- **GPT Integration** - Natural language processing and content analysis
- **Predictive Analytics** - Forecast trends using machine learning models
- **Data Classification** - Automated categorization and pattern recognition
- **Intelligent Insights** - AI-powered data analysis and recommendations

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        DXSH CORE                        │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐            │
│  │ Collect │───▶│ Process │───▶│ Output  │            │
│  │  Data   │    │  Data   │    │ Results │            │
│  └─────────┘    └─────────┘    └─────────┘            │
│       ▲              ▲               │                  │
│       │              │               ▼                  │
│  ┌─────────┐   ┌──────────┐   ┌───────────┐          │
│  │   API   │   │ ML/Stats │   │ Dashboard │          │
│  │ Scraper │   │  Models  │   │   Feeds   │          │
│  │Database │   │ Analysis │   │  Storage  │          │
│  └─────────┘   └──────────┘   └───────────┘          │
└─────────────────────────────────────────────────────────┘

    Frontend (React)     Backend (Flask)      Database (PostgreSQL)
    ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
    │ Workflow    │────▶│ API Server  │────▶│ User Data       │
    │ Builder     │     │             │     │ Workflows       │
    │             │     │ Execution   │     │ Results         │
    │ Dashboard   │     │ Engine      │     │ Models          │
    │ Interface   │     │             │     │                 │
    └─────────────┘     └─────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │ Docker Executor │
                        │ (Sandboxed)     │
                        │ - Python Code   │
                        │ - ML Training   │
                        │ - Data Processing│
                        └─────────────────┘
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Setting up the development environment
- Code style and conventions  
- Submitting pull requests
- Creating new workflow nodes
- Reporting issues

### Development Workflow

```bash
# 1. Fork and clone the repository
git clone https://github.com/yourusername/dxsh.git
cd dxsh

# 2. Set up development environment
./scripts/dev-setup.sh  # Sets up all services for development

# 3. Make your changes and test
npm run test          # Frontend tests
pytest               # Backend tests
docker-compose up -d  # Integration testing

# 4. Submit your pull request
```

## 📦 Examples & Templates

Check out the `examples/` directory for sample workflows:
- **[Chatmark Sports Analytics](examples/chatmark/)** - Advanced sports data analysis
- **Stock Market Analysis** - Financial data processing and prediction
- **Web Scraping Pipeline** - Automated data collection workflows  
- **ML Training Pipeline** - End-to-end machine learning workflows

## 🛣️ Roadmap

### Core Platform
- [ ] Advanced ML nodes (XGBoost, Neural Networks, Time Series)
- [ ] Workflow scheduling and cron job integration
- [ ] Version control for workflows (Git-like)
- [ ] Multi-tenant support and user management
- [ ] REST API for workflow management
- [ ] Workflow templates marketplace

### Infrastructure & Deployment
- [ ] Kubernetes deployment configurations
- [ ] Cloud provider integrations (AWS, GCP, Azure)
- [ ] Horizontal scaling for high-volume processing
- [ ] Workflow execution monitoring and alerts
- [ ] Performance optimization and caching

### Integrations & Ecosystem
- [ ] Pre-built integrations (Salesforce, HubSpot, etc.)
- [ ] Plugin system for custom nodes
- [ ] Mobile app for monitoring workflows
- [ ] Slack/Teams notifications
- [ ] Enterprise SSO support

## 🏢 Business Model & Distribution

1. **Open Source Core** - Free workflow engine with essential nodes
2. **Enterprise License** - Advanced nodes (ML, AI, enterprise integrations)  
3. **Cloud Hosting** - Managed service with scalable infrastructure
4. **Template Marketplace** - Pre-built workflows for specific industries
5. **White-Label Solutions** - Branded platforms for enterprise clients

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments & Technology Stack

**Core Technologies:**
- [React Flow](https://reactflow.dev/) - Powerful flow diagram library
- [Flask](https://flask.palletsprojects.com/) - Lightweight Python web framework  
- [PostgreSQL](https://postgresql.org/) - Advanced open source database
- [Docker](https://docker.com/) - Containerization and sandboxing
- [Playwright](https://playwright.dev/) - Reliable web automation

**Frontend Stack:**
- [React](https://reactjs.org/) + [TypeScript](https://typescriptlang.org/)
- [Vite](https://vitejs.dev/) for fast development builds
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Recharts](https://recharts.org/) for data visualization

**Backend Stack:**
- [Flask](https://flask.palletsprojects.com/) + [SQLAlchemy](https://sqlalchemy.org/)
- [Alembic](https://alembic.sqlalchemy.org/) for database migrations
- [Celery](https://celeryproject.org/) for background tasks
- [Playwright](https://playwright.dev/) for web scraping

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=markmiller/dxsh&type=Date)](https://star-history.com/#markmiller/dxsh&Date)

## 💬 Community & Support

- 📧 **Email**: support@dxsh.dev
- 💬 **GitHub Discussions**: [Ask questions and share workflows](https://github.com/markmiller/dxsh/discussions)  
- 🐛 **Issue Tracker**: [Report bugs and request features](https://github.com/markmiller/dxsh/issues)
- 📖 **Wiki**: [Community documentation and tutorials](https://github.com/markmiller/dxsh/wiki)

---

**Made with ❤️ by the Dxsh community** | [Website](https://dxsh.dev) | [Documentation](https://docs.dxsh.dev)
