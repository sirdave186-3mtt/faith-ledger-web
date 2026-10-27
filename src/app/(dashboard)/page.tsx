'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import {
    DollarSign,
    TrendingUp,
    CreditCard,
    Users,
    AlertTriangle,
    ArrowRight,
    ShieldAlert,
    Fuel,
    HeartHandshake,
    Lightbulb,
    Award,
} from 'lucide-react';

interface MetricsSummary {
    totalInflow: number;
    totalYYPC: number;
    netInflow: number;
    totalExpenses: number;
    netCashBalance: number;
    pendingRequisitionsCount: number;
    latestAttendanceTotal: number;
    latestAttendanceDate: string;
}

interface ExpenseBreakdown {
    allowances: number;
    welfare: number;
    utilities: number;
    fuel: number;
}

export default function DashboardOverviewPage() {
    const supabase = createClient();
    const [isLoading, setIsLoading] = useState(true);

    const [metrics, setMetrics] = useState<MetricsSummary>({
        totalInflow: 0,
        totalYYPC: 0,
        netInflow: 0,
        totalExpenses: 0,
        netCashBalance: 0,
        pendingRequisitionsCount: 0,
        latestAttendanceTotal: 0,
        latestAttendanceDate: 'N/A',
    });

    const [expenses, setExpenses] = useState<ExpenseBreakdown>({
        allowances: 0,
        welfare: 0,
        utilities: 0,
        fuel: 0,
    });

    useEffect(() => {
        async function loadDashboardData() {
            setIsLoading(true);

            // 1. Fetch Inflow Totals
            const { data: inflows } = await supabase
                .from('inflow_records')
                .select('total_inflow, yypc_remittance, net_inflow');

            let sumInflow = 0;
            let sumYYPC = 0;
            let sumNet = 0;

            if (inflows) {
                inflows.forEach((item) => {
                    sumInflow += Number(item.total_inflow) || 0;
                    sumYYPC += Number(item.yypc_remittance) || 0;
                    sumNet += Number(item.net_inflow) || 0;
                });
            }

            // 2. Fetch Disbursed Expenses & Categorical Breakdown
            const { data: reqs } = await supabase
                .from('expense_requisitions')
                .select('amount, category, status');

            let sumExpenses = 0;
            let pendingCount = 0;
            const catTotals: ExpenseBreakdown = { allowances: 0, welfare: 0, utilities: 0, fuel: 0 };

            if (reqs) {
                reqs.forEach((r) => {
                    if (r.status === 'disbursed') {
                        const amt = Number(r.amount) || 0;
                        sumExpenses += amt;
                        if (r.category in catTotals) {
                            catTotals[r.category as keyof ExpenseBreakdown] += amt;
                        }
                    } else if (r.status !== 'rejected') {
                        pendingCount++;
                    }
                });
            }

            // 3. Fetch Most Recent Attendance
            const { data: att } = await supabase
                .from('attendance_records')
                .select('total_attendance, service_date')
                .order('service_date', { ascending: false })
                .limit(1)
                .single();

            setMetrics({
                totalInflow: sumInflow,
                totalYYPC: sumYYPC,
                netInflow: sumNet,
                totalExpenses: sumExpenses,
                netCashBalance: sumNet - sumExpenses,
                pendingRequisitionsCount: pendingCount,
                latestAttendanceTotal: att ? att.total_attendance : 0,
                latestAttendanceDate: att ? att.service_date : 'N/A',
            });

            setExpenses(catTotals);
            setIsLoading(false);
        }

        loadDashboardData();
    }, [supabase]);

    // Derived budget utilization limits for Household of Love Church benchmark
    const monthlyExpenseCaps = {
        allowances: 150000,
        welfare: 80000,
        utilities: 50000,
        fuel: 75000,
    };

    const calculateBurn = (spent: number, cap: number) => {
        const pct = Math.round((spent / cap) * 100);
        return Math.min(pct, 100);
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
            {/* Top Banner */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Executive Overview</h1>
                    <p className="mt-1 text-xs text-slate-500">
                        Real-time cash flow, budget utilization gauges, and Four-Rule governance pipeline.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/requests/new"
                        className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-sm shadow-amber-500/20"
                    >
                        <CreditCard className="h-4 w-4" />
                        <span>New Requisition</span>
                    </Link>
                    <Link
                        href="/income"
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
                    >
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        <span>Record Giving</span>
                    </Link>
                </div>
            </div>

            {/* KPI Stats Grid */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {/* Gross Inflow */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Total Inflows
                        </span>
                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 border border-emerald-100">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </div>
                    <p className="mt-3 text-2xl font-bold font-mono text-slate-900">
                        ₦{metrics.totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">Tithes, Offerings, Seeds</p>
                </div>

                {/* YYPC Remittance */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                            YYPC Remittances
                        </span>
                        <div className="rounded-lg bg-rose-50 p-2 text-rose-600 border border-rose-100">
                            <DollarSign className="h-4 w-4" />
                        </div>
                    </div>
                    <p className="mt-3 text-2xl font-bold font-mono text-rose-600">
                        -₦{metrics.totalYYPC.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">Parent Church Deductions</p>
                </div>

                {/* Total Expenses Disbursed */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Disbursed Expenses
                        </span>
                        <div className="rounded-lg bg-amber-50 p-2 text-amber-600 border border-amber-100">
                            <CreditCard className="h-4 w-4" />
                        </div>
                    </div>
                    <p className="mt-3 text-2xl font-bold font-mono text-slate-900">
                        ₦{metrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">Approved by Senior Pastor</p>
                </div>

                {/* Net Retained Cash */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                            Net Cash Balance
                        </span>
                        <div className="rounded-lg bg-amber-50 p-2 text-amber-600 border border-amber-100">
                            <ShieldAlert className="h-4 w-4" />
                        </div>
                    </div>
                    <p className="mt-3 text-2xl font-bold font-mono text-amber-700">
                        ₦{metrics.netCashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">Retained after YYPC & Expenses</p>
                </div>
            </div>

            {/* Middle Section: Budget Utilization Gauges + Governance Pipeline Alert */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                {/* Category Budget Utilization Bars */}
                <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-900">
                                Monthly Expenditure Utilization Gauges
                            </h2>
                            <p className="text-[11px] text-slate-500">
                                Monitors spending across the church's core expense buckets
                            </p>
                        </div>
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-800">
                            HOL Benchmark
                        </span>
                    </div>

                    <div className="mt-6 space-y-5">
                        {/* Allowances */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                                <span className="flex items-center gap-2">
                                    <Award className="h-4 w-4 text-amber-600" /> Allowances (Ministers & Pastoral)
                                </span>
                                <span className="font-mono text-slate-500">
                                    ₦{expenses.allowances.toLocaleString()} / ₦{monthlyExpenseCaps.allowances.toLocaleString()} ({calculateBurn(expenses.allowances, monthlyExpenseCaps.allowances)}%)
                                </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    style={{ width: `${calculateBurn(expenses.allowances, monthlyExpenseCaps.allowances)}%` }}
                                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                />
                            </div>
                        </div>

                        {/* Welfare */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                                <span className="flex items-center gap-2">
                                    <HeartHandshake className="h-4 w-4 text-emerald-600" /> Welfare & Community Support
                                </span>
                                <span className="font-mono text-slate-500">
                                    ₦{expenses.welfare.toLocaleString()} / ₦{monthlyExpenseCaps.welfare.toLocaleString()} ({calculateBurn(expenses.welfare, monthlyExpenseCaps.welfare)}%)
                                </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    style={{ width: `${calculateBurn(expenses.welfare, monthlyExpenseCaps.welfare)}%` }}
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                />
                            </div>
                        </div>

                        {/* Utilities */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                                <span className="flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-sky-600" /> Utilities (Electricity, Sound, Water)
                                </span>
                                <span className="font-mono text-slate-500">
                                    ₦{expenses.utilities.toLocaleString()} / ₦{monthlyExpenseCaps.utilities.toLocaleString()} ({calculateBurn(expenses.utilities, monthlyExpenseCaps.utilities)}%)
                                </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    style={{ width: `${calculateBurn(expenses.utilities, monthlyExpenseCaps.utilities)}%` }}
                                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                                />
                            </div>
                        </div>

                        {/* Fuel */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                                <span className="flex items-center gap-2">
                                    <Fuel className="h-4 w-4 text-rose-600" /> Fuel (Generator & Logistics)
                                </span>
                                <span className="font-mono text-slate-500">
                                    ₦{expenses.fuel.toLocaleString()} / ₦{monthlyExpenseCaps.fuel.toLocaleString()} ({calculateBurn(expenses.fuel, monthlyExpenseCaps.fuel)}%)
                                </span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    style={{ width: `${calculateBurn(expenses.fuel, monthlyExpenseCaps.fuel)}%` }}
                                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Four-Rule Governance Status & Attendance Card */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Governance Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="text-xs font-bold text-slate-900">Requisitions in Pipeline</span>
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                Rule 2 & 3
                            </span>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                            <div className="rounded-xl bg-amber-50 p-3 text-amber-600 border border-amber-100">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold font-mono text-slate-900">
                                    {metrics.pendingRequisitionsCount}
                                </p>
                                <p className="text-xs text-slate-500">Awaiting Sign-off or Release</p>
                            </div>
                        </div>

                        <Link
                            href="/requests"
                            className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-amber-800 transition"
                        >
                            <span>Review Requisitions</span>
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {/* Attendance Snapshot */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <span className="text-xs font-bold text-slate-900">Latest Attendance</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                                {metrics.latestAttendanceDate}
                            </span>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                            <div className="rounded-xl bg-sky-50 p-3 text-sky-600 border border-sky-100">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold font-mono text-slate-900">
                                    {metrics.latestAttendanceTotal.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500">Total Worshippers Present</p>
                            </div>
                        </div>

                        <Link
                            href="/attendance"
                            className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-sky-800 transition"
                        >
                            <span>View Attendance Register</span>
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}