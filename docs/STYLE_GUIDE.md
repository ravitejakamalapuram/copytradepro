# Documentation Style Guide

## Overview

This style guide ensures consistency across all CopyTrade Pro documentation. Follow these guidelines when creating or updating documentation.

## File Organization

### Directory Structure
```
docs/
├── api/                    # API documentation
├── architecture/           # System architecture docs
├── deployment/            # Deployment and configuration
├── development/           # Development guides
├── features/              # Feature specifications
├── troubleshooting/       # Troubleshooting guides
├── .templates/            # Documentation templates
└── README.md              # Main documentation index
```

### File Naming
- Use kebab-case for file names: `symbol-search-api.md`
- Use descriptive names that clearly indicate content
- Include version numbers when applicable: `api-v2.md`

## Markdown Standards

### Headers
- Use ATX-style headers (`#`, `##`, `###`)
- Include a single H1 (`#`) at the top of each document
- Use sentence case for headers: `## Getting started`
- Leave blank lines before and after headers

### Code Blocks
- Always specify language for syntax highlighting:
  ```typescript
  // Good
  const example = 'code';
  ```
- Use `bash` for shell commands
- Use `json` for JSON examples
- Use `typescript` for TypeScript code

### Links
- Use relative links for internal documentation: `[API Docs](../api/README.md)`
- Use descriptive link text, avoid "click here"
- Check all links are working before publishing

### Lists
- Use `-` for unordered lists
- Use `1.` for ordered lists
- Leave blank lines before and after lists
- Use consistent indentation (2 spaces)

### Tables
- Always include headers
- Align columns for readability
- Use `|` separators consistently

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |

## Content Guidelines

### Writing Style
- **Tone**: Professional but approachable
- **Voice**: Active voice preferred over passive
- **Tense**: Present tense for current features, future tense for planned features
- **Audience**: Assume technical knowledge but explain complex concepts

### Structure
1. **Overview**: Brief description of purpose
2. **Prerequisites**: What users need before starting
3. **Step-by-step instructions**: Clear, numbered steps
4. **Examples**: Practical code examples
5. **Troubleshooting**: Common issues and solutions

### Code Examples
- Include complete, working examples
- Add comments to explain complex logic
- Show both success and error cases
- Use realistic data in examples

```typescript
// Good: Complete example with comments
const symbolService = new SymbolService();

// Search for NIFTY options expiring in January 2025
const results = await symbolService.search({
  query: 'NIFTY',
  instrumentType: 'OPTION',
  expiryStart: '2025-01-01',
  expiryEnd: '2025-01-31'
});

if (results.success) {
  console.log(`Found ${results.data.total} symbols`);
} else {
  console.error('Search failed:', results.error.message);
}
```

## API Documentation Standards

### Endpoint Documentation
Each API endpoint must include:
1. **Purpose**: What the endpoint does
2. **HTTP Method and URL**: Complete endpoint path
3. **Parameters**: All parameters with types and descriptions
4. **Request/Response Examples**: Complete JSON examples
5. **Error Codes**: All possible error responses
6. **Rate Limits**: Request limits and time windows

### Parameter Tables
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `query` | string | No | Search query text | `"NIFTY"` |
| `limit` | number | No | Maximum results (default: 50) | `10` |

### Response Examples
Always show complete response structure:

```json
{
  "success": true,
  "data": {
    "symbols": [...],
    "total": 150,
    "hasMore": true
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

## Feature Documentation Standards

### Status Indicators
Use consistent status indicators:
- ✅ **Completed**: Feature is fully implemented and tested
- 🚧 **In Progress**: Feature is currently being developed
- 📋 **Planned**: Feature is planned for future development
- ❌ **Deprecated**: Feature is deprecated and will be removed

### Requirements Traceability
Link implementation back to requirements:
```markdown
### Requirements Satisfied
✅ **Requirement 1.1**: Standardized symbol data structure
✅ **Requirement 1.2**: Separate fields for options and futures
🚧 **Requirement 2.1**: Daily data updates (in progress)
```

## Version Control

### Documentation Updates
- Update documentation in the same PR as code changes
- Include documentation changes in commit messages
- Review documentation changes as part of code review

### Changelog
Maintain a changelog for significant documentation updates:
```markdown
## [1.2.0] - 2025-01-31
### Added
- New API endpoint documentation
- Troubleshooting guide for symbol search

### Changed
- Updated installation instructions
- Improved code examples

### Deprecated
- Old API endpoints (will be removed in v2.0)
```

## Quality Checklist

Before publishing documentation, verify:

### Content
- [ ] Purpose and scope clearly defined
- [ ] All steps are accurate and tested
- [ ] Code examples work as written
- [ ] Screenshots are current and relevant
- [ ] Links are working and point to correct locations

### Format
- [ ] Follows markdown standards
- [ ] Headers are properly structured
- [ ] Code blocks have language specified
- [ ] Tables are properly formatted
- [ ] Lists use consistent formatting

### Completeness
- [ ] All required sections included
- [ ] Prerequisites clearly stated
- [ ] Troubleshooting section included
- [ ] Related documentation linked

## Tools and Automation

### Linting
Use markdownlint to ensure consistent formatting:
```bash
npm install -g markdownlint-cli
markdownlint docs/**/*.md
```

### Link Checking
Regularly check for broken links:
```bash
npm install -g markdown-link-check
find docs -name "*.md" -exec markdown-link-check {} \;
```

### Spell Checking
Use a spell checker for professional quality:
```bash
npm install -g cspell
cspell "docs/**/*.md"
```

## Templates

Use the provided templates for consistency:
- [API Documentation Template](./templates/api-documentation-template.md)
- [Feature Documentation Template](./templates/feature-documentation-template.md)

## Review Process

### Documentation Review
1. **Technical Accuracy**: Verify all technical details are correct
2. **Clarity**: Ensure instructions are clear and easy to follow
3. **Completeness**: Check all necessary information is included
4. **Style Compliance**: Verify adherence to this style guide

### Approval Process
- Technical writer review for style and clarity
- Subject matter expert review for accuracy
- Final approval from team lead

## Maintenance

### Regular Updates
- Review documentation quarterly for accuracy
- Update screenshots and examples as UI changes
- Archive or update deprecated information
- Monitor user feedback and common questions

### Metrics
Track documentation effectiveness:
- User feedback and ratings
- Support ticket reduction
- Time to complete tasks
- Documentation usage analytics