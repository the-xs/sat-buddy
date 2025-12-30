import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import prisma from '../config/database.js';
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// Upload directories
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PDF_DIR = path.join(UPLOADS_DIR, 'pdfs');
const FIGURES_DIR = path.join(UPLOADS_DIR, 'figures');

// In-memory progress storage
const progressMap = new Map();

export const pdfService = {
    // Get progress for a specific file
    getProgress(filename) {
        return progressMap.get(filename) || { status: 'starting', progress: 0 };
    },

    // Update progress for a file
    updateProgress(filename, status, progress, result = null) {
        progressMap.set(filename, { status, progress, result, timestamp: Date.now() });
        // Clean up old entries (older than 10 minutes)
        for (const [key, value] of progressMap.entries()) {
            if (Date.now() - value.timestamp > 10 * 60 * 1000) {
                progressMap.delete(key);
            }
        }
    },

    // Parse PDF and store in database
    async parsePDF(filePath, originalName) {
        const fileId = path.basename(filePath);
        try {
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
            const moduleConfigs = [
                { section: 'ReadingWriting', moduleNumber: 1, promptSuffix: 'Reading and Writing Module 1' },
                { section: 'ReadingWriting', moduleNumber: 2, promptSuffix: 'Reading and Writing Module 2' },
                { section: 'Math', moduleNumber: 1, promptSuffix: 'Math Module 1' },
                { section: 'Math', moduleNumber: 2, promptSuffix: 'Math Module 2' }
            ];

            const extractedModules = [];
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
                const figureCount = result.questions.filter(q => q.hasFigure).length;
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
            const parsedData = {
                testName: testName,
                modules: extractedModules
            };

            // Clean up Gemini file
            await fileManager.deleteFile(uploadResult.file.name);
            console.log('🗑️  Cleaned up Gemini file');

            // Store in database
            this.updateProgress(fileId, 'Saving to database...', 95);
            const satTest = await this.storeInDatabase(parsedData, pdfFilename, originalName);

            this.updateProgress(fileId, 'Complete!', 100, satTest);
            return satTest;
        } catch (error) {
            this.updateProgress(fileId, `Error: ${error.message}`, -1);
            console.error('PDF parsing error:', error);
            throw error;
        }
    },

    // Extract a specific module using Gemini
    async extractModuleWithGemini(file, config) {
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

    // Store parsed data in database
    async storeInDatabase(parsedData, pdfFilename, originalName) {
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
                                optionA: q.optionA || null,
                                optionB: q.optionB || null,
                                optionC: q.optionC || null,
                                optionD: q.optionD || null,
                                correctAnswer: String(q.correctAnswer),
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
    },

    // Test parsing without saving to database
    async testParse(filePath) {
        try {
            console.log('📄 Test parsing PDF with Gemini 3 Flash...');

            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType: 'application/pdf',
                displayName: 'Test Parse'
            });

            const moduleConfigs = [
                { section: 'ReadingWriting', moduleNumber: 1, promptSuffix: 'Reading and Writing Module 1' },
                { section: 'Math', moduleNumber: 1, promptSuffix: 'Math Module 1' }
            ];

            const extractedModules = [];
            for (const config of moduleConfigs) {
                const result = await this.extractModuleWithGemini(uploadResult.file, config);
                extractedModules.push({
                    section: config.section,
                    moduleNumber: config.moduleNumber,
                    questions: result.questions
                });
            }

            await fileManager.deleteFile(uploadResult.file.name);
            await fs.unlink(filePath);

            return {
                testName: 'Test Parse',
                modules: extractedModules
            };
        } catch (error) {
            try { await fs.unlink(filePath); } catch { }
            throw error;
        }
    },

    // Get cropped figure image for a question
    async getFigureImage(questionId) {
        try {
            // Get question with its module and test info
            const question = await prisma.question.findUnique({
                where: { id: parseInt(questionId) },
                include: {
                    module: {
                        include: {
                            test: true
                        }
                    }
                }
            });

            if (!question) {
                throw new Error('Question not found');
            }

            if (!question.hasFigure || !question.figurePageNumber || !question.figureBoundingBox) {
                throw new Error('Question does not have figure data');
            }

            // Check if cached figure exists
            const cacheFilename = `figure-q${questionId}.png`;
            const cachePath = path.join(FIGURES_DIR, cacheFilename);

            try {
                await fs.access(cachePath);
                // Cache exists, return the cached file
                return { path: cachePath, cached: true };
            } catch {
                // Cache doesn't exist, generate the figure
            }

            // Ensure figures directory exists
            await fs.mkdir(FIGURES_DIR, { recursive: true });

            // Get PDF path
            const pdfPath = path.join(PDF_DIR, question.module.test.pdfFilename);

            // Convert PDF page to image using pdf2pic
            const convert = fromPath(pdfPath, {
                density: 200,           // DPI for quality
                saveFilename: `temp-q${questionId}`,
                savePath: FIGURES_DIR,
                format: 'png',
                width: 1200,            // Output width
                height: 1600            // Output height
            });

            // Convert the specific page (pdf2pic is 1-indexed)
            const pageResult = await convert(question.figurePageNumber);
            const tempImagePath = pageResult.path;

            // Get image dimensions for cropping
            const metadata = await sharp(tempImagePath).metadata();
            const imgWidth = metadata.width;
            const imgHeight = metadata.height;

            // Parse bounding box (stored as JSON string: [ymin, xmin, ymax, xmax])
            const boundingBox = JSON.parse(question.figureBoundingBox);
            const [ymin, xmin, ymax, xmax] = boundingBox;

            // Convert normalized coordinates (0-1000) to pixel coordinates
            const top = Math.max(0, Math.floor((ymin / 1000) * imgHeight));
            const left = Math.max(0, Math.floor((xmin / 1000) * imgWidth));
            const width = Math.min(imgWidth - left, Math.ceil(((xmax - xmin) / 1000) * imgWidth));
            const height = Math.min(imgHeight - top, Math.ceil(((ymax - ymin) / 1000) * imgHeight));

            // Crop and save the figure
            await sharp(tempImagePath)
                .extract({
                    left,
                    top,
                    width: Math.max(1, width),
                    height: Math.max(1, height)
                })
                .toFile(cachePath);

            // Clean up temp file
            try {
                await fs.unlink(tempImagePath);
            } catch {
                // Ignore cleanup errors
            }

            console.log(`✅ Generated figure for question ${questionId}: ${cacheFilename}`);
            return { path: cachePath, cached: false };
        } catch (error) {
            console.error('Error generating figure:', error);
            throw error;
        }
    }
};
