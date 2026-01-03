import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { pdfService } from '@/lib/services/pdfService';

// POST /api/upload - Upload and parse PDF
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
        const tempPath = path.join(tempDir, `${Date.now()}-${file.name}`);
        await writeFile(tempPath, buffer);

        // Start parsing (returns immediately, parsing happens in background)
        const result = await pdfService.parsePDF(tempPath, file.name);

        return NextResponse.json({
            success: true,
            data: result,
            message: 'PDF parsed successfully'
        });
    } catch (error) {
        console.error('Error uploading PDF:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to upload PDF' },
            { status: 500 }
        );
    }
}

// GET /api/upload?file=filename - Get upload progress
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
        return NextResponse.json({ success: true, data: progress });
    } catch (error) {
        console.error('Error getting progress:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get progress' },
            { status: 500 }
        );
    }
}
