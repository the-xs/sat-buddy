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

// Q26 data (text-only punctuation question)
const Q26_PASSAGE = `Sociologist Alton Okinaka sits on the review board tasked with adding new sites to the Hawai'i Register of Historic Places, which includes Pi'ilanihale Heiau and the 'Ōpaeka'a Road Bridge. Okinaka doesn't make such decisions _______ all historical designations must be approved by a group of nine other experts from the fields of architecture, archaeology, history, and Hawaiian culture.`;

const Q26_QUESTION = `Which choice completes the text so that it conforms to the conventions of Standard English?`;

const Q26_OPTIONS = {
  A: `single-handedly, however;`,
  B: `single-handedly; however,`,
  C: `single-handedly, however,`,
  D: `single-handedly however`
};

// Q27 data (logical transition)
const Q27_PASSAGE = `During a 2021 launch, Rocket Labs' Electron rocket experienced an unexpected failure: its second-stage booster shut down suddenly after ignition. _______ instead of downplaying the incident, Rocket Labs' CEO publicly acknowledged what happened and apologized for the loss of the rocket's payload, which had consisted of two satellites.`;

const Q27_QUESTION = `Which choice completes the text with the most logical transition?`;

const Q27_OPTIONS = {
  A: `Afterward,`,
  B: `Additionally,`,
  C: `Indeed,`,
  D: `Similarly,`
};

// Q21 data (punctuation - sentence boundary)
const Q21_PASSAGE = `After a spate of illnesses as a child, Wilma Rudolph was told she might never walk again. Defying all odds, Rudolph didn't just walk, she _______ the 1960 Summer Olympics in Rome, she won both the 100- and 200-meter dashes and clinched first place for her team in the 4×100-meter relay, becoming the first US woman to win three gold medals in a single Olympics.`;

const Q21_QUESTION = `Which choice completes the text so that it conforms to the conventions of Standard English?`;

const Q21_OPTIONS = {
  A: `ran—fast—during`,
  B: `ran—fast during`,
  C: `ran—fast, during`,
  D: `ran—fast. During`
};

// M2-Q24 data (verb form - infinitive vs participle)
const M2_Q24_PASSAGE = `Working from an earlier discovery of Charpentier's, chemists Emmanuelle Charpentier and Jennifer Doudna—winners of the 2020 Nobel Prize in Chemistry—re-created and then reprogrammed the so-called "genetic scissors" of a species of DNA-cleaving bacteria _______ a tool that is revolutionizing the field of gene technology.`;

const M2_Q24_QUESTION = `Which choice completes the text so that it conforms to the conventions of Standard English?`;

