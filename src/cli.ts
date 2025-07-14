#!/usr/bin/env node
/**
 * DeepSRT CLI Tool
 * Provides direct command-line access to DeepSRT functionality
 * 
 * Usage:
 *   deepsrt get-transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   deepsrt get-summary dQw4w9WgXcQ --lang zh-tw --mode bullet
 */

import axios from 'axios';
import { VERSION } from './version.js';

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

class DeepSRTCLI {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }

  // Helper methods (same as MCP server)
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
    
    // Handle YouTube's timedtext format
    if (xmlContent.includes('<timedtext')) {
      // Extract the body content
      const bodyMatch = xmlContent.match(/<body>(.*?)<\/body>/s);
      if (!bodyMatch) return result;
      
      const bodyContent = bodyMatch[1];
      
      // Find all <p> tags with their content
      const pTagRegex = /<p[^>]*t="(\d+)"[^>]*>(.*?)<\/p>/gs;
      let match;
      
      while ((match = pTagRegex.exec(bodyContent)) !== null) {
        const startTime = parseInt(match[1]);
        const pContent = match[2];
        
        // Skip empty paragraphs or paragraphs with only whitespace/newlines
        if (!pContent.trim() || pContent.trim() === '') {
          continue;
        }
        
        // Extract text from <s> tags within this paragraph
        const sTagRegex = /<s[^>]*>(.*?)<\/s>/g;
        const syllables: string[] = [];
        let sMatch;
        
        while ((sMatch = sTagRegex.exec(pContent)) !== null) {
          let syllable = sMatch[1];
          
          // Decode HTML entities
          syllable = syllable
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
          
          syllables.push(syllable);
        }
        
        // Reconstruct words from syllables
        if (syllables.length > 0) {
          const words: string[] = [];
          let currentWord = '';
          
          for (const syllable of syllables) {
            if (syllable.startsWith(' ')) {
              // This syllable starts a new word
              if (currentWord.trim()) {
                words.push(currentWord.trim());
              }
              currentWord = syllable; // Keep the leading space for now
            } else {
              // This syllable continues the current word
              currentWord += syllable;
            }
          }
          
          // Don't forget the last word
          if (currentWord.trim()) {
            words.push(currentWord.trim());
          }
          
          // Join words with single spaces
          const fullText = words.join(' ').trim();
          
          // Skip music notation and empty segments
          if (fullText && !fullText.match(/^\[.*\]$/) && fullText !== '♪♪♪' && fullText.trim() !== '') {
            const timestamp = this.formatTimestamp(startTime);
            result.push({ timestamp, text: fullText });
          }
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

  // CLI Commands
  async getTranscript(videoInput: string, lang: string = 'en') {
    try {
      console.log(`🎬 Extracting transcript for: ${videoInput}`);
      
      // Extract video ID from URL or use directly
      const videoId = this.extractVideoId(videoInput);
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

      console.log(`📹 Title: ${title}`);
      console.log(`👤 Author: ${author}`);
      console.log(`⏱️  Duration: ${duration}\n`);

      // Extract captions
      const captionTracks = videoInfo.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) {
        throw new Error('No captions available for this video');
      }

      console.log(`📝 Available captions:`);
      captionTracks.forEach(track => {
        const type = track.kind === 'asr' ? '(auto)' : '(manual)';
        console.log(`   • ${track.languageCode}: ${track.name.simpleText} ${type}`);
      });

      // Select best caption
      const selectedCaption = this.selectBestCaption(captionTracks, lang);
      if (!selectedCaption) {
        throw new Error('No suitable captions found');
      }

      const captionType = selectedCaption.kind === 'asr' ? 'auto-generated' : 'manual';
      console.log(`\n✅ Using: ${selectedCaption.languageCode} (${captionType})\n`);

      // Fetch transcript content
      const transcriptResponse = await this.axiosInstance.get(selectedCaption.baseUrl);
      const parsedTranscript = this.parseXMLTranscript(transcriptResponse.data);

      // Output transcript
      console.log(`📝 Transcript with Timestamps:`);
      console.log(`═══════════════════════════════════════`);
      parsedTranscript.forEach(segment => {
        console.log(`${segment.timestamp} ${segment.text}`);
      });

      console.log(`\n✅ Extracted ${parsedTranscript.length} transcript segments`);

    } catch (error) {
      console.error(`💥 Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  async getSummary(videoInput: string, lang: string = 'zh-tw', mode: SummaryMode = 'narrative') {
    try {
      console.log(`📊 Generating ${mode} summary in ${lang} for: ${videoInput}`);
      
      const videoId = this.extractVideoId(videoInput);
      if (!videoId) {
        throw new Error('Invalid YouTube URL or video ID');
      }

      // Step 1: Get video info and captions from YouTube
      const videoInfo = await this.getVideoInfo(videoId);
      
      if (!videoInfo.videoDetails) {
        throw new Error('Could not fetch video details');
      }

      const { title, author, lengthSeconds } = videoInfo.videoDetails;
      const duration = `${Math.floor(parseInt(lengthSeconds) / 60)}:${(parseInt(lengthSeconds) % 60).toString().padStart(2, '0')}`;

      console.log(`📹 Title: ${title}`);
      console.log(`👤 Author: ${author}`);
      console.log(`⏱️  Duration: ${duration}\n`);
      
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

      const captionType = selectedCaption.kind === 'asr' ? 'auto-generated' : 'manual';
      console.log(`✅ Using captions: ${selectedCaption.languageCode} (${captionType})\n`);

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

      console.log(`🔄 Processing with DeepSRT API...`);

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
        throw new Error(`Summary generation failed: ${summaryData.error || 'No summary generated'}`);
      }

      // Output results
      console.log(`📊 Results:`);
      console.log(`═══════════════════════════════════════`);
      
      if (titleData.success && translatedTitle !== title) {
        console.log(`🏷️  Translated Title: ${translatedTitle}`);
      } else {
        console.log(`🏷️  Title: ${title}`);
      }

      console.log(`\n📝 Summary (${mode} mode, ${lang}):`);
      console.log(summaryText);

      console.log(`\n✅ Summary generated successfully`);

    } catch (error) {
      console.error(`💥 Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`🚀 DeepSRT CLI Tool v${VERSION}\n`);
    console.log(`Usage:`);
    console.log(`  npx @deepsrt/deepsrt-mcp get-transcript <youtube-url> [--lang=<lang>]`);
    console.log(`  npx @deepsrt/deepsrt-mcp get-summary <youtube-url> [--lang=<lang>] [--mode=<mode>]`);
    console.log(`  deepsrt-mcp get-transcript <youtube-url> [--lang=<lang>]  (if installed globally)\n`);
    console.log(`Commands:`);
    console.log(`  get-transcript    Extract transcript with timestamps`);
    console.log(`  get-summary       Generate video summary\n`);
    console.log(`Options:`);
    console.log(`  --lang=<lang>     Target language (default: en for transcript, zh-tw for summary)`);
    console.log(`  --mode=<mode>     Summary mode: narrative|bullet (default: narrative)\n`);
    console.log(`Installation:`);
    console.log(`  npm install -g @deepsrt/deepsrt-mcp  # Global installation (recommended)`);
    console.log(`  npm install @deepsrt/deepsrt-mcp     # Local installation\n`);
    console.log(`Examples:`);
    console.log(`  npx @deepsrt/deepsrt-mcp get-transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ`);
    console.log(`  npx @deepsrt/deepsrt-mcp get-transcript dQw4w9WgXcQ --lang=en`);
    console.log(`  npx @deepsrt/deepsrt-mcp get-summary dQw4w9WgXcQ --lang=zh-tw --mode=bullet`);
    console.log(`  npx @deepsrt/deepsrt-mcp get-summary https://youtu.be/dQw4w9WgXcQ --lang=ja\n`);
    console.log(`  # After global installation:`);
    console.log(`  deepsrt-mcp get-transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ`);
    console.log(`  deepsrt-mcp get-summary dQw4w9WgXcQ --lang=zh-tw --mode=bullet`);
    process.exit(1);
  }

  const command = args[0];
  const videoInput = args[1];
  
  if (!videoInput) {
    console.error('❌ Error: Video URL or ID is required');
    process.exit(1);
  }

  // Parse options
  let lang = '';
  let mode: SummaryMode = 'narrative';

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    // Handle --lang=value format
    if (arg.startsWith('--lang=')) {
      lang = arg.split('=')[1];
    }
    // Handle --lang value format
    else if (arg === '--lang' && i + 1 < args.length) {
      lang = args[i + 1];
      i++; // Skip next argument since we consumed it
    }
    // Handle --mode=value format
    else if (arg.startsWith('--mode=')) {
      const modeValue = arg.split('=')[1];
      if (modeValue === 'narrative' || modeValue === 'bullet') {
        mode = modeValue;
      }
    }
    // Handle --mode value format
    else if (arg === '--mode' && i + 1 < args.length) {
      const modeValue = args[i + 1];
      if (modeValue === 'narrative' || modeValue === 'bullet') {
        mode = modeValue;
      }
      i++; // Skip next argument since we consumed it
    }
  }

  // Set default languages
  if (!lang) {
    lang = command === 'get-transcript' ? 'en' : 'zh-tw';
  }

  return { command, videoInput, lang, mode };
}

// Main execution
async function main() {
  const { command, videoInput, lang, mode } = parseArgs();
  const cli = new DeepSRTCLI();

  switch (command) {
    case 'get-transcript':
      await cli.getTranscript(videoInput, lang);
      break;
    case 'get-summary':
      await cli.getSummary(videoInput, lang, mode);
      break;
    default:
      console.error(`❌ Error: Unknown command '${command}'`);
      console.log(`Available commands: get-transcript, get-summary`);
      process.exit(1);
  }
}

// Execute main function
main().catch(console.error);
