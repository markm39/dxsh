# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Rules

- Always make a new branch for a new feature, and merge it with a pull request
- Keep files under 700 lines, refactoring long files whenever you see them
- Add unit tests for all logical code you add
- Add a README for every root subdirectory in the repo
- Make sure the frontends build and the backends compile before pushing changes
- ALWAYS make commits as me (Don't commit as Claude)

1. **NO EMOJIS**: Do not add emojis to any code, comments, console logs, or documentation. Keep all text professional and emoji-free.
2. **ALWAYS ACTIVATE VENV**: When running Python commands in the Flask backend services, always activate the virtual environment first.

## Project Overview

**Dxsh** is a self-hostable visual workflow automation platform designed for data science, analytics, statistics, and mathematical operations. This platform provides a visual interface for building complex data workflows through a drag-and-drop node-based system.

### Core Vision

**Universal Data Processing Platform**: A Docker-containerized visual workflow builder that transforms complex data operations into intuitive drag-and-drop workflows:

- **Data Collection**: Web scraping, API integration, database queries, file imports
- **Data Processing**: Statistical analysis, ML models, transformations, validations
- **AI Integration**: GPT-powered analysis, natural language processing, intelligent insights
- **Visualization**: Dynamic chart generation, dashboard feeds, export capabilities
- **Automation**: Scheduled execution, parameter looping, conditional logic

### Architecture Philosophy

```

                        DXSH CORE                        
                      
   Collect  Process  Output              
    Data         Data        Results             
                      
                                                      
                                                      
                  
     API       ML/Stats     Dashboard           
   Scraper      Models        Feeds             
  Database     Analysis      Storage            
                  

```

### Business Model & Distribution Strategy

1. **Open Source Core**: Free workflow engine with essential nodes
2. **Enterprise License**: Advanced nodes (ML, AI, enterprise integrations)
3. **Cloud Hosting**: Managed service with scalable infrastructure
4. **Template Marketplace**: Pre-built workflows for specific industries
5. **White-Label Solutions**: Branded platforms for enterprise clients

## Development Best Practices

- **Always activate venv when running commands in the flask backend**