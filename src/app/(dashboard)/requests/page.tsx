'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import RequestGovernanceCard from '@/components/request-governance-card';
import {
    FileText,
    Plus,
    Filter,
    CheckCircle2,
    Clock,
    AlertCircle,
    CreditCard,
    Search,
    ExternalLink,
    ChevronRight,
    ShieldAlert,
    Fuel,
    HeartHandshake,
    Lightbulb,
    Award,
    Layers,
    X,
} from 'lucide-react';

interface RequisitionItem {
    id: string;
    amount: number;
    category: 'allowances' | 'welfare' | 'utilities' | 'fuel' | 'capital_special';
    description: string;
    status: 'pending_compliance' | 'pending_executive_approval' | 'approved_for_disbursement' | 'disbursed' | 'rejected';
    sunday_service_tag: string;
    receipt_storage_path: string | null;
    receipt_drive_url: string | null;
    payment_reference: string | null;
    initiated_at: string;
}

type TabFilter = 'all' | 'pending_compliance' | 'pending_executive_approval' | 'approved_for_disbursement' | 'disbursed' | 'rejected';

export default function RequisitionsListPage() {
    const supabase = createClient();

    const [requisitions, setRequisitions] = useState<RequisitionItem[]>([]);
    const [activeTab, setActiveTab] = useState<TabFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [currentUserRole, setCurrentUserRole] = useState<
        'senior_pastor' | 'admin_1' | 'admin_2' | 'treasurer_1' | 'treasurer_2'
    >('admin_1');

    // Selected requisition for modal review / signoff
    const [selectedReq, setSelectedReq] = useState<RequisitionItem | null>(null);

    const fetchRequisitions = async () => {
        setIsLoading(true);

        // 1. Identify user role
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            if (profile) {
                setCurrentUserRole(profile.role);
            }
        }

        // 2. Query requisitions
        const { data, error } = await supabase
            .from('expense_requisitions')
            .select('*')
            .order('initiated_at', { ascending: false });

        if (!error && data) {
            setRequisitions(data as RequisitionItem[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchRequisitions();
    }, []);

    // Categorical badge icons
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'allowances':
                return <Award className="h-3.5 w-3.5 text-amber-400" />;
            case 'welfare':
                return <HeartHandshake className="h-3.5 w-3.5 text-emerald-400" />;
            case 'utilities':
                return <Lightbulb className="h-3.5 w-3.5 text-sky-400" />;
            case 'fuel':
                return <Fuel className="h-3.5 w-3.5 text-rose-400" />;
            default:
                return <Layers className="h-3.5 w-3.5 text-slate-400" />;
        }
    };

    // Status visual badge styling
    const getStatusBadge = (status: RequisitionItem['status']) => {
        switch (status) {
            case 'pending_compliance':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                        <Clock className="h-3 w-3" /> Rule 2: Pending Compliance
                    </span>
                );
            case 'pending_executive_approval':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400 border border-sky-500/20">
                        <Clock className="h-3 w-3" /> Rule 3: Pending Approval
                    </span>
                );
            case 'approved_for_disbursement':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-400 border border-indigo-500/20">
                        <CreditCard className="h-3 w-3" /> Rule 4: Ready to Disburse
                    </span>
                );
            case 'disbursed':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" /> Disbursed
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400 border border-rose-500/20">
                        <AlertCircle className="h-3 w-3" /> Rejected
                    </span>
                );
        }
    };

    // Filtered dataset
    const filteredRequisitions = useMemo(() => {
        return requisitions.filter((req) => {
            const matchesTab = activeTab === 'all' ? true : req.status === activeTab;
            const matchesSearch =
                req.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (req.sunday_service_tag && req.sunday_service_tag.includes(searchQuery));
            return matchesTab && matchesSearch;
        });
    }, [requisitions, activeTab, searchQuery]);

    // Tab counts
    const counts = useMemo(() => {
        return {
            all: requisitions.length,
            pending_compliance: requisitions.filter((r) => r.status === 'pending_compliance').length,
            pending_executive_approval: requisitions.filter((r) => r.status === 'pending_executive_approval').length,
            approved_for_disbursement: requisitions.filter((r) => r.status === 'approved_for_disbursement').length,
            disbursed: requisitions.filter((r) => r.status === 'disbursed').length,
            rejected: requisitions.filter((r) => r.status === 'rejected').length,
        };
    }, [requisitions]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Top Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">Expense Requisitions</h1>
                    <p className="mt-1 text-xs text-slate-400">
                        Monitor, audit compliance, authorize release, and verify payment references across the 4-Rule governance workflow[cite: 1].
                    </p>
                </div>
                <Link
                    href="/requests/new"
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-md shadow-amber-500/20"
                >
                    <Plus className="h-4 w-4" />
                    <span>New Requisition</span>
                </Link>
            </div>

            {/* Tabs and Search Bar */}
            <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Governance State Tabs */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === 'all'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        All ({counts.all})
                    </button>
                    <button
                        onClick={() => setActiveTab('pending_compliance')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === 'pending_compliance'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <span>Compliance</span>
                        <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-300">
                            {counts.pending_compliance}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('pending_executive_approval')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === 'pending_executive_approval'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <span>Approval</span>
                        <span className="rounded-full bg-sky-500/20 px-1.5 py-0.2 text-[10px] text-sky-300">
                            {counts.pending_executive_approval}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('approved_for_disbursement')}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === 'approved_for_disbursement'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <span>Ready to Disburse</span>
                        <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[10px] text-indigo-300">
                            {counts.approved_for_disbursement}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('disbursed')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeTab === 'disbursed'
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Disbursed ({counts.disbursed})
                    </button>
                </div>

                {/* Search */}
                <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search description, category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                </div>
            </div>

            {/* Requisitions Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                <th className="px-5 py-3.5">Requisition Details</th>
                                <th className="px-5 py-3.5">Category</th>
                                <th className="px-5 py-3.5">Sunday Tag</th>
                                <th className="px-5 py-3.5">Amount (₦)</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500">
                                        Loading requisitions pipeline...
                                    </td>
                                </tr>
                            ) : filteredRequisitions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-500">
                                        No requisitions found matching the selected filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequisitions.map((req) => (
                                    <tr
                                        key={req.id}
                                        onClick={() => setSelectedReq(req)}
                                        className="cursor-pointer hover:bg-slate-800/40 transition group"
                                    >
                                        <td className="px-5 py-4">
                                            <p className="font-semibold text-slate-200 group-hover:text-amber-400 transition">
                                                {req.description}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-mono">
                                                ID: {req.id.slice(0, 8)}... • {new Date(req.initiated_at).toLocaleDateString()}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-1.5 capitalize font-medium text-slate-300">
                                                {getCategoryIcon(req.category)}
                                                <span>{req.category.replace('_', ' ')}</span>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 font-mono text-slate-400">
                                            {req.sunday_service_tag || 'N/A'}
                                        </td>

                                        <td className="px-5 py-4 font-mono font-bold text-slate-100">
                                            ₦{Number(req.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>

                                        <td className="px-5 py-4">
                                            {getStatusBadge(req.status)}
                                        </td>

                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedReq(req);
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-300 group-hover:bg-amber-500 group-hover:text-slate-950 transition"
                                            >
                                                <span>Audit / Act</span>
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Review / Governance Modal */}
            {selectedReq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Requisition Audit Card
                                </span>
                                <h3 className="text-base font-bold text-slate-100">
                                    {selectedReq.description}
                                </h3>
                            </div>
                            <button
                                onClick={() => setSelectedReq(null)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Core Requisition Data */}
                        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                            <div>
                                <span className="text-slate-500">Amount:</span>
                                <p className="font-mono font-bold text-amber-400 text-sm">
                                    ₦{Number(selectedReq.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Category:</span>
                                <p className="font-semibold text-slate-200 capitalize">
                                    {selectedReq.category.replace('_', ' ')}
                                </p>
                            </div>
                            <div>
                                <span className="text-slate-500">Sunday Accounting Tag:</span>
                                <p className="font-mono text-slate-300">{selectedReq.sunday_service_tag || 'N/A'}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Payment Reference:</span>
                                <p className="font-mono text-slate-300">{selectedReq.payment_reference || 'Pending'}</p>
                            </div>
                        </div>

                        {/* Embedded Role Governance Component */}
                        <RequestGovernanceCard
                            requisition={selectedReq}
                            currentUserRole={currentUserRole}
                            onStatusUpdated={() => {
                                setSelectedReq(null);
                                fetchRequisitions();
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}