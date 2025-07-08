#!/usr/bin/env bun
/**
 * DeepSRT Video Summarizer
 * Fetch YouTube video info, extract captions, and generate summary
 * 
 * Usage: bun run summarize-video.ts https://www.youtube.com/watch?v=efbHJCwGqC8
 *        bun run summarize-video.ts https://www.youtube.com/watch?v=efbHJCwGqC8 --lang=zh-tw --mode=bullet
 */

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

interface SummaryOptions {
  lang: string;
  mode: 'narrative' | 'bullet';
  apiUrl: string;
  transcriptOnly?: boolean;
}

class YouTubeVideoSummarizer {
  private apiUrl: string;

  constructor(apiUrl: string = 'https://s.deepsrt.com') {
    this.apiUrl = apiUrl;
  }

  /**
   * Extract video ID from YouTube URL
   */
  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Get video info and captions from YouTube InnerTube API
   */
  async getVideoInfo(videoId: string): Promise<InnerTubeResponse> {
    console.log(`🔍 Fetching video info for: ${videoId}`);

    const response = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 30,
            userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
            osName: "Android",
            osVersion: "11"
          }
        },
        videoId
      })
    });

    if (!response.ok) {
      throw new Error(`InnerTube API failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Parse XML transcript and return clean text with timestamps
   */
  parseXMLTranscript(xmlContent: string): string {
    try {
      // Extract all <p> elements with timing and text
      const pElements = xmlContent.match(/<p[^>]*>.*?<\/p>/gs) || [];
      
      const segments: Array<{time: string, text: string}> = [];
      
      for (const pElement of pElements) {
        // Extract timing attribute (t="milliseconds")
        const timeMatch = pElement.match(/t="(\d+)"/);
        if (!timeMatch) continue;
        
        const timeMs = parseInt(timeMatch[1]);
        const timeFormatted = this.formatTimestamp(timeMs);
        
        // Extract text content and clean it
        const textMatch = pElement.match(/<p[^>]*>(.*?)<\/p>/s);
        if (!textMatch) continue;
        
        let text = textMatch[1];
        
        // Handle auto-generated captions with <s> tags
        if (text.includes('<s ')) {
          // Extract text from <s> segments and join them
          const sMatches = text.match(/<s[^>]*>(.*?)<\/s>/gs) || [];
          text = sMatches.map(sMatch => {
            const sTextMatch = sMatch.match(/<s[^>]*>(.*?)<\/s>/s);
            return sTextMatch ? sTextMatch[1] : '';
          }).join(' ');
        }
        
        // Decode HTML entities
        text = text.replace(/&#39;/g, "'")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"')
                  .replace(/&nbsp;/g, " ");
        
        // Remove line breaks and extra spaces
        text = text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        
        if (text) {
          segments.push({ time: timeFormatted, text });
        }
      }
      
      // Format output
      return segments.map(segment => `[${segment.time}] "${segment.text}"`).join('\n\n');
      
    } catch (error) {
      console.error('Error parsing XML transcript:', error);
      return 'Error parsing transcript XML';
    }
  }

  /**
   * Format milliseconds to [MM:SS] format
   */
  formatTimestamp(milliseconds: number): string {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Fetch raw transcript content from YouTube caption URL
   */
  async fetchRawTranscript(captionUrl: string): Promise<string> {
    console.log(`📥 Fetching raw transcript from: ${captionUrl.substring(0, 80)}...`);

    const response = await fetch(captionUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch transcript: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const content = await response.text();

    console.log(`📄 Content-Type: ${contentType}`);
    console.log(`📊 Content Length: ${content.length} characters`);

    return content;
  }
  /**
   * Extract transcript argument from caption URL
   */
  extractTranscriptArg(captionUrl: string): string {
    const url = new URL(captionUrl);
    return url.search.slice(1); // Remove '?' and return query string
  }

  /**
   * Select best caption track (prefer manual over auto-generated)
   */
  selectBestCaption(captionTracks: any[], preferredLang: string = 'en') {
    if (!captionTracks || captionTracks.length === 0) {
      return null;
    }

    // Priority: Manual captions in preferred language > Auto-generated in preferred language > Any manual > Any auto > First available
    const manual = captionTracks.find(track => !track.kind && track.languageCode === preferredLang);
    if (manual) return manual;

    const autoGenerated = captionTracks.find(track => track.kind === 'asr' && track.languageCode === preferredLang);
    if (autoGenerated) return autoGenerated;

    const anyManual = captionTracks.find(track => !track.kind);
    if (anyManual) return anyManual;

    const anyAuto = captionTracks.find(track => track.kind === 'asr');
    if (anyAuto) return anyAuto;

    return captionTracks[0];
  }

  /**
   * Call DeepSRT API for summarization
   */
  async summarizeVideo(videoId: string, transcriptArg: string, title: string, options: SummaryOptions) {
    console.log(`📝 Generating summary in ${options.lang} (${options.mode} mode)`);

    const summaryParams = new URLSearchParams({
      v: videoId,
      action: 'summarize',
      lang: options.lang,
      mode: options.mode
    });

    const titleParams = new URLSearchParams({
      v: videoId,
      txt: title,
      action: 'translate',
      lang: options.lang,
      mode: options.mode
    });

    try {
      const [summaryResponse, titleResponse] = await Promise.all([
        fetch(`${options.apiUrl}/transcript2?${summaryParams}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Transcript-Arg': transcriptArg,
            'User-Agent': 'DeepSRT-CLI/1.5.4'
          }
        }),
        fetch(`${options.apiUrl}/transcript2?${titleParams}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-Transcript-Arg': transcriptArg,
            'User-Agent': 'DeepSRT-CLI/1.5.4'
          }
        })
      ]);

      const [summaryData, titleData] = await Promise.all([
        summaryResponse.json(),
        titleResponse.json()
      ]);

      return {
        summary: summaryData,
        translatedTitle: titleData,
        summaryStatus: summaryResponse.status,
        titleStatus: titleResponse.status
      };

    } catch (error) {
      throw new Error(`API request failed: ${error}`);
    }
  }

  /**
   * Main processing function
   */
  async processVideo(url: string, options: SummaryOptions) {
    try {
      // Extract video ID
      const videoId = this.extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL or video ID');
      }

      console.log(`🎬 Processing video: ${videoId}`);
      console.log(`📺 URL: https://www.youtube.com/watch?v=${videoId}\n`);

      // Get video info from InnerTube API
      const videoInfo = await this.getVideoInfo(videoId);

      if (!videoInfo.videoDetails) {
        throw new Error('Could not fetch video details');
      }

      const { title, author, lengthSeconds } = videoInfo.videoDetails;
      console.log(`📹 Title: ${title}`);
      console.log(`👤 Author: ${author}`);
      console.log(`⏱️  Duration: ${Math.floor(parseInt(lengthSeconds) / 60)}:${(parseInt(lengthSeconds) % 60).toString().padStart(2, '0')}\n`);

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
      const selectedCaption = this.selectBestCaption(captionTracks);
      if (!selectedCaption) {
        throw new Error('No suitable captions found');
      }

      const captionType = selectedCaption.kind === 'asr' ? 'auto-generated' : 'manual';
      console.log(`\n✅ Using: ${selectedCaption.languageCode} (${captionType})`);

      // If transcript-only mode, fetch and return raw content
      if (options.transcriptOnly) {
        console.log(`\n📥 Transcript-only mode: fetching raw content...\n`);
        
        const rawContent = await this.fetchRawTranscript(selectedCaption.baseUrl);
        const cleanTranscript = this.parseXMLTranscript(rawContent);
        
        console.log(`\n📝 Clean Transcript with Timestamps:`);
        console.log(`═══════════════════════════════════════`);
        console.log(cleanTranscript);
        
        return; // Exit early for transcript-only mode
      }

      // Extract transcript argument
      const transcriptArg = this.extractTranscriptArg(selectedCaption.baseUrl);
      console.log(`🔗 Transcript arg: ${transcriptArg.substring(0, 50)}...\n`);

      // Generate summary
      const result = await this.summarizeVideo(videoId, transcriptArg, title, options);

      // Display results
      console.log(`\n📊 Results:`);
      console.log(`═══════════════════════════════════════`);

      if (result.titleStatus === 200 && result.translatedTitle.success) {
        console.log(`🏷️  Translated Title: ${result.translatedTitle.result || result.translatedTitle.translation || 'N/A'}`);
      } else {
        console.log(`🏷️  Original Title: ${title}`);
      }

      console.log(`\n📝 Summary (${options.mode} mode, ${options.lang}):`);
      if (result.summaryStatus === 200) {
        // Handle different response formats
        const summaryText = result.summary.summary || result.summary.result || result.summary.content || 'No summary generated';
        console.log(`${summaryText}\n`);
      } else {
        console.log(`❌ Summary failed: ${result.summary.error || 'Unknown error'}\n`);
      }

      console.log(`📈 API Status: Summary ${result.summaryStatus}, Title ${result.titleStatus}`);

    } catch (error) {
      console.error(`💥 Error: ${error}`);
      process.exit(1);
    }
  }
}

