import fs from 'fs/promises';
import path from 'path';
import prisma from '@/lib/prisma';
import sharp from 'sharp';
import {
    generateWithFallback,
    uploadFile,
    deleteFile,
    createPartFromUri,
    createUserContent
} from '@/lib/gemini/client';
import { getVerificationBatchSize, isVerificationEnabled } from '@/lib/gemini/config';
import { QuestionForVerification, BatchVerificationResponse } from '@/lib/gemini/types';
import type { ContentListUnion } from '@google/genai';

// Upload directories - use /tmp for serverless or local uploads folder
const UPLOADS_DIR = process.env.NODE_ENV === 'production'
    ? '/tmp/uploads'
    : path.join(process.cwd(), 'public', 'uploads');
const PDF_DIR = path.join(UPLOADS_DIR, 'pdfs');
const FIGURES_DIR = path.join(UPLOADS_DIR, 'figures');

// In-memory progress storage
const progressMap = new Map<string, { status: string; progress: number; result?: unknown; timestamp: number; logs: string[] }>();

interface ModuleConfig {
    section: string;
    moduleNumber: number;
    promptSuffix: string;
}

// Individual question within a QuestionSet (no passage/figure - those are on the set)
interface ParsedQuestion {
    questionNumber: number;
    questionType: string;
    questionText: string; // Just the question itself, not the passage
    topic?: string;
    difficulty?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctAnswer: string;
    explanation?: string;
}

// A group of questions sharing a passage and/or figure
interface ParsedQuestionSet {
    passage?: string | null;
    passageIntro?: string | null;
    hasFigure?: boolean;
    figureDescription?: string | null;
    pageNumber?: number | null;
    boundingBox?: number[] | null;
    figureData?: string; // Base64-encoded PNG (added after extraction)
    questions: ParsedQuestion[];
}

interface ParsedModule {
    section: string;
    moduleNumber: number;
    timeLimit?: number | null; // Time limit in minutes
    questionSets: ParsedQuestionSet[];
}

interface ParsedData {
    testName: string;
    modules: ParsedModule[];
}

