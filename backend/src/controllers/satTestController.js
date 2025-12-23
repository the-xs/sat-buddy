import { satTestService } from '../services/satTestService.js';

export const satTestController = {
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
    }
};
