# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2025-01-08

### Fixed
- **Major transcript parsing fix**: Fixed XML parser to handle newer YouTube caption format where text content comes after `<p>` tags instead of between them
- Now correctly extracts complete transcripts (e.g., 103 segments instead of just 1 for a 5:45 video)
- Maintains backward compatibility with older YouTube caption formats
- Both MCP server and CLI implementations updated

### Changed
- Improved XML parsing logic to be more robust and handle multiple YouTube caption formats
- Enhanced error handling and text extraction accuracy

## [0.1.3] - 2025-01-08

### Added
- Comprehensive CLI documentation in README.md
- Fixed CLI argument parsing to support both `--key=value` and `--key value` formats
- Fixed bullet mode functionality for summary generation
- Enhanced bunx compatibility for direct execution

### Fixed
- CLI execution issues with different argument formats
- Summary mode selection (narrative vs bullet)
- Package configuration for proper binary resolution

## [0.1.2] - 2025-01-08

### Added
- Direct transcript extraction functionality without pre-caching requirements
- YouTube InnerTube API integration for real-time video metadata and caption access
- Comprehensive test suite (unit tests, integration tests, end-to-end tests)
- CLI tool with full-featured command-line interface

### Changed
- Migrated from cache-dependent to direct processing architecture
- Updated documentation to reflect no pre-caching requirements
- Improved error handling and user feedback

## [0.1.1] - 2025-01-08

### Added
- Enhanced MCP server implementation
- Multi-language support for summaries and transcripts
- Support for both narrative and bullet-point summary modes
- Bun runtime support for faster TypeScript execution

## [0.1.0] - 2025-01-08

### Added
- Initial release of DeepSRT MCP Server
- Basic YouTube video summarization functionality
- MCP (Model Context Protocol) integration
- Support for Claude Desktop and Cline
- `get_summary` and `get_transcript` tools
- Multi-language support (zh-tw, en, ja, etc.)
