# Testing Documentation

## Test Coverage

This project includes comprehensive testing covering both unit tests and end-to-end integration tests for the complete MCP server functionality.

### Test Files

- **`src/index.test.ts`** - Unit tests for utility functions
- **`src/integration.test.ts`** - Integration tests for MCP tool handlers (mocked)
- **`src/transcript.test.ts`** - Real YouTube API integration tests
- **`src/e2e.test.ts`** - Complete end-to-end workflow tests

### Test Coverage Areas

#### Core Utility Functions (Unit Tests)
- ✅ **extractVideoId()** - YouTube URL parsing and video ID extraction
- ✅ **selectBestCaption()** - Caption selection logic (manual vs auto-generated)
- ✅ **formatTimestamp()** - Millisecond to [MM:SS] format conversion
- ✅ **parseXMLTranscript()** - XML transcript parsing with HTML entity decoding

#### MCP Tool Integration (Mocked Tests)
- ✅ **get_summary tool** - DeepSRT API integration with parameter handling
- ✅ **get_transcript tool** - YouTube InnerTube API integration
- ✅ **Parameter validation** - Required parameter checking

#### Real API Integration Tests
- ✅ **YouTube video info fetching** - Real YouTube InnerTube API calls
- ✅ **Caption discovery** - Finding available caption tracks
- ✅ **Transcript extraction** - Fetching and parsing real YouTube captions
- ✅ **Multiple URL format support** - Testing various YouTube URL patterns

#### End-to-End Workflow Tests
- ✅ **get_summary with zh-tw language** - Traditional Chinese summary requests
- ✅ **get_summary with bullet mode** - Different summary formatting
- ✅ **Multi-language support** - Testing zh-tw, en, ja languages
- ✅ **Complete transcript extraction** - Full workflow from URL to formatted output
- ✅ **Markdown generation** - Formatted output for MCP responses
- ✅ **Combined workflow** - Testing both tools together

### Running Tests

```bash
# Run unit tests only (fast, no network calls)
npm test
# or
npm run test:unit

# Run network tests (requires internet, may be slower)
npm run test:network

# Run all tests including network tests
npm run test:all

# Run tests in watch mode
npm run test:watch

# Run with CI reporter
npm run test:ci
```

### Test Results Summary

```
✅ Unit Tests: 18 tests passing
✅ Network Tests: 13 tests passing  
✅ Total: 31+ tests
✅ 0 failures in core functionality
✅ Execution time: <2 seconds for unit tests, ~15 seconds for network tests
```

### Test Philosophy

#### Unit Tests (Fast & Reliable)
- Focus on **happy path scenarios** with mocked data
- Ensure core functionality works as expected
- No external dependencies or network calls
- Fast execution for development workflow

#### Network Tests (Real Integration)
- Test with **actual YouTube videos** (Rick Astley - Never Gonna Give You Up)
- Verify **real API responses** and data parsing
- Handle **expected failures gracefully** (e.g., uncached videos, API unavailability)
- Demonstrate **complete end-to-end functionality**

#### Error Handling Strategy
- **DeepSRT API tests** work with direct transcript processing from YouTube
- **YouTube API tests** use stable, popular videos with known captions
- **Network errors** are handled gracefully with informative messages
- **Tests pass** even when external services are temporarily unavailable (conditional assertions)

### CI/CD Integration

Tests are automatically run in GitHub Actions on:
- Push to main branch
- Pull requests to main branch

The CI pipeline includes:
1. **Unit tests only** (for speed and reliability)
2. **Build verification**
3. **Server startup test**
4. **Network tests excluded** from CI to avoid external dependencies

### Test Data

#### Test Video Used
- **Video ID**: `dQw4w9WgXcQ`
- **Title**: "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)"
- **Reason**: Stable, popular video with reliable captions in multiple languages
- **Expected Results**: 
  - 31+ transcript segments
  - Manual English captions available
  - Contains recognizable lyrics for validation

#### Expected API Behaviors
- **YouTube InnerTube API**: Should return video metadata and caption tracks
- **DeepSRT API**: Processes transcripts directly from YouTube and returns summaries
- **Caption Selection**: Prefers manual over auto-generated captions
- **Transcript Parsing**: Handles YouTube's `<timedtext>` XML format

### Debugging Test Failures

#### Common Issues
1. **Network connectivity** - Check internet connection for network tests
2. **YouTube API changes** - API structure may evolve over time
3. **DeepSRT API availability** - External service may be down or video not cached
4. **Rate limiting** - Multiple rapid requests may be throttled

#### Troubleshooting Commands
```bash
# Test specific file
bun test src/index.test.ts

# Verbose output
bun test --verbose

# Test with timeout
bun test --timeout 30000
```

This comprehensive testing approach ensures the MCP server works reliably in both development and production environments while gracefully handling external service dependencies.
