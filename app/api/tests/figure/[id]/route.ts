import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/tests/figure/[id] - Get figure by QuestionSet ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const questionSetId = parseInt(id);

        if (isNaN(questionSetId)) {
            return NextResponse.json({ error: 'Invalid QuestionSet ID' }, { status: 400 });
        }

        // Fetch QuestionSet with figure data
        const questionSet = await prisma.questionSet.findUnique({
            where: { id: questionSetId },
            select: {
                hasFigure: true,
                figureData: true,
            }
        });

        if (!questionSet) {
            return NextResponse.json({ error: 'QuestionSet not found' }, { status: 404 });
        }

        if (!questionSet.hasFigure || !questionSet.figureData) {
            return NextResponse.json({ error: 'QuestionSet has no figure' }, { status: 404 });
        }

        // Decode base64 to buffer
        const imageBuffer = Buffer.from(questionSet.figureData, 'base64');

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
