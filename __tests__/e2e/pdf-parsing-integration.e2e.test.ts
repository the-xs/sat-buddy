/**
 * @vitest-environment node
 *
 * E2E integration test for PDF parsing verification pipeline.
 * 
 * Since actual PDF parsing requires file uploads, this test focuses on
 * the VERIFICATION phase which catches errors from parsing.
 *
 * Tests multiple question types to ensure verification logic works correctly:
 * - M1-Q21: Radical/exponent simplification → 45.125
 * - M1-Q26: Parabola vertex form → D (-12)
 * - M1-Q27: Exponential function → 5
 * - Q101: System of equations → (3, 1)
 * - Q102: Rational expression → 3.5
 *
 * This simulates the scenario where parsing extracted wrong answers,
 * and verification catches and corrects them.
 *
 * To run: GEMINI_API_KEY=your_key npm test -- __tests__/e2e/pdf-parsing-integration.e2e.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SKIP_E2E = !process.env.GEMINI_API_KEY;

// Test cases: wrong answer extracted by parsing → correct answer after verification
const TEST_QUESTIONS = [
  {
    id: 21,
    name: 'M1-Q21: Radical/Exponent',
    questionText: `The expression $6\\sqrt[5]{3^5 x^{45}} \\cdot \\sqrt[8]{2^8 x}$ is equivalent to $ax^b$, where $a$ and $b$ are positive constants and $x > 1$. What is the value of $a + b$?`,
    type: 'FreeResponse',
    wrongAnswer: '47.5',
    correctAnswer: '45.125',
  },
  {
    id: 26,
    name: 'M1-Q26: Parabola',
    questionText: `In the xy-plane, a parabola has vertex $(9, -14)$ and intersects the x-axis at two points. If the equation of the parabola is written in the form $y = ax^2 + bx + c$, where $a$, $b$, and $c$ are constants, which of the following could be the value of $a + b + c$?`,
    type: 'MultipleChoice',
    options: { A: '-23', B: '-19', C: '-14', D: '-12' },
    wrongAnswer: 'A',
    correctAnswer: 'D',
  },
  {
    id: 27,
    name: 'M1-Q27: Exponential',
    questionText: `Function $f$ is defined by $f(x) = -a^x + b$, where $a$ and $b$ are constants. In the xy-plane, the graph of $y = f(x) - 15$ has a y-intercept at $\\left(0, -\\frac{99}{7}\\right)$. The product of $a$ and $b$ is $\\frac{65}{7}$. What is the value of $a$?`,
    type: 'FreeResponse',
    wrongAnswer: '13/7',
    correctAnswer: '5',
  },
  {
    id: 101,
    name: 'Q101: System of Equations',
    questionText: `Solve the system of equations:\n$$2x + y = 7$$\n$$x - y = 2$$\nWhat is the solution $(x, y)$?`,
    type: 'FreeResponse',
    wrongAnswer: '3',
    correctAnswer: '(3, 1)',
  },
  {
    id: 102,
    name: 'Q102: Rational Expression',
    questionText: `Solve the equation:\n$$\\frac{x+1}{x-2} = 3$$\nWhat is the value of $x$?`,
    type: 'FreeResponse',
    wrongAnswer: '2',
    correctAnswer: '3.5',
  },
];

// Hoisted mocks
const mockPrismaUpdate = vi.hoisted(() => vi.fn());
const mockPrismaVerificationLogCreate = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
  default: {
    question: {
      update: mockPrismaUpdate.mockImplementation((data) => 
        Promise.resolve({ id: data.where.id })
      ),
    },
    answerVerificationLog: {
      create: mockPrismaVerificationLogCreate.mockImplementation((data) =>
        Promise.resolve({ id: Date.now(), ...data.data })
      ),
    },
  },
}));

import { pdfService } from '@/lib/services/pdfService';

describe.skipIf(SKIP_E2E)('E2E: PDF Parsing Verification Pipeline with Real Gemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify and correct all 5 question types with real Gemini API', async () => {
    console.log('='.repeat(70));
    console.log('PDF PARSING VERIFICATION PIPELINE E2E TEST');
    console.log('='.repeat(70));
    console.log('');
    console.log('This test simulates the scenario where PDF parsing extracted');
    console.log('wrong answers, and the verification phase catches and corrects them.');
    console.log('');
    console.log('Testing 5 different math question types:');
    TEST_QUESTIONS.forEach(q => {
      console.log(`  ${q.name}`);
      console.log(`    Wrong: ${q.wrongAnswer} → Correct: ${q.correctAnswer}`);
    });
    console.log('');
    console.log('='.repeat(70));
    console.log('');

    const results = [];

    for (const testCase of TEST_QUESTIONS) {
      console.log(`Testing ${testCase.name}...`);
      
      const questionData = {
        questionId: testCase.id,
        setIndex: 0,
        qIndex: 0,
        questionNumber: testCase.id,
        questionText: testCase.questionText,
        questionType: testCase.type,
        optionA: testCase.options?.A || null,
        optionB: testCase.options?.B || null,
        optionC: testCase.options?.C || null,
        optionD: testCase.options?.D || null,
        correctAnswer: testCase.wrongAnswer,  // WRONG answer
        passage: null,
        hasFigure: false,
        figureCaption: null,
        figureData: null
      };

      vi.clearAllMocks();

      await pdfService.verifyBatch(
        `e2e-integration-test-q${testCase.id}`,
        1000 + testCase.id,
        'E2E Integration Test',
        'Math',
        1,
        [questionData]
      );

      // Check if verification corrected the answer
      const wasCorrected = mockPrismaUpdate.mock.calls.length > 0;
      
      if (wasCorrected) {
        const updateCall = mockPrismaUpdate.mock.calls[0][0];
        const verifiedAnswer = updateCall.data.correctAnswer;
        
        // Verify the correction matches expected
        let isCorrect = false;
        if (testCase.correctAnswer.includes(',')) {
          // Ordered pair: allow format variations
          const actualMatch = verifiedAnswer.match(/[(]?\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*[)]?/);
          const expectedMatch = testCase.correctAnswer.match(/[(]?\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*[)]?/);
          isCorrect = actualMatch && expectedMatch && 
                     actualMatch[1] === expectedMatch[1] && 
                     actualMatch[2] === expectedMatch[2];
        } else if (testCase.correctAnswer.includes('.') || verifiedAnswer.includes('.') || verifiedAnswer.includes('/')) {
          // Numeric: allow decimal or fraction
          const expectedNum = parseFloat(testCase.correctAnswer);
          const actualNum = verifiedAnswer.includes('/') ? eval(verifiedAnswer) : parseFloat(verifiedAnswer);
          isCorrect = Math.abs(expectedNum - actualNum) < 0.01;
        } else {
          // Exact match (e.g., multiple choice)
          isCorrect = verifiedAnswer === testCase.correctAnswer;
        }

        results.push({
          name: testCase.name,
          expected: testCase.correctAnswer,
          actual: verifiedAnswer,
          success: isCorrect
        });

        const status = isCorrect ? '✅ CORRECTED' : '❌ WRONG CORRECTION';
        console.log(`  ${status}: ${testCase.wrongAnswer} → ${verifiedAnswer}`);
      } else {
        results.push({
          name: testCase.name,
          expected: testCase.correctAnswer,
          actual: testCase.wrongAnswer,
          success: false
        });
        console.log(`  ❌ NOT CORRECTED: Still ${testCase.wrongAnswer}`);
      }
      console.log('');
    }

    // Summary
    console.log('='.repeat(70));
    const successCount = results.filter(r => r.success).length;
    console.log(`SUMMARY: ${successCount}/${results.length} questions verified correctly`);
    console.log('='.repeat(70));
    
    // Detailed results
    results.forEach(r => {
      const status = r.success ? '✅' : '❌';
      console.log(`${status} ${r.name}: Expected "${r.expected}", got "${r.actual}"`);
    });
    console.log('');

    // All must pass
    expect(successCount).toBe(results.length);

  }, 300000); // 5 minute timeout for all 5 questions
});
