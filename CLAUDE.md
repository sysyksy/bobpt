# CLAUDE.md - AI Assistant Guide for bobpt

This document provides comprehensive guidance for AI assistants working on the bobpt codebase. It outlines project structure, development workflows, conventions, and best practices.

## Project Overview

**Project Name:** bobpt
**Repository:** sysyksy/bobpt
**License:** MIT License
**Owner:** sysyksy (sinyoung1524@gmail.com)
**Project Stage:** Early Development / Bootstrap Phase

### Purpose

bobpt is a full-stack application with a planned frontend and backend architecture. The project is currently in its initial setup phase with foundational structure being established.

## Repository Structure

### Current Structure

```
bobpt/
├── .git/                 # Git repository data
├── .gitignore           # Git ignore patterns for Python/Node.js
├── LICENSE              # MIT License
├── README.md            # Project README (minimal)
└── CLAUDE.md            # This file - AI assistant guide
```

### Planned Structure

Based on the gitignore configuration, the project will have the following structure:

```
bobpt/
├── frontend/            # Frontend application (Node.js/JavaScript)
│   ├── node_modules/   # NPM dependencies (gitignored)
│   └── ...             # Frontend source code
├── backend/            # Backend application (Python)
│   ├── venv/          # Python virtual environment (gitignored)
│   └── ...            # Backend source code
├── .gitignore
├── LICENSE
├── README.md
└── CLAUDE.md
```

## Technology Stack

### Backend
- **Language:** Python
- **Environment Management:** Python virtual environment (venv)
- **Package Managers Supported:** pip, poetry, pdm, pipenv, uv, pixi
- **Testing:** pytest (based on gitignore patterns)
- **Type Checking:** mypy, pytype, pyre (based on gitignore patterns)
- **Linting:** ruff (based on gitignore patterns)

### Frontend
- **Package Manager:** npm/yarn (Node.js)
- **Dependencies:** Managed via node_modules

### Development Tools
- Supports VS Code, PyCharm, Cursor, and other IDEs
- Marimo for interactive Python notebooks
- Jupyter notebooks support

## Development Workflows

### Initial Setup

#### Backend Setup
1. Create the backend directory structure
2. Initialize Python virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Linux/Mac
   # or venv\Scripts\activate on Windows
   ```
3. Create requirements.txt or pyproject.toml for dependencies
4. Install dependencies

#### Frontend Setup
1. Create the frontend directory structure
2. Initialize Node.js project:
   ```bash
   cd frontend
   npm init -y
   ```
3. Install dependencies as needed

### Git Workflow

**Branch Structure:**
- Main/Master branch: Production-ready code
- Feature branches: Use `claude/` prefix for AI-assisted development
- Current working branch: `claude/claude-md-mi3i91k6hsfrt44z-01LvercKPm8zN9NcubqG6kNf`

**Commit Guidelines:**
- Write clear, descriptive commit messages
- Use conventional commits format when possible:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `refactor:` for code refactoring
  - `test:` for adding/updating tests
  - `chore:` for maintenance tasks

**Pushing Changes:**
- Always push to the designated feature branch
- Use: `git push -u origin <branch-name>`
- For claude branches, ensure branch starts with 'claude/' and has matching session ID
- Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s) on network errors

### Development Cycle

1. **Planning**: Understand requirements and create task list
2. **Implementation**: Write code following conventions
3. **Testing**: Ensure tests pass before committing
4. **Review**: Check code quality and security
5. **Commit**: Create meaningful commits
6. **Push**: Push to feature branch
7. **PR**: Create pull request when feature is complete

## Coding Conventions

### Python Backend Conventions

#### File Organization
- Keep modules focused and single-purpose
- Use clear, descriptive names for files and directories
- Follow Python package structure standards

#### Code Style
- Follow PEP 8 style guidelines
- Use type hints for function arguments and return values
- Maximum line length: 88 characters (Black formatter default)
- Use docstrings for all public modules, classes, and functions

#### Naming Conventions
- Classes: `PascalCase`
- Functions/Methods: `snake_case`
- Constants: `UPPER_SNAKE_CASE`
- Private methods: `_leading_underscore`
- Module names: `lowercase_with_underscores`

#### Import Organization
```python
# Standard library imports
import os
import sys

# Third-party imports
import numpy as np
from django.http import HttpResponse

# Local application imports
from .models import MyModel
from .utils import helper_function
```

### Frontend Conventions

#### File Organization
- Component-based architecture
- Group related files together
- Use index files for clean imports

#### Code Style
- Use consistent indentation (2 or 4 spaces)
- Use modern JavaScript/TypeScript features
- Prefer functional components in React (if using React)

#### Naming Conventions
- Components: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: Match component name or use `kebab-case`

## Security Best Practices

### Critical Security Considerations

1. **Never commit sensitive data:**
   - API keys, tokens, passwords
   - `.env` files (already gitignored)
   - Database credentials
   - Private keys or certificates

2. **Input Validation:**
   - Always validate and sanitize user input
   - Use parameterized queries for database operations
   - Implement proper authentication and authorization

3. **Common Vulnerabilities to Avoid:**
   - SQL Injection: Use ORMs or parameterized queries
   - XSS (Cross-Site Scripting): Sanitize output, use templating engines properly
   - CSRF: Implement CSRF tokens
   - Command Injection: Avoid shell=True in subprocess calls
   - Path Traversal: Validate file paths
   - Insecure Deserialization: Validate serialized data

4. **Dependencies:**
   - Keep dependencies up to date
   - Review security advisories
   - Use tools like `pip-audit` or `npm audit`

## Testing Guidelines

### Backend Testing
- Use pytest for unit and integration tests
- Place tests in `tests/` directory or alongside code with `test_` prefix
- Aim for meaningful test coverage, not just high percentages
- Write tests before fixing bugs (TDD approach recommended)

### Frontend Testing
- Use appropriate testing framework (Jest, Vitest, etc.)
- Test components, utilities, and critical user flows
- Include both unit and integration tests

### Test Structure
```python
# test_example.py
import pytest

