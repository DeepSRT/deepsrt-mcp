#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

type SummaryMode = 'narrative' | 'bullet';

interface InnerTubeResponse {
  videoDetails?: {
    videoId: string;
    title: string;
    lengthSeconds: string;
    channelId: string;
    author: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{
        baseUrl: string;
        name: { simpleText: string };
        vssId: string;
        languageCode: string;
        kind?: string;
        isTranslatable: boolean;
      }>;
    };
  };
}

class DeepSRTServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'deepsrt-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      timeout: 30000,
    });

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
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
                  description: 'Target language (default: zh-tw)',
                  default: 'zh-tw',
                },
                mode: {
                  type: 'string',
                  enum: ['narrative', 'bullet'],
                  description: 'Summary mode (default: narrative)',
                  default: 'narrative',
                },
              },
              required: ['videoId'],
            },
          },
          {
            name: 'get_transcript',
            description: 'Get transcript for a YouTube video with timestamps',
            inputSchema: {
              type: 'object',
              properties: {
                videoId: {
                  type: 'string',
                  description: 'YouTube video ID or full YouTube URL',
                },
                lang: {
                  type: 'string',
                  description: 'Preferred language code for captions (default: en)',
                  default: 'en',
                },
              },
              required: ['videoId'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'get_summary') {
        return this.handleGetSummary(request.params.arguments);
      } else if (request.params.name === 'get_transcript') {
        return this.handleGetTranscript(request.params.arguments);
      } else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }
    });
  }

  private async handleGetSummary(args: any): Promise<CallToolResult> {
    if (!this.isValidSummaryArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid summary arguments. Required: videoId'
      );
    }

    try {
      const videoId = args.videoId;
      const lang = args.lang || 'zh-tw';
      const mode = args.mode || 'narrative';

      // Step 1: Get video info and captions from YouTube
      const videoInfo = await this.getVideoInfo(videoId);
      
      if (!videoInfo.videoDetails) {
        throw new Error('Could not fetch video details');
      }

      const { title, author, lengthSeconds } = videoInfo.videoDetails;
      
      // Step 2: Extract captions
      const captionTracks = videoInfo.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) {
        throw new Error('No captions available for this video');
      }

      // Step 3: Select best caption
      const selectedCaption = this.selectBestCaption(captionTracks);
      if (!selectedCaption) {
        throw new Error('No suitable captions found');
      }

      // Step 4: Extract transcript argument from caption URL
      const transcriptArg = new URL(selectedCaption.baseUrl).search.slice(1);

      // Step 5: Call DeepSRT API for summarization
      const summaryParams = new URLSearchParams({
        v: videoId,
        action: 'summarize',
        lang: lang,
        mode: mode
      });

      const titleParams = new URLSearchParams({
        v: videoId,
        txt: title,
        action: 'translate',
        lang: lang,
        mode: mode
      });

      const [summaryResponse, titleResponse] = await Promise.all([
        this.axiosInstance.get(`https://worker.deepsrt.com/transcript2?${summaryParams}`, {
          headers: {
            'Accept': 'application/json',
            'X-Transcript-Arg': transcriptArg,
            'User-Agent': 'DeepSRT-CLI/1.5.4'
          }
        }),
        this.axiosInstance.get(`https://worker.deepsrt.com/transcript2?${titleParams}`, {
          headers: {
            'Accept': 'application/json',
            'X-Transcript-Arg': transcriptArg,
            'User-Agent': 'DeepSRT-CLI/1.5.4'
          }
        })
      ]);

      const summaryData = summaryResponse.data;
      const titleData = titleResponse.data;

      // Format response
      const translatedTitle = titleData.success ? 
        (titleData.result || titleData.translation || title) : title;
      
      const summaryText = summaryData.summary || summaryData.result || summaryData.content;

      if (!summaryText) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting summary: ${summaryData.error || 'No summary generated'}`
            }
          ],
          isError: true
        };
      }

      // Format summary with video information
      const duration = Math.floor(parseInt(lengthSeconds) / 60) + ':' + 
                      (parseInt(lengthSeconds) % 60).toString().padStart(2, '0');

      const formattedSummary = `# ${translatedTitle}

**Author:** ${author}  
**Duration:** ${duration}  
**Language:** ${lang}  
**Mode:** ${mode}

## Summary

${summaryText}

