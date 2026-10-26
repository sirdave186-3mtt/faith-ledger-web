import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin client with service_role to bypass RLS for backend sync
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SheetsEditPayload {
    sheetName: 'INCOME_LEDGER' | 'EXPENSE_REQUISITIONS' | string;
    row: number;
    col: number;
    oldValue: string | number | null;
    newValue: string | number | null;
    rowData: (string | number | null)[];
    editedBy: string;
    timestamp: string;
}

/**
 * Timing-safe header validation
 */
function isValidSecret(providedSecret: string | null): boolean {
    const expectedSecret = process.env.SHEETS_SYNC_SECRET;
    if (!providedSecret || !expectedSecret) return false;

    const providedBuffer = Buffer.from(providedSecret);
    const expectedBuffer = Buffer.from(expectedSecret);

    if (providedBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(req: NextRequest) {
    try {
        // 1. Verify shared HMAC/Secret header
        const authHeader = req.headers.get('x-sheets-sync-secret');
        if (!isValidSecret(authHeader)) {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid or missing sync secret' },
                { status: 401 }
            );
        }

        const payload: SheetsEditPayload = await req.json();
        const { sheetName, row, rowData, editedBy, oldValue, newValue } = payload;

        const defaultTenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'org_hol_kubwa';

        // 2. Process INCOME_LEDGER modifications
        if (sheetName === 'INCOME_LEDGER') {
            // Expected layout:
            // [0] Transaction ID | [1] Date | [2] Service Type | [3] Tithe | [4] Offering
            // [5] Thanksgiving | [6] Seed | [7] Other Inflows | [8] Total Inflow
            // [9] YYPC Remittance | [10] Net Inflow | [11] Recorded By | [12] Notes
            const transactionId = rowData[0]?.toString()?.trim();

            if (!transactionId || transactionId === 'Transaction ID') {
                return NextResponse.json({ message: 'Header or unindexed row ignored' }, { status: 200 });
            }

            const updateData = {
                service_date: rowData[1] ? new Date(String(rowData[1])).toISOString().split('T')[0] : undefined,
                tithe: Number(rowData[3]) || 0,
                offering: Number(rowData[4]) || 0,
                thanksgiving: Number(rowData[5]) || 0,
                seed: Number(rowData[6]) || 0,
                other_inflows: Number(rowData[7]) || 0,
                yypc_remittance: Number(rowData[9]) || 0,
                notes: rowData[12] ? String(rowData[12]) : null,
            };

            const { data: updatedRecord, error: updateError } = await supabaseAdmin
                .from('inflow_records')
                .update(updateData)
                .eq('id', transactionId)
                .eq('tenant_id', defaultTenantId)
                .select()
                .single();

            if (updateError) {
                console.error('Supabase update failed for inflow_records:', updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }

            // Log to Audit Trail
            await supabaseAdmin.from('audit_logs').insert({
                tenant_id: defaultTenantId,
                action: 'UPDATED_VIA_GOOGLE_SHEETS',
                entity_name: 'inflow_records',
                entity_id: transactionId,
                metadata_diff: {
                    sheet_row: row,
                    edited_by: editedBy,
                    old_value: oldValue,
                    new_value: newValue,
                    updated_fields: updateData,
                },
            });

            return NextResponse.json({ success: true, record: updatedRecord });
        }

        // 3. Process EXPENSE_REQUISITIONS modifications
        if (sheetName === 'EXPENSE_REQUISITIONS') {
            // Expected layout:
            // [0] Request ID | [1] Date | [2] Sunday Service Tag | [3] Category
            // [4] Vendor / Description | [5] Amount | [6] Compliance Signoff
            // [7] Executive Approval | [8] Disbursed By | [9] Receipt Link | [10] Status
            const requestId = rowData[0]?.toString()?.trim();

            if (!requestId || requestId === 'Request ID') {
                return NextResponse.json({ message: 'Header or unindexed row ignored' }, { status: 200 });
            }

            const rawCategory = rowData[3]?.toString()?.toLowerCase().trim();
            const validCategories = ['allowances', 'welfare', 'utilities', 'fuel', 'capital_special'];
            const category = validCategories.includes(rawCategory || '') ? rawCategory : undefined;

            const updateData = {
                description: rowData[4] ? String(rowData[4]) : undefined,
                amount: rowData[5] !== undefined ? Number(rowData[5]) : undefined,
                category: category,
                receipt_drive_url: rowData[9] ? String(rowData[9]) : undefined,
                updated_at: new Date().toISOString(),
            };

            // Filter out undefined fields to prevent accidental overwrites
            const cleanedUpdates = Object.fromEntries(
                Object.entries(updateData).filter(([_, v]) => v !== undefined)
            );

            const { data: updatedExpense, error: expenseError } = await supabaseAdmin
                .from('expense_requisitions')
                .update(cleanedUpdates)
                .eq('id', requestId)
                .eq('tenant_id', defaultTenantId)
                .select()
                .single();

            if (expenseError) {
                console.error('Supabase update failed for expense_requisitions:', expenseError);
                return NextResponse.json({ error: expenseError.message }, { status: 500 });
            }

            // Log to Audit Trail
            await supabaseAdmin.from('audit_logs').insert({
                tenant_id: defaultTenantId,
                action: 'UPDATED_VIA_GOOGLE_SHEETS',
                entity_name: 'expense_requisitions',
                entity_id: requestId,
                metadata_diff: {
                    sheet_row: row,
                    edited_by: editedBy,
                    old_value: oldValue,
                    new_value: newValue,
                    updated_fields: cleanedUpdates,
                },
            });

            return NextResponse.json({ success: true, record: updatedExpense });
        }

        return NextResponse.json({ message: `Sheet '${sheetName}' ignored` }, { status: 200 });
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: 'Internal server error processing sheet sync' },
            { status: 500 }
        );
    }
}