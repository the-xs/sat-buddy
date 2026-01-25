/**
 * @vitest-environment node
 *
 * E2E test for rational expressions verification.
 * Tests that Gemini correctly handles domain restrictions and extraneous solutions.
 *
 * Question: Solve (x+1)/(x-2) = 3
 * Solution:
 *   - Domain restriction: x ≠ 2 (makes denominator zero)
 *   - Cross-multiply: x + 1 = 3(x - 2)
 *   - Simplify: x + 1 = 3x - 6
 *   - Solve: 7 = 2x → x = 7/2 = 3.5
 *   - Check: x = 3.5 ≠ 2 ✓ (valid)
 *   - Verify: (3.5+1)/(3.5-2) = 4.5/1.5 = 3 ✓
 *
 * Common mistake: Accepting x = 2 as a solution (extraneous - makes denominator 0)
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/rational-expressions-verification.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

const RATIONAL_QUESTION = `Solve the equation:
$$\\frac{x+1}{x-2} = 3$$

What is the value of $x$?`;

const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 102 }));
const mockPrismaVerificationLogCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 1 }));

vi.mock('@/lib/prisma', () => ({
  default: {
    question: { update: mockPrismaQuestionUpdate },
    answerVerificationLog: { create: mockPrismaVerificationLogCreate },
  },
}));

import { pdfService } from '@/lib/services/pdfService';

describe.skipIf(SKIP_E2E)('E2E: Rational Expressions Verification with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should reject extraneous solution x=2 and correct to x=3.5', async () => {
    console.log('Testing Rational Expressions');
    console.log('Equation: (x+1)/(x-2) = 3');
    console.log('Domain restriction: x ≠ 2');
    console.log('Expected solution: x = 7/2 = 3.5');
    console.log('Proposed wrong answer: 2 (extraneous - makes denominator 0)');
    console.log('Expected correction: 2 → 3.5 (or 7/2)');
    console.log('');

    await pdfService.verifyBatch(
      'e2e-rational-test',
      502,
      'E2E Rational Test',
      'Math',
      2,
      [{
        questionId: 102,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 102,
        questionText: RATIONAL_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '2',  // WRONG - extraneous solution
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockPrismaQuestionUpdate.mock.calls[0][0];
    const verifiedAnswer = updateCall.data.correctAnswer;
    
    // Accept 3.5 or 7/2
    const numericValue = verifiedAnswer.includes('/') ? eval(verifiedAnswer) : parseFloat(verifiedAnswer);
    expect(numericValue).toBeCloseTo(3.5, 2);

    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);

    console.log(`✅ verifyBatch rejected extraneous solution and returned: ${verifiedAnswer}`);
  }, 120000);

  it('should verify 3.5 is correct when already provided', async () => {
    console.log('Testing with correct answer (3.5)...');

    await pdfService.verifyBatch(
      'e2e-rational-test-correct',
      503,
      'E2E Rational Test - Already Correct',
      'Math',
      2,
      [{
        questionId: 102,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 102,
        questionText: RATIONAL_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '3.5',  // Already correct
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    expect(mockPrismaQuestionUpdate).not.toHaveBeenCalled();
    expect(mockPrismaVerificationLogCreate).not.toHaveBeenCalled();

    console.log('✅ verifyBatch correctly confirmed 3.5 is right');
  }, 120000);
});
