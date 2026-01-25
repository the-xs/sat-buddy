/**
 * @vitest-environment node
 *
 * E2E test for parabola vertex form verification.
 * Tests that Gemini correctly analyzes parabola properties from vertex and x-intercepts.
 *
 * Question: Parabola with vertex (9, -14) intersects x-axis at two points.
 * What could be the value of a + b + c in y = ax² + bx + c?
 *
 * Solution:
 *   - Vertex form: y = a(x - 9)² - 14
 *   - Expand: y = ax² - 18ax + (81a - 14)
 *   - So: b = -18a, c = 81a - 14
 *   - Therefore: a + b + c = a - 18a + 81a - 14 = 64a - 14
 *   - Vertex below x-axis + 2 x-intercepts → parabola opens upward → a > 0
 *   - Testing D: -12 = 64a - 14 → a = 1/32 > 0 ✓
 *   - Answer: D) -12
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/parabola-vertex-verification.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

// M1-Q26: Parabola Vertex Question
const M1_Q26_QUESTION = `In the xy-plane, a parabola has vertex $(9, -14)$ and intersects the x-axis at two points. If the equation of the parabola is written in the form $y = ax^2 + bx + c$, where $a$, $b$, and $c$ are constants, which of the following could be the value of $a + b + c$?`;

const M1_Q26_OPTIONS = {
  A: '-23',
  B: '-19',
  C: '-14',
  D: '-12'
};

// Hoisted mock for Prisma only
const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 26 }));
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

describe.skipIf(SKIP_E2E)('E2E: Parabola Vertex Form Verification with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should correct M1-Q26 from A to D using real Gemini API', async () => {
    console.log('Testing M1-Q26: Parabola Vertex Form');
    console.log('Vertex: (9, -14), intersects x-axis at 2 points');
    console.log('Expected reasoning:');
    console.log('  - Vertex form: y = a(x-9)² - 14');
    console.log('  - Standard: y = ax² - 18ax + (81a-14)');
    console.log('  - So: a + b + c = 64a - 14');
    console.log('  - Vertex below x-axis + 2 intercepts → a > 0');
    console.log('  - D: -12 = 64a - 14 → a = 1/32 ✓');
    console.log('Proposed wrong answer: A (-23)');
    console.log('Expected correction: A → D');
    console.log('');

    await pdfService.verifyBatch(
      'e2e-parabola-vertex-test',
      300,
      'E2E Parabola Vertex Test',
      'Math',
      1,
      [{
        questionId: 26,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 26,
        questionText: M1_Q26_QUESTION,
        questionType: 'MultipleChoice',
        optionA: M1_Q26_OPTIONS.A,
        optionB: M1_Q26_OPTIONS.B,
        optionC: M1_Q26_OPTIONS.C,
        optionD: M1_Q26_OPTIONS.D,
        correctAnswer: 'A',  // WRONG - Gemini should correct to D
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    // Verify correction to D
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
      where: { id: 26 },
      data: expect.objectContaining({
        correctAnswer: 'D'
      })
    });

    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionNumber: 26,
        originalAnswer: 'A',
        verifiedAnswer: 'D',
        wasCorrect: false
      })
    });

    console.log('✅ verifyBatch correctly identified A was wrong and corrected to D');
  }, 120000);

  it('should verify M1-Q26 is correct when proposed answer is already D', async () => {
    console.log('Testing M1-Q26 with correct answer (D)...');

    await pdfService.verifyBatch(
      'e2e-parabola-vertex-test-correct',
      301,
      'E2E Parabola Vertex Test - Already Correct',
      'Math',
      1,
      [{
        questionId: 26,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 26,
        questionText: M1_Q26_QUESTION,
        questionType: 'MultipleChoice',
        optionA: M1_Q26_OPTIONS.A,
        optionB: M1_Q26_OPTIONS.B,
        optionC: M1_Q26_OPTIONS.C,
        optionD: M1_Q26_OPTIONS.D,
        correctAnswer: 'D',  // Already correct
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      }]
    );

    // No correction should be made
    expect(mockPrismaQuestionUpdate).not.toHaveBeenCalled();
    expect(mockPrismaVerificationLogCreate).not.toHaveBeenCalled();

    console.log('✅ verifyBatch correctly confirmed D is the right answer');
  }, 120000);
});
