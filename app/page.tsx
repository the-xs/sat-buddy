'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import PDFUploader from '@/components/PDFUploader';
import MockTest from '@/components/MockTest';
import TestResults from '@/components/TestResults';
import Analytics from '@/components/Analytics';
import Practice from '@/components/Practice';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import './App.css';

// Types
interface SATTest {
    id: number;
    name: string;
    uploadedAt: string;
    modules: Array<{
        id: number;
        section: string;
        moduleNumber: number;
        _count?: { questions: number };
    }>;
}

interface TestSession {
    sessionId: string;
    testId: number;
    testName: string;
    rwScore: number | null;
    mathScore: number | null;
    totalScore: number | null;
    totalQuestions: number;
    startedAt: string;
    completedAt: string | null;
}

interface ResultItem {
    questionNumber: number;
    moduleSection: string;
    moduleNumber: number;
    isCorrect: boolean;
    questionText: string;
    userAnswer: string | null;
    correctAnswer: string;
    options?: Record<string, string> | string[];
    explanation?: string;
}

interface SessionResults {
    sessionId: string;
    testId: number;
    testName: string;
    rwScore: number | null;
    mathScore: number | null;
    totalScore: number | null;
    totalQuestions: number;
    correctCount: number;
    results: ResultItem[];
}

export default function HomePage() {
    const [currentView, setCurrentView] = useState('dashboard');
    const [testResults, setTestResults] = useState<SessionResults | null>(null);
    const [satTests, setSatTests] = useState<SATTest[]>([]);
    const [selectedTest, setSelectedTest] = useState<SATTest | null>(null);
    const [loading, setLoading] = useState(true);
    const [pastSessions, setPastSessions] = useState<TestSession[]>([]);
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        // Load theme from localStorage
        const savedTheme = localStorage.getItem('sat-buddy-theme') || 'dark';
        setTheme(savedTheme);

        loadSATTests();
        loadPastSessions();
    }, []);

    useEffect(() => {
        // Apply theme to body
        document.body.className = '';
        if (theme !== 'dark') {
            document.body.classList.add(`theme-${theme}`);
        }
        localStorage.setItem('sat-buddy-theme', theme);
    }, [theme]);

    const loadSATTests = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/tests');
            const data = await response.json();
            if (data.success) {
                setSatTests(data.data);
            }
        } catch (err) {
            console.error('Error loading SAT tests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUploadComplete = () => {
        loadSATTests();
        setTimeout(() => {
            setCurrentView('dashboard');
        }, 2000);
    };

    const handleTestComplete = (results: unknown) => {
        setTestResults(results as SessionResults);
        loadPastSessions();
        setCurrentView('results');
    };

    const handleReturnHome = () => {
        setCurrentView('dashboard');
        setTestResults(null);
        setSelectedTest(null);
    };

    const handleSelectTest = (test: SATTest) => {
        setSelectedTest(test);
        setCurrentView('test');
    };

    const handleViewPastResults = async (sessionId: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/sessions/${sessionId}`);
            const data = await response.json();
            if (data.success) {
                setTestResults(data.data);
                setCurrentView('results');
            }
        } catch (err) {
            console.error('Error loading session results:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadPastSessions = async () => {
        try {
            const response = await fetch('/api/sessions');
            const data = await response.json();
            if (data.success) {
                setPastSessions(data.data);
            }
        } catch (err) {
            console.error('Error loading past sessions:', err);
        }
    };

    const handleViewChange = (view: string) => {
        setCurrentView(view);
        setTestResults(null);
        setSelectedTest(null);
    };

    const renderView = () => {
        switch (currentView) {
            case 'upload':
                return <PDFUploader onUploadComplete={handleUploadComplete} />;
            case 'test':
                return <MockTest test={selectedTest ?? undefined} onTestComplete={handleTestComplete} />;
            case 'results':
                return <TestResults sessionData={testResults} onReturnHome={handleReturnHome} />;
            case 'analytics':
                return <Analytics pastSessions={pastSessions} />;
            case 'practice':
                return <Practice />;
            case 'dashboard':
            default:
                return (
                    <Dashboard
                        satTests={satTests}
                        pastSessions={pastSessions}
                        onSelectTest={handleSelectTest}
                        onViewResults={handleViewPastResults}
                        loading={loading}
                    />
                );
        }
    };

    return (
        <div className="app">
            <div className="app-layout">
                <Sidebar activeView={currentView} onViewChange={handleViewChange} />
                <div className="app-content">
                    <header className="app-header">
                        <div className="container">
                            <div className="header-content">
                                <div className="header-actions">
                                    <ThemeSwitcher currentTheme={theme} onThemeChange={setTheme} />
                                    {(currentView === 'test' || currentView === 'results') && (
                                        <button onClick={handleReturnHome} className="btn btn-secondary btn-sm">
                                            Back to Dashboard
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </header>

                    <main className="app-main">
                        <div className="container">
                            {renderView()}
                        </div>
                    </main>

                    <footer className="app-footer">
                        <div className="container">
                            <p>SAT Buddy - Your intelligent testing companion</p>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}
