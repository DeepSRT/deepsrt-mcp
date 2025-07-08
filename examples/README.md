# Examples

This directory contains example implementations and reference code for the DeepSRT MCP server.

## Standalone Summarizer (`standalone-summarizer.ts`)

A standalone TypeScript script that demonstrates direct usage of the YouTube InnerTube API and DeepSRT API integration without the MCP framework.

### Usage

```bash
# Basic usage
bun run examples/standalone-summarizer.ts https://www.youtube.com/watch?v=dQw4w9WgXcQ

# With options
bun run examples/standalone-summarizer.ts --lang=zh-tw --mode=bullet dQw4w9WgXcQ

# Transcript only mode
bun run examples/standalone-summarizer.ts --transcript https://youtu.be/dQw4w9WgXcQ
```

### Features

- Direct YouTube InnerTube API integration
- DeepSRT API summarization
- Multiple language support
- Transcript extraction with timestamps
- Standalone execution (no MCP required)

### Purpose

This example shows:
- How to extract video information from YouTube
- How to select and fetch caption tracks
- How to parse YouTube's timedtext XML format
- How to integrate with DeepSRT's summarization API
- Implementation patterns used in the main MCP server

### Note

For production use, prefer the main CLI tool (`npx @deepsrt/deepsrt-mcp`) which provides better error handling, structured output, and npm integration.
