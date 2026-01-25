/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { getGeminiClient } from '@/lib/gemini/client';

const SKIP_E2E = !process.env.GEMINI_API_KEY;
const FIXTURE_PATH = path.join(__dirname, 'fixtures/q13-economic-policy-graph.png');

const Q13_PASSAGE = `High levels of public uncertainty about which economic policies a country will adopt can make planning difficult for businesses, but measures of such uncertainty have not tended to be very detailed. Recently, however, economist Sandile Hlatshwayo analyzed trends in news reports to derive measures not only for general economic policy uncertainty but also for uncertainty related to specific areas of economic policy, like tax or trade policy. One revelation of her work is that a general measure may not fully reflect uncertainty about specific areas of policy, as in the case of the United Kingdom, where general economic policy uncertainty _______`;

const Q13_QUESTION = 'Which choice most effectively uses data from the graph to illustrate the claim?';

const Q13_OPTIONS = {
  A: 'aligned closely with uncertainty about tax and public spending policy in 2005 but differed from uncertainty about tax and public spending policy by a large amount in 2009.',
  B: 'was substantially lower than uncertainty about tax and public spending policy each year from 2005 to 2010.',
  C: 'reached its highest level between 2005 and 2010 in the same year that uncertainty about trade policy and tax and public spending policy reached their lowest levels.',
  D: 'was substantially lower than uncertainty about trade policy in 2005 and substantially higher than uncertainty about trade policy in 2010.',
};

const EXPECTED_ANSWER = 'D';

describe.skipIf(SKIP_E2E)('E2E: Figure/Graph Parsing', () => {
  it('should correctly analyze bar graph and answer Q13 with D', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) {
      throw new Error(`Test fixture not found: ${FIXTURE_PATH}`);
    }

    const imageBuffer = fs.readFileSync(FIXTURE_PATH);
    const base64Image = imageBuffer.toString('base64');
    
    const ai = getGeminiClient();
    
    const prompt = `You are an expert SAT test analyzer. Look at this bar graph and answer the question.

**CRITICAL FOR THE BAR GRAPH - FOLLOW THESE STEPS:**
1. READ THE LEGEND FIRST: Identify what each color/pattern/shading represents
2. MATCH BARS TO LEGEND: For each bar, CAREFULLY identify its visual style and match to the legend
3. READ Y-AXIS VALUES: For each bar, read its height from the y-axis scale
4. DOUBLE-CHECK: Verify your color/pattern matching is correct - this is the #1 source of errors

**Common mistake to AVOID:** Swapping which bar represents which category (e.g., confusing "trade policy" bars with "general economic policy" bars)

**PASSAGE:**
${Q13_PASSAGE}

**QUESTION:**
${Q13_QUESTION}

**OPTIONS:**
A) ${Q13_OPTIONS.A}
B) ${Q13_OPTIONS.B}
C) ${Q13_OPTIONS.C}
D) ${Q13_OPTIONS.D}

First, describe the graph data for each year (2005-2010), listing the values for each policy type.
Then, analyze each option against the data.
Finally, provide your answer.

**OUTPUT FORMAT (JSON):**
{
  "graphData": {
    "2005": { "tax": <number>, "trade": <number>, "general": <number> },
    "2010": { "tax": <number>, "trade": <number>, "general": <number> }
  },
  "analysis": "Brief analysis of why each option is correct or incorrect",
  "answer": "A/B/C/D"
}`;

    console.log('Sending image to Gemini for analysis...');
    
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: base64Image } },
          { text: prompt }
        ]
      }]
    });

    const responseText = result.text || '';
    console.log('Raw response:', responseText.substring(0, 1000));

    const jsonMatch = responseText.match(/\{[\s\S]*"answer"[\s\S]*\}/);
    if (!jsonMatch) {
      const answerMatch = responseText.match(/answer[:\s]*["']?([A-D])["']?/i);
      if (answerMatch) {
        console.log('Extracted answer from text:', answerMatch[1]);
        expect(answerMatch[1].toUpperCase()).toBe(EXPECTED_ANSWER);
        
        const trade2005Match = responseText.match(/2005[\s\S]{0,200}trade[^\d]*(\d+)/i);
        const general2005Match = responseText.match(/2005[\s\S]{0,200}general[^\d]*(\d+)/i);
        const trade2010Match = responseText.match(/2010[\s\S]{0,200}trade[^\d]*(\d+)/i);
        const general2010Match = responseText.match(/2010[\s\S]{0,200}general[^\d]*(\d+)/i);
        
        if (trade2005Match && general2005Match) {
          const trade2005 = parseInt(trade2005Match[1]);
          const general2005 = parseInt(general2005Match[1]);
          console.log(`2005: general (${general2005}) < trade (${trade2005})`);
          expect(general2005).toBeLessThan(trade2005);
        }
        
        if (trade2010Match && general2010Match) {
          const trade2010 = parseInt(trade2010Match[1]);
          const general2010 = parseInt(general2010Match[1]);
          console.log(`2010: general (${general2010}) > trade (${trade2010})`);
          expect(general2010).toBeGreaterThan(trade2010);
        }
        
        console.log('\n=== Test Passed ===');
        return;
      }
      throw new Error('Could not parse response');
    }

    let jsonText = jsonMatch[0];
    const parsed = JSON.parse(jsonText);
    
    console.log('\n=== Analysis Results ===');
    console.log('Graph Data:', JSON.stringify(parsed.graphData, null, 2));
    console.log('Analysis:', parsed.analysis);
    console.log('Answer:', parsed.answer);
    console.log('Expected:', EXPECTED_ANSWER);

    expect(parsed.answer).toBe(EXPECTED_ANSWER);

    if (parsed.graphData?.['2005'] && parsed.graphData?.['2010']) {
      const data2005 = parsed.graphData['2005'];
      const data2010 = parsed.graphData['2010'];
      
      console.log('\n=== Data Relationship Verification ===');
      console.log(`2005: general (${data2005.general}) should be < trade (${data2005.trade})`);
      console.log(`2010: general (${data2010.general}) should be > trade (${data2010.trade})`);
      
      expect(data2005.general).toBeLessThan(data2005.trade);
      expect(data2010.general).toBeGreaterThan(data2010.trade);
    }

    console.log('\n=== Test Passed ===');
  }, 60000);
});