---
*Generated using DeepSRT MCP Server*`;

      return {
        content: [
          {
            type: 'text',
            text: formattedSummary
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting summary: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleGetTranscript(args: any): Promise<CallToolResult> {
    if (!this.isValidTranscriptArgs(args)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid transcript arguments. Required: videoId'
      );
    }

    try {
      // Extract video ID from URL or use directly
      const videoId = this.extractVideoId(args.videoId);
      if (!videoId) {
        throw new Error('Invalid YouTube URL or video ID');
      }

      // Get video info from InnerTube API
      const videoInfo = await this.getVideoInfo(videoId);

      if (!videoInfo.videoDetails) {
        throw new Error('Could not fetch video details');
      }

      const { title, author, lengthSeconds } = videoInfo.videoDetails;
      const duration = `${Math.floor(parseInt(lengthSeconds) / 60)}:${(parseInt(lengthSeconds) % 60).toString().padStart(2, '0')}`;

      // Extract captions
      const captionTracks = videoInfo.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) {
        throw new Error('No captions available for this video');
      }

      // Select best caption
      const selectedCaption = this.selectBestCaption(captionTracks, args.lang);
      if (!selectedCaption) {
        throw new Error('No suitable captions found');
      }

      const captionType = selectedCaption.kind === 'asr' ? 'auto-generated' : 'manual';

      // Fetch transcript content
      const transcriptResponse = await this.axiosInstance.get(selectedCaption.baseUrl);
      const parsedTranscript = this.parseXMLTranscript(transcriptResponse.data);

      // Format response
      const formattedTranscript = `# ${title}

**Author:** ${author}  
**Duration:** ${duration}  
**Captions:** ${selectedCaption.name?.simpleText || selectedCaption.languageCode} (${captionType})

## Transcript

${parsedTranscript.map(segment => `${segment.timestamp} ${segment.text}`).join('\n')}

---
*Generated using DeepSRT MCP Server*`;

      return {
        content: [
          {
            type: 'text',
            text: formattedTranscript
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting transcript: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  // Helper methods
  private extractVideoId(input: string): string | null {
    // Handle direct video ID
    if (input.length === 11 && !input.includes('/') && !input.includes('=')) {
      return input;
    }
    
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  private async getVideoInfo(videoId: string): Promise<InnerTubeResponse> {
    const response = await this.axiosInstance.post('https://www.youtube.com/youtubei/v1/player', {
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.09.37',
          androidSdkVersion: 30,
        }
      },
      videoId: videoId
    });
    
    return response.data;
  }

  private selectBestCaption(captions: any[], preferredLang: string = 'en') {
    if (!captions || captions.length === 0) {
      return null;
    }
    
    // First, try to find manual captions in preferred language
    const manualPreferred = captions.find(c => 
      c.languageCode === preferredLang && !c.kind
    );
    if (manualPreferred) return manualPreferred;
    
    // Then try auto-generated in preferred language
    const autoPreferred = captions.find(c => 
      c.languageCode === preferredLang && c.kind === 'asr'
    );
    if (autoPreferred) return autoPreferred;
    
    // Fall back to any manual caption
    const anyManual = captions.find(c => !c.kind);
    if (anyManual) return anyManual;
    
    // Finally, any caption
    return captions[0];
  }

  private parseXMLTranscript(xmlContent: string): Array<{timestamp: string, text: string}> {
    const result: Array<{timestamp: string, text: string}> = [];
    
    // Handle YouTube's timedtext format with <p> tags
    if (xmlContent.includes('<timedtext')) {
      const pRegex = /<p[^>]*t="(\d+)"[^>]*>(.*?)<\/p>/g;
      let match;
      
      while ((match = pRegex.exec(xmlContent)) !== null) {
        const startMs = parseInt(match[1]);
        let textContent = match[2];
        
        // Remove <s> tags if present (word-level timing)
        textContent = textContent.replace(/<\/?s[^>]*>/g, '');
        
        // Decode HTML entities
        textContent = textContent
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        
        // Clean up newlines and extra spaces
        textContent = textContent.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Skip empty or music-only segments
        if (textContent && !textContent.match(/^\[.*\]$/) && textContent !== '♪♪♪') {
          const timestamp = this.formatTimestamp(startMs);
          result.push({ timestamp, text: textContent });
        }
      }
    }
    
    return result;
  }

  private formatTimestamp(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
  }

  // Validation methods
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

  private isValidTranscriptArgs(
    args: any
  ): args is { videoId: string; lang?: string } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.videoId === 'string' &&
      args.videoId.length > 0 &&
      (args.lang === undefined || typeof args.lang === 'string')
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
