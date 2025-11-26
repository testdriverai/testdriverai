# Changelog

## [1.0.0] - 2024-11-25

### Purpose

This MCP server enables AI agents to **interactively create Vitest test files** by:
1. Connecting to a persistent TestDriver sandbox
2. Exploring and testing the application
3. Generating proper Vitest test code from successful interactions

### Added
- Complete TypeScript implementation of TestDriver MCP server
- **Persistent sandbox connections** - sandbox stays alive throughout test creation
- All SDK v7 methods exposed as MCP tools:
  - Connection management (`connect`, `disconnect`)
  - Modern element finding (`find`, `findAll`)
  - Direct interaction (`click`, `hover`, `type`, `pressKeys`, `scroll`)
  - AI-powered operations (`assert`, `remember`, `ai`)
  - Utilities (`screenshot`, `focusApplication`, `exec`, `wait`)
- Full TypeScript support with type definitions
- Cache threshold support for element finding
- Screenshot support returning proper MCP image format
- Enhanced connect response with debugger URL and workflow instructions
- Comprehensive error handling with stack traces
- Deployment script for easy installation
- Complete documentation:
  - README.md - Usage guide
  - AI_GUIDELINES.md - Best practices for AI agents with test creation focus
  - TEST_CREATION_GUIDE.md - Detailed guide for creating Vitest tests
  - DEPLOYMENT.md - Deployment instructions
  - UPDATE_SUMMARY.md - Migration guide
  - QUICK_REFERENCE.md - Quick command reference

### Changed
- Replaced Mintlify-generated server with custom implementation
- Updated from limited API wrapper to full SDK exposure
- Modernized element finding approach (prefer `find()` over coordinates)
- Improved error messages and debugging information

### Removed
- Mintlify search tool (replaced with full SDK access)
- Legacy method signatures

### Migration Notes
- Update MCP client configuration to point to new dist/index.js location
- All operations now require initial `testdriver_connect` call
- Element coordinates returned include centerX/centerY
- Screenshot returns MCP image format instead of base64 text

## [0.x.x] - Previous Versions
- Mintlify-generated server with limited functionality
- Only search tool available
