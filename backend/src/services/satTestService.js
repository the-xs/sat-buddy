import prisma from '../config/database.js';

export const satTestService = {
    // Get all SAT tests
    async getAllTests() {
        return await prisma.sATTest.findMany({
            include: {
                modules: {
                    include: {
                        _count: {
                            select: { questions: true }
                        }
                    }
                }
            },
            orderBy: { uploadedAt: 'desc' }
        });
    },

    // Get single SAT test with all data
    async getTestById(id) {
        return await prisma.sATTest.findUnique({
            where: { id: parseInt(id) },
            include: {
                modules: {
                    include: {
                        questions: {
                            orderBy: { questionNumber: 'asc' }
                        }
                    },
                    orderBy: [
                        { section: 'asc' },
                        { moduleNumber: 'asc' }
                    ]
                }
            }
        });
    },

    // Get questions by module
    async getQuestionsByModule(testId, section, moduleNumber) {
        const module = await prisma.module.findFirst({
            where: {
                testId: parseInt(testId),
                section,
                moduleNumber: parseInt(moduleNumber)
            },
            include: {
                questions: {
                    orderBy: { questionNumber: 'asc' }
                }
            }
        });
        return module?.questions || [];
    },

    // Get random questions for practice
    async getRandomQuestions(options = {}) {
        const { testId, section, count = 10 } = options;

        const where = {};
        if (testId) {
            where.module = { testId: parseInt(testId) };
        }
        if (section) {
            where.module = { ...where.module, section };
        }

        const questions = await prisma.question.findMany({
            where,
            include: {
                module: {
                    select: { section: true, moduleNumber: true }
                }
            }
        });

        // Shuffle and return requested count
        const shuffled = questions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    },

    // Get test statistics
    async getTestStats(testId) {
        const test = await prisma.sATTest.findUnique({
            where: { id: parseInt(testId) },
            include: {
                modules: {
                    include: {
                        _count: {
                            select: { questions: true }
                        }
                    }
                }
            }
        });

        if (!test) return null;

        const stats = {
            testId: test.id,
            testName: test.name,
            totalQuestions: 0,
            readingWritingModule1: 0,
            readingWritingModule2: 0,
            mathModule1: 0,
            mathModule2: 0
        };

        test.modules.forEach(m => {
            const count = m._count.questions;
            stats.totalQuestions += count;

            if (m.section === 'ReadingWriting' && m.moduleNumber === 1) {
                stats.readingWritingModule1 = count;
            } else if (m.section === 'ReadingWriting' && m.moduleNumber === 2) {
                stats.readingWritingModule2 = count;
            } else if (m.section === 'Math' && m.moduleNumber === 1) {
                stats.mathModule1 = count;
            } else if (m.section === 'Math' && m.moduleNumber === 2) {
                stats.mathModule2 = count;
            }
        });

        return stats;
    },

    // Delete a SAT test
    async deleteTest(id) {
        return await prisma.sATTest.delete({
            where: { id: parseInt(id) }
        });
    },

    // Get all questions count
    async getOverallStats() {
        const [totalTests, totalQuestions, rwQuestions, mathQuestions] = await Promise.all([
            prisma.sATTest.count(),
            prisma.question.count(),
            prisma.question.count({
                where: { module: { section: 'ReadingWriting' } }
            }),
            prisma.question.count({
                where: { module: { section: 'Math' } }
            })
        ]);

        return {
            totalTests,
            totalQuestions,
            readingWritingQuestions: rwQuestions,
            mathQuestions
        };
    }
};
