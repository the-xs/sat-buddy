import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { pdfService } from '@/lib/services/pdfService';

// POST /api/upload - Upload and parse PDF (async)
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('pdf') as File | null;

        if (!file) {
            return NextResponse.json(
                { success: false, error: 'No file provided' },
                { status: 400 }
            );
        }

        // Ensure temp directory exists
        const tempDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'public', 'uploads', 'temp');
        await mkdir(tempDir, { recursive: true });

        // Save file temporarily
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileId = `${Date.now()}-${file.name}`;
        const tempPath = path.join(tempDir, fileId);
        await writeFile(tempPath, buffer);

        // Initialize progress tracking
        pdfService.updateProgress(fileId, 'Starting...', 0);

        // Start parsing in background (don't await)
        pdfService.parsePDF(tempPath, file.name).catch(error => {
            console.error('Background PDF parsing error:', error);
        });

        // Return immediately with file ID for polling
        return NextResponse.json({
            success: true,
            fileId: fileId,
            message: 'Upload started, poll for progress'
        });
    } catch (error) {
        console.error('Error uploading PDF:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload PDF' },
            { status: 500 }
        );
    }
}

// GET /api/upload?file=filename - Get upload progress and logs
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const filename = searchParams.get('file');

        if (!filename) {
            return NextResponse.json(
                { success: false, error: 'Filename required' },
                { status: 400 }
            );
        }

        const progress = pdfService.getProgress(filename);
        return NextResponse.json({
            success: true,
            data: {
                status: progress.status,
                progress: progress.progress,
                logs: progress.logs || [],
                result: progress.result
            }
        });
    } catch (error) {
        console.error('Error getting progress:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get progress' },
            { status: 500 }
        );
    }
}