// Parse command line arguments
function parseArgs(): { url: string; options: SummaryOptions } {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`Usage: bun run summarize-video.ts [options] <youtube-url>`);
    console.log(`\nOptions:`);
    console.log(`  --lang=<lang>     Target language (default: zh-tw)`);
    console.log(`  --mode=<mode>     Summary mode: narrative|bullet (default: narrative)`);
    console.log(`  --api=<url>       API base URL (default: https://s.deepsrt.com)`);
    console.log(`  --transcript      Return raw transcript content only (no summarization)`);
    console.log(`\nExamples:`);
    console.log(`  bun run summarize-video.ts https://www.youtube.com/watch?v=efbHJCwGqC8`);
    console.log(`  bun run summarize-video.ts --lang=en --mode=bullet efbHJCwGqC8`);
    console.log(`  bun run summarize-video.ts --transcript https://youtu.be/efbHJCwGqC8`);
    console.log(`  bun run summarize-video.ts --lang=zh-tw --api=https://worker.deepsrt.com https://youtu.be/efbHJCwGqC8`);
    process.exit(1);
  }

  // URL is the last argument (non-option argument)
  let url = '';
  const options: SummaryOptions = {
    lang: 'zh-tw',
    mode: 'narrative',
    apiUrl: 'https://s.deepsrt.com',
    transcriptOnly: false
  };

  // Parse all arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--lang=')) {
      options.lang = arg.split('=')[1];
    } else if (arg.startsWith('--mode=')) {
      const mode = arg.split('=')[1];
      if (mode === 'narrative' || mode === 'bullet') {
        options.mode = mode;
      }
    } else if (arg.startsWith('--api=')) {
      options.apiUrl = arg.split('=')[1];
    } else if (arg === '--transcript') {
      options.transcriptOnly = true;
    } else if (!arg.startsWith('--')) {
      // This is the URL (last non-option argument)
      url = arg;
    }
  }

  if (!url) {
    console.error('❌ Error: YouTube URL is required as the last argument');
    console.log('\nUsage: bun run summarize-video.ts [options] <youtube-url>');
    process.exit(1);
  }

  return { url, options };
}

// Main execution
async function main() {
  console.log(`🚀 DeepSRT Video Summarizer v1.5.4\n`);

  const { url, options } = parseArgs();
  const summarizer = new YouTubeVideoSummarizer(options.apiUrl);
  
  await summarizer.processVideo(url, options);
}

if (import.meta.main) {
  main();
}
