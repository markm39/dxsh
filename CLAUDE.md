# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dxsh** is a self-hostable visual workflow automation platform designed for data science, analytics, statistics, and mathematical operations. Born from the successful extraction and evolution of the workflow system originally developed within the Chatmark sports analytics platform, this project represents a complete reimagining of data processing automation.

### Core Vision

**Universal Data Processing Platform**: A Docker-containerized visual workflow builder that transforms complex data operations into intuitive drag-and-drop workflows:

- **Data Collection**: Web scraping, API integration, database queries, file imports
- **Data Processing**: Statistical analysis, ML models, transformations, validations
- **AI Integration**: GPT-powered analysis, natural language processing, intelligent insights
- **Visualization**: Dynamic chart generation, dashboard feeds, export capabilities
- **Automation**: Scheduled execution, parameter looping, conditional logic

### Architecture Philosophy

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
```

### Business Model & Distribution Strategy

1. **Open Source Core**: Free workflow engine with essential nodes
2. **Enterprise License**: Advanced nodes (ML, AI, enterprise integrations)
3. **Cloud Hosting**: Managed service with scalable infrastructure
4. **Template Marketplace**: Pre-built workflows for specific industries
5. **White-Label Solutions**: Branded platforms for enterprise clients

## Development Best Practices

- **Always activate venv when running commands in the flask backend**