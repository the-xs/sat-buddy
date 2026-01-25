/**
 * @vitest-environment node
 *
 * E2E test for systems of equations verification.
 * Tests that Gemini correctly solves systems and returns ordered pairs.
 *
 * Question: Solve the system: 2x + y = 7 and x - y = 2
 * Solution:
 *   - From equation 2: x = y + 2
 *   - Substitute into equation 1: 2(y+2) + y = 7
 *   - Simplify: 2y + 4 + y = 7 → 3y = 3 → y = 1
 *   - Back-substitute: x = 1 + 2 = 3
 *   - Solution: (3, 1)
 *   - Verify: 2(3) + 1 = 7 ✓ and 3 - 1 = 2 ✓
 *
 * Common mistake: Reporting x=3 or y=1 instead of (3, 1)
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/systems-of-equations-verification.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

const SYSTEM_QUESTION = `Solve the system of equations:
$$2x + y = 7$$
$$x - y = 2$$

What is the solution $(x, y)$?`;

// Hoisted mock for Prisma only
const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 101 }));
const mockPrismaVerificationLogCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 1 }));

vi.mock('@/lib/prisma', () => ({
  default: {
    question: { update: mockPrismaQuestionUpdate },
    answerVerificationLog: { create: mockPrismaVerificationLogCreate },
  },
}));

import { pdfService } from '@/lib/services/pdfService';

describe.skipIf(SKIP_E2E)('E2E: Systems of Equations Verification with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should correct "3" to "(3, 1)" using real Gemini API', async () => {
    console.log('Testing Systems of Equations');
    console.log('System: 2x + y = 7 and x - y = 2');
    console.log('Expected solution: (3, 1)');
    console.log('Proposed wrong answer: 3 (only x value)');
    console.log('Expected correction: 3 → (3, 1)');
    console.log('');

    await pdfService.verifyBatch(
      'e2e-systems-test',
      500,
      'E2E Systems Test',
      'Math',
      2,
      [{
        questionId: 101,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 101,
        questionText: SYSTEM_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '3',  // WRONG - missing y value
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    // Verify correction to (3, 1) in some format
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    const updateCall = mockPrismaQuestionUpdate.mock.calls[0][0];
    const verifiedAnswer = updateCall.data.correctAnswer;
    
    // Accept various formats: "(3, 1)" or "3, 1" or "(3,1)"
    expect(verifiedAnswer).toMatch(/[(]?\s*3\s*,\s*1\s*[)]?/);

    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);

    console.log(`✅ verifyBatch correctly identified missing y-value and returned: ${verifiedAnswer}`);
  }, 120000);

  it('should verify (3, 1) is correct when already provided', async () => {
    console.log('Testing with correct answer (3, 1)...');

    await pdfService.verifyBatch(
      'e2e-systems-test-correct',
      501,
      'E2E Systems Test - Already Correct',
      'Math',
      2,
      [{
        questionId: 101,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 101,
        questionText: SYSTEM_QUESTION,
        questionType: 'FreeResponse',
        optionA: null,
        optionB: null,
        optionC: null,
        optionD: null,
        correctAnswer: '(3, 1)',  // Already correct
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    expect(mockPrismaQuestionUpdate).not.toHaveBeenCalled();
    expect(mockPrismaVerificationLogCreate).not.toHaveBeenCalled();

    console.log('✅ verifyBatch correctly confirmed (3, 1) is right');
  }, 120000);
});
