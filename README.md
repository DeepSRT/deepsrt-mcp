# DeepSRT MCP Server

A Model Context Protocol (MCP) server that provides YouTube video summarization functionality through integration with DeepSRT's API.

## Features

- Generate summaries for YouTube videos
- Support for both narrative and bullet-point summary modes
- Multi-language support (default: zh-tw)
- Seamless integration with MCP-enabled environments

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Usage

The server provides the following tool:

### get_summary

Gets a summary for a YouTube video.

**Parameters:**

- `videoId` (required): YouTube video ID
- `lang` (optional): Language code (e.g., zh-tw) - defaults to zh-tw
- `mode` (optional): Summary mode ("narrative" or "bullet") - defaults to narrative

## License

Private. All rights reserved.
