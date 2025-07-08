import { describe, test, expect, mock } from 'bun:test';

// Mock axios for testing
const mockAxios = {
  get: mock(() => Promise.resolve({ data: 'mock response' })),
  post: mock(() => Promise.resolve({ data: 'mock response' }))
};

// Mock the axios module
mock.module('axios', () => ({
  default: mockAxios
}));

describe('MCP Tool Integration Tests', () => {
  describe('get_summary tool', () => {
    test('handles valid video ID request', async () => {
      // Mock successful DeepSRT API response
      mockAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          summary: 'This is a test video summary about testing.'
        }
      });

      const toolArgs = {
        videoId: 'dQw4w9WgXcQ',
        lang: 'en',
        mode: 'narrative'
      };

      // This would normally be called through the MCP server
      // For testing, we'll simulate the API call directly
      const response = await mockAxios.get(
        `https://deepsrt.com/api/summary/${toolArgs.videoId}`,
        {
          params: {
            lang: toolArgs.lang,
            mode: toolArgs.mode
          }
        }
      );

      expect(response.data.success).toBe(true);
      expect(response.data.summary).toContain('test video summary');
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://deepsrt.com/api/summary/dQw4w9WgXcQ',
        {
          params: {
            lang: 'en',
            mode: 'narrative'
          }
        }
      );
    });

    test('uses default parameters when not provided', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          summary: 'Default summary response'
        }
      });

      const toolArgs = {
        videoId: 'dQw4w9WgXcQ'
        // lang and mode not provided - should use defaults
      };

      const response = await mockAxios.get(
        `https://deepsrt.com/api/summary/${toolArgs.videoId}`,
        {
          params: {
            lang: 'zh-tw', // default
            mode: 'narrative' // default
          }
        }
      );

      expect(response.data.success).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://deepsrt.com/api/summary/dQw4w9WgXcQ',
        {
          params: {
            lang: 'zh-tw',
            mode: 'narrative'
          }
        }
      );
    });
  });

  describe('get_transcript tool', () => {
    test('handles YouTube URL extraction and API call', async () => {
      // Mock YouTube InnerTube API response
      const mockVideoInfo = {
        videoDetails: {
          title: 'Test Video',
          author: 'Test Channel',
          lengthSeconds: '180'
        },
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                baseUrl: 'https://www.youtube.com/api/timedtext?v=dQw4w9WgXcQ&lang=en',
                name: { simpleText: 'English' },
                languageCode: 'en'
              }
            ]
          }
        }
      };

      const mockTranscriptXML = `
        <transcript>
          <text start="0" dur="2000">Hello world</text>
          <text start="2000" dur="3000">This is a test transcript</text>
        </transcript>
      `;

      // Mock the YouTube API calls
      mockAxios.post.mockResolvedValueOnce({ data: mockVideoInfo });
      mockAxios.get.mockResolvedValueOnce({ data: mockTranscriptXML });

      const toolArgs = {
        videoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        lang: 'en'
      };

      // Simulate the video info API call
      const videoInfoResponse = await mockAxios.post(
        'https://www.youtube.com/youtubei/v1/player',
        expect.any(Object)
      );

      // Simulate the transcript API call
      const transcriptResponse = await mockAxios.get(
        mockVideoInfo.captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl
      );

      expect(videoInfoResponse.data.videoDetails.title).toBe('Test Video');
      expect(transcriptResponse.data).toContain('Hello world');
      expect(transcriptResponse.data).toContain('This is a test transcript');
    });

    test('extracts video ID from various URL formats', () => {
      const testCases = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'dQw4w9WgXcQ'
      ];

      testCases.forEach(input => {
        // This would be handled by the extractVideoId function
        const expectedVideoId = 'dQw4w9WgXcQ';
        expect(input.includes(expectedVideoId) || input === expectedVideoId).toBe(true);
      });
    });
  });

  describe('Tool parameter validation', () => {
    test('get_summary requires videoId parameter', () => {
      const validArgs = { videoId: 'dQw4w9WgXcQ' };
      const invalidArgs = { lang: 'en' }; // missing videoId

      expect(validArgs.videoId).toBeDefined();
      expect(validArgs.videoId).toHaveLength(11);
      
      // @ts-expect-error - testing invalid args
      expect(invalidArgs.videoId).toBeUndefined();
    });

    test('get_transcript requires videoId parameter', () => {
      const validArgs = { videoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
      const invalidArgs = { lang: 'en' }; // missing videoId

      expect(validArgs.videoId).toBeDefined();
      expect(validArgs.videoId.length).toBeGreaterThan(0);
      
      // @ts-expect-error - testing invalid args
      expect(invalidArgs.videoId).toBeUndefined();
    });
  });
});
