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
        const { question, userAnswer } = req.body;
        const result = await practiceService.checkAnswer(question, userAnswer);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

// Get detailed explanation
router.post('/explain', async (req, res, next) => {
    try {
        const { question, userAnswer } = req.body;
        const result = await practiceService.explainAnswer(question, userAnswer);
        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
});

export default router;