export const pdfService = {
    // Get progress for a specific file
    getProgress(filename: string) {
        return progressMap.get(filename) || { status: 'starting', progress: 0, logs: [], result: null };
    },

    // Update progress for a file
    updateProgress(filename: string, status: string, progress: number, result: unknown = null) {
        const existing = progressMap.get(filename);
        const logs = existing?.logs || [];
        progressMap.set(filename, { status, progress, result, timestamp: Date.now(), logs });
        // Clean up old entries (older than 10 minutes)
        for (const [key, value] of progressMap.entries()) {
            if (Date.now() - value.timestamp > 10 * 60 * 1000) {
                progressMap.delete(key);
            }
        }
    },

    // Add a log message
    addLog(filename: string, message: string) {
        const existing = progressMap.get(filename);
        if (existing) {
            existing.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
            existing.timestamp = Date.now();
        }
    },

    // Ensure directories exist
    async ensureDirectories() {
        await fs.mkdir(PDF_DIR, { recursive: true });
        await fs.mkdir(FIGURES_DIR, { recursive: true });
    },

    // Parse PDF and store in database
    async parsePDF(filePath: string, originalName: string) {
        const fileId = path.basename(filePath);
        try {
            await this.ensureDirectories();
            this.updateProgress(fileId, 'Storing PDF...', 5);
            console.log('📄 Starting PDF parsing with Gemini 3 Flash (Module-by-Module)...');

            const pdfFilename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const permanentPath = path.join(PDF_DIR, pdfFilename);
            await fs.copyFile(filePath, permanentPath);
            await fs.unlink(filePath);

            console.log(`📁 Stored PDF at: ${permanentPath}`);
            this.updateProgress(fileId, 'Uploading to Gemini AI...', 10);

            console.log('⬆️  Uploading PDF to Gemini...');
            const uploadResult = await uploadFile(permanentPath, 'application/pdf');
            console.log(`✅ Uploaded to Gemini: ${uploadResult.uri}`);

            let testName = originalName.replace('.pdf', '').replace(/[_-]/g, ' ');

            this.updateProgress(fileId, 'Creating test record...', 15);
            const satTest = await prisma.sATTest.create({
                data: {
                    name: testName,
                    pdfFilename: pdfFilename,
                    originalName: originalName
                }
            });
            console.log(`📝 Created test record: ID ${satTest.id}`);

            const moduleConfigs: ModuleConfig[] = [
                { section: 'ReadingWriting', moduleNumber: 1, promptSuffix: 'Reading and Writing Module 1' },
                { section: 'ReadingWriting', moduleNumber: 2, promptSuffix: 'Reading and Writing Module 2' },
                { section: 'Math', moduleNumber: 1, promptSuffix: 'Math Module 1' },
                { section: 'Math', moduleNumber: 2, promptSuffix: 'Math Module 2' }
            ];

            for (let i = 0; i < moduleConfigs.length; i++) {
                const config = moduleConfigs[i];
                const baseProgress = 20 + (i * 20); // 20, 40, 60, 80

                this.updateProgress(fileId, `Extracting ${config.section} Module ${config.moduleNumber}...`, baseProgress);
                console.log(`🔍 Extracting ${config.section} Module ${config.moduleNumber}...`);

                const result = await this.extractModuleWithGemini(uploadResult, config);

                if (result.testName && i === 0) {
                    testName = result.testName;
                    await prisma.sATTest.update({
                        where: { id: satTest.id },
                        data: { name: testName }
                    });
                }

                const questionSets: ParsedQuestionSet[] = result.questionSets || [];
                const timeLimit = result.moduleTimeLimit || null;

                const figureCount = questionSets.filter((qs: ParsedQuestionSet) => qs.hasFigure).length;
                const totalQuestions = questionSets.reduce((sum: number, qs: ParsedQuestionSet) => sum + qs.questions.length, 0);
                if (figureCount > 0) {
                    console.log(`   📊 Detected ${figureCount} question sets with figures`);
                }
                if (timeLimit) {
                    console.log(`   ⏱️  Time limit: ${timeLimit} minutes`);
                }

                const moduleData: ParsedModule = {
                    section: config.section,
                    moduleNumber: config.moduleNumber,
                    timeLimit: timeLimit,
                    questionSets: questionSets
                };

                if (figureCount > 0) {
                    this.updateProgress(fileId, `Extracting figures for ${config.section} M${config.moduleNumber}...`, baseProgress + 5);
                    await this.extractFiguresForModule(permanentPath, moduleData);
                }

                this.updateProgress(fileId, `Saving ${config.section} Module ${config.moduleNumber}...`, baseProgress + 10);
                const savedModule = await this.saveModule(satTest.id, moduleData);
                console.log(`   ✅ Saved ${totalQuestions} questions for ${config.section} Module ${config.moduleNumber}`);

                if (isVerificationEnabled() && totalQuestions > 0) {
                    this.updateProgress(fileId, `Verifying ${config.section} M${config.moduleNumber}...`, baseProgress + 15);
                    await this.verifyModule(fileId, satTest.id, satTest.name, savedModule);
                }
            }

            await deleteFile(uploadResult.name);
            console.log('🗑️  Cleaned up Gemini file');

            const finalTest = await prisma.sATTest.findUnique({
                where: { id: satTest.id },
                include: {
                    modules: {
                        include: {
                            questionSets: {
                                include: { questions: true }
                            }
                        }
                    }
                }
            });

            this.updateProgress(fileId, 'Complete!', 100, finalTest);
            console.log(`\n📊 Processing Complete: Test ID: ${satTest.id}`);
            return finalTest;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.updateProgress(fileId, `Error: ${errorMessage}`, -1);
            console.error('PDF parsing error:', error);
            throw error;
        }
    },

    async extractModuleWithGemini(file: { mimeType: string; uri: string; name: string }, config: ModuleConfig) {
        try {
            const prompt = `You are an expert SAT test parser. Extract questions ONLY for "${config.promptSuffix}" from this PDF.

**YOUR TASK:**
Extract EVERY question for this specific module, grouped into QUESTION SETS.

**QUESTION SET GROUPING RULES:**
1. If multiple consecutive questions reference the SAME PASSAGE, group them in ONE questionSet
2. Look for explicit cues like "Questions 5-7 refer to the following passage"
3. A standalone question with no passage = a questionSet with ONE question and passage: null
4. If a figure/chart/table is shared by multiple questions, attach it to the questionSet (not individual questions)
5. For Math: if a diagram or table is referenced by multiple questions, group them together
6. Preserve the order of question sets and questions as they appear in the PDF

**PASSAGE EXTRACTION:**
- passage: The main text that questions reference (paragraphs, excerpts, poems, etc.)
- passageIntro: Any introductory text like "The following is adapted from..." (SEPARATE from main passage)
- If no passage exists, set both to null

**CRITICAL - PRESERVE FORMATTING:**
- Mark underlined text with <u>underlined text</u> tags
- Preserve indentation using spaces (e.g., "    indented text" for paragraph indents)
- Preserve line breaks as they appear in the PDF using \\n
- **LINE NUMBERS**: SAT passages have line numbers (5, 10, 15, etc.) in margins - PRESERVE these at the start of the appropriate lines (e.g., "5  The ancient forest...")
- Mark bold text with **bold** markdown
- Mark italic text with *italic* markdown
- **MATH EXPRESSIONS**: Use LaTeX syntax wrapped in $ delimiters for ALL mathematical expressions:
  - Fractions: $\\frac{numerator}{denominator}$ (e.g., $\\frac{x+1}{2}$)
  - Exponents: $x^{2}$ or $x^{n}$
  - Square roots: $\\sqrt{x}$ or $\\sqrt[n]{x}$
  - Greek letters: $\\pi$, $\\theta$, $\\alpha$
  - Inequalities: $\\leq$, $\\geq$, $\\neq$
  - Multiplication: $\\times$ or $\\cdot$
  - Keep simple variables like x, y, n without $ delimiters unless in a formula
  - **CRITICAL - NESTED EXPRESSIONS**: Preserve the EXACT nesting structure:
    - Square root of a sum: $\\sqrt{w + 19}$ (NOT $\\sqrt{w} + 19$ - the +19 must be INSIDE the sqrt braces)
    - Squared fraction: $\\left(\\frac{x}{y}\\right)^2$ (use \\left and \\right for proper sizing)
    - **SQUARE ROOT OF A FRACTION** (VERY IMPORTANT): When a fraction is UNDER a square root sign, write it as $\\sqrt{\\frac{numerator}{denominator}}$ with the ENTIRE \\frac{}{} inside the \\sqrt{} braces
      - Correct: $w = \\sqrt{\\frac{x}{y}} - 19$ (the fraction x/y is completely inside the square root)
      - Correct: $w = \\sqrt{\\frac{28x}{14y}} - 19$
      - WRONG: $w = \\frac{\\sqrt{x}}{y} - 19$ (this puts only x under the root, not the whole fraction)
      - WRONG: $w = \\sqrt{x/y} - 19$ (use \\frac, not /)

**FIGURE HANDLING (at QuestionSet level):**
- hasFigure: true if the questionSet has a shared figure/chart/table/diagram
- figureDescription: A detailed description of the figure that would allow someone to recreate it:
  - For COORDINATE PLANE GRAPHS: describe axis ranges, identify key points the line/curve passes through (especially where it crosses axes), and note the general direction/shape
  - For BAR CHARTS: describe what each bar represents, axis labels, and the legend
  - For TABLES: describe column/row headers and key data values
  - For GEOMETRIC FIGURES: describe shapes, labeled measurements, angles, and relationships
- pageNumber: The page number in the PDF (1-indexed) where this figure is located
- boundingBox: The precise [ymin, xmin, ymax, xmax] coordinates as normalized values (0-1000)

**MATH QUESTION CONTENT - IMPORTANT:**
- For Math questions, the questionText MUST include ALL mathematical context needed to solve the problem:
  - Function definitions (e.g., "f(x) = 2x + 3")
  - Equations and systems of equations
  - Given values, conditions, and constraints
  - Any formulas or expressions the question references
- Do NOT put math content in the "passage" field - passage is only for Reading/Writing text passages
- For Math, passage should always be null unless there's actual prose text to read

**MODULE TIME LIMIT:**
- Look for time limit information for this module (e.g., "32 minutes", "35 min", "Time: 32:00")
- Extract the time in MINUTES as an integer
- If no time limit is specified, return null

**OUTPUT FORMAT - Return valid JSON:**
{
  "testName": "The name of the test if found",
  "moduleTimeLimit": integer (minutes) or null,
  "questionSets": [
    {
      "passage": "The main passage text with preserved formatting" or null,
      "passageIntro": "The following text is adapted from..." or null,
      "hasFigure": true or false,
      "figureDescription": "detailed description of shared figure" or null,
      "pageNumber": integer or null,
      "boundingBox": [ymin, xmin, ymax, xmax] or null,
      "questions": [
        {
          "questionNumber": 1,
          "questionType": "MultipleChoice" or "FreeResponse",
          "questionText": "The COMPLETE question including all math context, equations, function definitions, and the actual question being asked",
          "topic": "SAT Topic (e.g., Heart of Algebra, Rhetoric, Standard English Conventions)",
          "difficulty": "Easy", "Medium", or "Hard",
          "optionA": "option A text" or null,
          "optionB": "option B text" or null,
          "optionC": "option C text" or null,
          "optionD": "option D text" or null,
          "correctAnswer": "A/B/C/D" or "numeric answer",
          "explanation": "brief explanation"
        }
      ]
    }
  ]
}

**EXAMPLE - Reading/Writing with shared passage (note line numbers):**
{
  "questionSets": [
    {
      "passage": "    In the depths of the forest, ancient trees\\nstood as silent witnesses to centuries of change.\\n5  Their gnarled branches reached toward the sky,\\nforming a canopy that filtered the afternoon\\nlight into dancing shadows on the forest floor.\\n    The naturalist paused, notebook in hand,\\n10  observing the intricate patterns of moss that\\nclung to the bark of an old oak.",
      "passageIntro": "The following is from a 2019 novel by Author Name.",
      "hasFigure": false,
      "questions": [
        { "questionNumber": 1, "questionText": "Which choice best states the main idea?", ... },
        { "questionNumber": 2, "questionText": "As used in line 5, 'ancient' most nearly means", ... }
      ]
    }
  ]
}

**EXAMPLE - Math with standalone questions:**
{
  "questionSets": [
    { "passage": null, "hasFigure": false, "questions": [{ "questionNumber": 1, "questionText": "If $2x + 3 = 11$, what is the value of $x$?", "questionType": "FreeResponse", "correctAnswer": "4", ... }] },
    { "passage": null, "hasFigure": false, "questions": [{ "questionNumber": 2, "questionText": "The function $f$ is defined by $f(x) = 3x^2 - 5x + 2$. What is the value of $f(4)$?", "questionType": "FreeResponse", "correctAnswer": "30", ... }] },
    { "passage": null, "hasFigure": true, "figureDescription": "A right triangle with legs labeled a and b, hypotenuse labeled c", "pageNumber": 5, "boundingBox": [100, 200, 400, 600], "questions": [{ "questionNumber": 3, "questionText": "In the figure shown, if $a = 3$ and $b = 4$, what is the value of $c$?", ... }] }
  ]
}

**EXAMPLE - Math with nested LaTeX (IMPORTANT - note square root of fraction pattern):**
Options A and B below show SQUARE ROOT OF A FRACTION - the entire \\frac{}{} must be inside \\sqrt{}:
{
  "questionSets": [
    {
      "passage": null,
      "hasFigure": false,
      "questions": [{
        "questionNumber": 19,
        "questionText": "$\\\\frac{14x}{7y} = 2\\\\sqrt{w + 19}$\\n\\nThe given equation relates the distinct positive real numbers $w$, $x$, and $y$. Which equation correctly expresses $w$ in terms of $x$ and $y$?",
        "questionType": "MultipleChoice",
        "optionA": "$w = \\\\sqrt{\\\\frac{x}{y}} - 19$",
        "optionB": "$w = \\\\sqrt{\\\\frac{28x}{14y}} - 19$",
        "optionC": "$w = \\\\left(\\\\frac{x}{y}\\\\right)^2 - 19$",
        "optionD": "$w = \\\\left(\\\\frac{28x}{14y}\\\\right)^2 - 19$",
        "correctAnswer": "C",
        "explanation": "Simplify the left side and solve for w by squaring both sides"
      }]
    }
  ]
}
Note: optionA uses \\\\sqrt{\\\\frac{x}{y}} - the fraction x/y is COMPLETELY INSIDE the sqrt braces.

Return ONLY valid JSON. No conversational text.`;

            const contents = createUserContent([
                createPartFromUri(file.uri, file.mimeType),
                prompt
            ]);

            const { text: responseText } = await generateWithFallback('pdfParsing', contents);

            if (!responseText) {
                console.error(`   ❌ Empty response from Gemini for ${config.promptSuffix}`);
                return { questionSets: [] };
            }

            let jsonText = responseText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
            }

            // Robust JSON Pre-processing:
            // We use a regex to identify and preserve VALID JSON escape sequences:
            // - \\ (escaped backslash)
            // - \" (escaped quote)
            // - \/ (escaped forward slash, common in JSON)
            // - \b, \f, \n, \r, \t (standard control chars)
            // - \uXXXX (valid unicode)
            //
            // EVERYTHING ELSE starting with \ is treated as an unescaped LaTeX command (e.g., \alpha, \leq) 
            // and we manually escape the backslash to \\ so it becomes a literal backslash in the string.
            jsonText = jsonText.replace(/(\\\\|\\"|\\\/|\\b|\\f|\\n|\\r|\\t|\\u[0-9a-fA-F]{4})|(\\)/g, (_match: string, preserved: string | undefined, _lone: string | undefined) => {
                if (preserved) return preserved;
                return '\\\\';
            });

            // Handle specific edge case: \neq (newline + eq) 
            // The above regex preserves \n. If we have "\neq", it matches \n then "eq".
            // So "\neq" becomes "\neq" (newline char + eq). 
            // This is actually syntactically VALID JSON (string with newline), but semantically wrong for LaTeX.
            // We want "\\neq". 
            // So we still need a specific fix for \n-based LaTeX commands if they exist.
            // LaTeX commands starting with n: \neq, \nu, \natural, \neg...
            // Be careful not to break actual newlines.
            // Heuristic: If \n is followed by alphanumeric chars that look like a command, escape it.
            // Actually, simpler: Just fix \neq explicitly as it's the most common collision.
            jsonText = jsonText.replace(/\neq/g, '\\\\neq');

            console.log(`📝 JSON Debug: Length ${jsonText.length}, First 50 chars: ${jsonText.substring(0, 50)}`);

            try {
                return JSON.parse(jsonText);
            } catch (e) {
                const parseError = e as Error;
                console.error(`❌ JSON Parse Error for ${config.promptSuffix}: ${parseError.message}`);

                // Try to extract position from error message to show relevant context
                const match = parseError.message.match(/at position (\d+)/);
                if (match) {
                    const pos = parseInt(match[1]);
                    const start = Math.max(0, pos - 100);
                    const end = Math.min(jsonText.length, pos + 100);
                    console.error(`💥 Context around position ${pos}:\n...${jsonText.substring(start, end)}...`);
                    console.error(`💥 Character at failure: '${jsonText.charAt(pos)}' (Code: ${jsonText.charCodeAt(pos)})`);
                } else {
                    console.error(`💥 First 500 chars of failing JSON:\n${jsonText.substring(0, 500)}`);
                }

                // Return empty questionSets to prevent app crash, but logged error will help debug
                return { questionSets: [] };
            }
        } catch (error) {
            console.error(`Error extracting ${config.promptSuffix}:`, error);
            return { questionSets: [] };
        }
    },

    // Extract figures from PDF and add base64 data to QuestionSets
    async extractFiguresFromPdf(fileId: string, pdfPath: string, modules: ParsedModule[]) {
        try {
            // Collect all QuestionSets with figures
            const setsWithFigures: { questionSet: ParsedQuestionSet; moduleIndex: number; setIndex: number }[] = [];

            modules.forEach((module, moduleIndex) => {
                module.questionSets.forEach((questionSet, setIndex) => {
                    if (questionSet.hasFigure && questionSet.pageNumber && questionSet.boundingBox?.length === 4) {
                        setsWithFigures.push({ questionSet, moduleIndex, setIndex });
                    }
                });
            });

            if (setsWithFigures.length === 0) {
                console.log('   ℹ️  No figures to extract');
                return;
            }

            console.log(`   📊 Extracting ${setsWithFigures.length} figures from PDF...`);

            // Get unique page numbers needed
            const pageNumbers = [...new Set(setsWithFigures.map(s => s.questionSet.pageNumber!))];
            const pageImages: Map<number, Buffer> = new Map();

            // Use pdf-to-img to render PDF pages
            const { pdf } = await import('pdf-to-img');
            const pdfBuffer = await fs.readFile(pdfPath);
            const document = await pdf(pdfBuffer, { scale: 2.0 });

            let currentPage = 0;
            const maxPage = Math.max(...pageNumbers);

            for await (const image of document) {
                currentPage++;
                if (pageNumbers.includes(currentPage)) {
                    pageImages.set(currentPage, Buffer.from(image));
                    console.log(`      📄 Rendered page ${currentPage}`);
                }
                if (pageImages.size === pageNumbers.length || currentPage >= maxPage) {
                    break;
                }
            }

            // Process each QuestionSet with a figure
            for (const { questionSet, moduleIndex, setIndex } of setsWithFigures) {
                try {
                    const pageImage = pageImages.get(questionSet.pageNumber!);
                    if (!pageImage) continue;

                    const boundingBox = questionSet.boundingBox!;
                    const metadata = await sharp(pageImage).metadata();
                    const imageWidth = metadata.width || 1;
                    const imageHeight = metadata.height || 1;

                    // Calculate crop coordinates from normalized bounding box (0-1000)
                    // Add padding (50 units = 5%) to capture more context around the figure
                    const PADDING = 50;
                    const [ymin, xmin, ymax, xmax] = boundingBox;
                    const paddedYmin = Math.max(0, ymin - PADDING);
                    const paddedXmin = Math.max(0, xmin - PADDING);
                    const paddedYmax = Math.min(1000, ymax + PADDING);
                    const paddedXmax = Math.min(1000, xmax + PADDING);

                    const cropX = Math.max(0, Math.round((paddedXmin / 1000) * imageWidth));
                    const cropY = Math.max(0, Math.round((paddedYmin / 1000) * imageHeight));
                    const cropWidth = Math.max(1, Math.round(((paddedXmax - paddedXmin) / 1000) * imageWidth));
                    const cropHeight = Math.max(1, Math.round(((paddedYmax - paddedYmin) / 1000) * imageHeight));

                    const croppedBuffer = await sharp(pageImage)
                        .extract({
                            left: Math.min(cropX, imageWidth - 1),
                            top: Math.min(cropY, imageHeight - 1),
                            width: Math.min(cropWidth, imageWidth - cropX),
                            height: Math.min(cropHeight, imageHeight - cropY)
                        })
                        .png()
                        .toBuffer();

                    // Store base64 data in the QuestionSet
                    modules[moduleIndex].questionSets[setIndex].figureData = croppedBuffer.toString('base64');
                    const questionNumbers = questionSet.questions.map(q => q.questionNumber).join(', ');
                    console.log(`      ✅ Extracted figure for QuestionSet (Q${questionNumbers})`);
                } catch (err) {
                    const questionNumbers = questionSet.questions.map(q => q.questionNumber).join(', ');
                    console.error(`      ❌ Error extracting figure for QuestionSet (Q${questionNumbers}):`, err);
                }
            }

            console.log('   ✅ Figure extraction complete');
        } catch (error) {
            console.error('Error extracting figures from PDF:', error);
        }
    },

    async extractFiguresForModule(pdfPath: string, module: ParsedModule) {
        try {
            const setsWithFigures = module.questionSets
                .map((qs, idx) => ({ qs, idx }))
                .filter(({ qs }) => qs.hasFigure && qs.pageNumber && qs.boundingBox?.length === 4);

            if (setsWithFigures.length === 0) return;

            const pageNumbers = [...new Set(setsWithFigures.map(s => s.qs.pageNumber!))];
            const pageImages: Map<number, Buffer> = new Map();

            const { pdf } = await import('pdf-to-img');
            const pdfBuffer = await fs.readFile(pdfPath);
            const document = await pdf(pdfBuffer, { scale: 2.0 });

            let currentPage = 0;
            const maxPage = Math.max(...pageNumbers);

            for await (const image of document) {
                currentPage++;
                if (pageNumbers.includes(currentPage)) {
                    pageImages.set(currentPage, Buffer.from(image));
                }
                if (pageImages.size === pageNumbers.length || currentPage >= maxPage) break;
            }

            for (const { qs, idx } of setsWithFigures) {
                try {
                    const pageImage = pageImages.get(qs.pageNumber!);
                    if (!pageImage) continue;

                    const [ymin, xmin, ymax, xmax] = qs.boundingBox!;
                    const metadata = await sharp(pageImage).metadata();
                    const imageWidth = metadata.width || 1;
                    const imageHeight = metadata.height || 1;

                    const PADDING = 50;
                    const paddedYmin = Math.max(0, ymin - PADDING);
                    const paddedXmin = Math.max(0, xmin - PADDING);
                    const paddedYmax = Math.min(1000, ymax + PADDING);
                    const paddedXmax = Math.min(1000, xmax + PADDING);

                    const cropX = Math.max(0, Math.round((paddedXmin / 1000) * imageWidth));
                    const cropY = Math.max(0, Math.round((paddedYmin / 1000) * imageHeight));
                    const cropWidth = Math.max(1, Math.round(((paddedXmax - paddedXmin) / 1000) * imageWidth));
                    const cropHeight = Math.max(1, Math.round(((paddedYmax - paddedYmin) / 1000) * imageHeight));

                    const croppedBuffer = await sharp(pageImage)
                        .extract({
                            left: Math.min(cropX, imageWidth - 1),
                            top: Math.min(cropY, imageHeight - 1),
                            width: Math.min(cropWidth, imageWidth - cropX),
                            height: Math.min(cropHeight, imageHeight - cropY)
                        })
                        .png()
                        .toBuffer();

                    module.questionSets[idx].figureData = croppedBuffer.toString('base64');
                    console.log(`      ✅ Extracted figure for Q${qs.questions.map(q => q.questionNumber).join(', ')}`);
                } catch (err) {
                    console.error(`      ❌ Figure extraction error:`, err);
                }
            }
        } catch (error) {
            console.error('Error extracting module figures:', error);
        }
    },

    async saveModule(testId: number, module: ParsedModule) {
        const dbModule = await prisma.module.create({
            data: {
                testId,
                section: module.section,
                moduleNumber: module.moduleNumber,
                timeLimit: module.timeLimit || null,
                questionSets: {
                    create: module.questionSets.map((qs, setIndex) => ({
                        orderIndex: setIndex,
                        passage: qs.passage || null,
                        passageIntro: qs.passageIntro || null,
                        hasFigure: qs.hasFigure || false,
                        figurePageNumber: qs.pageNumber || null,
                        figureBoundingBox: qs.boundingBox ? JSON.stringify(qs.boundingBox) : null,
                        figureCaption: qs.figureDescription || null,
                        figureData: qs.figureData || null,
                        questions: {
                            create: qs.questions.map((q, qIndex) => ({
                                questionNumber: q.questionNumber,
                                orderInSet: qIndex,
                                questionType: q.questionType,
                                questionText: q.questionText,
                                optionA: q.optionA || null,
                                optionB: q.optionB || null,
                                optionC: q.optionC || null,
                                optionD: q.optionD || null,
                                correctAnswer: String(q.correctAnswer),
                                topic: q.topic || 'General',
                                difficulty: q.difficulty || 'Medium',
                                explanation: q.explanation || ''
                            }))
                        }
                    }))
                }
            },
            include: {
                questionSets: {
                    include: { questions: true }
                }
            }
        });
        return dbModule;
    },

    async verifyModule(
        fileId: string,
        testId: number,
        testName: string,
        dbModule: { section: string; moduleNumber: number; questionSets: Array<{ passage: string | null; hasFigure?: boolean; figureData?: string | null; figureCaption?: string | null; questions: Array<{ id: number; questionNumber: number; questionText: string; questionType: string; optionA: string | null; optionB: string | null; optionC: string | null; optionD: string | null; correctAnswer: string }> }> }
    ) {
        const batchSize = getVerificationBatchSize();
        const questions: QuestionForVerification[] = [];

        dbModule.questionSets.forEach((set, setIndex) => {
            set.questions.forEach((q, qIndex) => {
                questions.push({
                    questionId: q.id,
                    setIndex,
                    qIndex,
                    questionNumber: q.questionNumber,
                    questionText: q.questionText,
                    questionType: q.questionType,
                    optionA: q.optionA,
                    optionB: q.optionB,
                    optionC: q.optionC,
                    optionD: q.optionD,
                    correctAnswer: q.correctAnswer,
                    passage: set.passage,
                    hasFigure: set.hasFigure ?? false,
                    figureData: set.figureData ?? null,
                    figureCaption: set.figureCaption ?? null
                });
            });
        });

        if (questions.length === 0) return;

        console.log(`   🔍 Verifying ${questions.length} questions...`);

        for (let i = 0; i < questions.length; i += batchSize) {
            const batch = questions.slice(i, i + batchSize);
            await this.verifyBatch(fileId, testId, testName, dbModule.section, dbModule.moduleNumber, batch);
        }
    },

    async verifyBatch(
        fileId: string,
        testId: number,
        testName: string,
        section: string,
        moduleNumber: number,
        batch: QuestionForVerification[],
        retryCount = 0
    ): Promise<void> {
        const MAX_RETRIES = 2;
        const startTime = Date.now();

        try {
            // Step 1: Dedupe figures by setIndex, track min question number per set
            const setFigures = new Map<number, { figureData: string; minQuestionNumber: number }>();
            for (const q of batch) {
                if (q.figureData) {
                    const existing = setFigures.get(q.setIndex);
                    if (!existing) {
                        setFigures.set(q.setIndex, {
                            figureData: q.figureData,
                            minQuestionNumber: q.questionNumber
                        });
                    } else if (q.questionNumber < existing.minQuestionNumber) {
                        existing.minQuestionNumber = q.questionNumber;
                    }
                }
            }

            // Step 2: Sort by minQuestionNumber, create setIndex -> imageIndex mapping (1-based)
            const sortedFigures = Array.from(setFigures.entries())
                .sort((a, b) => a[1].minQuestionNumber - b[1].minQuestionNumber);
            
            const setIndexToImageIndex = new Map<number, number>();
            sortedFigures.forEach(([setIndex], idx) => {
                setIndexToImageIndex.set(setIndex, idx + 1);
            });

            // Step 3: Build prompt with imageIndex mapping
            const prompt = this.buildVerificationPrompt(batch, section, setIndexToImageIndex);

            // Step 4: Build multimodal or text-only content
            let contents: ContentListUnion;
            if (sortedFigures.length > 0) {
                // Multimodal: images first (sorted order), then text prompt
                const parts: Array<{text: string} | {inlineData: {mimeType: string, data: string}}> = [];
                for (const [, figData] of sortedFigures) {
                    // figureData is raw base64 (no data URI prefix)
                    parts.push({ inlineData: { mimeType: 'image/png', data: figData.figureData } });
                }
                parts.push({ text: prompt });
                contents = createUserContent(parts);
            } else {
                // Text-only: plain string (backward compatible)
                contents = prompt;
            }

            const { text, modelUsed, tierUsed } = await generateWithFallback(
                'answerVerification',
                contents,
                { 
                    startTier: 'premium',
                    responseMimeType: 'application/json'
                }
            );

            let response = this.parseVerificationResponse(text);

            // Retry with stricter prompt if parsing returned empty
            if (response.verifications.length === 0 && batch.length > 0) {
                console.log('[pdfService] Empty verification response, retrying with stricter prompt...');
                
                const strictPrompt = `You MUST respond with ONLY valid JSON. No explanations, no markdown, no prose.

${prompt}

CRITICAL: Your entire response must be parseable JSON. Start with { and end with }. Nothing else.`;

                // Rebuild contents with strict prompt
                let strictContents: ContentListUnion;
                if (sortedFigures.length > 0) {
                    const parts: Array<{text: string} | {inlineData: {mimeType: string, data: string}}> = [];
                    for (const [, figData] of sortedFigures) {
                        parts.push({ inlineData: { mimeType: 'image/png', data: figData.figureData } });
                    }
                    parts.push({ text: strictPrompt });
                    strictContents = createUserContent(parts);
                } else {
                    strictContents = strictPrompt;
                }

                const retryResult = await generateWithFallback(
                    'answerVerification',
                    strictContents,
                    { 
                        startTier: 'premium',
                        responseMimeType: 'application/json'
                    }
                );
                
                response = this.parseVerificationResponse(retryResult.text);
                
                if (response.verifications.length > 0) {
                    console.log('[pdfService] Retry successful, got valid verifications');
                }
            }

            const processingTimeMs = Date.now() - startTime;

            for (const result of response.verifications) {
                const question = batch.find(q => q.questionNumber === result.questionNumber);
                if (!question) continue;

                if (!result.wasCorrect) {
                    await prisma.question.update({
                        where: { id: question.questionId },
                        data: {
                            correctAnswer: result.verifiedAnswer,
                            explanation: result.explanation || undefined
                        }
                    });

                    console.log(`   ⚠️  Q${result.questionNumber}: ${question.correctAnswer} → ${result.verifiedAnswer} (${result.confidence})`);
                    this.addLog(fileId, `Corrected Q${result.questionNumber}: ${question.correctAnswer} → ${result.verifiedAnswer}`);

                    await prisma.answerVerificationLog.create({
                        data: {
                            testId,
                            testName,
                            section,
                            moduleNumber,
                            questionNumber: result.questionNumber,
                            questionText: question.questionText,
                            originalAnswer: question.correctAnswer,
                            verifiedAnswer: result.verifiedAnswer,
                            wasCorrect: false,
                            explanation: result.explanation,
                            confidence: result.confidence,
                            modelUsed,
                            tierUsed,
                            thinkingBudget: null,
                            processingTimeMs
                        }
                    });
                }
            }
        } catch (error) {
            console.error(`   ❌ Verification batch failed (attempt ${retryCount + 1}):`, error);

            if (retryCount < MAX_RETRIES) {
                const halfSize = Math.ceil(batch.length / 2);
                if (halfSize >= 1 && batch.length > 1) {
                    console.log(`   🔄 Retrying with smaller batches (${halfSize} questions each)...`);
                    await this.verifyBatch(fileId, testId, testName, section, moduleNumber, batch.slice(0, halfSize), retryCount + 1);
                    await this.verifyBatch(fileId, testId, testName, section, moduleNumber, batch.slice(halfSize), retryCount + 1);
                    return;
                }
            }

            console.log(`   ⏭️  Skipping verification for batch after ${MAX_RETRIES + 1} attempts`);
        }
    },

    buildVerificationPrompt(batch: QuestionForVerification[], section: string, setIndexToImageIndex?: Map<number, number>): string {
        const questionsJson = batch.map(q => {
            const imageIndex = setIndexToImageIndex?.get(q.setIndex) ?? null;
            return {
                questionNumber: q.questionNumber,
                questionText: q.questionText,
                questionType: q.questionType,
                options: q.questionType === 'MultipleChoice' ? {
                    A: q.optionA,
                    B: q.optionB,
                    C: q.optionC,
                    D: q.optionD
                } : null,
                passage: q.passage || null,
                proposedAnswer: q.correctAnswer,
                hasFigure: q.hasFigure ?? false,
                figureCaption: q.figureCaption ?? null,
                imageIndex: imageIndex
            };
        });

        return `You are an expert SAT question validator. Think very carefully and deeply about each question. Take your time to reason through every step.

IMPORTANT: This is a critical verification task. Think step by step. Double-check your work. Consider all possibilities before deciding.

For each question:
1. Read the question, passage (if any), and ALL options extremely carefully
2. Think hard about the problem - work through it step by step, showing your reasoning
3. For math: verify calculations twice. For reading: re-read relevant passages
4. For Math questions with radicals/exponents (CRITICAL):
   - **RADICAL SIMPLIFICATION**: When simplifying nth roots:
     * ⁿ√(aⁿ) = a (the root and power cancel)
     * ⁿ√(xᵐ) = x^(m/n) (convert to fractional exponent)
     * Example: ⁵√(3⁵x⁴⁵) = 3 · x^(45/5) = 3x⁹
   - **EXPONENT RULES**: When multiplying powers:
     * xᵃ · xᵇ = x^(a+b) (add exponents with same base)
     * Example: x⁹ · x^(1/8) = x^(9 + 1/8) = x^(73/8)
   - **COEFFICIENT MULTIPLICATION**: Multiply coefficients separately:
     * (6 · 3) · x⁹ · (2 · x^(1/8)) = 36 · x^(73/8)
   - **COMMON MISTAKES TO AVOID**:
     * Don't forget to simplify radicals completely (⁵√(3⁵) = 3, not left as ⁵√(3⁵))
     * Don't confuse root index with exponent (⁵√(x⁴⁵) = x⁹, not x⁵)
     * When adding fractional exponents, find common denominator: 9 + 1/8 = 72/8 + 1/8 = 73/8
     * For "a + b" questions, calculate BOTH values separately then add
5. For Standard English/grammar questions:
   - Mentally insert EACH option into the blank and read the FULL sentence
   - **VERB FORMS**: Identify what grammatical role the blank plays:
     * Is it a MAIN VERB continuing a series? (needs same tense as other verbs)
     * Is it an INFINITIVE expressing purpose? ("to + verb" = in order to)
     * Is it a PARTICIPLE modifying something? ("-ing" or "-ed" form)
   - **SAT RULE - INFINITIVE vs PARTICIPLE**:
     * When a blank follows a completed action and introduces an outcome, and BOTH infinitive ("to + verb") AND participle ("-ing") seem possible:
     * CHOOSE INFINITIVE if the outcome represents the PURPOSE or GOAL of the action
     * The SAT tests this pattern frequently: "Subject did X _____ Y" where Y is the intended result
      * Example: "Scientists modified the gene to create a cure" (NOT "creating") - the cure was the PURPOSE
    - **KEY PATTERN - "verb + object + BLANK + result"**:
      * When the structure is: "Subject verbed [object] _____ [result/outcome]"
      * The blank expresses PURPOSE → Use INFINITIVE ("to + verb")
      * This is NOT parallel structure even if earlier verbs are parallel
      * Example: "Scientists reprogrammed the bacteria to forge a tool" (NOT "forging")
      * The result ("a tool") is what they INTENDED to create
    - **PARALLEL STRUCTURE**: Verbs connected by "and" should match in form, BUT check if the blank is actually part of the parallel series or serves a different function (like expressing purpose)
   - Check punctuation and sentence boundaries
5. Determine the correct answer with high confidence
6. Compare with the proposed answer
7. If different, explain why the proposed answer is wrong and yours is correct

**FOR QUESTIONS WITH FIGURES (imageIndex > 0):**
- Questions with imageIndex > 0 have an associated image provided above.
- Image #1 is the first image, Image #2 is the second, etc.
- Questions with the same imageIndex share the same figure.
- If hasFigure is true but imageIndex is null, the image could not be extracted - use figureCaption and context clues.

**When analyzing bar charts/data graphs (CRITICAL):**
1. READ THE LEGEND FIRST: Identify what each color/pattern/shading represents
2. MATCH BARS TO LEGEND: For each bar, CAREFULLY identify its visual style and match to the legend
3. READ Y-AXIS VALUES: For each bar, read its height from the y-axis scale
4. DOUBLE-CHECK: Verify your color/pattern matching is correct - this is the #1 source of errors

Common mistake to AVOID: Swapping which bar represents which category (e.g., confusing "trade policy" bars with "general economic policy" bars)

**When analyzing line graphs on coordinate planes (CRITICAL for Math questions):**
1. IDENTIFY THE Y-INTERCEPT: Find where the line crosses the y-axis (the point where x=0)
2. FIND TWO CLEAR POINTS: Locate two points on the line that fall exactly on grid intersections
3. CALCULATE THE SLOPE: slope = rise/run = (y2-y1)/(x2-x1). Count grid squares carefully.
   - If line goes DOWN from left to right → slope is NEGATIVE
   - If line goes UP from left to right → slope is POSITIVE
4. VERIFY STEEPNESS: A slope of -1 means for every 1 unit right, line goes 1 unit down.
   A slope of -2 means for every 1 unit right, line goes 2 units down (steeper).
5. MATCH TO EQUATION: Use y = mx + b form where m=slope, b=y-intercept

Common mistakes to AVOID:
- Confusing slope magnitude: -1 vs -2 look similar but -2 is TWICE as steep
- Getting slope sign wrong: check if line rises or falls left-to-right
- Misreading the y-intercept value from the axis

**${section} Questions to verify:**
${JSON.stringify(questionsJson, null, 2)}

**Output format (JSON only):**
{
  "verifications": [
    {
      "questionNumber": 1,
      "wasCorrect": true,
      "verifiedAnswer": "B",
      "explanation": "Brief explanation of why this is correct",
      "confidence": "high"
    }
  ]
}

- wasCorrect: true if proposedAnswer matches your verified answer
- verifiedAnswer: Your determined correct answer (A/B/C/D for MC, numeric for free response)
- confidence: "high", "medium", or "low" based on your certainty

Return ONLY valid JSON. No markdown code fences.`;
    },

    parseVerificationResponse(text: string): BatchVerificationResponse {
        let jsonText = text.trim();
        
        // Step 1: Strip markdown code fences
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
        }
        
        // Step 2: Try direct parse
        try {
            return JSON.parse(jsonText);
        } catch {
            // Step 3: Extract JSON from prose using brace matching
            const firstBrace = jsonText.indexOf('{');
            const lastBrace = jsonText.lastIndexOf('}');
            
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                const jsonCandidate = jsonText.substring(firstBrace, lastBrace + 1);
                try {
                    const parsed = JSON.parse(jsonCandidate);
                    // Validate structure has verifications array
                    if (parsed.verifications && Array.isArray(parsed.verifications)) {
                        console.log('[pdfService] Extracted JSON from prose response');
                        return parsed;
                    }
                } catch {
                    // Fall through to error
                }
            }
            
            console.error('Failed to parse verification response:', jsonText.substring(0, 200));
            return { verifications: [] };
        }
    }
};
