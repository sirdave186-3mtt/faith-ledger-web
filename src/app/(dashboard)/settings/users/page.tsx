'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    ShieldAlert,
    UserCheck,
    UserX,
    Shield,
    Search,
    CheckCircle2,
    AlertCircle,
    Crown,
    KeyRound,
    Lock,
    Mail,
    Calendar,
    Save,
    RotateCcw,
} from 'lucide-react';

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: 'senior_pastor' | 'admin_1' | 'admin_2' | 'treasurer_1' | 'treasurer_2';
    is_active: boolean;
    created_at: string;
}

const ROLE_DEFINITIONS: Record<
    Profile['role'],
    { label: string; description: string; badgeColor: string }
> = {
    senior_pastor: {
        label: 'Senior Pastor',
        description: 'Executive authority, fund disbursement approval, full audit oversight',
        badgeColor: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    },
    admin_1: {
        label: 'Admin 1 (Compliance)',
        description: 'Rule 2 compliance reviewer, role admin, sole Google Sheets custodian',
        badgeColor: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
    },
    admin_2: {
        label: 'Admin 2 (Requisitioner)',
        description: 'Rule 1 expense initiator, vendor manager, delegated fallback approver',
        badgeColor: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
    },
    treasurer_1: {
        label: 'Treasurer 1',
        description: 'Disbursement execution & bank transfers (zero Google Sheet access)',
        badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    },
    treasurer_2: {
        label: 'Treasurer 2',
        description: 'Disbursement execution & bank transfers (zero Google Sheet access)',
        badgeColor: 'border-teal-500/30 bg-teal-500/10 text-teal-400',
    },
};

