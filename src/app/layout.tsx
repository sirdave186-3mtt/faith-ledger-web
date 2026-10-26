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
        <html lang="en" className="dark">
            <body className="bg-slate-950 text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
                {children}
            </body>
        </html>
    );
}