def test_feature_behavior():
    # Arrange
    expected = "expected result"

    # Act
    result = function_under_test()

    # Assert
    assert result == expected
```

## Documentation Standards

### Code Documentation
- Write clear docstrings for all public APIs
- Include parameter types, return types, and examples
- Document complex algorithms or business logic

### Python Docstring Format
```python
def calculate_total(items: list[dict], tax_rate: float = 0.0) -> float:
    """
    Calculate the total cost of items including tax.

    Args:
        items: List of dictionaries with 'price' keys
        tax_rate: Tax rate as decimal (e.g., 0.08 for 8%)

    Returns:
        Total cost including tax

    Example:
        >>> items = [{'price': 10.0}, {'price': 20.0}]
        >>> calculate_total(items, 0.1)
        33.0
    """
    subtotal = sum(item['price'] for item in items)
    return subtotal * (1 + tax_rate)
```

### Project Documentation
- Keep README.md updated with setup instructions
- Document API endpoints and data models
- Maintain changelog for significant changes

## Environment Configuration

### Backend Environment Variables
Create a `.env` file in the backend directory (never commit):
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/dbname

# API Keys
API_KEY=your-secret-key

# Environment
DEBUG=True
ENVIRONMENT=development
```

### Frontend Environment Variables
Create `.env.local` or similar (never commit):
```bash
REACT_APP_API_URL=http://localhost:8000/api
REACT_APP_ENV=development
```

## Common Tasks for AI Assistants

### When Adding New Features
1. Understand the requirement fully
2. Check existing patterns in the codebase
3. Create task list with TodoWrite tool
4. Write tests first (TDD)
5. Implement feature following conventions
6. Run tests and linting
7. Update documentation
8. Commit with descriptive message
9. Push to feature branch

### When Fixing Bugs
1. Reproduce the bug
2. Write a failing test that demonstrates the bug
3. Fix the bug
4. Ensure the test passes
5. Check for similar issues elsewhere
6. Update documentation if needed
7. Commit and push

### When Refactoring
1. Ensure existing tests pass
2. Make small, incremental changes
3. Run tests after each change
4. Maintain backward compatibility unless planned otherwise
5. Update documentation to reflect changes
6. Commit frequently with clear messages

### When Reviewing Code
- Check for security vulnerabilities
- Verify coding conventions are followed
- Ensure tests exist and pass
- Look for edge cases
- Check for proper error handling
- Verify documentation is updated

## File Reference Format

When referencing code locations, use the format:
```
file_path:line_number
```

Example: `backend/main.py:42`

This helps users navigate to specific code locations easily.

## Tool Usage Preferences

### For File Operations
- **Reading files:** Use Read tool, not `cat`
- **Searching files:** Use Grep tool, not `grep` command
- **Finding files:** Use Glob tool, not `find` command
- **Editing files:** Use Edit tool, not `sed`
- **Writing files:** Use Write tool, not `echo >` or heredocs

### For Codebase Exploration
- Use Task tool with `subagent_type=Explore` for open-ended exploration
- Use Grep for specific pattern searches
- Use Glob for file pattern matching
- Read files in parallel when possible

### For Task Management
- Always use TodoWrite tool for multi-step tasks
- Mark tasks as in_progress before starting work
- Mark tasks as completed immediately after finishing
- Keep only one task in_progress at a time

## Dependencies and Package Management

### Python Dependencies
The project is configured to work with multiple Python package managers. Choose one:

- **pip:** Use `requirements.txt`
- **poetry:** Use `pyproject.toml` and `poetry.lock`
- **pdm:** Use `pyproject.toml` and `pdm.lock`
- **uv:** Use `pyproject.toml` and `uv.lock`
- **pixi:** Use `pixi.toml` and `pixi.lock`

### Installing Dependencies
```bash
# pip
pip install -r requirements.txt

# poetry
poetry install

# pdm
pdm install

# uv
uv pip install -r requirements.txt

# pixi
pixi install
```

## CI/CD Considerations

When CI/CD is set up, ensure:
- Tests run automatically on pull requests
- Linting and type checking are enforced
- Security scans are performed
- Build artifacts are generated correctly
- Deployment scripts are tested

## Questions and Support

### For AI Assistants
- When uncertain about project-specific conventions, ask the user
- When multiple valid approaches exist, present options
- When dealing with security-sensitive code, be extra cautious
- Always prefer existing patterns over introducing new ones

### For Humans
- Check this document when onboarding AI assistants
- Update this document as the project evolves
- Use this as a reference for project conventions
- Share with team members for consistency

## Version History

- **v1.0** (2025-11-17): Initial creation during bootstrap phase
  - Documented project structure and planned architecture
  - Established coding conventions and workflows
  - Defined security best practices
  - Created comprehensive guide for AI assistants

---

**Last Updated:** 2025-11-17
**Maintained By:** Project contributors
**Status:** Living document - update as project evolves
