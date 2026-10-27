import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Faith Ledger | Household of Love Church',
    description: 'Financial Management and Governance System',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="bg-slate-50 text-slate-900 antialiased selection:bg-amber-500 selection:text-white">
                {children}
            </body>
        </html>
    );
}