import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import prisma from '@/lib/prisma';
import sharp from 'sharp';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY || '');

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

interface ParsedQuestion {
    questionNumber: number;
    questionType: string;
    questionText: string;
    topic?: string;
    difficulty?: string;
    hasFigure?: boolean;
    figureDescription?: string;
    pageNumber?: number;
    boundingBox?: number[];
    figureData?: string; // Base64-encoded PNG
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctAnswer: string;
    explanation?: string;
}

interface ParsedModule {
    section: string;
    moduleNumber: number;
    questions: ParsedQuestion[];
}

interface ParsedData {
    testName: string;
    modules: ParsedModule[];
}

export const pdfService = {
    // Get progress for a specific file
    getProgress(filename: string) {
        return progressMap.get(filename) || { status: 'starting', progress: 0, logs: [] };
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

            // Move PDF to permanent storage
            const pdfFilename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const permanentPath = path.join(PDF_DIR, pdfFilename);
            await fs.copyFile(filePath, permanentPath);
            await fs.unlink(filePath);

            console.log(`📁 Stored PDF at: ${permanentPath}`);
            this.updateProgress(fileId, 'Uploading to Gemini AI...', 15);

            // Upload PDF to Gemini
            console.log('⬆️  Uploading PDF to Gemini...');
            const uploadResult = await fileManager.uploadFile(permanentPath, {
                mimeType: 'application/pdf',
                displayName: originalName
            });

            console.log(`✅ Uploaded to Gemini: ${uploadResult.file.uri}`);

            // Define modules to extract
            const moduleConfigs: ModuleConfig[] = [
                { section: 'ReadingWriting', moduleNumber: 1, promptSuffix: 'Reading and Writing Module 1' },
                { section: 'ReadingWriting', moduleNumber: 2, promptSuffix: 'Reading and Writing Module 2' },
                { section: 'Math', moduleNumber: 1, promptSuffix: 'Math Module 1' },
                { section: 'Math', moduleNumber: 2, promptSuffix: 'Math Module 2' }
            ];

            const extractedModules: ParsedModule[] = [];
            let testName = originalName.replace('.pdf', '').replace(/[_-]/g, ' ');

            // Extract each module sequentially
            for (let i = 0; i < moduleConfigs.length; i++) {
                const config = moduleConfigs[i];
                const progressVal = 25 + (i * 15); // 25, 40, 55, 70
                this.updateProgress(fileId, `Extracting ${config.section} Module ${config.moduleNumber}...`, progressVal);

                console.log(`🔍 Extracting ${config.section} Module ${config.moduleNumber}...`);
                const result = await this.extractModuleWithGemini(uploadResult.file, config);

                if (result.testName && !testName) testName = result.testName;

                // Log figure detections
                const figureCount = result.questions.filter((q: ParsedQuestion) => q.hasFigure).length;
                if (figureCount > 0) {
                    console.log(`   📊 Detected ${figureCount} questions with figures`);
                }

                extractedModules.push({
                    section: config.section,
                    moduleNumber: config.moduleNumber,
                    questions: result.questions
                });

                console.log(`   ✅ Extracted ${result.questions.length} questions for ${config.section} Module ${config.moduleNumber}`);
            }

            this.updateProgress(fileId, 'Cleaning up and saving...', 85);
            const parsedData: ParsedData = {
                testName: testName,
                modules: extractedModules
            };

            // Clean up Gemini file
            await fileManager.deleteFile(uploadResult.file.name);
            console.log('🗑️  Cleaned up Gemini file');

            // Extract figures from PDF
            this.updateProgress(fileId, 'Extracting figures...', 80);
            await this.extractFiguresFromPdf(fileId, permanentPath, extractedModules);

            // Store in database
            this.updateProgress(fileId, 'Saving to database...', 95);
            const satTest = await this.storeInDatabase(parsedData, pdfFilename, originalName);

            this.updateProgress(fileId, 'Complete!', 100, satTest);
            return satTest;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.updateProgress(fileId, `Error: ${errorMessage}`, -1);
            console.error('PDF parsing error:', error);
            throw error;
        }
    },

    // Extract a specific module using Gemini
    async extractModuleWithGemini(file: { mimeType: string; uri: string; name: string }, config: ModuleConfig) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

            const prompt = `You are an expert SAT test parser. Extract questions ONLY for "${config.promptSuffix}" from this PDF.

**YOUR TASK:**
Extract EVERY question for this specific module.

1. **Question Number**: The number of the question within this module.
2. **Question Type**: "MultipleChoice" (A, B, C, D) or "FreeResponse" (usually Math).
3. **Question Text**: Complete text.
4. **Options**: For MultipleChoice, provide A, B, C, D. For FreeResponse, list these as null.
5. **Correct Answer**: The letter (A, B, C, or D) or the numeric value for FreeResponse.
6. **Figure Handling**:
   - **hasFigure**: true if there is a diagram, chart, graph, or geometric figure.
   - **figureDescription**: A detailed description of the figure that would allow someone to recreate it.
   - **pageNumber**: The page number in the PDF (1-indexed) where this figure is located.
   - **boundingBox**: The precise [ymin, xmin, ymax, xmax] coordinates of the figure as normalized values (0-1000).

**OUTPUT FORMAT - Return valid JSON:**
{
  "testName": "The name of the test if found",
  "questions": [
    {
      "questionNumber": 1,
      "questionType": "MultipleChoice" or "FreeResponse",
      "questionText": "full question text",
      "topic": "SAT Topic (e.g., Heart of Algebra, Rhetoric, Standard English Conventions)",
      "difficulty": "Easy", "Medium", or "Hard",
      "hasFigure": true or false,
      "figureDescription": "detailed description" or null,
      "pageNumber": integer or null,
      "boundingBox": [ymin, xmin, ymax, xmax] or null,
      "optionA": "option A text" or null,
      "optionB": "option B text" or null,
      "optionC": "option C text" or null,
      "optionD": "option D text" or null,
      "correctAnswer": "A/B/C/D" or "answer",
      "explanation": "text"
    }
  ]
}

Return ONLY valid JSON. No conversational text.`;

            const result = await model.generateContent([
                {
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri
                    }
                },
                { text: prompt }
            ]);

            if (!result.response) {
                console.error(`   ❌ No response from Gemini for ${config.promptSuffix}`);
                return { questions: [] };
            }

            const responseText = result.response.text();
            if (!responseText) {
                console.error(`   ❌ Empty response text from Gemini for ${config.promptSuffix}`);
                return { questions: [] };
            }

            let jsonText = responseText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
            }

            return JSON.parse(jsonText);
        } catch (error) {
            console.error(`Error extracting ${config.promptSuffix}:`, error);
            return { questions: [] };
        }
    },

    // Extract figures from PDF and add base64 data to questions
    async extractFiguresFromPdf(fileId: string, pdfPath: string, modules: ParsedModule[]) {
        try {
            // Collect all questions with figures
            const questionsWithFigures: { question: ParsedQuestion; moduleIndex: number; questionIndex: number }[] = [];

            modules.forEach((module, moduleIndex) => {
                module.questions.forEach((question, questionIndex) => {
                    if (question.hasFigure && question.pageNumber && question.boundingBox?.length === 4) {
                        questionsWithFigures.push({ question, moduleIndex, questionIndex });
                    }
                });
            });

            if (questionsWithFigures.length === 0) {
                console.log('   ℹ️  No figures to extract');
                return;
            }

            console.log(`   📊 Extracting ${questionsWithFigures.length} figures from PDF...`);

            // Get unique page numbers needed
            const pageNumbers = [...new Set(questionsWithFigures.map(q => q.question.pageNumber!))];
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

            // Process each question with a figure
            for (const { question, moduleIndex, questionIndex } of questionsWithFigures) {
                try {
                    const pageImage = pageImages.get(question.pageNumber!);
                    if (!pageImage) continue;

                    const boundingBox = question.boundingBox!;
                    const metadata = await sharp(pageImage).metadata();
                    const imageWidth = metadata.width || 1;
                    const imageHeight = metadata.height || 1;

                    // Calculate crop coordinates from normalized bounding box (0-1000)
                    const [ymin, xmin, ymax, xmax] = boundingBox;
                    const cropX = Math.max(0, Math.round((xmin / 1000) * imageWidth));
                    const cropY = Math.max(0, Math.round((ymin / 1000) * imageHeight));
                    const cropWidth = Math.max(1, Math.round(((xmax - xmin) / 1000) * imageWidth));
                    const cropHeight = Math.max(1, Math.round(((ymax - ymin) / 1000) * imageHeight));

                    const croppedBuffer = await sharp(pageImage)
                        .extract({
                            left: Math.min(cropX, imageWidth - 1),
                            top: Math.min(cropY, imageHeight - 1),
                            width: Math.min(cropWidth, imageWidth - cropX),
                            height: Math.min(cropHeight, imageHeight - cropY)
                        })
                        .png()
                        .toBuffer();

                    // Store base64 data in the question
                    modules[moduleIndex].questions[questionIndex].figureData = croppedBuffer.toString('base64');
                    console.log(`      ✅ Extracted figure for Q${question.questionNumber}`);
                } catch (err) {
                    console.error(`      ❌ Error extracting figure for Q${question.questionNumber}:`, err);
                }
            }

            console.log('   ✅ Figure extraction complete');
        } catch (error) {
            console.error('Error extracting figures from PDF:', error);
            // Don't throw - figures are optional
        }
    },

    // Store parsed data in database
    async storeInDatabase(parsedData: ParsedData, pdfFilename: string, originalName: string) {
        console.log('💾 Storing in database...');

        const satTest = await prisma.sATTest.create({
            data: {
                name: parsedData.testName || `SAT Practice Test - ${new Date().toLocaleDateString()}`,
                pdfFilename: pdfFilename,
                originalName: originalName,
                modules: {
                    create: parsedData.modules.map(module => ({
                        section: module.section,
                        moduleNumber: module.moduleNumber,
                        questions: {
                            create: module.questions.map(q => ({
                                questionNumber: q.questionNumber,
                                questionType: q.questionType,
                                questionText: q.questionText,
                                hasFigure: q.hasFigure || false,
                                figurePageNumber: q.pageNumber || null,
                                figureBoundingBox: q.boundingBox ? JSON.stringify(q.boundingBox) : null,
                                figureCaption: q.figureDescription || null,
                                figureData: q.figureData || null,
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
                modules: {
                    include: {
                        questions: true
                    }
                }
            }
        });

        console.log(`\n📊 Database Storage Complete: Test ID: ${satTest.id}`);
        return satTest;
    }
};
