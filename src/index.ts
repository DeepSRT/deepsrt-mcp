#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { config, SummaryMode } from './config.js';

interface SummaryResponse {
  summary: string;
  error?: string;
}

class DeepSRTServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: config.server.name,
        version: config.server.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: config.api.baseURL,
    });

    // Setup tool handlers
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_summary',
          description: 'Get summary for a YouTube video',
          inputSchema: {
            type: 'object',
            properties: {
              videoId: {
                type: 'string',
                description: 'YouTube video ID',
              },
              lang: {
                type: 'string',
                description: 'Language code (e.g. zh-tw)',
                default: config.api.defaults.lang,
              },
              mode: {
                type: 'string',
                description: 'Summary mode (narrative or bullet)',
                default: config.api.defaults.mode,
                enum: ['narrative', 'bullet'],
              },
            },
            required: ['videoId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'get_summary') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      const args = request.params.arguments;
      if (!this.isValidSummaryArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid summary arguments. Required: videoId'
        );
      }

      try {
        const response = await this.axiosInstance.post<SummaryResponse>(
          config.api.endpoints.transcript,
          {
            arg: `v=${args.videoId}`,
            action: 'summarize',
            lang: args.lang || config.api.defaults.lang,
            mode: args.mode || config.api.defaults.mode,
          }
        );

        if (response.data.error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error getting summary: ${response.data.error}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: response.data.summary,
            },
          ],
        };
      } catch (error) {
        const errorMessage = axios.isAxiosError(error)
          ? `API error: ${error.response?.data?.message || error.message}`
          : 'Unknown error occurred';

        return {
          content: [
            {
              type: 'text',
              text: errorMessage,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private isValidSummaryArgs(
    args: any
  ): args is { videoId: string; lang?: string; mode?: SummaryMode } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.videoId === 'string' &&
      args.videoId.length > 0 &&
      (args.lang === undefined || typeof args.lang === 'string') &&
      (args.mode === undefined ||
        args.mode === 'narrative' ||
        args.mode === 'bullet')
    );
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DeepSRT MCP server running on stdio');
  }
}

const server = new DeepSRTServer();
server.run().catch(console.error);
