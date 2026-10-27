'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Percent,
    CheckCircle2,
    AlertCircle,
    Plus,
} from 'lucide-react';

interface InflowRecord {
    id: string;
    tenant_id: string;
    service_date: string;
    service_type: string;
    tithe: number;
    offering: number;
    thanksgiving: number;
    seed: number;
    other_inflows: number;
    total_inflow: number;
    yypc_remittance: number;
    net_inflow: number;
    notes?: string | null;
    created_at: string;
}

export default function IncomeLedgerPage() {
    const supabase = createClient();

    const [records, setRecords] = useState<InflowRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form State - initialized safely to prevent SSR hydration mismatches
    const [serviceDate, setServiceDate] = useState<string>('');
    const [serviceType, setServiceType] = useState<string>('sunday_first');
    const [tithe, setTithe] = useState<string>('');
    const [offering, setOffering] = useState<string>('');
    const [thanksgiving, setThanksgiving] = useState<string>('');
    const [seed, setSeed] = useState<string>('');
    const [otherInflows, setOtherInflows] = useState<string>('');
    const [notes, setNotes] = useState<string>('');

    // Optional YYPC Remittance Toggles for Special Givings
    const [includeThanksgiving, setIncludeThanksgiving] = useState<boolean>(false);
    const [includeSeed, setIncludeSeed] = useState<boolean>(false);
    const [includeOther, setIncludeOther] = useState<boolean>(false);

    // Safely populate date after component mounts on client
    useEffect(() => {
        setServiceDate(new Date().toISOString().split('T')[0]);
    }, []);

    // Numerical conversions
    const numTithe = parseFloat(tithe) || 0;
    const numOffering = parseFloat(offering) || 0;
    const numThanksgiving = parseFloat(thanksgiving) || 0;
    const numSeed = parseFloat(seed) || 0;
    const numOther = parseFloat(otherInflows) || 0;

    const totalInflow = numTithe + numOffering + numThanksgiving + numSeed + numOther;

    // 25% YYPC remittance base (Tithes and Offerings mandatory; Special Givings optional)
    const yypcBase =
        numTithe +
        numOffering +
        (includeThanksgiving ? numThanksgiving : 0) +
        (includeSeed ? numSeed : 0) +
        (includeOther ? numOther : 0);

    const yypcRemittance = Math.round(yypcBase * 0.25 * 100) / 100;
    const netInflow = totalInflow - yypcRemittance;

    const fetchInflowRecords = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('inflow_records')
            .select('*')
            .order('service_date', { ascending: false })
            .limit(50);

        if (!error && data) {
            setRecords(data as InflowRecord[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchInflowRecords();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (totalInflow <= 0) {
            setStatusMsg({ type: 'error', text: 'Total collection amount must be greater than zero.' });
            return;
        }

        setIsSubmitting(true);
        setStatusMsg(null);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            // total_inflow is omitted because it is a generated column in PostgreSQL
            const newRecord = {
                tenant_id: 'org_hol_kubwa',
                service_date: serviceDate || new Date().toISOString().split('T')[0],
                service_type: serviceType,
                tithe: numTithe,
                offering: numOffering,
                thanksgiving: numThanksgiving,
                seed: numSeed,
                other_inflows: numOther,
                yypc_remittance: yypcRemittance,
                net_inflow: netInflow,
                recorded_by: user?.id,
                notes: notes.trim() || null,
            };

            // 1. Insert into Supabase
            const { data: insertedData, error: dbError } = await supabase
                .from('inflow_records')
                .insert([newRecord])
                .select()
                .single();

            if (dbError) {
                console.error('PostgREST Error:', dbError.message, dbError.details, dbError.hint);
                throw new Error(dbError.message || dbError.details || 'Database insert failed.');
            }

            // 2. Outbound sync to Google Sheets via server API route
            let sheetSyncSucceeded = false;
            try {
                const syncRes = await fetch('/api/income/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: insertedData?.id,
                        service_date: serviceDate || new Date().toISOString().split('T')[0],
                        service_type: serviceType,
                        tithe: numTithe,
                        offering: numOffering,
                        thanksgiving: numThanksgiving,
                        seed: numSeed,
                        other_inflows: numOther,
                        total_inflow: totalInflow,
                        yypc_remittance: yypcRemittance,
                        net_inflow: netInflow,
                        recorded_by: user?.email || 'Admin 1',
                        notes: notes.trim() || null,
                    }),
                });

                if (syncRes.ok) {
                    sheetSyncSucceeded = true;
                }
            } catch (sheetErr) {
                console.warn('Google Sheets background sync notice:', sheetErr);
            }

            setStatusMsg({
                type: 'success',
                text: `Inflow of ₦${totalInflow.toLocaleString()} registered${sheetSyncSucceeded ? ' and synced to Google Sheets' : ''
                    }. ₦${yypcRemittance.toLocaleString()} earmarked for YYPC.`,
            });

            // Reset form fields
            setTithe('');
            setOffering('');
            setThanksgiving('');
            setSeed('');
            setOtherInflows('');
            setNotes('');
            setIncludeThanksgiving(false);
            setIncludeSeed(false);
            setIncludeOther(false);

            fetchInflowRecords();
        } catch (err: any) {
            console.error('Inflow submit error:', err);
            setStatusMsg({
                type: 'error',
                text: err?.message || 'Failed to record entry.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatServiceType = (type: string) => {
        switch (type) {
            case 'sunday_first':
                return 'Sunday 1st Service';
            case 'sunday_second':
                return 'Sunday 2nd Service';
            case 'midweek':
                return 'Midweek Service';
            case 'special':
                return 'Special Program';
            default:
                return type ? type.replace(/_/g, ' ') : 'General Service';
        }
    };

    const aggregatedTotal = useMemo(() => records.reduce((acc, r) => acc + (Number(r.total_inflow) || 0), 0), [records]);
    const aggregatedYYPC = useMemo(() => records.reduce((acc, r) => acc + (Number(r.yypc_remittance) || 0), 0), [records]);
    const aggregatedNet = useMemo(() => records.reduce((acc, r) => acc + (Number(r.net_inflow) || 0), 0), [records]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Income & Giving Ledger
                    </h1>
                    <p className="mt-1 text-xs text-slate-500">
                        Household of Love Church, Kubwa • Record service collections and compute YYPC 25% remittance allocations.
                    </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                    <Percent className="h-4 w-4 text-amber-600" />
                    <span>25% Tithe & Offering Remittance Enforced</span>
                </div>
            </div>

            {/* Aggregate Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Gross Collections
                    </span>
                    <p className="mt-2 text-2xl font-extrabold text-slate-900">
                        ₦{aggregatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <span className="mt-1 text-[11px] text-slate-500">Total recorded service inflows</span>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                            YYPC Remittance (25%)
                        </span>
                        <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Youth Fellowship
                        </span>
                    </div>
                    <p className="mt-2 text-2xl font-extrabold text-amber-900">
                        ₦{aggregatedYYPC.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <span className="mt-1 text-[11px] text-amber-700">Total allocated to YYPC</span>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                        Net Church Retained
                    </span>
                    <p className="mt-2 text-2xl font-extrabold text-emerald-900">
                        ₦{aggregatedNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <span className="mt-1 text-[11px] text-emerald-700">Available church operational funds</span>
                </div>
            </div>

            {/* Main Grid: Form + Table */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Form Card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
                        Register Service Collections
                    </h2>

                    {statusMsg && (
                        <div
                            className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${statusMsg.type === 'success'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                    : 'border-rose-200 bg-rose-50 text-rose-800'
                                }`}
                        >
                            {statusMsg.type === 'success' ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            ) : (
                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                            )}
                            <span>{statusMsg.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                    Service Date
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={serviceDate}
                                    onChange={(e) => setServiceDate(e.target.value)}
                                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                    Service Type
                                </label>
                                <select
                                    value={serviceType}
                                    onChange={(e) => setServiceType(e.target.value)}
                                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                >
                                    <option value="sunday_first">Sunday 1st Service</option>
                                    <option value="sunday_second">Sunday 2nd Service</option>
                                    <option value="midweek">Midweek Service</option>
                                    <option value="special">Special Program</option>
                                </select>
                            </div>
                        </div>

                        {/* Tithes & Offerings (Auto 25%) */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                                Mandatory 25% YYPC Remittance Categories
                            </span>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700">Tithe (₦)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={tithe}
                                        onChange={(e) => setTithe(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-700">Offering (₦)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={offering}
                                        onChange={(e) => setOffering(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Special Givings (Optional Remittance) */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                Special Givings (Optional Remittance)
                            </span>

                            {/* Thanksgiving */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-slate-700">Thanksgiving (₦)</label>
                                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeThanksgiving}
                                            onChange={(e) => setIncludeThanksgiving(e.target.checked)}
                                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span>Include 25% YYPC</span>
                                    </label>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={thanksgiving}
                                    onChange={(e) => setThanksgiving(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            {/* Special Seed */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-slate-700">Special Seed (₦)</label>
                                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeSeed}
                                            onChange={(e) => setIncludeSeed(e.target.checked)}
                                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span>Include 25% YYPC</span>
                                    </label>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={seed}
                                    onChange={(e) => setSeed(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>

                            {/* Other Inflows */}
                            <div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-slate-700">Other Inflows (₦)</label>
                                    <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeOther}
                                            onChange={(e) => setIncludeOther(e.target.checked)}
                                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span>Include 25% YYPC</span>
                                    </label>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={otherInflows}
                                    onChange={(e) => setOtherInflows(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        {/* Live Computation Summary */}
                        <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-600">
                                <span>Total Collection:</span>
                                <span className="font-bold text-slate-900 font-mono">
                                    ₦{totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-amber-700">
                                <span>YYPC Remittance (25%):</span>
                                <span className="font-bold font-mono">
                                    - ₦{yypcRemittance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-emerald-800 border-t border-slate-100 pt-1.5 font-bold">
                                <span>Net Church Retained:</span>
                                <span className="font-mono">
                                    ₦{netInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Notes / Particulars
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Optional notes or teller references..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                        >
                            <Plus className="h-4 w-4" />
                            <span>{isSubmitting ? 'Registering Inflows...' : 'Save Service Collections'}</span>
                        </button>
                    </form>
                </div>

                {/* Ledger Table */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:col-span-7">
                    <div className="flex items-center justify-between border-b border-slate-100 p-4">
                        <h3 className="text-sm font-bold text-slate-900">Service Collection History</h3>
                        <span className="text-[11px] font-medium text-slate-500 font-mono">
                            {records.length} Record{records.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-3">Service Date</th>
                                    <th className="px-4 py-3 text-right">Tithe & Offering</th>
                                    <th className="px-4 py-3 text-right">Total Inflow</th>
                                    <th className="px-4 py-3 text-right">YYPC (25%)</th>
                                    <th className="px-4 py-3 text-right">Net Retained</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-400">
                                            Loading collection records...
                                        </td>
                                    </tr>
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-400">
                                            No service records found.
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((r) => {
                                        const titheOffering = (Number(r.tithe) || 0) + (Number(r.offering) || 0);

                                        return (
                                            <tr key={r.id} className="hover:bg-slate-50/80 transition">
                                                <td className="px-4 py-3">
                                                    <p className="font-semibold text-slate-900">{r.service_date}</p>
                                                    <p className="text-[10px] text-slate-400">{formatServiceType(r.service_type)}</p>
                                                </td>

                                                <td className="px-4 py-3 text-right font-mono text-slate-700">
                                                    ₦{titheOffering.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>

                                                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                                                    ₦{Number(r.total_inflow).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>

                                                <td className="px-4 py-3 text-right font-mono font-semibold text-amber-700">
                                                    ₦{Number(r.yypc_remittance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>

                                                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                                                    ₦{Number(r.net_inflow).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}