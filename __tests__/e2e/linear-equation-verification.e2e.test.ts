/**
 * @vitest-environment node
 *
 * E2E test for linear equation graph verification.
 * Tests that Gemini correctly identifies the equation of a line from a coordinate plane graph.
 *
 * This test uses a REAL Gemini API call to verify the fix works.
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/linear-equation-verification.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';

const SKIP_E2E = !process.env.GEMINI_API_KEY;
const FIXTURE_PATH = path.join(__dirname, 'fixtures/q12-linear-equation-graph.png');

// Q12 Linear Equation Question
// The graph shows a line passing through (0, -8) with slope -1
// Equation: y = -x - 8 (Answer: C)
const Q12_QUESTION = 'What is an equation of the graph shown?';

const Q12_OPTIONS = {
  A: 'y = -2x - 8',  // Wrong: slope is -2, but actual slope is -1
  B: 'y = x - 8',    // Wrong: positive slope
  C: 'y = -x - 8',   // CORRECT: slope -1, y-intercept -8
  D: 'y = 2x - 8',   // Wrong: positive slope
};

// Hoisted mock for Prisma only
const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 12 }));
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

describe.skipIf(SKIP_E2E)('E2E: Linear Equation Graph Verification with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should correct Q12 from A to C using real Gemini API (linear equation graph)', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) {
      throw new Error(
        `Test fixture not found: ${FIXTURE_PATH}\n` +
        `Please save the linear equation graph image to this location.\n` +
        `The graph should show a line with y-intercept at (0, -8) and slope -1.`
      );
    }

    const imageBuffer = fs.readFileSync(FIXTURE_PATH);
    const base64Image = imageBuffer.toString('base64');

    console.log('Calling verifyBatch with Q12 linear equation (wrong answer A)...');
    console.log('Graph shows: y-intercept = -8, slope = -1');
    console.log('Expected correction: A (y = -2x - 8) → C (y = -x - 8)');

    // Call the ACTUAL verifyBatch function with real Gemini
    await pdfService.verifyBatch(
      'e2e-linear-eq-test',
      100,  // testId
      'E2E Linear Equation Test',
      'Math',  // Math section
      2,  // moduleNumber (Math Module 2)
      [{
        questionId: 12,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 12,
        questionText: Q12_QUESTION,
        questionType: 'MultipleChoice',
        optionA: Q12_OPTIONS.A,
        optionB: Q12_OPTIONS.B,
        optionC: Q12_OPTIONS.C,
        optionD: Q12_OPTIONS.D,
        correctAnswer: 'A',  // WRONG - Gemini should correct to C
        passage: null,  // No passage for this math question
        hasFigure: true,
        figureCaption: 'Coordinate plane graph showing a linear function',
        figureData: base64Image
      }]
    );

    // Verify prisma.question.update was called with correction to C
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
      where: { id: 12 },
      data: expect.objectContaining({
        correctAnswer: 'C'
      })
    });

    // Verify the correction was logged
    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionNumber: 12,
        originalAnswer: 'A',
        verifiedAnswer: 'C',
        wasCorrect: false
      })
    });

    console.log('✅ verifyBatch correctly identified A was wrong and corrected to C');
    console.log('   The line has slope -1 (not -2), so y = -x - 8 is correct');
  }, 120000);  // 2 minute timeout for API call

  it('should verify Q12 is correct when proposed answer is already C', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) {
      console.log('Skipping - fixture not found');
      return;
    }

    const imageBuffer = fs.readFileSync(FIXTURE_PATH);
    const base64Image = imageBuffer.toString('base64');

    console.log('Calling verifyBatch with Q12 linear equation (correct answer C)...');

    // Call with CORRECT answer to verify no false corrections
    await pdfService.verifyBatch(
      'e2e-linear-eq-test-correct',
      101,
      'E2E Linear Equation Test - Already Correct',
      'Math',
      2,
      [{
        questionId: 12,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 12,
        questionText: Q12_QUESTION,
        questionType: 'MultipleChoice',
        optionA: Q12_OPTIONS.A,
        optionB: Q12_OPTIONS.B,
        optionC: Q12_OPTIONS.C,
        optionD: Q12_OPTIONS.D,
        correctAnswer: 'C',  // Already correct
        passage: null,
        hasFigure: true,
        figureCaption: 'Coordinate plane graph showing a linear function',
        figureData: base64Image
      }]
    );

    // Question.update should NOT be called when answer is already correct
    expect(mockPrismaQuestionUpdate).not.toHaveBeenCalled();

    // Verification log is only created for corrections, not for correct answers
    // This is by design - we only log when we need to fix something
    expect(mockPrismaVerificationLogCreate).not.toHaveBeenCalled();

    console.log('✅ verifyBatch correctly confirmed C is the right answer (no correction needed)');
  }, 120000);
});
