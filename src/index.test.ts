import { describe, test, expect } from 'bun:test';

// Mock data for testing
const mockVideoInfo = {
  videoDetails: {
    title: 'Test Video',
    author: 'Test Author',
    lengthSeconds: '180'
  },
  captions: {
    playerCaptionsTracklistRenderer: {
      captionTracks: [
        {
          baseUrl: 'https://example.com/caption1',
          name: { simpleText: 'English' },
          languageCode: 'en',
          kind: undefined // manual caption
        },
        {
          baseUrl: 'https://example.com/caption2', 
          name: { simpleText: 'English (auto-generated)' },
          languageCode: 'en',
          kind: 'asr' // auto-generated
        }
      ]
    }
  }
};

const mockXMLTranscript = `
<transcript>
  <text start="0" dur="2000">Hello world</text>
  <text start="2000" dur="3000">This is a test</text>
  <text start="5000" dur="2500">Final message</text>
</transcript>
`;

const mockXMLTranscriptWithS = `
<transcript>
  <text start="0" dur="2000"><s>Hello</s> <s>world</s></text>
  <text start="2000" dur="3000"><s>This</s> <s>is</s> <s>a</s> <s>test</s></text>
</transcript>
`;

// Utility functions to test (extracted from main implementation)
function extractVideoId(input: string): string {
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
  
  throw new Error(`Invalid YouTube URL or video ID: ${input}`);
}

function selectBestCaption(captions: any[], preferredLang: string = 'en') {
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

function parseXMLTranscript(xmlContent: string): Array<{timestamp: string, text: string}> {
  const result: Array<{timestamp: string, text: string}> = [];
  
  // Simple regex to extract text elements with start time and content
  const textRegex = /<text[^>]*start="(\d+)"[^>]*>(.*?)<\/text>/g;
  let match;
  
  while ((match = textRegex.exec(xmlContent)) !== null) {
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
    
    const timestamp = formatTimestamp(startMs);
    result.push({ timestamp, text: textContent.trim() });
  }
  
  return result;
}

function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
}

// Tests
describe('DeepSRT MCP Server Utils', () => {
  describe('extractVideoId', () => {
    test('extracts video ID from standard YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('extracts video ID from short YouTube URL', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('extracts video ID from embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    test('handles direct video ID', () => {
      const videoId = 'dQw4w9WgXcQ';
      expect(extractVideoId(videoId)).toBe('dQw4w9WgXcQ');
    });

    test('extracts video ID from URL with additional parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });
  });

  describe('selectBestCaption', () => {
    test('selects manual caption in preferred language', () => {
      const result = selectBestCaption(mockVideoInfo.captions.playerCaptionsTracklistRenderer.captionTracks, 'en');
      expect(result?.languageCode).toBe('en');
      expect(result?.kind).toBeUndefined(); // manual caption
    });

    test('falls back to auto-generated when no manual available', () => {
      const autoOnlyCaptions = [
        {
          baseUrl: 'https://example.com/caption',
          name: { simpleText: 'English (auto-generated)' },
          languageCode: 'en',
          kind: 'asr'
        }
      ];
      const result = selectBestCaption(autoOnlyCaptions, 'en');
      expect(result?.languageCode).toBe('en');
      expect(result?.kind).toBe('asr');
    });

    test('returns first caption when preferred language not available', () => {
      const result = selectBestCaption(mockVideoInfo.captions.playerCaptionsTracklistRenderer.captionTracks, 'fr');
      expect(result?.languageCode).toBe('en');
      expect(result?.kind).toBeUndefined(); // should pick manual over auto
    });
  });

  describe('formatTimestamp', () => {
    test('formats milliseconds to MM:SS format', () => {
      expect(formatTimestamp(0)).toBe('[00:00]');
      expect(formatTimestamp(30000)).toBe('[00:30]');
      expect(formatTimestamp(90000)).toBe('[01:30]');
      expect(formatTimestamp(3661000)).toBe('[61:01]'); // Over 60 minutes
    });
  });

  describe('parseXMLTranscript', () => {
    test('parses basic XML transcript', () => {
      const result = parseXMLTranscript(mockXMLTranscript);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        timestamp: '[00:00]',
        text: 'Hello world'
      });
      expect(result[1]).toEqual({
        timestamp: '[00:02]',
        text: 'This is a test'
      });
      expect(result[2]).toEqual({
        timestamp: '[00:05]',
        text: 'Final message'
      });
    });

    test('handles XML with <s> tags (word-level timing)', () => {
      const result = parseXMLTranscript(mockXMLTranscriptWithS);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        timestamp: '[00:00]',
        text: 'Hello world'
      });
      expect(result[1]).toEqual({
        timestamp: '[00:02]',
        text: 'This is a test'
      });
    });

    test('decodes HTML entities', () => {
      const xmlWithEntities = `
        <transcript>
          <text start="0" dur="2000">Hello &amp; welcome &lt;test&gt; &quot;quotes&quot; &#39;apostrophe&#39;</text>
        </transcript>
      `;
      
      const result = parseXMLTranscript(xmlWithEntities);
      expect(result[0].text).toBe('Hello & welcome <test> "quotes" \'apostrophe\'');
    });
  });
});
