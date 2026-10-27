'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Users,
    UserCheck,
    UserPlus,
    Calendar,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    Layers,
    Baby
} from 'lucide-react';

interface AttendanceRecord {
    id: string;
    service_date: string;
    service_title: string;
    men: number;
    women: number;
    children: number;
    total_attendance: number;
    first_timers: number;
    created_at: string;
}

export default function AttendancePage() {
    const supabase = createClient();

    // Form States
    const [serviceDate, setServiceDate] = useState('');
    const [todayFormatted, setTodayFormatted] = useState('');
    const [serviceTitle, setServiceTitle] = useState('Sunday 1st Service');
    const [customTitle, setCustomTitle] = useState('');
    const [men, setMen] = useState<number | ''>('');
    const [women, setWomen] = useState<number | ''>('');
    const [children, setChildren] = useState<number | ''>('');
    const [firstTimers, setFirstTimers] = useState<number | ''>('');
    const [notes, setNotes] = useState('');

    // UI & Data States
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Numeric coercion
    const numMen = Number(men) || 0;
    const numWomen = Number(women) || 0;
    const numChildren = Number(children) || 0;
    const numFirstTimers = Number(firstTimers) || 0;

    // Real-time Total Calculation
    const totalAttendance = useMemo(() => {
        return numMen + numWomen + numChildren;
    }, [numMen, numWomen, numChildren]);

    // Demographics percentages for distribution bar
    const menPercent = totalAttendance > 0 ? Math.round((numMen / totalAttendance) * 100) : 0;
    const womenPercent = totalAttendance > 0 ? Math.round((numWomen / totalAttendance) * 100) : 0;
    const childrenPercent = totalAttendance > 0 ? 100 - (menPercent + womenPercent) : 0;

    const fetchRecords = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .order('service_date', { ascending: false })
            .limit(20);

        if (!error && data) {
            setRecords(data as AttendanceRecord[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        setServiceDate(new Date().toISOString().split('T')[0]);
        setTodayFormatted(new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' }));
        fetchRecords();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMsg(null);

        const finalTitle = serviceTitle === 'Custom' ? customTitle.trim() : serviceTitle;
        if (!finalTitle) {
            setStatusMsg({ type: 'error', text: 'Please enter a valid service title.' });
            setIsSubmitting(false);
            return;
        }

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
                .from('attendance_records')
                .insert({
                    tenant_id: tenantId,
                    service_date: serviceDate,
                    service_title: finalTitle,
                    men: numMen,
                    women: numWomen,
                    children: numChildren,
                    first_timers: numFirstTimers,
                    recorded_by: user.id,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // 2. Audit Trail Logging
            await supabase.from('audit_logs').insert({
                tenant_id: tenantId,
                actor_id: user.id,
                action: 'ATTENDANCE_LOGGED',
                entity_name: 'attendance_records',
                entity_id: newRecord.id,
                metadata_diff: {
                    service_title: finalTitle,
                    total: totalAttendance,
                    first_timers: numFirstTimers,
                },
            });

            // 3. Outbound Google Sheets Sync (ATTENDANCE_METRICS tab)
            await fetch('/api/sync/sheets/attendance-outbound', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: serviceDate,
                    serviceTitle: finalTitle,
                    men: numMen,
                    women: numWomen,
                    children: numChildren,
                    totalAttendance,
                    firstTimers: numFirstTimers,
                    notes,
                }),
            });

            setStatusMsg({ type: 'success', text: 'Attendance logged and synced to Google Sheets.' });

            // Reset form fields
            setMen('');
            setWomen('');
            setChildren('');
            setFirstTimers('');
            setNotes('');
            if (serviceTitle === 'Custom') setCustomTitle('');
            fetchRecords();
        } catch (err: any) {
            console.error('Attendance submission error:', err);
            setStatusMsg({ type: 'error', text: err.message || 'Error recording attendance.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Service Attendance & Headcount</h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Log congregation demographics, first-time visitors, and sync counts with the church register.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-xs text-slate-300">
                    <Calendar className="h-4 w-4 text-amber-500" />
                    <span>{todayFormatted}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Entry Form */}
                <div className="lg:col-span-5">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-4 text-amber-400 font-semibold text-sm">
                            <Users className="h-4 w-4" />
                            <span>Record Headcount</span>
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
                                        Service Title
                                    </label>
                                    <select
                                        value={serviceTitle}
                                        onChange={(e) => setServiceTitle(e.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    >
                                        <option value="Sunday 1st Service">Sunday 1st Service</option>
                                        <option value="Sunday 2nd Service">Sunday 2nd Service</option>
                                        <option value="Midweek Service">Midweek Service</option>
                                        <option value="Karo Crusade">Karo Crusade</option>
                                        <option value="Special Program">Special Program</option>
                                        <option value="Custom">Other (Custom Title)...</option>
                                    </select>
                                </div>
                            </div>

                            {serviceTitle === 'Custom' && (
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Custom Service / Program Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Night of Worship, Leadership Retreat"
                                        value={customTitle}
                                        onChange={(e) => setCustomTitle(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            )}

                            {/* Headcount Inputs */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Men
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={men}
                                        onChange={(e) => setMen(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Women
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={women}
                                        onChange={(e) => setWomen(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                        Children
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={children}
                                        onChange={(e) => setChildren(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* First Timers Input */}
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                                        <UserPlus className="h-4 w-4" />
                                        <span>First Timers (New Visitors)</span>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={firstTimers}
                                        onChange={(e) => setFirstTimers(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                        className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-right font-mono text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    First timers are included in the Men/Women/Children totals above.
                                </p>
                            </div>

                            {/* Dynamic Demographics Visualizer */}
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-300">Total Headcount:</span>
                                    <span className="font-mono text-base font-bold text-amber-400">
                                        {totalAttendance.toLocaleString()}
                                    </span>
                                </div>

                                {totalAttendance > 0 && (
                                    <>
                                        <div className="h-2 w-full flex overflow-hidden rounded-full bg-slate-800 mt-2">
                                            <div style={{ width: `${menPercent}%` }} className="bg-sky-500" title={`Men: ${menPercent}%`} />
                                            <div style={{ width: `${womenPercent}%` }} className="bg-rose-500" title={`Women: ${womenPercent}%`} />
                                            <div style={{ width: `${childrenPercent}%` }} className="bg-amber-500" title={`Children: ${childrenPercent}%`} />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-slate-400 pt-1">
                                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Men ({menPercent}%)</span>
                                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Women ({womenPercent}%)</span>
                                            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Children ({childrenPercent}%)</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Notes
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Rainy morning, Special guest minister"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || totalAttendance <= 0}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition disabled:opacity-50"
                            >
                                <UserCheck className="h-4 w-4" />
                                {isSubmitting ? 'Logging Headcount...' : 'Log & Sync Attendance'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Attendance Records Table */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
                                <Layers className="h-4 w-4 text-amber-500" />
                                <span>Attendance Log</span>
                            </div>
                            <span className="text-[11px] text-slate-400">Recent Services</span>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                        <th className="pb-3">Date</th>
                                        <th className="pb-3">Service</th>
                                        <th className="pb-3">Men</th>
                                        <th className="pb-3">Women</th>
                                        <th className="pb-3">Children</th>
                                        <th className="pb-3">First Timers</th>
                                        <th className="pb-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="py-6 text-center text-slate-500">
                                                Loading attendance history...
                                            </td>
                                        </tr>
                                    ) : records.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-6 text-center text-slate-500">
                                                No attendance records logged yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        records.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-800/30 transition">
                                                <td className="py-3 font-medium text-slate-200">{r.service_date}</td>
                                                <td className="py-3 text-slate-300 font-medium">{r.service_title}</td>
                                                <td className="py-3 font-mono text-slate-400">{r.men}</td>
                                                <td className="py-3 font-mono text-slate-400">{r.women}</td>
                                                <td className="py-3 font-mono text-slate-400">{r.children}</td>
                                                <td className="py-3 font-mono text-amber-400 font-semibold">{r.first_timers}</td>
                                                <td className="py-3 font-mono font-bold text-slate-100 text-right">
                                                    {r.total_attendance}
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