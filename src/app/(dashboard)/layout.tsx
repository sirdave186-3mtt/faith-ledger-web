'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    LayoutDashboard,
    DollarSign,
    FileText,
    Users,
    Building2,
    ShieldCheck,
    Settings,
    LogOut,
    Menu,
    X,
    Church,
} from 'lucide-react';

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    adminOnly?: boolean;
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [userRole, setUserRole] = useState<string>('Staff');
    const [rawRole, setRawRole] = useState<string>('');
    const [userName, setUserName] = useState<string>('User');

    useEffect(() => {
        async function loadUser() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, role')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    setRawRole(profile.role);
                    setUserRole(profile.role.replace(/_/g, ' '));
                    setUserName(profile.full_name);
                }
            }
        }

        loadUser();
    }, [supabase]);

    const navItems: NavItem[] = [
        { label: 'Overview', href: '/', icon: LayoutDashboard },
        { label: 'Income & Giving', href: '/income', icon: DollarSign },
        { label: 'Requisitions', href: '/requests', icon: FileText },
        { label: 'Attendance', href: '/attendance', icon: Users },
        { label: 'Vendors', href: '/vendors', icon: Building2 },
        { label: 'User Roles', href: '/settings/users', icon: Settings, adminOnly: true },
        { label: 'Audit Trail', href: '/audit', icon: ShieldCheck },
    ];

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
    };

    const isLeader = ['senior_pastor', 'admin_1'].includes(rawRole);

    return (
        <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden font-sans">
            {/* Mobile Menu Backdrop */}
            {isMobileOpen && (
                <div
                    onClick={() => setIsMobileOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden"
                />
            )}

            {/* Side Navigation Bar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Brand / Church Header */}
                <div className="flex h-18 items-center justify-between border-b border-slate-200 px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                            <Church className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                                Faith Ledger
                            </span>
                            <p className="text-xs font-bold text-slate-900 line-clamp-1">
                                Household of Love
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsMobileOpen(false)}
                        className="text-slate-400 hover:text-slate-600 lg:hidden"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation Items */}
                <nav className="flex-1 space-y-1.5 px-3 py-6 overflow-y-auto">
                    {navItems.map((item) => {
                        // Hide User Roles management if the user is not Senior Pastor or Admin 1
                        if (item.adminOnly && !isLeader) {
                            return null;
                        }

                        const Icon = item.icon;
                        const isActive =
                            item.href === '/'
                                ? pathname === '/'
                                : pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setIsMobileOpen(false)}
                                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-medium transition-all ${isActive
                                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm shadow-amber-500/20'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    }`}
                            >
                                <Icon className={`h-4 w-4 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Role Card & Logout */}
                <div className="border-t border-slate-200 p-4">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 p-3">
                        <div className="truncate pr-2">
                            <p className="truncate text-xs font-bold text-slate-900">{userName}</p>
                            <p className="text-[10px] uppercase font-bold text-amber-700 font-mono tracking-wider truncate">
                                {userRole}
                            </p>
                        </div>
                        <button
                            onClick={handleSignOut}
                            title="Sign Out"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition shrink-0"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Mobile Header Bar */}
                <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
                    <button
                        onClick={() => setIsMobileOpen(true)}
                        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <span className="text-xs font-bold text-slate-900">
                        Household of Love Church, Kubwa
                    </span>
                    <div className="w-5" />
                </header>

                {/* Dynamic Page Scroll Container */}
                <main className="flex-1 overflow-y-auto bg-slate-50">
                    {children}
                </main>
            </div>
        </div>
    );
}