import { satTestService } from '../services/satTestService.js';
import { pdfService } from '../services/pdfService.js';

export const satTestController = {
    // GET /api/tests/figure/:questionId - Get cropped figure for a question
    async getFigure(req, res, next) {
        try {
            const { questionId } = req.params;
            const result = await pdfService.getFigureImage(questionId);
            res.sendFile(result.path);
        } catch (error) {
            if (error.message === 'Question not found' || error.message === 'Question does not have figure data') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    },

    // GET /api/tests - Get all SAT tests
    async getAllTests(req, res, next) {
        try {
            const tests = await satTestService.getAllTests();
            res.json({
                success: true,
                data: tests,
                count: tests.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/tests/:id - Get single test with all data
    async getTestById(req, res, next) {
        try {
            const test = await satTestService.getTestById(req.params.id);
            if (!test) {
                return res.status(404).json({
                    success: false,
                    message: 'Test not found'
                });
            }
            res.json({
                success: true,
                data: test
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/tests/:id/stats - Get test statistics
    async getTestStats(req, res, next) {
        try {
            const stats = await satTestService.getTestStats(req.params.id);
            if (!stats) {
                return res.status(404).json({
                    success: false,
                    message: 'Test not found'
                });
            }
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/tests/:id/module/:section/:moduleNumber - Get questions by module
    async getModuleQuestions(req, res, next) {
        try {
            const { id, section, moduleNumber } = req.params;
            const questions = await satTestService.getQuestionsByModule(id, section, moduleNumber);
            res.json({
                success: true,
                data: questions,
                count: questions.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/tests/random - Get random questions for practice
    async getRandomQuestions(req, res, next) {
        try {
            const { testId, section, count } = req.query;
            const questions = await satTestService.getRandomQuestions({
                testId,
                section,
                count: parseInt(count) || 10
            });
            res.json({
                success: true,
                data: questions,
                count: questions.length
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/stats - Get overall statistics
    async getOverallStats(req, res, next) {
        try {
            const stats = await satTestService.getOverallStats();
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            next(error);
        }
    },

    // DELETE /api/tests/:id - Delete a test
    async deleteTest(req, res, next) {
        try {
            await satTestService.deleteTest(req.params.id);
            res.json({
                success: true,
                message: 'Test deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    },

    // ============================================
    // TEST SESSION ENDPOINTS
    // ============================================

    // POST /api/tests/session - Create a new test session
    async createSession(req, res, next) {
        try {
            const { testId } = req.body;
            if (!testId) {
                return res.status(400).json({
                    success: false,
                    message: 'testId is required'
                });
            }
            const session = await satTestService.createSession(testId);
            res.status(201).json({
                success: true,
                data: session
            });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/tests/session/:sessionId - Get a session
    async getSession(req, res, next) {
        try {
            const session = await satTestService.getSession(req.params.sessionId);
            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: 'Session not found'
                });
            }
            res.json({
                success: true,
                data: session
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/tests/session/:sessionId/answer - Record an answer
    async recordAnswer(req, res, next) {
        try {
            const { sessionId } = req.params;
            const { questionId, answer } = req.body;

            if (!questionId) {
                return res.status(400).json({
                    success: false,
                    message: 'questionId is required'
                });
            }

            const result = await satTestService.recordAnswer(sessionId, questionId, answer);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            if (error.message === 'Question not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    },

    // POST /api/tests/session/:sessionId/submit - Submit a session
    async submitSession(req, res, next) {
        try {
            const session = await satTestService.submitSession(req.params.sessionId);
            res.json({
                success: true,
                data: session
            });
        } catch (error) {
            if (error.message === 'Session not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    },

    // GET /api/tests/session/:sessionId/results - Get detailed results
    async getSessionResults(req, res, next) {
        try {
            const results = await satTestService.getSessionResults(req.params.sessionId);
            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            if (error.message === 'Session not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    },

    // GET /api/tests/sessions - Get all completed sessions for review
    async getCompletedSessions(req, res, next) {
        try {
            const sessions = await satTestService.getCompletedSessions();
            res.json({
                success: true,
                data: sessions,
                count: sessions.length
            });
        } catch (error) {
            next(error);
        }
    }
};
