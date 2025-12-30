import express from 'express';
import { practiceService } from '../services/practiceService.js';

const router = express.Router();

// Generate a random SAT question
router.post('/generate', async (req, res, next) => {
    try {
        const { category = 'random' } = req.body;
        const question = await practiceService.generateQuestion(category);
        res.json({ success: true, data: question });
    } catch (error) {
        next(error);
    }
});

// Check user's answer
router.post('/check', async (req, res, next) => {
    try {
        const { questionId, question, userAnswer } = req.body;
        const result = await practiceService.checkAnswer(questionId, question, userAnswer);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get detailed explanation
router.post('/explain', async (req, res, next) => {
    try {
        const { questionId, question, userAnswer } = req.body;
        const result = await practiceService.explainAnswer(questionId, question, userAnswer);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get practice history
router.get('/history', async (req, res, next) => {
    try {
        const { limit = 50 } = req.query;
        const history = await practiceService.getPracticeHistory(parseInt(limit));
        res.json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
});

// Get practice stats
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await practiceService.getPracticeStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
});

export default router;
