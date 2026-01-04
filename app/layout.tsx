import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/auth';
import './globals.css';

export const metadata: Metadata = {
    title: 'SAT Buddy - Your Intelligent Testing Companion',
    description: 'Practice SAT questions, take mock tests, and track your progress with AI-powered learning.',
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    return (
        <html lang="en">
            <body>
                <SessionProvider session={session}>
                    {children}
                </SessionProvider>
            </body>
        </html>
    );
}
