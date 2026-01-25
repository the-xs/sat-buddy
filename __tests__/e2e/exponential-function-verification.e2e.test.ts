/**
 * @vitest-environment node
 *
 * E2E test for exponential function verification.
 * Tests that Gemini correctly solves for constants in exponential functions.
 *
 * Question: f(x) = -a^x + b, graph of y = f(x) - 15 has y-intercept (0, -99/7), ab = 65/7
 * What is the value of a?
 *
 * Solution:
 *   - At x=0: y = f(0) - 15 = -99/7
 *   - So: f(0) = -99/7 + 15 = 6/7
 *   - f(0) = -a^0 + b = -1 + b = 6/7
 *   - Therefore: b = 13/7
 *   - Given: ab = 65/7
 *   - So: a · (13/7) = 65/7
 *   - Therefore: a = 5
 *
 * Common mistake: Returning b (13/7) instead of solving for a
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/exponential-function-verification.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

// M1-Q27: Exponential Function Question
const M1_Q27_QUESTION = `Function $f$ is defined by $f(x) = -a^x + b$, where $a$ and $b$ are constants. In the xy-plane, the graph of $y = f(x) - 15$ has a y-intercept at $\\left(0, -\\frac{99}{7}\\right)$. The product of $a$ and $b$ is $\\frac{65}{7}$. What is the value of $a$?`;

// Hoisted mock for Prisma only
const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 27 }));
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

describe.skipIf(SKIP_E2E)('E2E: Exponential Function Verification with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should correct M1-Q27 from 13/7 to 5 using real Gemini API', async () => {
    console.log('Testing M1-Q27: Exponential Function');
    console.log('Function: f(x) = -a^x + b');
    console.log('y-intercept of y = f(x) - 15: (0, -99/7)');
    console.log('Product: ab = 65/7');
    console.log('Expected reasoning:');
    console.log('  - f(0) - 15 = -99/7 → f(0) = 6/7');
    console.log('  - f(0) = -1 + b = 6/7 → b = 13/7');
    console.log('  - ab = 65/7 → a·(13/7) = 65/7 → a = 5');
    console.log('Proposed wrong answer: 13/7 (this is b, not a!)');
    console.log('Expected correction: 13/7 → 5');
    console.log('');

    await pdfService.verifyBatch(
      'e2e-exponential-function-test',
      400,
      'E2E Exponential Function Test',
      'Math',
      1,
      [{
        questionId: 27,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 27,
        questionText: M1_Q27_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '13/7',  // WRONG - This is b, not a! Gemini should correct to 5
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    // Verify correction to 5
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
      where: { id: 27 },
      data: expect.objectContaining({
        correctAnswer: '5'
      })
    });

    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionNumber: 27,
        originalAnswer: '13/7',
        verifiedAnswer: '5',
        wasCorrect: false
      })
    });

    console.log('✅ verifyBatch correctly identified 13/7 was wrong and corrected to 5');
  }, 120000);

  it('should verify M1-Q27 is correct when proposed answer is already 5', async () => {
    console.log('Testing M1-Q27 with correct answer (5)...');

    await pdfService.verifyBatch(
      'e2e-exponential-function-test-correct',
      401,
      'E2E Exponential Function Test - Already Correct',
      'Math',
      1,
      [{
        questionId: 27,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 27,
        questionText: M1_Q27_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '5',  // Already correct
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    // No correction should be made
    expect(mockPrismaQuestionUpdate).not.toHaveBeenCalled();
    expect(mockPrismaVerificationLogCreate).not.toHaveBeenCalled();

    console.log('✅ verifyBatch correctly confirmed 5 is the right answer');
  }, 120000);
});
