import { NextRequest, NextResponse } from 'next/server';
import { satTestService } from '@/lib/services/satTestService';

// GET /api/tests/[id] - Get single test
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        const test = await satTestService.getTestById(id);

        if (!test) {
            return NextResponse.json(
                { success: false, error: 'Test not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: test });
    } catch (error) {
        console.error('Error fetching test:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch test' },
            { status: 500 }
        );
    }
}

// DELETE /api/tests/[id] - Delete a test
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        await satTestService.deleteTest(id);
        return NextResponse.json({ success: true, message: 'Test deleted' });
    } catch (error) {
        console.error('Error deleting test:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete test' },
            { status: 500 }
        );
    }
}
