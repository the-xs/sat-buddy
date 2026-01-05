import { NextResponse } from 'next/server';
import { satTestService } from '@/lib/services/satTestService';

// Force dynamic rendering - this route requires database access
export const dynamic = 'force-dynamic';

// GET /api/tests - Get all tests
export async function GET() {
    try {
        const tests = await satTestService.getAllTests();
        return NextResponse.json({ success: true, data: tests });
    } catch (error) {
        console.error('Error fetching tests:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch tests' },
            { status: 500 }
        );
    }
}
