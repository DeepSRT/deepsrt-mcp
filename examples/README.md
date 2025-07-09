# DeepSRT MCP Configuration Examples

This directory contains example configuration files for different MCP clients.

## Claude Desktop

File: `claude-desktop-config.json`

Add this to your Claude Desktop configuration:
- On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

## Cline

File: `cline_mcp_settings.json`

Add this to your Cline MCP settings file.

## Unified Configuration

All examples use the same unified configuration:

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

This configuration:
- ✅ **No installation required** - Uses bunx to run directly from npm
- ✅ **Always latest version** - `@latest` ensures you get updates
- ✅ **Cross-platform** - Works on macOS, Windows, and Linux
- ✅ **Simple and clean** - Single configuration for all clients