const M2_Q24_OPTIONS = {
  A: `to forge`,
  B: `forging`,
  C: `forged`,
  D: `and forging`
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

   it('should correct Q26 from C to A (text-only regression)', async () => {
     console.log('Calling verifyBatch with Q26 (wrong answer C)...');

     await pdfService.verifyBatch(
       'e2e-test-file-id',
       2,  // testId
       'E2E Test Q26',
       'ReadingWriting',
       1,  // moduleNumber
       [{
         questionId: 26,
         setIndex: 0,
         qIndex: 0,
         questionNumber: 26,
         questionText: Q26_QUESTION,
         questionType: 'MultipleChoice',
         optionA: Q26_OPTIONS.A,
         optionB: Q26_OPTIONS.B,
         optionC: Q26_OPTIONS.C,
         optionD: Q26_OPTIONS.D,
         correctAnswer: 'C',  // WRONG - Gemini should correct to A
         passage: Q26_PASSAGE,
         hasFigure: false,
         figureCaption: null,
         figureData: undefined  // Text-only question
       }]
     );

     // Verify correction to A
     expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
     expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
       where: { id: 26 },
       data: expect.objectContaining({
         correctAnswer: 'A'
       })
     });

     // Verify logging
     expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
     expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
       data: expect.objectContaining({
         questionNumber: 26,
         originalAnswer: 'C',
         verifiedAnswer: 'A',
         wasCorrect: false
       })
     });

      console.log('✅ verifyBatch correctly identified C was wrong and corrected to A');
    }, 120000);  // 2 minute timeout for API call

    it('should correct Q27 from C to A (logical transition regression)', async () => {
      console.log('Calling verifyBatch with Q27 (wrong answer C)...');

      await pdfService.verifyBatch(
        'e2e-test-file-id',
        3,  // testId
        'E2E Test Q27',
        'ReadingWriting',
        1,  // moduleNumber
        [{
          questionId: 27,
          setIndex: 0,
          qIndex: 0,
          questionNumber: 27,
          questionText: Q27_QUESTION,
          questionType: 'MultipleChoice',
          optionA: Q27_OPTIONS.A,
          optionB: Q27_OPTIONS.B,
          optionC: Q27_OPTIONS.C,
          optionD: Q27_OPTIONS.D,
          correctAnswer: 'C',  // WRONG - Gemini should correct to A
          passage: Q27_PASSAGE,
          hasFigure: false,
          figureCaption: null,
          figureData: undefined  // Text-only question
        }]
      );

      // Verify correction to A
      expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
      expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
        where: { id: 27 },
        data: expect.objectContaining({
          correctAnswer: 'A'
        })
      });

      // Verify logging
      expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
      expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          questionNumber: 27,
          originalAnswer: 'C',
          verifiedAnswer: 'A',
          wasCorrect: false
        })
      });

       console.log('✅ verifyBatch correctly identified C was wrong and corrected to A');
     }, 120000);  // 2 minute timeout for API call

     it('should correct Q21 from B to D (punctuation regression)', async () => {
       console.log('Calling verifyBatch with Q21 (wrong answer B)...');

       await pdfService.verifyBatch(
         'e2e-test-file-id',
         4,  // testId
         'E2E Test Q21',
         'ReadingWriting',
         1,  // moduleNumber
         [{
           questionId: 21,
           setIndex: 0,
           qIndex: 0,
           questionNumber: 21,
           questionText: Q21_QUESTION,
           questionType: 'MultipleChoice',
           optionA: Q21_OPTIONS.A,
           optionB: Q21_OPTIONS.B,
           optionC: Q21_OPTIONS.C,
           optionD: Q21_OPTIONS.D,
           correctAnswer: 'B',  // WRONG - Gemini should correct to D
           passage: Q21_PASSAGE,
           hasFigure: false,
           figureCaption: null,
           figureData: undefined  // Text-only question
         }]
       );

       // Verify correction to D
       expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
       expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
         where: { id: 21 },
         data: expect.objectContaining({
           correctAnswer: 'D'
         })
       });

       // Verify logging
       expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
       expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
         data: expect.objectContaining({
           questionNumber: 21,
           originalAnswer: 'B',
           verifiedAnswer: 'D',
           wasCorrect: false
         })
       });

        console.log('✅ verifyBatch correctly identified B was wrong and corrected to D');
      }, 120000);  // 2 minute timeout for API call

      it('should correct M2-Q24 from B to A (verb form regression)', async () => {
        console.log('Calling verifyBatch with M2-Q24 (wrong answer B)...');

        await pdfService.verifyBatch(
          'e2e-test-file-id',
          5,  // testId
          'E2E Test M2-Q24',
          'ReadingWriting',
          2,  // moduleNumber (Module 2)
          [{
            questionId: 24,
            setIndex: 0,
            qIndex: 0,
            questionNumber: 24,
            questionText: M2_Q24_QUESTION,
            questionType: 'MultipleChoice',
            optionA: M2_Q24_OPTIONS.A,
            optionB: M2_Q24_OPTIONS.B,
            optionC: M2_Q24_OPTIONS.C,
            optionD: M2_Q24_OPTIONS.D,
            correctAnswer: 'B',  // WRONG - Gemini should correct to A
            passage: M2_Q24_PASSAGE,
            hasFigure: false,
            figureCaption: null,
            figureData: undefined  // Text-only question
          }]
        );

        // Verify correction to A
        expect(mockPrismaQuestionUpdate).toHaveBeenCalledTimes(1);
        expect(mockPrismaQuestionUpdate).toHaveBeenCalledWith({
          where: { id: 24 },
          data: expect.objectContaining({
            correctAnswer: 'A'
          })
        });

        // Verify logging
        expect(mockPrismaVerificationLogCreate).toHaveBeenCalledTimes(1);
        expect(mockPrismaVerificationLogCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            questionNumber: 24,
            originalAnswer: 'B',
            verifiedAnswer: 'A',
            wasCorrect: false
          })
        });

        console.log('✅ verifyBatch correctly identified B was wrong and corrected to A');
      }, 120000);  // 2 minute timeout for API call
});
