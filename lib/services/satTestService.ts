import prisma from '@/lib/prisma';

export const satTestService = {
    // Get all SAT tests
    async getAllTests() {
        const tests = await prisma.sATTest.findMany({
            include: {
                modules: {
                    include: {
                        questionSets: {
                            include: {
                                _count: {
                                    select: { questions: true }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { uploadedAt: 'desc' }
        });

        // Transform to include question counts per module
        return tests.map(test => ({
            ...test,
            modules: test.modules.map(module => ({
                ...module,
                _count: {
                    questions: module.questionSets.reduce((sum, qs) => sum + qs._count.questions, 0)
                }
            }))
        }));
    },

    // Get single SAT test with all data
    async getTestById(id: number) {
        return await prisma.sATTest.findUnique({
            where: { id },
            include: {
                modules: {
                    include: {
                        questionSets: {
                            include: {
                                questions: {
                                    orderBy: { questionNumber: 'asc' }
                                }
                            },
                            orderBy: { orderIndex: 'asc' }
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

    // Get questions by module (returns flat list of questions with their questionSet info)
    async getQuestionsByModule(testId: number, section: string, moduleNumber: number) {
        const module = await prisma.module.findFirst({
            where: {
                testId,
                section,
                moduleNumber
            },
            include: {
                questionSets: {
                    include: {
                        questions: {
                            orderBy: { questionNumber: 'asc' }
                        }
                    },
                    orderBy: { orderIndex: 'asc' }
                }
            }
        });

        if (!module) return [];

        // Flatten questions with their questionSet reference
        return module.questionSets.flatMap(qs =>
            qs.questions.map(q => ({
                ...q,
                questionSet: {
                    id: qs.id,
                    passage: qs.passage,
                    passageIntro: qs.passageIntro,
                    hasFigure: qs.hasFigure,
                    figureData: qs.figureData,
                    figureCaption: qs.figureCaption
                }
            }))
        );
    },

    // Get random questions for practice
    async getRandomQuestions(options: { testId?: number; section?: string; count?: number } = {}) {
        const { testId, section, count = 10 } = options;

        const where: {
            questionSet?: { module?: { testId?: number; section?: string } };
        } = {};

        if (testId) {
            where.questionSet = { module: { testId } };
        }
        if (section) {
            where.questionSet = { module: { ...where.questionSet?.module, section } };
        }

        const questions = await prisma.question.findMany({
            where,
            include: {
                questionSet: {
                    select: {
                        id: true,
                        passage: true,
                        passageIntro: true,
                        hasFigure: true,
                        figureData: true,
                        figureCaption: true,
                        module: {
                            select: { section: true, moduleNumber: true }
                        }
                    }
                }
            }
        });

        // Shuffle and return requested count
        const shuffled = questions.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, shuffled.length));
    },

    // Get test statistics
    async getTestStats(testId: number) {
        const test = await prisma.sATTest.findUnique({
            where: { id: testId },
            include: {
                modules: {
                    include: {
                        questionSets: {
                            include: {
                                _count: {
                                    select: { questions: true }
                                }
                            }
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
            const count = m.questionSets.reduce((sum, qs) => sum + qs._count.questions, 0);
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
    async deleteTest(id: number) {
        return await prisma.sATTest.delete({
            where: { id }
        });
    },

    // Get all questions count
    async getOverallStats() {
        const [totalTests, totalQuestions, rwQuestions, mathQuestions] = await Promise.all([
            prisma.sATTest.count(),
            prisma.question.count(),
            prisma.question.count({
                where: { questionSet: { module: { section: 'ReadingWriting' } } }
            }),
            prisma.question.count({
                where: { questionSet: { module: { section: 'Math' } } }
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
    async createSession(testId: number, userId?: string) {
        const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const session = await prisma.testSession.create({
            data: {
                sessionId,
                testId,
                userId,
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
                                questionSets: {
                                    include: {
                                        questions: {
                                            orderBy: { questionNumber: 'asc' }
                                        }
                                    },
                                    orderBy: { orderIndex: 'asc' }
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
    async getSession(sessionId: string) {
        return await prisma.testSession.findUnique({
            where: { sessionId },
            include: {
                test: true,
                results: {
                    include: {
                        question: {
                            include: {
                                questionSet: true
                            }
                        }
                    }
                }
            }
        });
    },

    // Record an answer for a question in a session
    async recordAnswer(sessionId: string, questionId: number, answer: string) {
        // Get the question to check correct answer
        const question = await prisma.question.findUnique({
            where: { id: questionId }
        });

        if (!question) {
            throw new Error('Question not found');
        }

        const isCorrect = Boolean(answer && answer.toUpperCase() === question.correctAnswer?.toUpperCase());

        // Upsert the result (update if exists, create if not)
        const result = await prisma.testResult.upsert({
            where: {
                sessionId_questionId: {
                    sessionId,
                    questionId
                }
            },
            update: {
                userAnswer: answer,
                isCorrect,
                answeredAt: new Date()
            },
            create: {
                sessionId,
                questionId,
                userAnswer: answer,
                isCorrect
            }
        });

        return result;
    },

    // Submit a session and calculate scores
    async submitSession(sessionId: string) {
        const session = await prisma.testSession.findUnique({
            where: { sessionId },
            include: {
                test: {
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
                },
                results: {
                    include: {
                        question: {
                            include: {
                                questionSet: {
                                    include: {
                                        module: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // Get all questions in the test
        const allQuestions = session.test.modules.flatMap(m =>
            m.questionSets.flatMap(qs => qs.questions)
        );

        // Find questions that weren't answered and create results for them
        const answeredQuestionIds = new Set(session.results.map(r => r.questionId));
        const unansweredQuestions = allQuestions.filter(q => !answeredQuestionIds.has(q.id));

        // Create TestResult records for unanswered questions (marked as incorrect)
        if (unansweredQuestions.length > 0) {
            await prisma.testResult.createMany({
                data: unansweredQuestions.map(q => ({
                    sessionId,
                    questionId: q.id,
                    userAnswer: null,
                    isCorrect: false
                }))
            });
        }

        // Re-fetch results to include the newly created unanswered records
        const updatedSession = await prisma.testSession.findUnique({
            where: { sessionId },
            include: {
                results: {
                    include: {
                        question: {
                            include: {
                                questionSet: {
                                    include: {
                                        module: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Calculate scores
        let rwCorrect = 0;
        let mathCorrect = 0;

        updatedSession!.results.forEach(result => {
            if (result.isCorrect) {
                const section = result.question.questionSet.module.section;
                if (section === 'ReadingWriting') {
                    rwCorrect++;
                } else if (section === 'Math') {
                    mathCorrect++;
                }
            }
        });

        // Update session with scores and completion time
        const finalSession = await prisma.testSession.update({
            where: { sessionId },
            data: {
                rwScore: rwCorrect,
                mathScore: mathCorrect,
                totalScore: rwCorrect + mathCorrect,
                completedAt: new Date()
            }
        });

        return finalSession;
    },

    // Get detailed results for review
    async getSessionResults(sessionId: string) {
        const session = await prisma.testSession.findUnique({
            where: { sessionId },
            include: {
                test: true,
                results: {
                    include: {
                        question: {
                            include: {
                                questionSet: {
                                    include: {
                                        module: true
                                    }
                                }
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
            moduleSection: r.question.questionSet.module.section,
            moduleNumber: r.question.questionSet.module.moduleNumber,
            // Include questionSet data for passage/figure display
            questionSet: {
                id: r.question.questionSet.id,
                passage: r.question.questionSet.passage,
                passageIntro: r.question.questionSet.passageIntro,
                hasFigure: r.question.questionSet.hasFigure,
                figureData: r.question.questionSet.figureData,
                figureCaption: r.question.questionSet.figureCaption
            },
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

        // Sort results: Reading first, then Math; within each section by module number, then question number
        results.sort((a, b) => {
            // Section order: ReadingWriting before Math
            if (a.moduleSection !== b.moduleSection) {
                return a.moduleSection === 'ReadingWriting' ? -1 : 1;
            }
            // Module number order
            if (a.moduleNumber !== b.moduleNumber) {
                return a.moduleNumber - b.moduleNumber;
            }
            // Question number order
            return a.questionNumber - b.questionNumber;
        });

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
    async getCompletedSessions(userId?: string) {
        const sessions = await prisma.testSession.findMany({
            where: {
                completedAt: { not: null },
                ...(userId && { userId })
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
