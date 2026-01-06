// Script to migrate local DB data to remote DB
import prisma from '../lib/prisma';
import { PrismaClient } from '@prisma/client';

const REMOTE_URL = "mysql://admin:MJqCT7ZyCq0TmkjDVvTM@sat-buddy-db.cwhqmaqqmuyq.us-east-1.rds.amazonaws.com:3306/sat_buddy";

async function migrateData() {
    console.log('🔄 Starting data migration...');

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
                        questions: true
                    }
                }
            }
        });

        console.log(`📊 Found ${localTests.length} tests to migrate`);

        for (const test of localTests) {
            console.log(`\n📄 Migrating test: ${test.name}`);

            // Create test on remote
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
                            questions: {
                                create: module.questions.map(q => ({
                                    questionNumber: q.questionNumber,
                                    questionType: q.questionType,
                                    questionText: q.questionText,
                                    hasFigure: q.hasFigure,
                                    figurePageNumber: q.figurePageNumber,
                                    figureBoundingBox: q.figureBoundingBox,
                                    figureCaption: q.figureCaption,
                                    figureData: q.figureData,
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
                }
            });

            console.log(`   ✅ Created remote test ID: ${remoteTest.id}`);

            // Count questions
            let totalQuestions = 0;
            let questionsWithFigures = 0;
            for (const module of test.modules) {
                totalQuestions += module.questions.length;
                questionsWithFigures += module.questions.filter(q => q.hasFigure && q.figureData).length;
            }
            console.log(`   📊 ${totalQuestions} questions, ${questionsWithFigures} with figure data`);
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
