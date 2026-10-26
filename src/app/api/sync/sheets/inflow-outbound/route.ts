import { NextRequest, NextResponse } from 'next/server';
import { appendInflowToGoogleSheet } from '@/lib/sheets/sync';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

        if (!spreadsheetId) {
            return NextResponse.json({ error: 'Spreadsheet ID not configured' }, { status: 500 });
        }

        await appendInflowToGoogleSheet(spreadsheetId, {
            transactionId: body.transactionId,
            date: body.date,
            serviceType: body.serviceType,
            tithe: body.tithe,
            offering: body.offering,
            thanksgiving: body.thanksgiving,
            seed: body.seed,
            otherInflows: body.otherInflows,
            yypcRemittance: body.yypcRemittance,
            recordedBy: body.recordedBy,
            notes: body.notes || '',
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Outbound inflow sync failed:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}