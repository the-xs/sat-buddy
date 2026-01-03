import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'SAT Buddy - Your Intelligent Testing Companion',
    description: 'Practice SAT questions, take mock tests, and track your progress with AI-powered learning.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
