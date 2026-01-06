import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const questionId = parseInt(id);

        if (isNaN(questionId)) {
            return NextResponse.json({ error: 'Invalid question ID' }, { status: 400 });
        }

        // Fetch question with figure data
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            select: {
                hasFigure: true,
                figureData: true,
            }
        });

        if (!question) {
            return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }

        if (!question.hasFigure || !question.figureData) {
            return NextResponse.json({ error: 'Question has no figure' }, { status: 404 });
        }

        // Decode base64 to buffer
        const imageBuffer = Buffer.from(question.figureData, 'base64');

        return new NextResponse(new Uint8Array(imageBuffer), {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000'
            }
        });
    } catch (error) {
        console.error('Error fetching figure:', error);
        return NextResponse.json(
            { error: 'Failed to fetch figure' },
            { status: 500 }
        );
    }
}
