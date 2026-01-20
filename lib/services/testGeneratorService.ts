import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '@/lib/prisma';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory progress storage for async generation
const progressMap = new Map<string, {
    status: string;
    progress: number;
    result?: { testId: number; name: string } | null;
    error?: string;
    timestamp: number;
    logs: string[];
}>();

type DifficultyDistribution = 'standard' | 'challenging' | 'beginner';
type TopicFocus = 'balanced' | 'reading-writing' | 'math';

interface GeneratorOptions {
    name?: string;
    difficulty?: DifficultyDistribution;
    topicFocus?: TopicFocus;
    jobId?: string;
}

interface GeneratedQuestion {
    questionText: string;
    questionType: 'MultipleChoice' | 'FreeResponse';
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctAnswer: string;
    explanation: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    topic: string;
}

interface GeneratedQuestionSet {
    passage?: string;
    passageIntro?: string;
    questions: GeneratedQuestion[];
}

interface GeneratedModule {
    questionSets: GeneratedQuestionSet[];
}

const DIFFICULTY_DISTRIBUTIONS: Record<DifficultyDistribution, { easy: number; medium: number; hard: number }> = {
    standard: { easy: 30, medium: 50, hard: 20 },
    challenging: { easy: 20, medium: 40, hard: 40 },
    beginner: { easy: 40, medium: 45, hard: 15 }
};

const RW_TOPICS = [
    'Information and Ideas',
    'Craft and Structure',
    'Expression of Ideas',
    'Standard English Conventions'
];

const MATH_TOPICS = [
    'Heart of Algebra',
    'Problem Solving and Data Analysis',
    'Passport to Advanced Math',
    'Additional Topics in Math'
];

