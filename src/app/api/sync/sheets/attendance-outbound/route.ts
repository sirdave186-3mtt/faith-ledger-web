import { NextRequest, NextResponse } from 'next/server';
import { appendAttendanceToGoogleSheet } from '@/lib/sheets/sync';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

        if (!spreadsheetId) {
            return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
        }

        await appendAttendanceToGoogleSheet(spreadsheetId, {
            date: body.date,
            serviceTitle: body.serviceTitle,
            men: body.men,
            women: body.women,
            children: body.children,
            totalAttendance: body.totalAttendance,
            firstTimers: body.firstTimers,
            notes: body.notes || '',
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Outbound attendance sync failed:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}