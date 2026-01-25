/**
 * E2E Test: Grammar Question Verification
 * 
 * Tests the Standard English Conventions question (Q24) about verb forms.
 * This question was incorrectly answered as B when it should be A.
 * 
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { getGeminiClient } from '@/lib/gemini/client';
import { pdfService } from '@/lib/services/pdfService';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

const Q24_FULL_SENTENCE = `Working from an earlier discovery of Charpentier's, chemists Emmanuelle Charpentier and Jennifer Doudna—winners of the 2020 Nobel Prize in Chemistry—re-created and then reprogrammed the so-called "genetic scissors" of a species of DNA-cleaving bacteria _______ a tool that is revolutionizing the field of gene technology.`;

const Q24_QUESTION = 'Which choice completes the text so that it conforms to the conventions of Standard English?';

const Q24_OPTIONS = {
  A: 'to forge',
  B: 'forging',
  C: 'forged',
  D: 'and forging',
};

const EXPECTED_ANSWER = 'A';

function parseVerificationResponse(responseText: string) {
  const jsonMatch = responseText.match(/\{\s*"verifications"\s*:\s*\[[\s\S]*?\]\s*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.verifications?.[0];
    } catch {
      return null;
    }
  }
  return null;
}

function parseDirectAnswer(responseText: string) {
  const jsonMatch = responseText.match(/\{[\s\S]*?"answer"\s*:\s*"([A-D])"[\s\S]*?\}/);
  if (jsonMatch) {
    return jsonMatch[1];
  }
  const boxedMatch = responseText.match(/\\boxed\{([A-D])\}/);
  if (boxedMatch) {
    return boxedMatch[1];
  }
  const answerMatch = responseText.match(/(?:answer|Answer|ANSWER)[:\s]+(?:is\s+)?(?:\*\*)?([A-D])(?:\*\*)?/);
  if (answerMatch) {
    return answerMatch[1];
  }
  return null;
}

describe.skipIf(SKIP_E2E)('E2E: Grammar Question Verification', () => {
  
  /**
   * Test 1: Uses actual pdfService.buildVerificationPrompt
   * This tests the real production verification logic
   */
  it('should correctly answer Q24 using actual pdfService verification prompt', async () => {
    const ai = getGeminiClient();
    
    const batch = [{
      questionId: 1,
      setIndex: 0,
      qIndex: 0,
      questionNumber: 24,
      questionText: Q24_FULL_SENTENCE + '\n\n' + Q24_QUESTION,
      questionType: 'MultipleChoice',
      optionA: Q24_OPTIONS.A,
      optionB: Q24_OPTIONS.B,
      optionC: Q24_OPTIONS.C,
      optionD: Q24_OPTIONS.D,
      correctAnswer: 'B',
      passage: null,
      hasFigure: false,
      figureCaption: null
    }];

    const prompt = pdfService.buildVerificationPrompt(batch, 'ReadingWriting');

    console.log('\n=== Testing ACTUAL pdfService verification prompt ===\n');
    console.log('Prompt preview:', prompt.substring(0, 500) + '...\n');
    
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    const responseText = result.text || '';
    console.log('Raw response:', responseText);

    const verification = parseVerificationResponse(responseText);
    console.log('\n=== Verification Result ===');
    console.log('Verified Answer:', verification?.verifiedAnswer);
    console.log('Was Proposed Correct:', verification?.wasCorrect);
    console.log('Explanation:', verification?.explanation);
    console.log('Confidence:', verification?.confidence);
    console.log('Expected:', EXPECTED_ANSWER);

    expect(verification?.verifiedAnswer).toBe(EXPECTED_ANSWER);
  }, 60000);

  /**
   * Test 2: Text-only with ENHANCED grammar prompt
   * This tests if adding grammar-specific instructions fixes the issue
   */
  it('should correctly answer Q24 with enhanced grammar-aware prompt', async () => {
    const ai = getGeminiClient();
    
    const questionsJson = [{
      questionNumber: 24,
      questionText: Q24_FULL_SENTENCE + '\n\n' + Q24_QUESTION,
      questionType: 'MultipleChoice',
      options: Q24_OPTIONS,
      passage: null,
      figureDescription: null,
      proposedAnswer: 'B'
    }];

    const enhancedPrompt = `You are an expert SAT question validator. Think very carefully and deeply about each question. Take your time to reason through every step.

IMPORTANT: This is a critical verification task. Think step by step. Double-check your work. Consider all possibilities before deciding.

For each question:
1. Read the question, passage (if any), and ALL options extremely carefully
2. Think hard about the problem - work through it step by step, showing your reasoning
3. For math: verify calculations twice. For reading: re-read relevant passages
4. For questions with figures/graphs: use the figure description to understand the visual data
5. For Standard English/grammar questions:
   - Mentally insert EACH option into the blank and read the FULL sentence aloud
   - **VERB FORMS**: Carefully identify what grammatical role the blank plays:
     * Is it a MAIN VERB continuing a series? (needs same tense as other verbs)
     * Is it an INFINITIVE expressing purpose? ("to + verb" = in order to)
     * Is it a PARTICIPLE modifying something? ("-ing" or "-ed" form)
   - **INFINITIVE OF PURPOSE**: "to + verb" often expresses WHY or FOR WHAT PURPOSE an action was done
     * Example: "She studied hard to pass the exam" (purpose: passing the exam)
     * Example: "They built a bridge to connect the towns" (purpose: connecting)
   - **PARALLEL STRUCTURE**: When verbs are connected by "and", they should match in form
     * But check if the blank is ACTUALLY part of the parallel series or serves a different function
   - Check punctuation and sentence boundaries carefully
6. Determine the correct answer with high confidence
7. Compare with the proposed answer
8. If different, explain why the proposed answer is wrong and yours is correct

**ReadingWriting Questions to verify:**
${JSON.stringify(questionsJson, null, 2)}

**Output format (JSON only):**
{
  "verifications": [
    {
      "questionNumber": 24,
      "wasCorrect": true or false,
      "verifiedAnswer": "A/B/C/D",
      "explanation": "Brief explanation of why this is correct",
      "confidence": "high/medium/low"
    }
  ]
}

Return ONLY valid JSON. No markdown code fences.`;

    console.log('\n=== Testing ENHANCED verification prompt (with grammar guidance) ===\n');
    
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: enhancedPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    const responseText = result.text || '';
    console.log('Raw response:', responseText);

    const verification = parseVerificationResponse(responseText);
    console.log('\n=== Verification Result (Enhanced) ===');
    console.log('Verified Answer:', verification?.verifiedAnswer);
    console.log('Was Proposed Correct:', verification?.wasCorrect);
    console.log('Explanation:', verification?.explanation);
    console.log('Confidence:', verification?.confidence);
    console.log('Expected:', EXPECTED_ANSWER);

    expect(verification?.verifiedAnswer).toBe(EXPECTED_ANSWER);
  }, 60000);
});
