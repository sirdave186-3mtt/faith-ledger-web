'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    Church,
    Lock,
    Mail,
    Eye,
    EyeOff,
    Loader2,
    AlertCircle,
    ShieldCheck
} from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(null);

        try {
            // 1. Authenticate credentials via Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (authError) {
                throw authError;
            }

            if (!authData.user) {
                throw new Error('Authentication failed. No user found.');
            }

            // 2. Fetch the user's role profile to enforce governance routing
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, is_active')
                .eq('id', authData.user.id)
                .single();

            if (profileError || !profile) {
                throw new Error('User profile record not configured. Please contact the administrator.');
            }

            if (!profile.is_active) {
                await supabase.auth.signOut();
                throw new Error('Your account is currently inactive. Please contact church leadership.');
            }

            // 3. Role-Based Navigation Routing
            // Senior Pastor -> Overview Dashboard (Executive Oversight)
            // Admin 1 -> Requisitions Pipeline / Governance review
            // Admin 2 -> Requisitions Pipeline / New Request entry
            // Treasurer 1 & 2 -> Requisitions (ready for disbursement)
            switch (profile.role) {
                case 'senior_pastor':
                    router.push('/');
                    break;
                case 'admin_1':
                    router.push('/requests');
                    break;
                case 'admin_2':
                    router.push('/requests/new');
                    break;
                case 'treasurer_1':
                case 'treasurer_2':
                    router.push('/requests');
                    break;
                default:
                    router.push('/');
                    break;
            }

            router.refresh();
        } catch (err: any) {
            console.error('Sign-in error:', err);
            setErrorMessage(err.message || 'Invalid email or password.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 selection:bg-amber-500 selection:text-slate-950">
            <div className="w-full max-w-md">
                {/* Brand Header */}
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/10">
                        <Church className="h-8 w-8" />
                    </div>
                    <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-100">
                        Faith Ledger
                    </h2>
                    <p className="mt-1 text-xs font-medium text-slate-400">
                        Household of Love Church, Kubwa • Financial Portal
                    </p>
                </div>

                {/* Login Card */}
                <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
                    <div className="mb-6 flex items-center justify-between border-b border-slate-800/80 pb-4">
                        <div>
                            <h3 className="text-sm font-bold text-slate-200">System Sign In</h3>
                            <p className="text-[11px] text-slate-400">Authorized personnel only</p>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                            <ShieldCheck className="h-4 w-4" />
                            <span>4-Rule Enforced</span>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Email Address
                            </label>
                            <div className="relative mt-1.5">
                                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    placeholder="pastor@householdoflove.org"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 transition focus:border-amber-500 focus:bg-slate-800 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                                    Password
                                </label>
                            </div>
                            <div className="relative mt-1.5">
                                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-10 text-xs text-slate-100 placeholder-slate-500 transition focus:border-amber-500 focus:bg-slate-800 focus:outline-none font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 rounded p-1 text-slate-400 hover:text-slate-200"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 shadow-md shadow-amber-500/20"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Authenticating Session...</span>
                                </>
                            ) : (
                                <span>Sign In to Faith Ledger</span>
                            )}
                        </button>
                    </form>
                </div>

                {/* Security Notice */}
                <p className="mt-6 text-center text-[11px] text-slate-500">
                    All sign-in operations and session tokens are strictly scoped to the Household of Love Church governance audit trail.
                </p>
            </div>
        </div>
    );
}