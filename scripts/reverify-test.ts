import { createConnection } from 'mysql2/promise';
import { pdfService } from '../lib/services/pdfService';

const TEST_ID = parseInt(process.argv[2] || '34');
const SAT_ID = 4;

interface Question {
  id: number;
  questionNumber: number;
  questionText: string;
  questionType: string;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctAnswer: string;
  passage: string | null;
  hasFigure: boolean;
  figureData: string | null;
  figureCaption: string | null;
  setIndex: number;
  section: string;
  moduleNumber: number;
}

interface AnswerKeyEntry {
  section: string;
  module_number: number;
  question_number: number;
  correct_answer: string;
}

async function connectDB() {
  return createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Hao@3306',
    database: 'sat_buddy'
  });
}

async function getQuestionsToVerify(testId: number): Promise<Question[]> {
  const connection = await connectDB();

  const query = `
    SELECT 
      q.id,
      q.question_number as questionNumber,
      q.question_text as questionText,
      q.question_type as questionType,
      q.option_a as optionA,
      q.option_b as optionB,
      q.option_c as optionC,
      q.option_d as optionD,
      q.correct_answer as correctAnswer,
      qs.passage,
      qs.has_figure as hasFigure,
      qs.figure_data as figureData,
      qs.figure_caption as figureCaption,
      qs.order_index as setIndex,
      m.section,
      m.module_number as moduleNumber
    FROM modules m
    JOIN question_sets qs ON qs.module_id = m.id
    JOIN questions q ON q.question_set_id = qs.id
    WHERE m.test_id = ?
    ORDER BY m.section, m.module_number, qs.order_index, q.order_in_set
  `;

  const [rows] = await connection.execute(query, [testId]);
  await connection.end();

  return rows as Question[];
}

async function getAnswerKey(): Promise<Map<string, string>> {
  const connection = await connectDB();

  const query = `
    SELECT 
      section,
      module_number,
      question_number,
      correct_answer
    FROM tmp_answer_key
    WHERE sat_id = ?
    ORDER BY section, module_number, question_number
  `;

  const [rows] = await connection.execute(query, [SAT_ID]);
  await connection.end();

  const answerMap = new Map<string, string>();
  (rows as AnswerKeyEntry[]).forEach(row => {
    const key = `${row.section}|${row.module_number}|${row.question_number}`;
    answerMap.set(key, row.correct_answer.trim());
  });

  return answerMap;
}

async function reverifyQuestions() {
  try {
    console.log(`\n🔍 Re-verifying Test ID ${TEST_ID}...\n`);

    const questions = await getQuestionsToVerify(TEST_ID);
    console.log(`Found ${questions.length} questions to verify\n`);

    if (questions.length === 0) {
      console.log('❌ No questions found for this test');
      process.exit(1);
    }

    const answerKey = await getAnswerKey();
    console.log(`Loaded answer key with ${answerKey.size} entries\n`);

    // Group questions by module for verification
    const questionsByModule = new Map<string, Question[]>();
    questions.forEach(q => {
      const key = `${q.section}|${q.moduleNumber}`;
      if (!questionsByModule.has(key)) {
        questionsByModule.set(key, []);
      }
      questionsByModule.get(key)!.push(q);
    });

    console.log('Running verification with improved prompt...\n');

    let totalCorrect = 0;
    let totalWrong = 0;
    const results: Array<{
      questionNumber: number;
      section: string;
      moduleNumber: number;
      originalAnswer: string;
      answerKeyAnswer: string;
      matchesKey: boolean;
    }> = [];

    for (const [moduleKey, moduleQuestions] of questionsByModule.entries()) {
      const [section, moduleNumber] = moduleKey.split('|');
      const moduleNum = parseInt(moduleNumber);

      const questionsForVerification = moduleQuestions.map(q => ({
        questionId: q.id,
        setIndex: q.setIndex,
        qIndex: 0,
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        questionType: q.questionType,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctAnswer: q.correctAnswer,
        passage: q.passage,
        hasFigure: q.hasFigure,
        figureData: q.figureData,
        figureCaption: q.figureCaption
      }));

      const testName = `Test ${TEST_ID}`;
      const fileId = `reverify-${TEST_ID}`;

      await pdfService.verifyBatch(
        fileId,
        TEST_ID,
        testName,
        section,
        moduleNum,
        questionsForVerification
      );

      for (const q of moduleQuestions) {
        const keyKey = `${section}|${moduleNum}|${q.questionNumber}`;
        const answerKeyValue = answerKey.get(keyKey);

        if (answerKeyValue) {
          const matches = q.correctAnswer.trim() === answerKeyValue;
          results.push({
            questionNumber: q.questionNumber,
            section,
            moduleNumber: moduleNum,
            originalAnswer: q.correctAnswer,
            answerKeyAnswer: answerKeyValue,
            matchesKey: matches
          });

          if (matches) {
            totalCorrect++;
          } else {
            totalWrong++;
          }
        }
      }
    }

    console.log('\n✅ Verification complete!\n');
    console.log('='.repeat(80));
    console.log('📊 RESULTS:\n');
    console.log(`Total questions verified: ${questions.length}`);
    console.log(`Marked correct: ${totalCorrect} (${((totalCorrect / questions.length) * 100).toFixed(1)}%)`);
    console.log(`Marked wrong: ${totalWrong} (${((totalWrong / questions.length) * 100).toFixed(1)}%)`);
    console.log(`Accuracy: ${totalCorrect}/${questions.length} (${((totalCorrect / questions.length) * 100).toFixed(1)}%)\n`);

    const mismatches = results.filter(r => !r.matchesKey);
    if (mismatches.length > 0) {
      console.log('='.repeat(80));
      console.log(`⚠️  MISMATCHES WITH ANSWER KEY (${mismatches.length}):\n`);
      mismatches.forEach(m => {
        console.log(`${m.section} M${m.moduleNumber} Q${m.questionNumber}:`);
        console.log(`  Parsed:    "${m.originalAnswer}"`);
        console.log(`  Answer Key: "${m.answerKeyAnswer}"`);
        console.log('');
      });
    }

    console.log('='.repeat(80));
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

reverifyQuestions();
