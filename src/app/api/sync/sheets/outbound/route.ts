import { NextRequest, NextResponse } from 'next/server';
import { appendExpenseToGoogleSheet } from '@/lib/sheets/sync';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

        if (!spreadsheetId) {
            return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
        }

        await appendExpenseToGoogleSheet(spreadsheetId, {
            requestId: body.requestId,
            date: new Date().toISOString().split('T')[0],
            sundayServiceTag: body.sundayServiceTag,
            category: body.category,
            description: body.description,
            amount: body.amount,
            complianceSignoff: 'Admin 1',
            executiveApprovedBy: 'Senior Pastor',
            disbursedBy: body.disbursedByRole.toUpperCase(),
            receiptDriveUrl: body.receiptUrl || '',
            status: 'Disbursed',
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Outbound sheet append error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}