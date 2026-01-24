/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';

const SKIP_E2E = !process.env.GEMINI_API_KEY;
const FIXTURE_PATH = path.join(__dirname, 'fixtures/q13-economic-policy-graph.png');

// Q13 data (same as figure-parsing.e2e.test.ts)
const Q13_PASSAGE = `High levels of public uncertainty about which economic policies a country will adopt can make planning difficult for businesses, but measures of such uncertainty have not tended to be very detailed. Recently, however, economist Sandile Hlatshwayo analyzed trends in news reports to derive measures not only for general economic policy uncertainty but also for uncertainty related to specific areas of economic policy, like tax or trade policy. One revelation of her work is that a general measure may not fully reflect uncertainty about specific areas of policy, as in the case of the United Kingdom, where general economic policy uncertainty _______`;

const Q13_QUESTION = 'Which choice most effectively uses data from the graph to illustrate the claim?';

const Q13_OPTIONS = {
  A: 'aligned closely with uncertainty about tax and public spending policy in 2005 but differed from uncertainty about tax and public spending policy by a large amount in 2009.',
  B: 'was substantially lower than uncertainty about tax and public spending policy each year from 2005 to 2010.',
  C: 'reached its highest level between 2005 and 2010 in the same year that uncertainty about trade policy and tax and public spending policy reached their lowest levels.',
  D: 'was substantially lower than uncertainty about trade policy in 2005 and substantially higher than uncertainty about trade policy in 2010.',
};

// Hoisted mock for Prisma only
const mockPrismaQuestionUpdate = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 13 }));
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

describe.skipIf(SKIP_E2E)('E2E: verifyBatch Pipeline with Real Gemini', () => {
  beforeEach(() => {
    mockPrismaQuestionUpdate.mockClear();
    mockPrismaVerificationLogCreate.mockClear();
  });

  it('should correct Q13 from A to D using real Gemini API', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) {
      throw new Error(`Test fixture not found: ${FIXTURE_PATH}`);
    }

    const imageBuffer = fs.readFileSync(FIXTURE_PATH);
    const base64Image = imageBuffer.toString('base64');

    console.log('Calling verifyBatch with Q13 (wrong answer A)...');

    // Call the ACTUAL verifyBatch function with real Gemini
    await pdfService.verifyBatch(
      'e2e-test-file-id',
      1,  // testId (mock will accept any)
      'E2E Test',  // testName
      'ReadingWriting',  // section
      1,  // moduleNumber
      [{
        questionId: 13,
        setIndex: 0,
        qIndex: 0,
        questionNumber: 13,
        questionText: Q13_QUESTION,
        questionType: 'MultipleChoice',
        optionA: Q13_OPTIONS.A,
        optionB: Q13_OPTIONS.B,
        optionC: Q13_OPTIONS.C,
        optionD: Q13_OPTIONS.D,
        correctAnswer: 'A',  // WRONG - Gemini should correct to D
        passage: Q13_PASSAGE,
        hasFigure: true,
        figureCaption: 'Economic Policy Uncertainty bar graph for UK (2005-2010)',
        figureData: base64Image
      }]
    );

    // Verify prisma.question.update was called with correction to D
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
    expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
      where: { id: 13 },
      data: expect.objectContaining({
        correctAnswer: 'D'
      })
    });

    // Verify the correction was logged
    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
    expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        questionNumber: 13,
        originalAnswer: 'A',
        verifiedAnswer: 'D',
        wasCorrect: false
      })
    });

    console.log('✅ verifyBatch correctly identified A was wrong and corrected to D');
  }, 120000);  // 2 minute timeout for API call
});
