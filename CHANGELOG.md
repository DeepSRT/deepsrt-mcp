# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.8] - 2025-01-08

### Changed
- **Unified MCP configuration**: Simplified all MCP client configurations to use a single, clean format
- **Consistent server naming**: All examples now use "deepsrt" as the server name for consistency
- **Streamlined documentation**: Removed complex installation options in favor of simple bunx-based configuration

### Documentation
- **Single configuration format**: All MCP clients now use the same configuration pattern
- **Updated examples**: Simplified example files to use unified configuration
- **Cleaner README**: Removed redundant installation options and focused on the recommended approach

### Configuration
```json
{
  "mcpServers": {
    "deepsrt": {
      "type": "stdio",
      "command": "bunx",
      "args": [
        "@deepsrt/deepsrt-mcp@latest",
        "--server"
      ]
    }
  }
}
```

## [0.1.7] - 2025-01-08

### Changed
- **Silent MCP server startup**: Removed "DeepSRT MCP server running on stdio" message for cleaner integration with MCP clients
- **Improved user experience**: MCP server now starts completely silently, reducing noise in Claude Desktop and Cline logs

### Technical
- MCP server initialization no longer prints startup messages to stderr
- CLI commands and help output remain unchanged and functional

## [0.1.6] - 2025-01-08

### Added
- **Enhanced unified interface**: Improved command routing and error handling
- **Comprehensive documentation**: Updated README with complete unified interface examples
- **Version management system**: Automatic version synchronization across all components

### Changed
- **Improved build process**: Enhanced prebuild hooks and executable permissions
- **Better error messages**: More informative error handling for unknown commands
- **Documentation structure**: Reorganized README for better clarity and usability

### Technical
- **Build optimization**: Streamlined build process with automatic version sync
- **Code organization**: Better separation of concerns between server, CLI, and unified interface
- **Testing improvements**: Enhanced test coverage for unified interface functionality

## [0.1.5] - 2025-01-08

### Added
- **Unified entry point**: Single command interface that handles both MCP server and CLI modes
- **Shared version management**: Centralized version constant with automatic sync from package.json
- **Improved CLI interface**: Cleaner command structure with `--server` flag for explicit server mode

### Changed
- **Simplified usage**: `bunx @deepsrt/deepsrt-mcp` now defaults to MCP server mode
- **Better command structure**: `bunx @deepsrt/deepsrt-mcp get-transcript|get-summary` for CLI usage
- **Version consistency**: All components now use shared version constant from `src/version.ts`
- **Build process**: Automatic version sync before build ensures consistency

### Technical
- Created unified `main.ts` entry point that routes to appropriate functionality
- Added `scripts/sync-version.js` for automatic version synchronization
- Updated package.json bin configuration to use single entry point
- Added prebuild hook to sync version automatically

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
