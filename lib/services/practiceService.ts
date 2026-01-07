import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/lib/prisma';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface QuestionData {
    category: string;
    topic: string;
    difficulty: string;
    passage: string | null;
    question: string;
    options: string[];
    correctAnswer: string;
    correctLetter: string;
    explanation: string;
}

export const practiceService = {
    // Generate a random SAT question using Gemini and save to database
    async generateQuestion(category = 'random', userId?: string) {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const categoryPrompt = category === 'random'
            ? 'Choose randomly from Math, Reading Comprehension, or Writing & Language'
            : category;

        const prompt = `You are an expert SAT test creator. Generate ONE realistic SAT-style practice question.

**Category**: ${categoryPrompt}

**Requirements**:
1. Create a challenging but fair question matching real SAT difficulty
2. For Reading/Writing, include a short passage (2-3 sentences) if relevant
3. Provide exactly 4 answer choices (A, B, C, D)
4. Include the correct answer and a brief explanation
5. Assign a standard SAT topic (e.g., "Heart of Algebra", "Problem Solving and Data Analysis", "Passport to Advanced Math", "Information and Ideas", "Rhetoric", "Standard English Conventions")
6. Assign a difficulty level ("Easy", "Medium", "Hard")

**MATH FORMATTING - Use LaTeX for ALL math expressions:**
- Wrap math expressions in $ delimiters: $x^2 + 5$
- Fractions: $\\frac{numerator}{denominator}$
- Exponents: $x^{2}$ or $x^{n}$
- Square roots: $\\sqrt{x}$
- Greek letters: $\\pi$, $\\theta$
- Inequalities: $\\leq$, $\\geq$, $\\neq$

**OUTPUT FORMAT - Return valid JSON only:**
{
    "category": "Math" or "Reading" or "Writing",
    "topic": "Standard SAT Topic",
    "difficulty": "Easy" or "Medium" or "Hard",
    "passage": "optional passage text" or null,
    "question": "the question text (use $LaTeX$ for math)",
    "options": ["option A", "option B", "option C", "option D"],
    "correctAnswer": "the exact text of the correct option",
    "correctLetter": "A" or "B" or "C" or "D",
    "explanation": "brief explanation (use $LaTeX$ for any math)"
}

Return ONLY valid JSON. No markdown code fences, no conversation.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        let jsonText = responseText;
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
        }

        const questionData: QuestionData = JSON.parse(jsonText);

        // Save to database
        const savedQuestion = await prisma.practiceQuestion.create({
            data: {
                userId,
                category: questionData.category,
                topic: questionData.topic || 'General',
                difficulty: questionData.difficulty || 'Medium',
                passage: questionData.passage || null,
                questionText: questionData.question,
                options: JSON.stringify(questionData.options),
                correctAnswer: questionData.correctAnswer,
                correctLetter: questionData.correctLetter,
            }
        });

        // Return with database ID
        return {
            id: savedQuestion.id,
            ...questionData
        };
    },

    // Check user's answer and update database
    async checkAnswer(questionId: number | null, questionData: QuestionData, userAnswer: string) {
        const isCorrect = userAnswer === questionData.correctAnswer ||
            userAnswer === questionData.correctLetter;

        // Update the database with user's answer
        if (questionId) {
            await prisma.practiceQuestion.update({
                where: { id: questionId },
                data: {
                    userAnswer: userAnswer,
                    isCorrect: isCorrect,
                    answeredAt: new Date()
                }
            });
        }

        return {
            isCorrect,
            correctAnswer: questionData.correctAnswer,
            correctLetter: questionData.correctLetter,
            explanation: questionData.explanation
        };
    },

    // Get detailed explanation from Gemini and save to database
    async explainAnswer(questionId: number | null, questionData: QuestionData, userAnswer: string) {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const prompt = `You are an expert SAT tutor. Explain why the correct answer is correct and why the other options are wrong.

**Question**: ${questionData.question}

**Options**:
A. ${questionData.options[0]}
B. ${questionData.options[1]}
C. ${questionData.options[2]}
D. ${questionData.options[3]}

**Correct Answer**: ${questionData.correctLetter}. ${questionData.correctAnswer}

**Student's Answer**: ${userAnswer}

Provide a clear, educational explanation:
1. Why the correct answer is right
2. Why each wrong answer is incorrect
3. Any tips or strategies for similar questions

**IMPORTANT**: Use LaTeX syntax for ALL math expressions by wrapping them in $ delimiters.
Example: $\\frac{x+1}{2}$, $x^2$, $\\sqrt{x}$

Be concise but thorough. Write in a friendly, encouraging tone.`;

        const result = await model.generateContent(prompt);
        const explanation = result.response.text().trim();

        // Save explanation to database
        if (questionId) {
            await prisma.practiceQuestion.update({
                where: { id: questionId },
                data: { explanation }
            });
        }

        return { explanation };
    },

    // Get practice history
    async getPracticeHistory(userId?: string, limit = 50) {
        const questions = await prisma.practiceQuestion.findMany({
            where: {
                answeredAt: { not: null },
                ...(userId && { userId })
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        return questions.map(q => ({
            ...q,
            options: JSON.parse(q.options)
        }));
    },

    // Get practice stats
    async getPracticeStats(userId?: string) {
        const whereClause = {
            answeredAt: { not: null },
            ...(userId && { userId })
        };

        const total = await prisma.practiceQuestion.count({
            where: whereClause
        });

        const correct = await prisma.practiceQuestion.count({
            where: { ...whereClause, isCorrect: true }
        });

        const byCategory = await prisma.practiceQuestion.groupBy({
            by: ['category'],
            where: whereClause,
            _count: { id: true }
        });

        // Get correct counts by category separately
        const correctByCategory = await prisma.practiceQuestion.groupBy({
            by: ['category'],
            where: { ...whereClause, isCorrect: true },
            _count: { id: true }
        });

        const correctMap = new Map(correctByCategory.map(c => [c.category, c._count.id]));

        return {
            total,
            correct,
            wrong: total - correct,
            accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
            byCategory: byCategory.map(c => ({
                category: c.category,
                total: c._count.id,
                correct: correctMap.get(c.category) || 0
            }))
        };
    }
};
