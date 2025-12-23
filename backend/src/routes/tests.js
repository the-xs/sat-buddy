import express from 'express';
import { satTestController } from '../controllers/satTestController.js';

const router = express.Router();

// GET /api/tests - List all SAT tests
router.get('/', satTestController.getAllTests);

// GET /api/tests/random - Get random questions for practice
router.get('/random', satTestController.getRandomQuestions);

// GET /api/stats - Get overall statistics
router.get('/stats', satTestController.getOverallStats);

// GET /api/tests/figure/:questionId - Get cropped figure image for a question
router.get('/figure/:questionId', satTestController.getFigure);

// GET /api/tests/:id - Get single test
router.get('/:id', satTestController.getTestById);

// GET /api/tests/:id/stats - Get test statistics
router.get('/:id/stats', satTestController.getTestStats);

// GET /api/tests/:id/module/:section/:moduleNumber - Get module questions
router.get('/:id/module/:section/:moduleNumber', satTestController.getModuleQuestions);

// DELETE /api/tests/:id - Delete a test
router.delete('/:id', satTestController.deleteTest);

export default router;
