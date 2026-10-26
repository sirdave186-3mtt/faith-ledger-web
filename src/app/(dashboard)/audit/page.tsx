'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    ShieldCheck,
    Search,
    Filter,
    Clock,
    User,
    ArrowRight,
    Database,
    FileSpreadsheet,
    CheckCircle2,
    AlertTriangle,
    Code,
    X,
    Layers,
    Calendar,
    Lock,
} from 'lucide-react';

interface AuditLog {
    id: string;
    tenant_id: string;
    actor_id: string | null;
    action: string;
    entity_name: string;
    entity_id: string;
    metadata_diff: Record<string, any> | null;
    created_at: string;
    actor_profile?: {
        full_name: string;
        email: string;
        role: string;
    };
}

export default function AuditTrailPage() {
    const supabase = createClient();

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [entityFilter, setEntityFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchAuditLogs = async () => {
        setIsLoading(true);

        const { data, error } = await supabase
            .from('audit_logs')
            .select(`
        *,
        actor_profile:profiles!audit_logs_actor_id_fkey(full_name, email, role)
      `)
            .order('created_at', { ascending: false })
            .limit(100);

        if (!error && data) {
            setLogs(data as unknown as AuditLog[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAuditLogs();
    }, []);

    // Action badge styling & icon mapping
    const getActionBadge = (action: string) => {
        switch (action) {
            case 'UPDATED_VIA_GOOGLE_SHEETS':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                        <FileSpreadsheet className="h-3 w-3" /> Sheets Two-Way Sync
                    </span>
                );
            case 'RULE_1_INITIATED':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                        <Clock className="h-3 w-3" /> Requisition Initiated
                    </span>
                );
            case 'RULE_2_COMPLIANCE_CLEARED':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400 border border-sky-500/20">
                        <ShieldCheck className="h-3 w-3" /> Compliance Approved
                    </span>
                );
            case 'RULE_3_EXECUTIVE_APPROVED':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-400 border border-indigo-500/20">
                        <CheckCircle2 className="h-3 w-3" /> Executive Approved
                    </span>
                );
            case 'RULE_4_DISBURSED':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" /> Funds Disbursed
                    </span>
                );
            case 'INFLOW_RECORDED':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                        <Database className="h-3 w-3" /> Inflow Logged
                    </span>
                );
            case 'ATTENDANCE_LOGGED':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400 border border-sky-500/20">
                        <Layers className="h-3 w-3" /> Attendance Logged
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700">
                        <ShieldCheck className="h-3 w-3" /> {action}
                    </span>
                );
        }
    };

    const filteredLogs = useMemo(() => {
        return logs.filter((log) => {
            const matchesAction = actionFilter === 'all' ? true : log.action === actionFilter;
            const matchesEntity = entityFilter === 'all' ? true : log.entity_name === entityFilter;

            const actorEmail = log.actor_profile?.email || '';
            const actorName = log.actor_profile?.full_name || '';
            const diffString = log.metadata_diff ? JSON.stringify(log.metadata_diff).toLowerCase() : '';

            const matchesSearch =
                actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                log.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                diffString.includes(searchQuery.toLowerCase());

            return matchesAction && matchesEntity && matchesSearch;
        });
    }, [logs, actionFilter, entityFilter, searchQuery]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Top Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-slate-100">Audit Trail & Governance Logs</h1>
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                            <Lock className="h-3 w-3" /> Immutable
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                        Trace all four-rule requisition approvals, income insertions, and two-way Google Sheets sync events.
                    </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-xs text-slate-300">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span>Real-time Event Logging Active</span>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:w-80">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by actor, entity ID, or diff..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Action Filter */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Event:
                        </span>
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                        >
                            <option value="all">All Events</option>
                            <option value="RULE_1_INITIATED">Requisition Initiated</option>
                            <option value="RULE_2_COMPLIANCE_CLEARED">Compliance Cleared</option>
                            <option value="RULE_3_EXECUTIVE_APPROVED">Executive Approved</option>
                            <option value="RULE_4_DISBURSED">Funds Disbursed</option>
                            <option value="INFLOW_RECORDED">Inflow Recorded</option>
                            <option value="ATTENDANCE_LOGGED">Attendance Logged</option>
                            <option value="UPDATED_VIA_GOOGLE_SHEETS">Google Sheets Sync</option>
                        </select>
                    </div>

                    {/* Entity Filter */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Entity:
                        </span>
                        <select
                            value={entityFilter}
                            onChange={(e) => setEntityFilter(e.target.value)}
                            className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
                        >
                            <option value="all">All Entities</option>
                            <option value="expense_requisitions">Expense Requisitions</option>
                            <option value="inflow_records">Inflow Records</option>
                            <option value="attendance_records">Attendance Records</option>
                            <option value="vendors">Vendors Directory</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Audit Log Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                <th className="px-5 py-3.5">Timestamp</th>
                                <th className="px-5 py-3.5">Action Event</th>
                                <th className="px-5 py-3.5">Actor & Role</th>
                                <th className="px-5 py-3.5">Target Entity</th>
                                <th className="px-5 py-3.5">Entity ID</th>
                                <th className="px-5 py-3.5 text-right">Payload Diff</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500">
                                        Loading audit trail...
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500">
                                        No audit records found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => {
                                    const date = new Date(log.created_at);
                                    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                    const formattedDate = date.toLocaleDateString();

                                    return (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className="cursor-pointer hover:bg-slate-800/40 transition group"
                                        >
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <p className="font-mono text-slate-200">{formattedDate}</p>
                                                <p className="text-[10px] text-slate-500 font-mono">{formattedTime}</p>
                                            </td>

                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                {getActionBadge(log.action)}
                                            </td>

                                            <td className="px-5 py-3.5">
                                                <p className="font-semibold text-slate-200">
                                                    {log.actor_profile?.full_name || 'System / Google Script'}
                                                </p>
                                                <p className="text-[10px] font-mono uppercase text-amber-400">
                                                    {log.actor_profile?.role ? log.actor_profile.role.replace('_', ' ') : 'External Service'}
                                                </p>
                                            </td>

                                            <td className="px-5 py-3.5 capitalize font-medium text-slate-300">
                                                {log.entity_name.replace(/_/g, ' ')}
                                            </td>

                                            <td className="px-5 py-3.5 font-mono text-[11px] text-slate-400">
                                                {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : 'N/A'}
                                            </td>

                                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLog(log);
                                                    }}
                                                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 group-hover:bg-amber-500 group-hover:text-slate-950 transition"
                                                >
                                                    <Code className="h-3 w-3" />
                                                    <span>Inspect</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* JSON Metadata Diff Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Audit Snapshot Details
                                </span>
                                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                                    <span>{selectedLog.action}</span>
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Event Summary Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-slate-500">Timestamp:</span>
                                <p className="font-mono text-slate-200 mt-0.5">
                                    {new Date(selectedLog.created_at).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Actor:</span>
                                <p className="font-semibold text-slate-200 mt-0.5">
                                    {selectedLog.actor_profile?.full_name || 'System / Sync'}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Entity:</span>
                                <p className="font-mono text-amber-400 mt-0.5">
                                    {selectedLog.entity_name}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Entity ID:</span>
                                <p className="font-mono text-slate-300 mt-0.5 truncate" title={selectedLog.entity_id}>
                                    {selectedLog.entity_id}
                                </p>
                            </div>
                        </div>

                        {/* Code Diff Display */}
                        <div>
                            <div className="flex items-center justify-between pb-1.5">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Recorded Payload / State Transition Diff
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">JSON Format</span>
                            </div>
                            <pre className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-amber-300/90 leading-relaxed">
                                {JSON.stringify(selectedLog.metadata_diff || { message: 'No payload diff captured.' }, null, 2)}
                            </pre>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                            >
                                Close Inspector
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}