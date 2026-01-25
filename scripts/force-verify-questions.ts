/**
 * Force re-verification of specific questions
 * Usage: npx tsx scripts/force-verify-questions.ts <testId> <questionNumbers...>
 * Example: npx tsx scripts/force-verify-questions.ts 1 21 27
 */

import prisma from '../lib/prisma';
import { pdfService } from '../lib/services/pdfService';

async function main() {
  const testId = parseInt(process.argv[2]);
  const questionNumbers = process.argv.slice(3).map(n => parseInt(n));

  if (!testId || questionNumbers.length === 0) {
    console.error('Usage: npx tsx scripts/force-verify-questions.ts <testId> <questionNumbers...>');
    console.error('Example: npx tsx scripts/force-verify-questions.ts 1 21 27');
    process.exit(1);
  }

  console.log(`Fetching test ${testId}...`);
  
  const test = await prisma.sATTest.findUnique({
    where: { id: testId },
    include: {
      modules: {
        include: {
          questionSets: {
            include: {
              questions: {
                where: {
                  questionNumber: { in: questionNumbers }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!test) {
    console.error(`Test ${testId} not found`);
    process.exit(1);
  }

  console.log(`Found test: ${test.name}`);
  console.log('');

  for (const module of test.modules) {
    for (const questionSet of module.questionSets) {
      for (const question of questionSet.questions) {
        console.log(`Q${question.questionNumber}: ${question.correctAnswer}`);
        console.log(`  Type: ${question.questionType}`);
        console.log(`  Text: ${question.questionText.substring(0, 100)}...`);
        console.log('');

        const batch = [{
          questionId: question.id,
          setIndex: 0,
          qIndex: 0,
          questionNumber: question.questionNumber,
          questionText: question.questionText,
          questionType: question.questionType,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correctAnswer: question.correctAnswer,
          passage: questionSet.passage,
          hasFigure: questionSet.hasFigure || false,
          figureCaption: questionSet.figureCaption,
          figureData: null
        }];

        console.log(`Verifying Q${question.questionNumber}...`);
        await pdfService['verifyBatch'](
          'manual-verify',
          test.id,
          test.name,
          module.section,
          module.moduleNumber,
          batch
        );
        console.log('');
      }
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(console.error);
