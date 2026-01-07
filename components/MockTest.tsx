'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, BookOpen, Calculator, Loader2, Coffee } from 'lucide-react';
import QuestionCard from './QuestionCard';
import './MockTest.css';

// Timer constants (in seconds)
const MODULE_TIMES: Record<string, number> = {
    ReadingWriting: 32 * 60, // 32 minutes
    Math: 35 * 60           // 35 minutes
};
const BREAK_TIME = 10 * 60; // 10 minutes

interface Question {
    id: number;
    questionNumber: number;
    questionText: string;
    questionType: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    hasFigure?: boolean;
    moduleSection?: string;
    moduleNumber?: number;
    moduleId?: number;
}

interface Module {
    id: number;
    section: string;
    moduleNumber: number;
    questions?: Question[];
}

interface TestData {
    id: number;
    name: string;
    modules: Module[];
}

interface MockTestProps {
    test?: { id: number };
    onTestComplete?: (results: unknown) => void;
}

const MockTest = ({ test, onTestComplete }: MockTestProps) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testData, setTestData] = useState<TestData | null>(null);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [testStarted, setTestStarted] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Timer state
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isOnBreak, setIsOnBreak] = useState(false);
    const [modules, setModules] = useState<Module[]>([]); // Sorted modules for navigation
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (test?.id) {
            loadTestData();
        }
    }, [test]);

    const loadTestData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/tests/${test?.id}`);
            const data = await response.json();
            if (data.success) {
                setTestData(data.data);

                // Flatten all questions from all modules in order
                const questions: Question[] = [];
                const sortedModules = [...data.data.modules].sort((a: Module, b: Module) => {
                    // Sort: ReadingWriting before Math, then by module number
                    if (a.section !== b.section) {
                        return a.section === 'ReadingWriting' ? -1 : 1;
                    }
                    return a.moduleNumber - b.moduleNumber;
                });

                sortedModules.forEach((module: Module) => {
                    const sortedQuestions = [...(module.questions || [])].sort(
                        (a, b) => a.questionNumber - b.questionNumber
                    );
                    sortedQuestions.forEach(q => {
                        questions.push({
                            ...q,
                            moduleSection: module.section,
                            moduleNumber: module.moduleNumber,
                            moduleId: module.id
                        });
                    });
                });

                setAllQuestions(questions);
                setModules(sortedModules); // Store for module navigation
                setCurrentModuleIndex(0);
            } else {
                setError('Failed to load test data');
            }
        } catch (err) {
            console.error('Error loading test:', err);
            setError(err instanceof Error ? err.message : 'Failed to load test');
        } finally {
            setLoading(false);
        }
    };

    const startTest = async () => {
        try {
            setLoading(true);
            // Create session via API
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ testId: test?.id })
            });
            const data = await response.json();
            if (data.success) {
                setSessionId(data.data.sessionId);
                setTestStarted(true);
                setCurrentQuestionIndex(0);
                setCurrentModuleIndex(0);
                setAnswers({});
                setIsOnBreak(false);
                // Initialize timer for first module
                if (modules.length > 0) {
                    const firstModuleSection = modules[0].section;
                    setTimeRemaining(MODULE_TIMES[firstModuleSection]);
                }
            } else {
                setError('Failed to create test session');
            }
        } catch (err) {
            console.error('Error creating session:', err);
            setError(err instanceof Error ? err.message : 'Failed to create test session');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSelect = async (questionId: number, answer: string) => {
        // Update local state immediately for responsiveness
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }));

        // Record answer in backend (fire and forget for better UX)
        if (sessionId) {
            try {
                await fetch(`/api/sessions/${sessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'answer', questionId, answer })
                });
            } catch (err) {
                console.error('Error recording answer:', err);
                // Don't block the user, they can still navigate
            }
        }
    };

    const goToQuestion = (index: number) => {
        setCurrentQuestionIndex(index);
    };

    // Get module boundaries for current question
    const getModuleBounds = useCallback(() => {
        const current = allQuestions[currentQuestionIndex];
        if (!current) return { start: 0, end: allQuestions.length };

        let start = 0;
        let end = allQuestions.length;

        for (let i = 0; i < allQuestions.length; i++) {
            const q = allQuestions[i];
            if (q.moduleSection === current.moduleSection && q.moduleNumber === current.moduleNumber) {
                if (start === 0 || i < start) start = i;
                end = i + 1;
            }
        }
        return { start, end };
    }, [allQuestions, currentQuestionIndex]);

    const nextQuestion = () => {
        const { end } = getModuleBounds();
        // Only allow moving to next question within current module
        if (currentQuestionIndex < end - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const previousQuestion = () => {
        const { start } = getModuleBounds();
        // Only allow moving to previous question within current module
        if (currentQuestionIndex > start) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const isFirstInModule = () => {
        const { start } = getModuleBounds();
        return currentQuestionIndex === start;
    };

    const isLastInModule = () => {
        const { end } = getModuleBounds();
        return currentQuestionIndex === end - 1;
    };

    const submitTest = useCallback(async () => {
        if (!sessionId) {
            console.error('No session ID');
            return;
        }

        try {
            setSubmitting(true);

            // Submit session and get results from API
            await fetch(`/api/sessions/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'submit' })
            });
            const resultsResponse = await fetch(`/api/sessions/${sessionId}`);
            const resultsData = await resultsResponse.json();

            if (resultsData.success && onTestComplete) {
                onTestComplete({
                    sessionId,
                    ...resultsData.data
                });
            }
        } catch (err) {
            console.error('Error submitting test:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit test');
        } finally {
            setSubmitting(false);
        }
    }, [sessionId, onTestComplete]);

    // Get the first question index for a given module index
    const getModuleStartIndex = useCallback((moduleIdx: number) => {
        if (!modules[moduleIdx]) return 0;
        const targetModule = modules[moduleIdx];
        for (let i = 0; i < allQuestions.length; i++) {
            if (allQuestions[i].moduleSection === targetModule.section &&
                allQuestions[i].moduleNumber === targetModule.moduleNumber) {
                return i;
            }
        }
        return 0;
    }, [modules, allQuestions]);

    // Advance to next module or trigger break/submit
    const advanceModule = useCallback(() => {
        const nextModuleIdx = currentModuleIndex + 1;

        if (nextModuleIdx >= modules.length) {
            // All modules complete - submit test
            submitTest();
            return;
        }

        const currentSection = modules[currentModuleIndex]?.section;
        const nextSection = modules[nextModuleIdx]?.section;

        // Check if transitioning from R/W to Math (break required)
        if (currentSection === 'ReadingWriting' && nextSection === 'Math') {
            setIsOnBreak(true);
            setTimeRemaining(BREAK_TIME);
        } else {
            // Same section, move to next module immediately
            setCurrentModuleIndex(nextModuleIdx);
            setCurrentQuestionIndex(getModuleStartIndex(nextModuleIdx));
            setTimeRemaining(MODULE_TIMES[nextSection]);
        }
    }, [currentModuleIndex, modules, getModuleStartIndex, submitTest]);

    // Resume from break
    const resumeFromBreak = useCallback(() => {
        const nextModuleIdx = currentModuleIndex + 1;
        if (nextModuleIdx < modules.length) {
            setIsOnBreak(false);
            setCurrentModuleIndex(nextModuleIdx);
            setCurrentQuestionIndex(getModuleStartIndex(nextModuleIdx));
            setTimeRemaining(MODULE_TIMES[modules[nextModuleIdx].section]);
        }
    }, [currentModuleIndex, modules, getModuleStartIndex]);

    // Timer countdown effect
    useEffect(() => {
        if (!testStarted || loading || submitting) {
            return;
        }

        timerRef.current = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 1) {
                    // Time's up for current phase
                    if (isOnBreak) {
                        // Break ended, move to next module
                        setTimeout(() => resumeFromBreak(), 0);
                    } else {
                        // Module time ended, advance
                        setTimeout(() => advanceModule(), 0);
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [testStarted, loading, submitting, isOnBreak, advanceModule, resumeFromBreak]);

    // Track module changes and reset timer when module changes
    useEffect(() => {
        if (!testStarted || isOnBreak || allQuestions.length === 0) return;

        const currentQ = allQuestions[currentQuestionIndex];
        if (!currentQ) return;

        // Find the module index for the current question
        const currentQModuleIdx = modules.findIndex(
            m => m.section === currentQ.moduleSection && m.moduleNumber === currentQ.moduleNumber
        );

        // If we've moved to a different module, update module index and reset timer
        if (currentQModuleIdx !== -1 && currentQModuleIdx !== currentModuleIndex) {
            setCurrentModuleIndex(currentQModuleIdx);
            setTimeRemaining(MODULE_TIMES[modules[currentQModuleIdx].section]);
        }
    }, [currentQuestionIndex, allQuestions, modules, testStarted, isOnBreak, currentModuleIndex]);

    // Format time as MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getAnsweredCount = () => {
        return Object.keys(answers).length;
    };

    const getCurrentModule = () => {
        if (!allQuestions[currentQuestionIndex]) return null;
        const q = allQuestions[currentQuestionIndex];
        return { section: q.moduleSection, number: q.moduleNumber };
    };

    // Calculate question index within current module
    const getModuleQuestionInfo = () => {
        const current = allQuestions[currentQuestionIndex];
        if (!current) return { moduleStart: 0, moduleEnd: 0, indexInModule: 0 };

        let moduleStart = 0;
        let moduleEnd = 0;

        for (let i = 0; i < allQuestions.length; i++) {
            const q = allQuestions[i];
            if (q.moduleSection === current.moduleSection && q.moduleNumber === current.moduleNumber) {
                if (moduleEnd === 0 || i < moduleStart) moduleStart = i;
                moduleEnd = i + 1;
            }
        }

        return {
            moduleStart,
            moduleEnd,
            indexInModule: currentQuestionIndex - moduleStart + 1,
            totalInModule: moduleEnd - moduleStart
        };
    };

    if (loading) {
        return (
            <div className="test-loading">
                <Loader2 size={48} className="spinner" />
                <p>Loading test questions...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="test-error glass-card">
                <h3>Error Loading Test</h3>
                <p>{error}</p>
                <button onClick={loadTestData} className="btn btn-primary">
                    Try Again
                </button>
            </div>
        );
    }

    if (!testStarted) {
        return (
            <div className="test-config">
                <div className="config-header">
                    <h2>{testData?.name || 'SAT Practice Test'}</h2>
                    <p>Review your test before starting</p>
                </div>

                <div className="config-form glass-card">
                    <div className="test-overview">
                        <h3>Test Overview</h3>
                        <div className="module-list">
                            {testData?.modules?.sort((a, b) => {
                                if (a.section !== b.section) {
                                    return a.section === 'ReadingWriting' ? -1 : 1;
                                }
                                return a.moduleNumber - b.moduleNumber;
                            }).map(module => (
                                <div key={module.id} className="module-item">
                                    <div className="module-icon">
                                        {module.section === 'Math' ? <Calculator size={24} /> : <BookOpen size={24} />}
                                    </div>
                                    <div className="module-info">
                                        <span className="module-name">
                                            {module.section === 'ReadingWriting' ? 'Reading & Writing' : 'Math'} Module {module.moduleNumber}
                                        </span>
                                        <span className="module-count">
                                            {module.questions?.length || 0} questions
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="test-total">
                            <strong>Total Questions:</strong> {allQuestions.length}
                        </div>
                    </div>

                    <button
                        onClick={startTest}
                        className="btn btn-primary btn-lg"
                        disabled={allQuestions.length === 0}
                    >
                        Start Test
                    </button>
                </div>
            </div>
        );
    }

    const currentQuestion = allQuestions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / allQuestions.length) * 100;
    const currentModule = getCurrentModule();
    const moduleInfo = getModuleQuestionInfo();

    // Break screen
    if (isOnBreak) {
        return (
            <div className="test-break">
                <div className="break-content glass-card">
                    <div className="break-header">
                        <Coffee size={64} />
                        <h2>Break Time</h2>
                        <p>Take a 10-minute break before starting the Math section.</p>
                    </div>
                    <div className="break-timer">
                        <Clock size={32} />
                        <span className="break-time">{formatTime(timeRemaining)}</span>
                    </div>
                    <div className="break-footer">
                        <p>The Math section will begin automatically when the timer ends.</p>
                        <button onClick={resumeFromBreak} className="btn btn-primary btn-lg">
                            Skip Break & Start Math
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mock-test">
            <div className="test-header">
                <div className="test-info">
                    <h2>
                        {currentModule?.section === 'Math' ? <Calculator size={24} /> : <BookOpen size={24} />}
                        {currentModule?.section === 'ReadingWriting' ? 'Reading & Writing' : 'Math'}
                        {' '}Module {currentModule?.number}
                    </h2>
                    <p>Question {moduleInfo.indexInModule} of {moduleInfo.totalInModule} (Overall: {currentQuestionIndex + 1}/{allQuestions.length})</p>
                </div>
                <div className="test-stats">
                    <div className={`stat timer ${timeRemaining < 300 ? 'warning' : ''}`}>
                        <span className="stat-label">Time</span>
                        <span className="stat-value">
                            <Clock size={18} />
                            {formatTime(timeRemaining)}
                        </span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Answered</span>
                        <span className="stat-value">{getAnsweredCount()}/{allQuestions.length}</span>
                    </div>
                </div>
            </div>

            <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>


            <div className="question-container">
                <QuestionCard
                    question={{
                        ...currentQuestion,
                        questionText: currentQuestion.questionText,
                        questionType: currentQuestion.questionType,
                        options: [
                            currentQuestion.optionA,
                            currentQuestion.optionB,
                            currentQuestion.optionC,
                            currentQuestion.optionD
                        ].filter(Boolean)
                    }}
                    questionNumber={currentQuestion.questionNumber}
                    selectedAnswer={answers[currentQuestion.id]}
                    onAnswerSelect={(answer: string) => handleAnswerSelect(currentQuestion.id, answer)}
                    figureUrl={currentQuestion.hasFigure ? `/api/tests/figure/${currentQuestion.id}` : undefined}
                />
            </div>

            <div className="question-navigator">
                <div className="question-grid">
                    {allQuestions.map((q, index) => {
                        const isInCurrentModule = q.moduleSection === currentModule?.section &&
                            q.moduleNumber === currentModule?.number;
                        return (
                            <button
                                key={q.id}
                                onClick={() => isInCurrentModule && goToQuestion(index)}
                                className={`question-number ${index === currentQuestionIndex ? 'active' : ''} ${answers[q.id] ? 'answered' : ''} ${q.moduleSection === 'Math' ? 'math' : 'rw'} ${!isInCurrentModule ? 'disabled' : ''}`}
                                title={`${q.moduleSection} M${q.moduleNumber} Q${q.questionNumber}`}
                                disabled={!isInCurrentModule}
                            >
                                {index + 1}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="test-navigation">
                <button
                    onClick={previousQuestion}
                    disabled={isFirstInModule()}
                    className="btn btn-secondary"
                >
                    <ArrowLeft size={20} />
                    Previous
                </button>

                {currentModuleIndex === modules.length - 1 && isLastInModule() ? (
                    // Last question of last module - show Submit
                    <button
                        onClick={submitTest}
                        className="btn btn-success btn-lg"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={20} className="spinner" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={20} />
                                Submit Test
                            </>
                        )}
                    </button>
                ) : isLastInModule() ? (
                    // Last question of current module - show Next Module
                    <button
                        onClick={advanceModule}
                        className="btn btn-primary btn-lg"
                    >
                        Next Module
                        <ArrowRight size={20} />
                    </button>
                ) : (
                    // Regular next question within module
                    <button
                        onClick={nextQuestion}
                        className="btn btn-primary"
                    >
                        Next
                        <ArrowRight size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default MockTest;