export default function UserManagementPage() {
    const supabase = createClient();

    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [currentUser, setCurrentUser] = useState<{ id: string; role: Profile['role'] } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isPermitted, setIsPermitted] = useState(false);

    // Status and feedback
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Role modification confirmation modal state
    const [pendingChange, setPendingChange] = useState<{
        profile: Profile;
        newRole: Profile['role'];
    } | null>(null);

    const fetchProfiles = async () => {
        setIsLoading(true);

        // 1. Authenticate & verify caller role
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setIsLoading(false);
            return;
        }

        const { data: myProfile } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', user.id)
            .single();

        if (!myProfile || !['senior_pastor', 'admin_1'].includes(myProfile.role)) {
            setIsPermitted(false);
            setIsLoading(false);
            return;
        }

        setCurrentUser({ id: myProfile.id, role: myProfile.role });
        setIsPermitted(true);

        // 2. Fetch tenant staff profiles
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: true });

        if (!error && data) {
            setProfiles(data as Profile[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleRoleSelect = (profile: Profile, newRole: Profile['role']) => {
        if (profile.role === newRole) return;

        // Safety: prevent self-demoting from Pastor/Admin 1 directly
        if (profile.id === currentUser?.id) {
            setStatusMsg({
                type: 'error',
                text: 'Self-demotion is restricted to prevent leadership lockout.',
            });
            return;
        }

        setPendingChange({ profile, newRole });
    };

    const confirmRoleChange = async () => {
        if (!pendingChange) return;

        const { profile, newRole } = pendingChange;
        setUpdatingId(profile.id);
        setPendingChange(null);
        setStatusMsg(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', profile.id);

            if (error) throw error;

            setStatusMsg({
                type: 'success',
                text: `Role for ${profile.full_name} updated to ${ROLE_DEFINITIONS[newRole].label}.`,
            });

            fetchProfiles();
        } catch (err: any) {
            console.error('Role update error:', err);
            setStatusMsg({ type: 'error', text: err.message || 'Failed to update user role.' });
        } finally {
            setUpdatingId(null);
        }
    };

    const toggleUserStatus = async (profile: Profile) => {
        if (profile.id === currentUser?.id) {
            setStatusMsg({
                type: 'error',
                text: 'You cannot deactivate your own administrative account.',
            });
            return;
        }

        setUpdatingId(profile.id);
        setStatusMsg(null);

        try {
            const nextStatus = !profile.is_active;
            const { error } = await supabase
                .from('profiles')
                .update({ is_active: nextStatus })
                .eq('id', profile.id);

            if (error) throw error;

            setStatusMsg({
                type: 'success',
                text: `Account for ${profile.full_name} is now ${nextStatus ? 'active' : 'suspended'}.`,
            });

            fetchProfiles();
        } catch (err: any) {
            console.error('Account status error:', err);
            setStatusMsg({ type: 'error', text: err.message || 'Failed to toggle account status.' });
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredProfiles = useMemo(() => {
        return profiles.filter((p) => {
            const q = searchQuery.toLowerCase();
            return (
                p.full_name.toLowerCase().includes(q) ||
                p.email.toLowerCase().includes(q) ||
                p.role.toLowerCase().includes(q)
            );
        });
    }, [profiles, searchQuery]);

    // Unauthorized view
    if (!isLoading && !isPermitted) {
        return (
            <div className="mx-auto flex h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-400">
                    <ShieldAlert className="h-10 w-10" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-100">Restricted Administration</h2>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                    Access to role management is reserved solely for the <strong>Senior Pastor</strong> and{' '}
                    <strong>Admin 1</strong> in accordance with church governance.
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Top Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-slate-100">User & Governance Roles</h1>
                        <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                            <Crown className="h-3 w-3" /> Senior Leadership
                        </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                        Assign and reconfigure staff responsibilities across the Four-Rule requisition pipeline.
                    </p>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-300">
                    <KeyRound className="h-4 w-4 text-amber-500" />
                    <span>RLS Enforced Governance</span>
                </div>
            </div>

            {statusMsg && (
                <div
                    className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${statusMsg.type === 'success'
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

            {/* Search Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by staff name, email, or role..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                </div>
                <span className="text-xs text-slate-400 font-mono">
                    {filteredProfiles.length} Account{filteredProfiles.length === 1 ? '' : 's'} Active
                </span>
            </div>

            {/* User Profiles Grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full py-16 text-center text-xs text-slate-500">
                        Loading governance accounts...
                    </div>
                ) : filteredProfiles.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-xs text-slate-500">
                        No accounts matching the search query.
                    </div>
                ) : (
                    filteredProfiles.map((p) => {
                        const roleInfo = ROLE_DEFINITIONS[p.role];
                        const isSelf = p.id === currentUser?.id;

                        return (
                            <div
                                key={p.id}
                                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg space-y-4 hover:border-slate-700 transition"
                            >
                                <div>
                                    {/* Top card bar */}
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="text-sm font-bold text-slate-100">{p.full_name}</h3>
                                                {isSelf && (
                                                    <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9px] font-bold text-amber-400 uppercase">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            <p className="flex items-center gap-1 text-[11px] text-slate-400 font-mono mt-0.5">
                                                <Mail className="h-3 w-3" />
                                                <span>{p.email}</span>
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => toggleUserStatus(p)}
                                            disabled={isSelf || updatingId === p.id}
                                            title={p.is_active ? 'Click to Suspend Account' : 'Click to Reactivate Account'}
                                            className={`rounded-lg p-1.5 transition ${p.is_active
                                                    ? 'text-emerald-400 hover:bg-rose-500/10 hover:text-rose-400'
                                                    : 'text-rose-400 hover:bg-emerald-500/10 hover:text-emerald-400'
                                                } disabled:opacity-40`}
                                        >
                                            {p.is_active ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                                        </button>
                                    </div>

                                    {/* Current Active Badge */}
                                    <div className="mt-3">
                                        <span
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleInfo.badgeColor}`}
                                        >
                                            <Shield className="h-3 w-3" />
                                            <span>{roleInfo.label}</span>
                                        </span>
                                        <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
                                            {roleInfo.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Role Switcher Action */}
                                <div className="border-t border-slate-800/80 pt-3">
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                                        Reassign Operational Role
                                    </label>
                                    <select
                                        value={p.role}
                                        disabled={isSelf || updatingId === p.id}
                                        onChange={(e) => handleRoleSelect(p, e.target.value as Profile['role'])}
                                        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-amber-500 focus:outline-none disabled:opacity-50"
                                    >
                                        <option value="senior_pastor">Senior Pastor</option>
                                        <option value="admin_1">Admin 1 (Compliance / Sheets)</option>
                                        <option value="admin_2">Admin 2 (Requisitioner / Alt Approver)</option>
                                        <option value="treasurer_1">Treasurer 1 (Disbursement)</option>
                                        <option value="treasurer_2">Treasurer 2 (Disbursement)</option>
                                    </select>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Confirmation Modal */}
            {pendingChange && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-amber-400">
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5">
                                <Crown className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-100">Confirm Role Reassignment</h3>
                                <p className="text-xs text-slate-400">Governance & RLS Update</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            Are you sure you want to transition{' '}
                            <strong className="text-slate-100">{pendingChange.profile.full_name}</strong> from{' '}
                            <span className="font-semibold text-amber-400">
                                {ROLE_DEFINITIONS[pendingChange.profile.role].label}
                            </span>{' '}
                            to{' '}
                            <span className="font-semibold text-emerald-400">
                                {ROLE_DEFINITIONS[pendingChange.newRole].label}
                            </span>
                            ?
                        </p>

                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400">
                            This will immediately adjust their data access boundaries and log an immutable entry in the
                            audit trail.
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setPendingChange(null)}
                                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmRoleChange}
                                className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 transition"
                            >
                                Confirm & Update Role
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}