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
    },

    // ============================================
    // TEST SESSION MANAGEMENT
    // ============================================

    // Create a new test session
    async createSession(testId) {
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const session = await prisma.testSession.create({
            data: {
                sessionId,
                testId: parseInt(testId),
                includeRWModule1: true,
                includeRWModule2: true,
                includeMathModule1: true,
                includeMathModule2: true
            },
            include: {
                test: {
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
                }
            }
        });

        return session;
    },

    // Get a session by sessionId
    async getSession(sessionId) {
        return await prisma.testSession.findUnique({
            where: { sessionId },
            include: {
                test: true,
                results: {
                    include: {
                        question: true
                    }
                }
            }
        });
    },

    // Record an answer for a question in a session
    async recordAnswer(sessionId, questionId, answer) {
        // Get the question to check correct answer
        const question = await prisma.question.findUnique({
            where: { id: parseInt(questionId) }
        });

        if (!question) {
            throw new Error('Question not found');
        }

        const isCorrect = answer && answer.toUpperCase() === question.correctAnswer?.toUpperCase();

        // Upsert the result (update if exists, create if not)
        const result = await prisma.testResult.upsert({
            where: {
                sessionId_questionId: {
                    sessionId,
                    questionId: parseInt(questionId)
                }
            },
            update: {
                userAnswer: answer,
                isCorrect,
                answeredAt: new Date()
            },
            create: {
                sessionId,
                questionId: parseInt(questionId),
                userAnswer: answer,
                isCorrect
            }
        });

        return result;
    },

    // Submit a session and calculate scores
    async submitSession(sessionId) {
        const session = await prisma.testSession.findUnique({
            where: { sessionId },
            include: {
                results: {
                    include: {
                        question: {
                            include: {
                                module: true
                            }
                        }
                    }
                }
            }
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // Calculate scores
        let rwCorrect = 0;
        let mathCorrect = 0;

        session.results.forEach(result => {
            if (result.isCorrect) {
                if (result.question.module.section === 'ReadingWriting') {
                    rwCorrect++;
                } else if (result.question.module.section === 'Math') {
                    mathCorrect++;
                }
            }
        });

        // Update session with scores and completion time
        const updatedSession = await prisma.testSession.update({
            where: { sessionId },
            data: {
                rwScore: rwCorrect,
                mathScore: mathCorrect,
                totalScore: rwCorrect + mathCorrect,
                completedAt: new Date()
            }
        });

        return updatedSession;
    },

    // Get detailed results for review
    async getSessionResults(sessionId) {
        const session = await prisma.testSession.findUnique({
            where: { sessionId },
            include: {
                test: true,
                results: {
                    include: {
                        question: {
                            include: {
                                module: true
                            }
                        }
                    },
                    orderBy: {
                        question: {
                            questionNumber: 'asc'
                        }
                    }
                }
            }
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // Transform results for frontend
        const results = session.results.map(r => ({
            questionId: r.questionId,
            questionNumber: r.question.questionNumber,
            questionText: r.question.questionText,
            questionType: r.question.questionType,
            moduleSection: r.question.module.section,
            moduleNumber: r.question.module.moduleNumber,
            hasFigure: r.question.hasFigure,
            options: {
                A: r.question.optionA,
                B: r.question.optionB,
                C: r.question.optionC,
                D: r.question.optionD
            },
            userAnswer: r.userAnswer,
            correctAnswer: r.question.correctAnswer,
            isCorrect: r.isCorrect,
            explanation: r.question.explanation
        }));

        return {
            sessionId: session.sessionId,
            testId: session.testId,
            testName: session.test.name,
            rwScore: session.rwScore,
            mathScore: session.mathScore,
            totalScore: session.totalScore,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
            totalQuestions: results.length,
            correctCount: results.filter(r => r.isCorrect).length,
            results
        };
    },

    // Get all completed sessions for review
    async getCompletedSessions() {
        const sessions = await prisma.testSession.findMany({
            where: {
                completedAt: { not: null }
            },
            include: {
                test: true,
                _count: {
                    select: { results: true }
                }
            },
            orderBy: { completedAt: 'desc' }
        });

        return sessions.map(s => ({
            sessionId: s.sessionId,
            testId: s.testId,
            testName: s.test.name,
            rwScore: s.rwScore,
            mathScore: s.mathScore,
            totalScore: s.totalScore,
            totalQuestions: s._count.results,
            startedAt: s.startedAt,
            completedAt: s.completedAt
        }));
    }
};
