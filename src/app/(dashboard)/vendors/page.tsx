'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Building2,
    Plus,
    Search,
    Phone,
    User,
    CreditCard,
    Copy,
    Check,
    Edit2,
    Trash2,
    X,
    Layers,
    Fuel,
    Lightbulb,
    HeartHandshake,
    Wrench,
    ShieldCheck,
} from 'lucide-react';

interface Vendor {
    id: string;
    name: string;
    category: string;
    bank_name: string;
    account_number: string;
    contact_person: string | null;
    phone: string | null;
    created_at: string;
}

export default function VendorsPage() {
    const supabase = createClient();

    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(true);

    // Modal & Form States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [name, setName] = useState('');
    const [category, setCategory] = useState('Fuel / Energy');
    const [bankName, setBankName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchVendors = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('vendors')
            .select('*')
            .order('name', { ascending: true });

        if (!error && data) {
            setVendors(data as Vendor[]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchVendors();
    }, []);

    const openAddModal = () => {
        setEditingVendor(null);
        setName('');
        setCategory('Fuel / Energy');
        setBankName('');
        setAccountNumber('');
        setContactPerson('');
        setPhone('');
        setIsModalOpen(true);
    };

    const openEditModal = (vendor: Vendor) => {
        setEditingVendor(vendor);
        setName(vendor.name);
        setCategory(vendor.category || 'General Operations');
        setBankName(vendor.bank_name || '');
        setAccountNumber(vendor.account_number || '');
        setContactPerson(vendor.contact_person || '');
        setPhone(vendor.phone || '');
        setIsModalOpen(true);
    };

    const handleCopyAccount = (acct: string, id: string) => {
        navigator.clipboard.writeText(acct);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated.');

            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('id', user.id)
                .single();

            const tenantId = profile?.tenant_id || process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'org_hol_kubwa';

            if (editingVendor) {
                // Update Existing
                const { error } = await supabase
                    .from('vendors')
                    .update({
                        name,
                        category,
                        bank_name: bankName,
                        account_number: accountNumber,
                        contact_person: contactPerson || null,
                        phone: phone || null,
                    })
                    .eq('id', editingVendor.id);

                if (error) throw error;

                await supabase.from('audit_logs').insert({
                    tenant_id: tenantId,
                    actor_id: user.id,
                    action: 'VENDOR_UPDATED',
                    entity_name: 'vendors',
                    entity_id: editingVendor.id,
                    metadata_diff: { name, bankName, accountNumber },
                });
            } else {
                // Insert New
                const { data: newV, error } = await supabase
                    .from('vendors')
                    .insert({
                        tenant_id: tenantId,
                        name,
                        category,
                        bank_name: bankName,
                        account_number: accountNumber,
                        contact_person: contactPerson || null,
                        phone: phone || null,
                    })
                    .select()
                    .single();

                if (error) throw error;

                await supabase.from('audit_logs').insert({
                    tenant_id: tenantId,
                    actor_id: user.id,
                    action: 'VENDOR_CREATED',
                    entity_name: 'vendors',
                    entity_id: newV.id,
                    metadata_diff: { name, bankName, accountNumber },
                });
            }

            setIsModalOpen(false);
            fetchVendors();
        } catch (err: any) {
            console.error('Vendor save error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getCategoryIcon = (cat: string) => {
        const lower = cat.toLowerCase();
        if (lower.includes('fuel')) return <Fuel className="h-3.5 w-3.5 text-rose-400" />;
        if (lower.includes('light') || lower.includes('electric') || lower.includes('utility'))
            return <Lightbulb className="h-3.5 w-3.5 text-sky-400" />;
        if (lower.includes('welfare') || lower.includes('food'))
            return <HeartHandshake className="h-3.5 w-3.5 text-emerald-400" />;
        if (lower.includes('repair') || lower.includes('maintenance'))
            return <Wrench className="h-3.5 w-3.5 text-amber-400" />;
        return <Building2 className="h-3.5 w-3.5 text-slate-400" />;
    };

    const filteredVendors = useMemo(() => {
        return vendors.filter((v) => {
            const matchesSearch =
                v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (v.bank_name && v.bank_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (v.contact_person && v.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (v.account_number && v.account_number.includes(searchQuery));

            const matchesCat = categoryFilter === 'all' ? true : v.category === categoryFilter;

            return matchesSearch && matchesCat;
        });
    }, [vendors, searchQuery, categoryFilter]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* Top Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Vendors & Suppliers Directory</h1>
                    <p className="mt-1 text-xs text-slate-500">
                        Maintain verified bank account details and contact information for church operational suppliers.
                    </p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition shadow-sm"
                >
                    <Plus className="h-4 w-4" />
                    <span>Add New Vendor</span>
                </button>
            </div>

            {/* Search and Category Filters */}
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search vendor, bank, or account #..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider">
                        Category:
                    </span>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
                    >
                        <option value="all">All Categories</option>
                        <option value="Fuel / Energy">Fuel / Energy</option>
                        <option value="Utilities & Power">Utilities & Power</option>
                        <option value="Welfare Supplies">Welfare Supplies</option>
                        <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                        <option value="Sound & Media">Sound & Media</option>
                        <option value="General Operations">General Operations</option>
                    </select>
                </div>
            </div>

            {/* Vendors Grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <div className="col-span-full py-12 text-center text-xs text-slate-500">
                        Loading vendors directory...
                    </div>
                ) : filteredVendors.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-xs text-slate-500">
                        No suppliers found matching your query.
                    </div>
                ) : (
                    filteredVendors.map((vendor) => (
                        <div
                            key={vendor.id}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 hover:border-slate-300 hover:shadow-md transition"
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                        {getCategoryIcon(vendor.category)}
                                        <span>{vendor.category}</span>
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900 mt-1">{vendor.name}</h3>
                                </div>
                                <button
                                    onClick={() => openEditModal(vendor)}
                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                                    title="Edit Vendor"
                                >
                                    <Edit2 className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            {/* Bank Account Details Box */}
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Bank:</span>
                                    <span className="font-semibold text-slate-800">{vendor.bank_name || 'N/A'}</span>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-xs">
                                    <span className="text-slate-500">Account No:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-slate-900">
                                            {vendor.account_number || 'N/A'}
                                        </span>
                                        {vendor.account_number && (
                                            <button
                                                onClick={() => handleCopyAccount(vendor.account_number, vendor.id)}
                                                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-amber-600 transition"
                                                title="Copy Account Number"
                                            >
                                                {copiedId === vendor.id ? (
                                                    <Check className="h-3 w-3 text-emerald-600" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contact Person Details */}
                            <div className="space-y-1.5 text-xs text-slate-500 pt-1 border-t border-slate-100">
                                {vendor.contact_person && (
                                    <div className="flex items-center gap-2">
                                        <User className="h-3.5 w-3.5 text-slate-400" />
                                        <span>{vendor.contact_person}</span>
                                    </div>
                                )}
                                {vendor.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                                        <a
                                            href={`tel:${vendor.phone}`}
                                            className="font-mono text-slate-700 hover:text-amber-600 transition"
                                        >
                                            {vendor.phone}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add / Edit Vendor Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-slate-900">
                                {editingVendor ? 'Edit Supplier' : 'Register New Vendor'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold uppercase tracking-wider text-slate-600">
                                    Vendor / Business Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. TotalEnergies Kubwa, Sound Pro Ltd"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="block font-semibold uppercase tracking-wider text-slate-600">
                                    Supply Category
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
                                >
                                    <option value="Fuel / Energy">Fuel / Energy</option>
                                    <option value="Utilities & Power">Utilities & Power</option>
                                    <option value="Welfare Supplies">Welfare Supplies</option>
                                    <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                                    <option value="Sound & Media">Sound & Media</option>
                                    <option value="General Operations">General Operations</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold uppercase tracking-wider text-slate-600">
                                        Bank Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. GTBank, Zenith, Access"
                                        value={bankName}
                                        onChange={(e) => setBankName(e.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold uppercase tracking-wider text-slate-600">
                                        Account Number
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={10}
                                        placeholder="10-digit NUBAN"
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold uppercase tracking-wider text-slate-600">
                                        Contact Person
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Engr. Samuel"
                                        value={contactPerson}
                                        onChange={(e) => setContactPerson(e.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold uppercase tracking-wider text-slate-600">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        placeholder="080XXXXXXXX"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="rounded-lg bg-slate-100 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-200 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="rounded-lg bg-amber-500 px-5 py-2 font-bold text-slate-950 hover:bg-amber-400 transition disabled:opacity-50 shadow-sm"
                                >
                                    {isSubmitting ? 'Saving...' : editingVendor ? 'Update Vendor' : 'Save Vendor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}