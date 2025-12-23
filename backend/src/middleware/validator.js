import { z } from 'zod';

export const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync(req.body);
            next();
        } catch (error) {
            next(error);
        }
    };
};

// Validation schemas
export const questionSchema = z.object({
    category: z.enum(['Math', 'English']),
    questionText: z.string().min(1),
    optionA: z.string().min(1),
    optionB: z.string().min(1),
    optionC: z.string().min(1),
    optionD: z.string().min(1),
    correctAnswer: z.enum(['A', 'B', 'C', 'D']),
    explanation: z.string().optional()
});

export const testSubmissionSchema = z.object({
    sessionId: z.string(),
    results: z.array(z.object({
        questionId: z.number(),
        userAnswer: z.enum(['A', 'B', 'C', 'D']).nullable(),
        isCorrect: z.boolean()
    }))
});