export const testGeneratorService = {
    // Get progress for a specific job
    getProgress(jobId: string) {
        return progressMap.get(jobId) || { status: 'unknown', progress: 0, logs: [], result: null, error: undefined };
    },

    // Update progress for a job
    updateProgress(jobId: string, status: string, progress: number, result: { testId: number; name: string } | null = null, error?: string) {
        const existing = progressMap.get(jobId);
        const logs = existing?.logs || [];
        progressMap.set(jobId, { status, progress, result, error, timestamp: Date.now(), logs });
        // Clean up old entries (older than 30 minutes)
        for (const [key, value] of progressMap.entries()) {
            if (Date.now() - value.timestamp > 30 * 60 * 1000) {
                progressMap.delete(key);
            }
        }
    },

    // Add a log message
    addLog(jobId: string, message: string) {
        const existing = progressMap.get(jobId);
        if (existing) {
            existing.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
            existing.timestamp = Date.now();
        }
    },

    async generateFullTest(options: GeneratorOptions = {}): Promise<{ testId: number; name: string }> {
        const {
            name = `Generated SAT Practice Test - ${new Date().toLocaleDateString()}`,
            difficulty = 'standard',
            topicFocus = 'balanced',
            jobId
        } = options;

        const distribution = DIFFICULTY_DISTRIBUTIONS[difficulty];

        // Update progress if jobId provided
        if (jobId) {
            this.updateProgress(jobId, 'Creating test record...', 5);
            this.addLog(jobId, `Starting generation: ${name}`);
        }

        // Create the test record first
        const test = await prisma.sATTest.create({
            data: {
                name,
                pdfFilename: 'generated',
                originalName: 'AI Generated'
            }
        });

        if (jobId) {
            this.addLog(jobId, `Test record created with ID: ${test.id}`);
        }

        // Generate all 4 modules
        const modules = [
            { section: 'ReadingWriting', moduleNumber: 1, questionCount: 27, timeLimit: 32 },
            { section: 'ReadingWriting', moduleNumber: 2, questionCount: 27, timeLimit: 32 },
            { section: 'Math', moduleNumber: 1, questionCount: 22, timeLimit: 35 },
            { section: 'Math', moduleNumber: 2, questionCount: 22, timeLimit: 35 }
        ];

        for (let i = 0; i < modules.length; i++) {
            const moduleConfig = modules[i];
            const baseProgress = 10 + (i * 22); // 10%, 32%, 54%, 76%

            if (jobId) {
                this.updateProgress(jobId, `Generating ${moduleConfig.section} Module ${moduleConfig.moduleNumber}...`, baseProgress);
                this.addLog(jobId, `Starting ${moduleConfig.section} Module ${moduleConfig.moduleNumber} (${moduleConfig.questionCount} questions)`);
            }

            await this.generateModule(
                test.id,
                moduleConfig.section,
                moduleConfig.moduleNumber,
                moduleConfig.questionCount,
                moduleConfig.timeLimit,
                distribution,
                topicFocus,
                jobId,
                baseProgress
            );

            if (jobId) {
                this.addLog(jobId, `Completed ${moduleConfig.section} Module ${moduleConfig.moduleNumber}`);
            }
        }

        const result = { testId: test.id, name };

        if (jobId) {
            this.updateProgress(jobId, 'Complete!', 100, result);
            this.addLog(jobId, `Test generation complete! Test ID: ${test.id}`);
        }

        return result;
    },

    async generateModule(
        testId: number,
        section: string,
        moduleNumber: number,
        questionCount: number,
        timeLimit: number,
        distribution: { easy: number; medium: number; hard: number },
        topicFocus: TopicFocus,
        jobId?: string,
        baseProgress?: number
    ): Promise<void> {
        const module = await prisma.module.create({
            data: {
                testId,
                section,
                moduleNumber,
                timeLimit
            }
        });

        const isRW = section === 'ReadingWriting';
        const topics = isRW ? RW_TOPICS : MATH_TOPICS;

        // Generate questions in batches (question sets)
        let questionNumber = 1;
        let orderIndex = 0;
        let setCount = 0;

        while (questionNumber <= questionCount) {
            const remainingQuestions = questionCount - questionNumber + 1;
            const batchSize = isRW
                ? Math.min(Math.floor(Math.random() * 3) + 2, remainingQuestions) // 2-4 questions per passage
                : Math.min(Math.floor(Math.random() * 2) + 1, remainingQuestions); // 1-2 questions per set for math

            const topic = topics[Math.floor(Math.random() * topics.length)];
            const difficulties = this.getDifficultiesForBatch(batchSize, distribution);

            // Update progress with question set info
            if (jobId && baseProgress !== undefined) {
                const progressIncrement = (22 * (questionNumber - 1)) / questionCount;
                this.updateProgress(
                    jobId,
                    `${section} M${moduleNumber}: Generating questions ${questionNumber}-${Math.min(questionNumber + batchSize - 1, questionCount)}...`,
                    Math.round(baseProgress + progressIncrement)
                );
            }

            const questionSet = await this.generateQuestionSet(
                section,
                topic,
                batchSize,
                difficulties,
                isRW
            );

            if (jobId) {
                this.addLog(jobId, `${section} M${moduleNumber}: Generated set ${++setCount} (${batchSize} questions, topic: ${topic})`);
            }

            // Save question set to database
            const dbQuestionSet = await prisma.questionSet.create({
                data: {
                    moduleId: module.id,
                    orderIndex,
                    passage: questionSet.passage || null,
                    passageIntro: questionSet.passageIntro || null,
                    hasFigure: false
                }
            });

            // Save questions
            for (let i = 0; i < questionSet.questions.length; i++) {
                const q = questionSet.questions[i];
                await prisma.question.create({
                    data: {
                        questionSetId: dbQuestionSet.id,
                        questionNumber: questionNumber++,
                        orderInSet: i,
                        questionType: q.questionType,
                        questionText: q.questionText,
                        optionA: q.optionA || null,
                        optionB: q.optionB || null,
                        optionC: q.optionC || null,
                        optionD: q.optionD || null,
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation,
                        difficulty: q.difficulty,
                        topic: q.topic
                    }
                });
            }

            orderIndex++;
        }
    },

    getDifficultiesForBatch(
        count: number,
        distribution: { easy: number; medium: number; hard: number }
    ): string[] {
        const difficulties: string[] = [];
        for (let i = 0; i < count; i++) {
            const rand = Math.random() * 100;
            if (rand < distribution.easy) {
                difficulties.push('Easy');
            } else if (rand < distribution.easy + distribution.medium) {
                difficulties.push('Medium');
            } else {
                difficulties.push('Hard');
            }
        }
        return difficulties;
    },

    async generateQuestionSet(
        section: string,
        topic: string,
        questionCount: number,
        difficulties: string[],
        includePassage: boolean
    ): Promise<GeneratedQuestionSet> {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const isRW = section === 'ReadingWriting';
        const difficultyList = difficulties.join(', ');

        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const prompt = isRW
                ? this.getRWPrompt(topic, questionCount, difficultyList)
                : this.getMathPrompt(topic, questionCount, difficultyList);

            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();

            let jsonText = responseText;
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
            }

            const parsed = this.parseQuestionSetJson(jsonText);
            if (parsed) {
                // Ensure topic is set on all questions
                parsed.questions = parsed.questions.map((q, i) => ({
                    ...q,
                    topic: q.topic || topic,
                    difficulty: (q.difficulty || difficulties[i] || 'Medium') as 'Easy' | 'Medium' | 'Hard'
                }));
                return parsed;
            }

            lastError = new Error(`JSON parse failed on attempt ${attempt + 1}`);
            console.log(`Retry ${attempt + 1}/${maxRetries} for ${section} - ${topic}`);
        }

        throw lastError || new Error('Failed to generate question set after retries');
    },

    parseQuestionSetJson(jsonText: string): GeneratedQuestionSet | null {
        // Fix common JSON escape issues from LLM responses
        const sanitizeJson = (text: string): string => {
            return text
                .replace(/[\x00-\x1F\x7F]/g, ' ')  // Remove control characters
                .replace(/\\\\/g, '@@DOUBLE_BACKSLASH@@')  // Preserve intentional double backslashes
                .replace(/\\([^"\\\/bfnrtu])/g, '\\\\$1')  // Escape unescaped backslashes
                .replace(/@@DOUBLE_BACKSLASH@@/g, '\\\\');  // Restore double backslashes
        };

        // Try multiple parsing strategies
        const strategies = [
            // Strategy 1: Basic sanitization
            () => JSON.parse(sanitizeJson(jsonText)),
            // Strategy 2: More aggressive sanitization
            () => {
                const cleaned = jsonText
                    .replace(/[\x00-\x1F\x7F]/g, ' ')
                    .replace(/\\(?=\s)/g, '\\\\')
                    .replace(/\\(?=[a-zA-Z](?!["\\/bfnrtu]))/g, '\\\\');
                return JSON.parse(cleaned);
            },
            // Strategy 3: Fix truncated JSON by closing brackets
            () => {
                let fixed = sanitizeJson(jsonText);
                // Count brackets to fix truncation
                const openBrackets = (fixed.match(/\[/g) || []).length;
                const closeBrackets = (fixed.match(/\]/g) || []).length;
                const openBraces = (fixed.match(/\{/g) || []).length;
                const closeBraces = (fixed.match(/\}/g) || []).length;

                // Try to fix truncated strings
                if (openBrackets > closeBrackets || openBraces > closeBraces) {
                    // Find last complete question object
                    const lastCompleteMatch = fixed.match(/.*"difficulty"\s*:\s*"[^"]+"\s*,\s*"topic"\s*:\s*"[^"]+"\s*\}/s);
                    if (lastCompleteMatch) {
                        fixed = lastCompleteMatch[0] + ']}';
                    }
                }
                return JSON.parse(fixed);
            },
            // Strategy 4: Strip all backslashes
            () => {
                const stripped = jsonText
                    .replace(/[\x00-\x1F\x7F]/g, ' ')
                    .replace(/\\/g, '');
                return JSON.parse(stripped);
            }
        ];

        for (const strategy of strategies) {
            try {
                const parsed = strategy() as GeneratedQuestionSet;
                if (parsed && parsed.questions && Array.isArray(parsed.questions)) {
                    return parsed;
                }
            } catch {
                continue;
            }
        }

        return null;
    },

    getRWPrompt(topic: string, questionCount: number, difficulties: string): string {
        return `You are an expert SAT test creator. Generate a Reading/Writing question set.

**Topic**: ${topic}
**Number of Questions**: ${questionCount}
**Difficulties**: ${difficulties} (one for each question in order)

**Requirements**:
1. Create a short passage (150-250 words) appropriate for SAT Reading/Writing
2. Add line numbers every 5 lines (e.g., "5  The ancient forest...")
3. Generate ${questionCount} multiple-choice questions about the passage
4. Questions should test: comprehension, vocabulary in context, author's purpose, evidence-based reasoning
5. Each question must have exactly 4 options (A, B, C, D)
6. Include clear explanations for correct answers

**OUTPUT FORMAT - Return valid JSON only:**
{
    "passage": "1  First line of passage...\\n   Second line...\\n5  Fifth line...",
    "passageIntro": "The following passage is adapted from...",
    "questions": [
        {
            "questionText": "According to the passage, which choice...",
            "questionType": "MultipleChoice",
            "optionA": "first option",
            "optionB": "second option",
            "optionC": "third option",
            "optionD": "fourth option",
            "correctAnswer": "B",
            "explanation": "The passage states that...",
            "difficulty": "Medium",
            "topic": "${topic}"
        }
    ]
}

Return ONLY valid JSON. No markdown code fences, no conversation.`;
    },

    getMathPrompt(topic: string, questionCount: number, difficulties: string): string {
        const includeFreeResponse = Math.random() > 0.7;

        return `You are an expert SAT test creator. Generate Math questions.

**Topic**: ${topic}
**Number of Questions**: ${questionCount}
**Difficulties**: ${difficulties} (one for each question in order)
**Include Free Response**: ${includeFreeResponse ? 'Yes, make at least one free response' : 'No, all multiple choice'}

**Requirements**:
1. Create realistic SAT Math questions for the specified topic
2. Use LaTeX for ALL math expressions: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$
3. For multiple choice: exactly 4 options (A, B, C, D)
4. For free response: correctAnswer should be the numerical answer
5. Include step-by-step explanations

**MATH FORMATTING**:
- Fractions: $\\frac{numerator}{denominator}$
- Exponents: $x^{2}$ or $x^{n}$
- Square roots: $\\sqrt{x}$
- Inequalities: $\\leq$, $\\geq$, $\\neq$

**OUTPUT FORMAT - Return valid JSON only:**
{
    "questions": [
        {
            "questionText": "If $x + 5 = 12$, what is the value of $x$?",
            "questionType": "MultipleChoice",
            "optionA": "$5$",
            "optionB": "$7$",
            "optionC": "$12$",
            "optionD": "$17$",
            "correctAnswer": "B",
            "explanation": "Subtract 5 from both sides: $x = 12 - 5 = 7$",
            "difficulty": "Easy",
            "topic": "${topic}"
        },
        {
            "questionText": "What is the value of $\\frac{15}{3}$?",
            "questionType": "FreeResponse",
            "correctAnswer": "5",
            "explanation": "Divide 15 by 3 to get 5.",
            "difficulty": "Easy",
            "topic": "${topic}"
        }
    ]
}

Return ONLY valid JSON. No markdown code fences, no conversation.`;
    }
};
