'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    DollarSign,
    PlusCircle,
    TrendingUp,
    Percent,
    Calendar,
    CheckCircle2,
    AlertCircle,
    Layers
} from 'lucide-react';

interface InflowRecord {
    id: string;
    service_date: string;
    service_type: 'sunday_service' | 'midweek_service' | 'crusade_special' | 'direct_transfer';
    tithe: number;
    offering: number;
    thanksgiving: number;
    seed: number;
    other_inflows: number;
    total_inflow: number;
    yypc_remittance: number;
    net_inflow: number;
    notes: string | null;
    created_at: string;
}

export default function IncomePage() {
    const supabase = createClient();

    // Form States
    const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
    const [serviceType, setServiceType] = useState<'sunday_service' | 'midweek_service' | 'crusade_special' | 'direct_transfer'>('sunday_service');
    const [tithe, setTithe] = useState<number | ''>('');
    const [offering, setOffering] = useState<number | ''>('');
    const [thanksgiving, setThanksgiving] = useState<number | ''>('');
    const [seed, setSeed] = useState<number | ''>('');
    const [otherInflows, setOtherInflows] = useState<number | ''>('');
    const [yypcRemittance, setYypcRemittance] = useState<number | ''>('');
    const [notes, setNotes] = useState('');

    // UI & Data States
    const [records, setRecords] = useState<InflowRecord[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Computed Inflow & Net
    const numTithe = Number(tithe) || 0;
    const numOffering = Number(offering) || 0;
    const numThanksgiving = Number(thanksgiving) || 0;
    const numSeed = Number(seed) || 0;
    const numOther = Number(otherInflows) || 0;
    const numYYPC = Number(yypcRemittance) || 0;

    const calculatedTotal = useMemo(() => {
        return numTithe + numOffering + numThanksgiving + numSeed + numOther;
    }, [numTithe, numOffering, numThanksgiving, numSeed, numOther]);

    const calculatedNet = useMemo(() => {
        return calculatedTotal - numYYPC;
    }, [calculatedTotal, numYYPC]);

    const fetchRecords = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('inflow_records')
            .select('*')
            .order('service_date', { ascending: false })
            .limit(20);

        if (!error && data) {
            setRecords(data as InflowRecord[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchRecords();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMsg(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Authentication required.');

            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id, role')
                .eq('id', user.id)
                .single();

            const tenantId = profile?.tenant_id || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'org_hol_kubwa';

            // 1. Insert into Supabase
            const { data: newRecord, error: insertError } = await supabase
                .from('inflow_records')
                .insert({
                    tenant_id: tenantId,
                    service_date: serviceDate,
                    service_type: serviceType,
                    tithe: numTithe,
                    offering: numOffering,
                    thanksgiving: numThanksgiving,
                    seed: numSeed,
                    other_inflows: numOther,
                    yypc_remittance: numYYPC,
                    recorded_by: user.id,
                    notes: notes || null,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // 2. Log in Audit Trail
            await supabase.from('audit_logs').insert({
                tenant_id: tenantId,
                actor_id: user.id,
                action: 'INFLOW_RECORDED',
                entity_name: 'inflow_records',
                entity_id: newRecord.id,
                metadata_diff: {
                    total: calculatedTotal,
                    net: calculatedNet,
                    yypc: numYYPC,
                },
            });

            // 3. Trigger Outbound Sync to Admin 1's Google Sheet
            await fetch('/api/sync/sheets/inflow-outbound', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transactionId: newRecord.id,
                    date: serviceDate,
                    serviceType,
                    tithe: numTithe,
                    offering: numOffering,
                    thanksgiving: numThanksgiving,
                    seed: numSeed,
                    otherInflows: numOther,
                    yypcRemittance: numYYPC,
                    recordedBy: profile?.role?.toUpperCase() || 'ADMIN',
                    notes,
                }),
            });

            setStatusMsg({ type: 'success', text: 'Inflow entry saved and synchronized with Google Sheets.' });

            // Reset Form fields
            setTithe('');
            setOffering('');
            setThanksgiving('');
            setSeed('');
            setOtherInflows('');
            setYypcRemittance('');
            setNotes('');
            fetchRecords();
        } catch (err: any) {
            console.error('Inflow submit error:', err);
            setStatusMsg({ type: 'error', text: err.message || 'Error recording inflow.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Income & Giving Ledger</h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Record weekly collections, Thanksgiving, Seed Faith, and automatically calculate YYPC deductions.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-300">
                    <Calendar className="h-4 w-4 text-amber-500" />
                    <span>Active Period: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Entry Form */}
                <div className="lg:col-span-5">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-4 text-amber-400 font-semibold text-sm">
                            <PlusCircle className="h-4 w-4" />
                            <span>Record Service Inflow</span>
                        </div>

                        {statusMsg && (
                            <div
                                className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-xs border ${statusMsg.type === 'success'
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                        : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                                    }`}
                            >
                                {statusMsg.type === 'success' ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                )}
                                <span>{statusMsg.text}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Service Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={serviceDate}
                                        onChange={(e) => setServiceDate(e.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Service Type
                                    </label>
                                    <select
                                        value={serviceType}
                                        onChange={(e: any) => setServiceType(e.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="sunday_service">Sunday Service</option>
                                        <option value="midweek_service">Midweek Service</option>
                                        <option value="crusade_special">Special / Crusade</option>
                                        <option value="direct_transfer">Direct Transfer</option>
                                    </select>
                                </div>
                            </div>

                            {/* Inflow Inputs */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Tithe (₦)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={tithe}
                                        onChange={(e) => setTithe(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Offering (₦)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={offering}
                                        onChange={(e) => setOffering(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Thanksgiving (₦)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={thanksgiving}
                                        onChange={(e) => setThanksgiving(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Seed Faith (₦)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={seed}
                                        onChange={(e) => setSeed(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Other Inflows (₦)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={otherInflows}
                                        onChange={(e) => setOtherInflows(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                                        YYPC Remittance (₦)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={yypcRemittance}
                                        onChange={(e) => setYypcRemittance(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                        className="mt-1 w-full rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-xs text-rose-200 focus:border-rose-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Dynamic Calculations Widget */}
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Total Gross Inflow:</span>
                                    <span className="font-semibold text-slate-100 font-mono">
                                        ₦{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-rose-400">YYPC Deduction:</span>
                                    <span className="font-semibold text-rose-400 font-mono">
                                        - ₦{numYYPC.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-xs">
                                    <span className="font-bold text-amber-400">Net Retained Church Inflow:</span>
                                    <span className="font-bold text-amber-400 font-mono text-sm">
                                        ₦{calculatedNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Notes / References
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1st Sunday Thanksgiving, Special Seed pledge"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || calculatedTotal <= 0}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition disabled:opacity-50"
                            >
                                <DollarSign className="h-4 w-4" />
                                {isSubmitting ? 'Recording & Syncing...' : 'Save & Sync Inflow'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Inflow Ledger View */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                                <Layers className="h-4 w-4 text-amber-500" />
                                <span>Recent Recorded Inflows</span>
                            </div>
                            <span className="text-[11px] text-slate-400">Last 20 entries</span>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                        <th className="pb-3">Date</th>
                                        <th className="pb-3">Service</th>
                                        <th className="pb-3">Tithe</th>
                                        <th className="pb-3">Offering</th>
                                        <th className="pb-3">Seed/Thanksg</th>
                                        <th className="pb-3">YYPC</th>
                                        <th className="pb-3 text-right">Net Inflow</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="py-6 text-center text-slate-500">
                                                Loading inflow ledger...
                                            </td>
                                        </tr>
                                    ) : records.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-6 text-center text-slate-500">
                                                No entries recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        records.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-800/30 transition">
                                                <td className="py-3 font-medium text-slate-200">{r.service_date}</td>
                                                <td className="py-3 text-slate-400 capitalize">
                                                    {r.service_type.replace('_', ' ')}
                                                </td>
                                                <td className="py-3 font-mono text-slate-300">
                                                    ₦{Number(r.tithe).toLocaleString()}
                                                </td>
                                                <td className="py-3 font-mono text-slate-300">
                                                    ₦{Number(r.offering).toLocaleString()}
                                                </td>
                                                <td className="py-3 font-mono text-slate-300">
                                                    ₦{(Number(r.seed) + Number(r.thanksgiving)).toLocaleString()}
                                                </td>
                                                <td className="py-3 font-mono text-rose-400">
                                                    ₦{Number(r.yypc_remittance).toLocaleString()}
                                                </td>
                                                <td className="py-3 font-mono font-bold text-amber-400 text-right">
                                                    ₦{Number(r.net_inflow).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}