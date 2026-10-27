'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import OCRUploader, { ExtractedReceiptData } from '@/components/ocr-uploader';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function NewRequisitionPage() {
    const router = useRouter();
    const supabase = createClient();

    const [vendorName, setVendorName] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [category, setCategory] = useState<'allowances' | 'welfare' | 'utilities' | 'fuel' | 'capital_special'>('fuel');
    const [sundayServiceTag, setSundayServiceTag] = useState('');

    useEffect(() => {
        setSundayServiceTag(new Date().toISOString().split('T')[0]);
    }, []);
    const [description, setDescription] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [ocrPayload, setOcrPayload] = useState<ExtractedReceiptData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleOCRExtracted = (data: ExtractedReceiptData, file: File) => {
        setReceiptFile(file);
        setOcrPayload(data);
        if (data.vendorName) setVendorName(data.vendorName);
        if (data.amount) setAmount(data.amount);
        if (data.suggestedCategory) setCategory(data.suggestedCategory);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setIsSubmitting(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated.');

            // Fetch user profile for tenant_id
            const { data: profile, error: profileErr } = await supabase
                .from('profiles')
                .select('tenant_id, role')
                .eq('id', user.id)
                .single();

            if (profileErr || !profile) throw new Error('Could not identify user organization.');

            let receiptStoragePath: string | null = null;

            // 1. Upload receipt to Supabase Storage if file attached
            if (receiptFile) {
                const fileExt = receiptFile.name.split('.').pop();
                const fileName = `${profile.tenant_id}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('receipts')
                    .upload(fileName, receiptFile);

                if (!uploadError) {
                    receiptStoragePath = fileName;
                }
            }

            // 2. Insert into expense_requisitions adhering to Rule 1 (pending_compliance)
            const { data: newReq, error: insertError } = await supabase
                .from('expense_requisitions')
                .insert({
                    tenant_id: profile.tenant_id,
                    initiated_by: user.id,
                    category,
                    amount: Number(amount),
                    description: description || `Payment to ${vendorName}`,
                    sunday_service_tag: sundayServiceTag,
                    receipt_storage_path: receiptStoragePath,
                    ocr_raw_payload: ocrPayload ? { raw: ocrPayload.rawText } : null,
                    status: 'pending_compliance',
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // 3. Log audit event
            await supabase.from('audit_logs').insert({
                tenant_id: profile.tenant_id,
                actor_id: user.id,
                action: 'RULE_1_INITIATED',
                entity_name: 'expense_requisitions',
                entity_id: newReq.id,
                metadata_diff: {
                    category,
                    amount,
                    sunday_service_tag: sundayServiceTag,
                },
            });

            router.push('/requests');
        } catch (err: any) {
            console.error('Requisition creation error:', err);
            setErrorMsg(err.message || 'Failed to submit requisition.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl px-4 py-8">
            <div className="mb-6 flex items-center justify-between">
                <Link
                    href="/requests"
                    className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-amber-400"
                >
                    <ArrowLeft className="h-4 w-4" /> Back to Requisitions
                </Link>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20">
                    <Sparkles className="h-3.5 w-3.5" /> Rule 1: Initiation Pipeline
                </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl">
                <h1 className="text-xl font-bold text-slate-100">New Expense Requisition</h1>
                <p className="mt-1 text-xs text-slate-400">
                    Upload an invoice or receipt to auto-fill details, then submit for Admin 1 compliance review.
                </p>

                <div className="mt-6">
                    <OCRUploader onExtractionComplete={handleOCRExtracted} />
                </div>

                {errorMsg && (
                    <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Expense Category
                            </label>
                            <select
                                value={category}
                                onChange={(e: any) => setCategory(e.target.value)}
                                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                            >
                                <option value="allowances">Allowances (Pastor / Ministers)</option>
                                <option value="welfare">Welfare & Members Support</option>
                                <option value="utilities">Utilities (Power, Water, Sound)</option>
                                <option value="fuel">Fuel (Generator & Service Ops)</option>
                                <option value="capital_special">Capital / Special Project</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Sunday Service Tag
                            </label>
                            <input
                                type="date"
                                required
                                value={sundayServiceTag}
                                onChange={(e) => setSundayServiceTag(e.target.value)}
                                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Vendor / Payee Name
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. TotalEnergies Kubwa, Sound Tech"
                                value={vendorName}
                                onChange={(e) => setVendorName(e.target.value)}
                                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Amount (NGN)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                            Purpose / Description
                        </label>
                        <textarea
                            rows={3}
                            required
                            placeholder="State purpose of expenditure and authorization notes..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex justify-end pt-3">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {isSubmitting ? 'Routing to Compliance...' : 'Submit to Admin 1 Compliance'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}