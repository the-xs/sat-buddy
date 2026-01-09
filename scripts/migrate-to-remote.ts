// Script to migrate local DB data to remote DB
// Updated for QuestionSet schema
import prisma from '../lib/prisma';
import { PrismaClient } from '@prisma/client';

// Set REMOTE_DATABASE_URL environment variable before running
const REMOTE_URL = process.env.REMOTE_DATABASE_URL;

async function migrateData() {
    console.log('🔄 Starting data migration...');

    if (!REMOTE_URL) {
        console.error('❌ REMOTE_DATABASE_URL environment variable is not set');
        process.exit(1);
    }

    // Create remote prisma client
    const remoteDb = new PrismaClient({
        datasources: {
            db: { url: REMOTE_URL }
        }
    });

    try {
        // Get local SAT tests with all related data
        const localTests = await prisma.sATTest.findMany({
            include: {
                modules: {
                    include: {
                        questionSets: {
                            include: {
                                questions: true
                            }
                        }
                    }
                }
            }
        });

        // Cleanup remote test data first
        console.log('🧹 Cleaning up remote test data (preserving users)...');
        await remoteDb.practiceQuestion.deleteMany({});
        await remoteDb.sATTest.deleteMany({});

        console.log('✅ Remote test data cleaned.');

        console.log(`📊 Found ${localTests.length} tests to migrate`);

        for (const test of localTests) {
            console.log(`\n📄 Migrating test: ${test.name}`);

            // Create test on remote with nested structure
            const remoteTest = await remoteDb.sATTest.create({
                data: {
                    name: test.name,
                    description: test.description,
                    pdfFilename: test.pdfFilename,
                    originalName: test.originalName,
                    uploadedAt: test.uploadedAt,
                    modules: {
                        create: test.modules.map(module => ({
                            section: module.section,
                            moduleNumber: module.moduleNumber,
                            timeLimit: module.timeLimit,
                            questionSets: {
                                create: module.questionSets.map(qs => ({
                                    orderIndex: qs.orderIndex,
                                    passage: qs.passage,
                                    passageIntro: qs.passageIntro,
                                    hasFigure: qs.hasFigure,
                                    figureData: qs.figureData,
                                    figureCaption: qs.figureCaption,
                                    figureBoundingBox: qs.figureBoundingBox,
                                    figurePageNumber: qs.figurePageNumber,
                                    questions: {
                                        create: qs.questions.map(q => ({
                                            questionNumber: q.questionNumber,
                                            orderInSet: q.orderInSet,
                                            questionType: q.questionType,
                                            questionText: q.questionText,
                                            optionA: q.optionA,
                                            optionB: q.optionB,
                                            optionC: q.optionC,
                                            optionD: q.optionD,
                                            correctAnswer: q.correctAnswer,
                                            explanation: q.explanation,
                                            difficulty: q.difficulty,
                                            topic: q.topic,
                                        }))
                                    }
                                }))
                            }
                        }))
                    }
                }
            });

            console.log(`   ✅ Created remote test ID: ${remoteTest.id}`);

            // Count questions
            let totalQuestions = 0;
            let questionsWithFigures = 0;
            for (const module of test.modules) {
                for (const qs of module.questionSets) {
                    totalQuestions += qs.questions.length;
                    if (qs.hasFigure && qs.figureData) {
                        questionsWithFigures += qs.questions.length;
                    }
                }
            }
            console.log(`   📊 ${totalQuestions} questions, ${questionsWithFigures} in sets with figure data`);
        }

        console.log('\n✅ Migration complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await remoteDb.$disconnect();
        await prisma.$disconnect();
    }
}

migrateData();
