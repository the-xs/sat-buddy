import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../config/database.js';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const practiceService = {
    // Generate a random SAT question using Gemini and save to database
    async generateQuestion(category = 'random') {
        try {
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

**OUTPUT FORMAT - Return valid JSON only:**
{
    "category": "Math" or "Reading" or "Writing",
    "topic": "Standard SAT Topic",
    "difficulty": "Easy" or "Medium" or "Hard",
    "passage": "optional passage text" or null,
    "question": "the question text",
    "options": ["option A", "option B", "option C", "option D"],
    "correctAnswer": "the exact text of the correct option",
    "correctLetter": "A" or "B" or "C" or "D",
    "explanation": "brief explanation of why this is correct"
}

Return ONLY valid JSON. No markdown, no conversation.`;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();

            let jsonText = responseText;
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
            }

            const questionData = JSON.parse(jsonText);

            // Save to database
            const savedQuestion = await prisma.practiceQuestion.create({
                data: {
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
        } catch (error) {
            console.error('Error generating question:', error);
            throw error;
        }
    },

    // Check user's answer and update database
    async checkAnswer(questionId, questionData, userAnswer) {
        try {
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
        } catch (error) {
            console.error('Error checking answer:', error);
            throw error;
        }
    },

    // Get detailed explanation from Gemini and save to database
    async explainAnswer(questionId, questionData, userAnswer) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
        } catch (error) {
            console.error('Error generating explanation:', error);
            throw error;
        }
    },

    // Get practice history
    async getPracticeHistory(limit = 50) {
        try {
            const questions = await prisma.practiceQuestion.findMany({
                where: { answeredAt: { not: null } },
                orderBy: { createdAt: 'desc' },
                take: limit
            });

            return questions.map(q => ({
                ...q,
                options: JSON.parse(q.options)
            }));
        } catch (error) {
            console.error('Error getting practice history:', error);
            throw error;
        }
    },

    // Get practice stats
    async getPracticeStats() {
        try {
            const total = await prisma.practiceQuestion.count({
                where: { answeredAt: { not: null } }
            });

            const correct = await prisma.practiceQuestion.count({
                where: { isCorrect: true }
            });

            const byCategory = await prisma.practiceQuestion.groupBy({
                by: ['category'],
                where: { answeredAt: { not: null } },
                _count: { id: true },
                _sum: { isCorrect: true }
            });

            return {
                total,
                correct,
                wrong: total - correct,
                accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
                byCategory: byCategory.map(c => ({
                    category: c.category,
                    total: c._count.id,
                    correct: c._sum.isCorrect || 0
                }))
            };
        } catch (error) {
            console.error('Error getting practice stats:', error);
            throw error;
        }
    }
};
