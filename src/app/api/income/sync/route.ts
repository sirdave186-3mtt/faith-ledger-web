import { NextResponse } from 'next/server';
import { appendInflowToGoogleSheet } from '@/lib/sheets/sync';

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        if (!payload.service_date || payload.total_inflow === undefined) {
            return NextResponse.json(
                { error: 'Missing required collection fields' },
                { status: 400 }
            );
        }

        // Call Google Sheets API server-side
        await appendInflowToGoogleSheet({
            id: payload.id,
            service_date: payload.service_date,
            service_type: payload.service_type,
            tithe: Number(payload.tithe) || 0,
            offering: Number(payload.offering) || 0,
            thanksgiving: Number(payload.thanksgiving) || 0,
            seed: Number(payload.seed) || 0,
            other_inflows: Number(payload.other_inflows) || 0,
            total_inflow: Number(payload.total_inflow) || 0,
            yypc_remittance: Number(payload.yypc_remittance) || 0,
            net_inflow: Number(payload.net_inflow) || 0,
            recorded_by: payload.recorded_by,
            notes: payload.notes,
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Google Sheets Sync API Error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to sync record to Google Sheets' },
            { status: 500 }
        );
    }
}