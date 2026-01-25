/**
 * @vitest-environment node
 *
 * E2E test for statistics verification.
 * Tests that Gemini correctly computes median from a dataset.
 *
 * Question: Find the median of: 12, 7, 15, 9, 11, 8, 14, 10
 * Solution:
 *   - Sort data: 7, 8, 9, 10, 11, 12, 14, 15
 *   - Count: 8 values (even)
 *   - For even count, median = average of two middle values
 *   - Middle positions: 4th and 5th values
 *   - Values: 10 and 11
 *   - Median = (10 + 11) / 2 = 10.5
 *
 * Common mistakes:
 *   - Not sorting first
 *   - Taking one middle value instead of averaging both (for even count)
 *   - Computing mean instead of median
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/statistics-verification.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

const STATS_QUESTION = `The following data shows test scores: 12, 7, 15, 9, 11, 8, 14, 10

What is the median score?`;

const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 104 }));
const mockPrismaVerificationLogCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 1 }));

vi.mock('@/lib/prisma', () => ({
  default: {
    question: { update: mockPrismaQuestionUpdate },
    answerVerificationLog: { create: mockPrismaVerificationLogCreate },
  },
}));

import { pdfService } from '@/lib/services/pdfService';

describe.skipIf(SKIP_E2E)('E2E: Statistics Verification with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should correct mean (10.75) to median (10.5)', async () => {
    console.log('Testing Statistics (Median)');
    console.log('Data: 12, 7, 15, 9, 11, 8, 14, 10');
    console.log('Sorted: 7, 8, 9, 10, 11, 12, 14, 15');
    console.log('Expected median: (10 + 11) / 2 = 10.5');
    console.log('Proposed wrong answer: 10.75 (this is the mean!)');
    console.log('Expected correction: 10.75 → 10.5');
    console.log('');

    await pdfService.verifyBatch(
      'e2e-stats-test',
      506,
      'E2E Stats Test',
      'Math',
      2,
      [{
        questionId: 104,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 104,
        questionText: STATS_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '10.75',  // WRONG - this is the mean, not median
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockPrismaQuestionUpdate.mock.calls[0][0];
    const verifiedAnswer = updateCall.data.correctAnswer;
    
    const numericValue = parseFloat(verifiedAnswer);
    expect(numericValue).toBeCloseTo(10.5, 2);

    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);

    console.log(`✅ verifyBatch corrected mean to median: ${verifiedAnswer}`);
  }, 120000);

  it('should verify 10.5 is correct when already provided', async () => {
    console.log('Testing with correct median (10.5)...');

    await pdfService.verifyBatch(
      'e2e-stats-test-correct',
      507,
      'E2E Stats Test - Already Correct',
      'Math',
      2,
      [{
        questionId: 104,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 104,
        questionText: STATS_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '10.5',  // Already correct
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    expect(mockPrismaQuestionUpdate).not.toHaveBeenCalled();
    expect(mockPrismaVerificationLogCreate).not.toHaveBeenCalled();

    console.log('✅ verifyBatch correctly confirmed 10.5 is right');
  }, 120000);
});
