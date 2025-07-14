import { describe, test, expect } from 'bun:test';

// Test for YouTube syllable parsing fix
// This test ensures that the parseXMLTranscript method correctly handles
// YouTube's timedtext format with <s> tags for syllables

// Mock YouTube XML with actual syllable structure (based on real YouTube captions)
const realYouTubeXMLWithSyllables = `<?xml version="1.0" encoding="utf-8" ?>
<timedtext format="3">
<head>
<ws id="0"/>
<ws id="1" mh="2" ju="0" sd="3"/>
<wp id="0"/>
<wp id="1" ap="6" ah="20" av="100" rc="2" cc="40"/>
</head>
<body>
<w t="0" id="1" wp="1" ws="1"/>
<p t="1634" d="3360" w="1"><s ac="0">wh</s><s t="33" ac="0">er</s><s t="67" ac="0">ev</s><s t="100" ac="0">er</s><s t="134" ac="0"> y</s><s t="167" ac="0">ou</s><s t="735" ac="0"> g</s><s t="768" ac="0">et</s><s t="901" ac="0"> y</s><s t="934" ac="0">ou</s><s t="967" ac="0">r </s><s t="1001" ac="0">po</s><s t="1034" ac="0">dc</s><s t="1067" ac="0">as</s><s t="1101" ac="0">ts</s><s t="1134" ac="0">.</s></p>
<p t="5572" d="1734" w="1"><s ac="0">&gt;&gt;</s><s t="33" ac="0"> W</s><s t="66" ac="0">el</s><s t="100" ac="0">co</s><s t="133" ac="0">me</s><s t="200" ac="0"> b</s><s t="233" ac="0">ac</s><s t="267" ac="0">k.</s><s t="300" ac="0"> O</s><s t="333" ac="0">ne</s><s t="1568" ac="0"> o</s><s t="1601" ac="0">f</s><s t="1634" ac="0"> t</s><s t="1668" ac="0">he</s></p>
<p t="7373" d="1267" w="1"><s ac="0">ye</s><s t="33" ac="0">ar</s><s t="67" ac="0">&#39;s</s><s t="301" ac="0"> h</s><s t="334" ac="0">ot</s><s t="367" ac="0">te</s><s t="401" ac="0">st</s><s t="434" ac="0"> I</s><s t="467" ac="0">PO</s><s t="501" ac="0">s.</s><s t="534" ac="0"> J</s><s t="567" ac="0">us</s><s t="601" ac="0">t</s></p>
</body>
</timedtext>`;

// Fixed parsing method that handles YouTube syllables correctly
function parseXMLTranscript(xmlContent: string): Array<{timestamp: string, text: string}> {
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
          const timestamp = formatTimestamp(startTime);
          result.push({ timestamp, text: fullText });
        }
      }
    }
  }
  
  return result;
}

function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
}

describe('YouTube Syllable Parsing Fix', () => {
  test('correctly reconstructs words from YouTube syllables', () => {
    const result = parseXMLTranscript(realYouTubeXMLWithSyllables);
    
    // Should have 3 segments
    expect(result).toHaveLength(3);
    
    // First segment should be properly reconstructed
    expect(result[0]).toEqual({
      timestamp: '[00:01]',
      text: 'wherever you get your podcasts.'
    });
    
    // Second segment should handle HTML entities and word boundaries
    expect(result[1]).toEqual({
      timestamp: '[00:05]',
      text: '>> Welcome back. One of the'
    });
    
    // Third segment should handle apostrophes
    expect(result[2]).toEqual({
      timestamp: '[00:07]',
      text: "year's hottest IPOs. Just"
    });
  });

  test('handles syllables with leading spaces as word boundaries', () => {
    const xmlWithSpaces = `
      <timedtext format="3">
        <body>
          <p t="0" d="2000"><s>hel</s><s>lo</s><s> wor</s><s>ld</s><s> test</s><s>ing</s></p>
        </body>
      </timedtext>
    `;
    
    const result = parseXMLTranscript(xmlWithSpaces);
    
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('hello world testing');
  });

  test('decodes HTML entities in syllables', () => {
    const xmlWithEntities = `
      <timedtext format="3">
        <body>
          <p t="0" d="2000"><s>&gt;&gt;</s><s> hel</s><s>lo</s><s> &amp;</s><s> wel</s><s>come</s><s> &#39;test&#39;</s></p>
        </body>
      </timedtext>
    `;
    
    const result = parseXMLTranscript(xmlWithEntities);
    
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(">> hello & welcome 'test'");
  });

  test('handles empty or whitespace-only paragraphs', () => {
    const xmlWithEmptyParagraphs = `
      <timedtext format="3">
        <body>
          <p t="0" d="2000"><s>hello</s><s> world</s></p>
          <p t="2000" d="1000"></p>
          <p t="3000" d="1000">   </p>
          <p t="4000" d="2000"><s>test</s><s>ing</s></p>
        </body>
      </timedtext>
    `;
    
    const result = parseXMLTranscript(xmlWithEmptyParagraphs);
    
    // Should only have 2 segments (empty paragraphs skipped)
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('hello world');
    expect(result[1].text).toBe('testing');
  });

  test('skips music notation segments', () => {
    const xmlWithMusic = `
      <timedtext format="3">
        <body>
          <p t="0" d="2000"><s>hello</s><s> world</s></p>
          <p t="2000" d="1000"><s>♪♪♪</s></p>
          <p t="3000" d="2000"><s>test</s><s>ing</s></p>
        </body>
      </timedtext>
    `;
    
    const result = parseXMLTranscript(xmlWithMusic);
    
    // Should only have 2 segments (music notation skipped)
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('hello world');
    expect(result[1].text).toBe('testing');
  });

  test('formats timestamps correctly', () => {
    const result = parseXMLTranscript(realYouTubeXMLWithSyllables);
    
    // Check timestamp formatting
    expect(result[0].timestamp).toBe('[00:01]'); // 1634ms -> 00:01
    expect(result[1].timestamp).toBe('[00:05]'); // 5572ms -> 00:05
    expect(result[2].timestamp).toBe('[00:07]'); // 7373ms -> 00:07
  });

  test('does not contain raw <s> tags in output', () => {
    const result = parseXMLTranscript(realYouTubeXMLWithSyllables);
    
    // Ensure no raw <s> tags remain in the output
    result.forEach(segment => {
      expect(segment.text).not.toContain('<s>');
      expect(segment.text).not.toContain('</s>');
      expect(segment.text).not.toContain('<s ');
    });
  });
});
