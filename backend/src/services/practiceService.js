import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const practiceService = {
    // Generate a random SAT question using Gemini
    async generateQuestion(category = 'random') {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

**OUTPUT FORMAT - Return valid JSON only:**
{
    "category": "Math" or "Reading" or "Writing",
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

            return JSON.parse(jsonText);
        } catch (error) {
            console.error('Error generating question:', error);
            throw error;
        }
    },

    // Check user's answer
    async checkAnswer(questionData, userAnswer) {
        try {
            const isCorrect = userAnswer === questionData.correctAnswer ||
                userAnswer === questionData.correctLetter;

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

    // Get detailed explanation from Gemini
    async explainAnswer(questionData, userAnswer) {
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
            return {
                explanation: result.response.text().trim()
            };
        } catch (error) {
            console.error('Error generating explanation:', error);
            throw error;
        }
    }
};
