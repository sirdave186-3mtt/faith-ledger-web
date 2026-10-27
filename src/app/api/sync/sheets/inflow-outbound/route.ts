import { NextResponse } from 'next/server';
import { appendInflowToGoogleSheet } from '@/lib/sheets/sync';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        if (!body || !body.service_date) {
            return NextResponse.json(
                { error: 'Missing required collection data' },
                { status: 400 }
            );
        }

        // appendInflowToGoogleSheet expects exactly ONE argument: an object
        await appendInflowToGoogleSheet({
            id: body.id,
            service_date: body.service_date,
            service_type: body.service_type,
            tithe: Number(body.tithe) || 0,
            offering: Number(body.offering) || 0,
            thanksgiving: Number(body.thanksgiving) || 0,
            seed: Number(body.seed) || 0,
            other_inflows: Number(body.other_inflows) || 0,
            total_inflow: Number(body.total_inflow) || 0,
            yypc_remittance: Number(body.yypc_remittance) || 0,
            net_inflow: Number(body.net_inflow) || 0,
            recorded_by: body.recorded_by,
            notes: body.notes,
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('Inflow Outbound Sheet Sync Error:', err);
        return NextResponse.json(
            { error: err.message || 'Failed to sync inflow to Google Sheets' },
            { status: 500 }
        );
    }
}