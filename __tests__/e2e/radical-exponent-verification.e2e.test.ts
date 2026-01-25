/**
 * @vitest-environment node
 *
 * E2E test for radical/exponent simplification verification.
 * Tests that Gemini correctly simplifies expressions with radicals and exponents.
 *
 * Question: The expression 6 * ⁵√(3⁵x⁴⁵) · ⁸√(2⁸x) is equivalent to ax^b
 * Solution:
 *   - 6 * ⁵√(3⁵x⁴⁵) = 6 * 3 * x⁹ = 18x⁹
 *   - ⁸√(2⁸x) = 2 * x^(1/8)
 *   - Combined: 36x^(73/8), so a=36, b=9.125
 *   - a + b = 45.125
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/radical-exponent-verification.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

// M1-Q21: Radical/Exponent Simplification Question
const M1_Q21_QUESTION = `The expression $6\\sqrt[5]{3^5 x^{45}} \\cdot \\sqrt[8]{2^8 x}$ is equivalent to $ax^b$, where $a$ and $b$ are positive constants and $x > 1$. What is the value of $a + b$?`;

// Hoisted mock for Prisma only
const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 21 }));
const mockPrismaVerificationLogCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 1 }));

// Mock ONLY Prisma - DO NOT mock @/lib/gemini/client (use real API)
vi.mock('@/lib/prisma', () => ({
  default: {
    question: { update: mockPrismaQuestionUpdate },
    answerVerificationLog: { create: mockPrismaVerificationLogCreate },
  },
}));

// Import AFTER mocks are set up
import { pdfService } from '@/lib/services/pdfService';

describe.skipIf(SKIP_E2E)('E2E: Radical/Exponent Simplification Verification with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should correct M1-Q21 from 47.5 to 45.125 using real Gemini API', async () => {
    console.log('Testing M1-Q21: Radical/Exponent Simplification');
    console.log('Expression: 6 * ⁵√(3⁵x⁴⁵) · ⁸√(2⁸x) = ax^b');
    console.log('Expected: a + b = 45.125, Proposed wrong: 47.5');

    await pdfService.verifyBatch(
      'e2e-radical-exponent-test',
      200,
      'E2E Radical Exponent Test',
      'Math',
      1,
      [{
        questionId: 21,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 21,
        questionText: M1_Q21_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '47.5',  // WRONG - Gemini should correct to 45.125
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    // Verify correction to 45.125
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
      where: { id: 21 },
      data: expect.objectContaining({
        correctAnswer: '45.125'
      })
    });

    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionNumber: 21,
        originalAnswer: '47.5',
        verifiedAnswer: '45.125',
        wasCorrect: false
      })
    });

    console.log('✅ verifyBatch correctly identified 47.5 was wrong and corrected to 45.125');
  }, 120000);

  it('should verify M1-Q21 is correct when proposed answer is already 45.125', async () => {
    console.log('Testing M1-Q21 with correct answer (45.125)...');

    await pdfService.verifyBatch(
      'e2e-radical-exponent-test-correct',
      201,
      'E2E Radical Exponent Test - Already Correct',
      'Math',
      1,
      [{
        questionId: 21,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 21,
        questionText: M1_Q21_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '45.125',  // Already correct
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    // No correction should be made
    expect(mockPrismaQuestionUpdate).not.toHaveBeenCalled();
    expect(mockPrismaVerificationLogCreate).not.toHaveBeenCalled();

    console.log('✅ verifyBatch correctly confirmed 45.125 is the right answer');
  }, 120000);
});
