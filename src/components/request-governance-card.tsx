'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, X, ShieldAlert, CreditCard } from 'lucide-react';

interface RequestGovernanceCardProps {
    requisition: {
        id: string;
        amount: number;
        category: string;
        description: string;
        status: string;
        sunday_service_tag: string;
    };
    currentUserRole: 'senior_pastor' | 'admin_1' | 'admin_2' | 'treasurer_1' | 'treasurer_2';
    onStatusUpdated: () => void;
}

export default function RequestGovernanceCard({
    requisition,
    currentUserRole,
    onStatusUpdated,
}: RequestGovernanceCardProps) {
    const supabase = createClient();
    const [paymentRef, setPaymentRef] = useState('');
    const [loading, setLoading] = useState(false);

    // Rule 2: Admin 1 Compliance Sign-off
    const handleComplianceSignoff = async (approved: boolean) => {
        setLoading(true);
        const nextStatus = approved ? 'pending_executive_approval' : 'rejected';

        await supabase
            .from('expense_requisitions')
            .update({
                status: nextStatus,
                compliance_cleared_at: new Date().toISOString(),
            })
            .eq('id', requisition.id);

        setLoading(false);
        onStatusUpdated();
    };

    // Rule 3: Executive Approval (Senior Pastor or Admin 2 delegate)
    const handleExecutiveApproval = async (approved: boolean) => {
        setLoading(true);
        const nextStatus = approved ? 'approved_for_disbursement' : 'rejected';

        await supabase
            .from('expense_requisitions')
            .update({
                status: nextStatus,
                approved_at: new Date().toISOString(),
            })
            .eq('id', requisition.id);

        setLoading(false);
        onStatusUpdated();
    };

    // Rule 4: Treasurer Disbursement Execution (Triggers Google Sheet sync)
    const handleDisbursement = async () => {
        if (!paymentRef.trim()) return;
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();

        // 1. Mark as disbursed in Supabase
        await supabase
            .from('expense_requisitions')
            .update({
                status: 'disbursed',
                disbursed_at: new Date().toISOString(),
                payment_reference: paymentRef,
            })
            .eq('id', requisition.id);

        // 2. Outbound sync trigger to Admin 1's Google Sheet
        await fetch('/api/sync/sheets/outbound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requestId: requisition.id,
                amount: requisition.amount,
                category: requisition.category,
                description: requisition.description,
                sundayServiceTag: requisition.sunday_service_tag,
                paymentReference: paymentRef,
                disbursedByRole: currentUserRole,
            }),
        });

        setLoading(false);
        onStatusUpdated();
    };

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Governance Stage</span>
                    <p className="text-sm font-bold text-slate-200 capitalize">
                        {requisition.status.replace(/_/g, ' ')}
                    </p>
                </div>
                <span className="text-xs font-mono text-amber-400 font-semibold">
                    Role: {currentUserRole.replace('_', ' ').toUpperCase()}
                </span>
            </div>

            <div className="mt-4">
                {/* RULE 2 ACTIONS: Admin 1 */}
                {requisition.status === 'pending_compliance' && currentUserRole === 'admin_1' && (
                    <div className="space-y-3">
                        <p className="text-xs text-slate-300">
                            Verify quotes, invoice authenticity, and budget caps before releasing to the Pastor.
                        </p>
                        <div className="flex gap-2">
                            <button
                                disabled={loading}
                                onClick={() => handleComplianceSignoff(true)}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                            >
                                <Check className="h-4 w-4" /> Pass Compliance
                            </button>
                            <button
                                disabled={loading}
                                onClick={() => handleComplianceSignoff(false)}
                                className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-600/20 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 border border-rose-500/30"
                            >
                                <X className="h-4 w-4" /> Reject
                            </button>
                        </div>
                    </div>
                )}

                {/* RULE 3 ACTIONS: Senior Pastor or Admin 2 delegate */}
                {requisition.status === 'pending_executive_approval' &&
                    (currentUserRole === 'senior_pastor' || currentUserRole === 'admin_2') && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-300">
                                Executive sign-off required to authorize disbursement of funds.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={loading}
                                    onClick={() => handleExecutiveApproval(true)}
                                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                                >
                                    <Check className="h-4 w-4" /> Authorize Fund Release
                                </button>
                                <button
                                    disabled={loading}
                                    onClick={() => handleExecutiveApproval(false)}
                                    className="flex items-center justify-center gap-1.5 rounded-lg bg-rose-600/20 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 border border-rose-500/30"
                                >
                                    <X className="h-4 w-4" /> Decline
                                </button>
                            </div>
                        </div>
                    )}

                {/* RULE 4 ACTIONS: Treasurer 1 or 2 */}
                {requisition.status === 'approved_for_disbursement' &&
                    (currentUserRole === 'treasurer_1' || currentUserRole === 'treasurer_2') && (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-300">
                                Execute the bank transfer and input the bank debit/transaction reference.
                            </p>
                            <input
                                type="text"
                                placeholder="Bank Transfer / Session ID Reference"
                                value={paymentRef}
                                onChange={(e) => setPaymentRef(e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                            />
                            <button
                                disabled={loading || !paymentRef.trim()}
                                onClick={handleDisbursement}
                                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                                <CreditCard className="h-4 w-4" /> Confirm Disbursement & Sync Ledger
                            </button>
                        </div>
                    )}

                {/* Waiting states for unauthorized or pending roles */}
                {requisition.status === 'disbursed' && (
                    <p className="text-xs font-medium text-emerald-400">
                        ✓ Disbursed & Synchronized to Admin 1 Google Sheet.
                    </p>
                )}
            </div>
        </div>
    );
}