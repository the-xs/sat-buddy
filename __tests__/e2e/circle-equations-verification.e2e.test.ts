/**
 * @vitest-environment node
 *
 * E2E test for circle equations verification.
 * Tests that Gemini correctly writes circle equations from center and radius.
 *
 * Question: Find the equation of a circle with center (2, -3) and radius 5
 * Solution:
 *   - Standard form: (x - h)² + (y - k)² = r²
 *   - Center (h, k) = (2, -3), radius r = 5
 *   - Equation: (x - 2)² + (y - (-3))² = 5²
 *   - Simplify: (x - 2)² + (y + 3)² = 25
 *
 * Common mistakes:
 *   - Sign errors: (x + 2)² instead of (x - 2)²
 *   - Using r instead of r²: = 5 instead of = 25
 *   - Confusing radius with diameter
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/circle-equations-verification.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

const CIRCLE_QUESTION = `Write the equation of a circle with center $(2, -3)$ and radius $5$ in standard form.`;

const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 103 }));
const mockPrismaVerificationLogCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 1 }));

vi.mock('@/lib/prisma', () => ({
  default: {
    question: { update: mockPrismaQuestionUpdate },
    answerVerificationLog: { create: mockPrismaVerificationLogCreate },
  },
}));

import { pdfService } from '@/lib/services/pdfService';

describe.skipIf(SKIP_E2E)('E2E: Circle Equations Verification with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should correct sign error from (x+2)² to (x-2)²', async () => {
    console.log('Testing Circle Equations');
    console.log('Center: (2, -3), Radius: 5');
    console.log('Expected equation: (x-2)² + (y+3)² = 25');
    console.log('Proposed wrong answer: (x+2)² + (y+3)² = 25 (sign error)');
    console.log('Expected correction: fix x sign');
    console.log('');

    await pdfService.verifyBatch(
      'e2e-circle-test',
      504,
      'E2E Circle Test',
      'Math',
      2,
      [{
        questionId: 103,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 103,
        questionText: CIRCLE_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '(x+2)^2 + (y+3)^2 = 25',  // WRONG - sign error on x
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockPrismaQuestionUpdate.mock.calls[0][0];
    const verifiedAnswer = updateCall.data.correctAnswer;
    
    // Should contain (x-2) not (x+2)
    expect(verifiedAnswer).toMatch(/x\s*-\s*2/);
    expect(verifiedAnswer).toMatch(/y\s*\+\s*3/);
    expect(verifiedAnswer).toMatch(/25/);

    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);

    console.log(`✅ verifyBatch corrected sign error: ${verifiedAnswer}`);
  }, 120000);

  it('should verify (x-2)² + (y+3)² = 25 is correct', async () => {
    console.log('Testing with correct answer...');

    await pdfService.verifyBatch(
      'e2e-circle-test-correct',
      505,
      'E2E Circle Test - Already Correct',
      'Math',
      2,
      [{
        questionId: 103,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 103,
        questionText: CIRCLE_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '(x-2)^2 + (y+3)^2 = 25',  // Already correct
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    expect(mockPrismaQuestionUpdate).not.toHaveBeenCalled();
    expect(mockPrismaVerificationLogCreate).not.toHaveBeenCalled();

    console.log('✅ verifyBatch correctly confirmed the equation is right');
  }, 120000);
});
