'use client';

import React, { useState } from 'react';
import { createWorker } from 'tesseract.js';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface ExtractedReceiptData {
    vendorName: string;
    amount: number | null;
    date: string | null;
    suggestedCategory: 'allowances' | 'welfare' | 'utilities' | 'fuel' | 'capital_special';
    rawText: string;
}

interface OCRUploaderProps {
    onExtractionComplete: (data: ExtractedReceiptData, file: File) => void;
}

export default function OCRUploader({ onExtractionComplete }: OCRUploaderProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressStatus, setProgressStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const parseExtractedText = (text: string): ExtractedReceiptData => {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

        // 1. Detect candidate vendor name (usually one of the first 3 lines)
        const vendorName = lines.length > 0 ? lines[0] : '';

        // 2. Parse currency / total amounts (detecting Nigerian Naira formats e.g., ₦15,000, N15000, 15,000.00)
        const amountRegex = /(?:₦|n|ngn|total|amount|sum)?\s*[:=]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/gi;
        let highestAmount = 0;
        let match;

        while ((match = amountRegex.exec(text)) !== null) {
            const cleaned = match[1].replace(/,/g, '');
            const val = parseFloat(cleaned);
            if (!isNaN(val) && val > highestAmount && val < 100000000) {
                highestAmount = val;
            }
        }

        // 3. Parse transaction dates (DD/MM/YYYY, YYYY-MM-DD, or DD-MM-YYYY)
        const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/;
        const dateMatch = text.match(dateRegex);
        let extractedDate: string | null = null;

        if (dateMatch) {
            const parts = dateMatch[1].split(/[\/\-\.]/);
            if (parts[0].length === 4) {
                extractedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                extractedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        // 4. Suggest church expense category from keywords
        const lower = text.toLowerCase();
        let suggestedCategory: ExtractedReceiptData['suggestedCategory'] = 'capital_special';

        if (lower.includes('fuel') || lower.includes('pms') || lower.includes('diesel') || lower.includes('petrol') || lower.includes('filling station')) {
            suggestedCategory = 'fuel';
        } else if (lower.includes('welfare') || lower.includes('food') || lower.includes('cater') || lower.includes('hospital') || lower.includes('provision')) {
            suggestedCategory = 'welfare';
        } else if (lower.includes('aedc') || lower.includes('electric') || lower.includes('water') || lower.includes('recharge') || lower.includes('internet') || lower.includes('utility')) {
            suggestedCategory = 'utilities';
        } else if (lower.includes('honorarium') || lower.includes('allowance') || lower.includes('stipend') || lower.includes('transport')) {
            suggestedCategory = 'allowances';
        }

        return {
            vendorName,
            amount: highestAmount > 0 ? highestAmount : null,
            date: extractedDate,
            suggestedCategory,
            rawText: text,
        };
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setIsProcessing(true);
        setProgressStatus('Initializing OCR engine...');

        try {
            const worker = await createWorker('eng');
            setProgressStatus('Analyzing invoice image text...');

            const ret = await worker.recognize(file);
            await worker.terminate();

            setProgressStatus('Extracting financial parameters...');
            const parsedData = parseExtractedText(ret.data.text);

            setIsProcessing(false);
            setProgressStatus('');
            onExtractionComplete(parsedData, file);
        } catch (err: any) {
            console.error('OCR Processing error:', err);
            setError('Unable to parse the receipt image. You can still fill in the details manually.');
            setIsProcessing(false);
            setProgressStatus('');
        }
    };

    return (
        <div className="w-full rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-6 text-center transition-colors hover:border-amber-500 hover:bg-amber-50/70">
            <input
                type="file"
                id="receipt-file-input"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={isProcessing}
                onChange={handleFileUpload}
            />

            <label htmlFor="receipt-file-input" className="flex flex-col items-center justify-center cursor-pointer">
                {isProcessing ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
                        <p className="text-sm font-medium text-amber-800">{progressStatus}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="rounded-full bg-amber-100 p-3 text-amber-600">
                            <UploadCloud className="h-8 w-8" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                            Click to scan receipt or invoice voucher
                        </p>
                        <p className="text-xs text-slate-500">
                            Auto-fills Category (Allowances, Welfare, Utilities, Fuel), Vendor & Amount
                        </p>
                    </div>
                )}
            </label>

            {error && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-rose-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}