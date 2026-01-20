'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, BookOpen, Calculator, Loader2, Coffee, Bookmark, BookmarkCheck } from 'lucide-react';
import QuestionCard from './QuestionCard';
import QuestionSetView from './QuestionSetView';
import './MockTest.css';

// Timer constants (in seconds)
const MODULE_TIMES: Record<string, number> = {
    ReadingWriting: 32 * 60, // 32 minutes
    Math: 35 * 60           // 35 minutes
};
const BREAK_TIME = 10 * 60; // 10 minutes

// Get time limit for a module in seconds
// Uses extracted timeLimit from PDF if available, otherwise falls back to defaults
const getModuleTimeLimit = (module: Module | undefined): number => {
    if (!module) return MODULE_TIMES.ReadingWriting; // Default fallback

    // If module has extracted timeLimit (in minutes), convert to seconds
    if (module.timeLimit && module.timeLimit > 0) {
        return module.timeLimit * 60;
    }

    // Fall back to default times based on section
    return MODULE_TIMES[module.section] || MODULE_TIMES.ReadingWriting;
};

interface QuestionSet {
    id: number;
    orderIndex?: number;
    passage?: string | null;
    passageIntro?: string | null;
    hasFigure?: boolean;
    figureData?: string | null;
    figureCaption?: string | null;
    questions?: Question[];
}

interface Question {
    id: number;
    questionNumber: number;
    questionText: string;
    questionType: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    orderInSet?: number;
    moduleSection?: string;
    moduleNumber?: number;
    moduleId?: number;
    questionSetId?: number;
    questionSet?: QuestionSet;
}

interface Module {
    id: number;
    section: string;
    moduleNumber: number;
    timeLimit?: number | null; // Time limit in minutes from PDF extraction
    questionSets?: QuestionSet[];
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

    // Bookmark state
    const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
    const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);

    // Cross-off state: questionId -> Set of crossed-off options
    const [crossedOff, setCrossedOff] = useState<Record<number, Set<string>>>({});

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

                // Flatten all questions from all modules via questionSets
                const questions: Question[] = [];
                const sortedModules = [...data.data.modules].sort((a: Module, b: Module) => {
                    // Sort: ReadingWriting before Math, then by module number
                    if (a.section !== b.section) {
                        return a.section === 'ReadingWriting' ? -1 : 1;
                    }
                    return a.moduleNumber - b.moduleNumber;
                });

                sortedModules.forEach((module: Module) => {
                    // Sort question sets by orderIndex
                    const sortedSets = [...(module.questionSets || [])].sort(
                        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
                    );

                    sortedSets.forEach((qs: QuestionSet) => {
                        // Sort questions within the set
                        const sortedQuestions = [...(qs.questions || [])].sort(
                            (a, b) => a.questionNumber - b.questionNumber
                        );

                        sortedQuestions.forEach(q => {
                            questions.push({
                                ...q,
                                moduleSection: module.section,
                                moduleNumber: module.moduleNumber,
                                moduleId: module.id,
                                questionSetId: qs.id,
                                questionSet: {
                                    id: qs.id,
                                    passage: qs.passage,
                                    passageIntro: qs.passageIntro,
                                    hasFigure: qs.hasFigure,
                                    figureData: qs.figureData,
                                    figureCaption: qs.figureCaption
                                }
                            });
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
                    setTimeRemaining(getModuleTimeLimit(modules[0]));
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

    const handleToggleBookmark = (questionId: number) => {
        setBookmarks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) {
                newSet.delete(questionId);
            } else {
                newSet.add(questionId);
            }
            return newSet;
        });
    };

    const handleToggleCrossOff = (questionId: number, option: string) => {
        setCrossedOff(prev => {
            const questionCrossedOff = new Set(prev[questionId] || []);
            if (questionCrossedOff.has(option)) {
                questionCrossedOff.delete(option);
            } else {
                questionCrossedOff.add(option);
            }
            return { ...prev, [questionId]: questionCrossedOff };
        });
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

    // Get information about the current question set for split-view rendering
    const getSetInfo = useCallback(() => {
        const current = allQuestions[currentQuestionIndex];
        if (!current?.questionSetId) return null;

        const setQuestions = allQuestions.filter(
            q => q.questionSetId === current.questionSetId
        );
        const indexInSet = setQuestions.findIndex(q => q.id === current.id);

        return {
            questions: setQuestions,
            indexInSet,
            total: setQuestions.length,
            // Only use split view for Reading/Writing with 2+ questions
            shouldSplit: setQuestions.length > 1 && current.moduleSection === 'ReadingWriting'
        };
    }, [allQuestions, currentQuestionIndex]);

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
            setTimeRemaining(getModuleTimeLimit(modules[nextModuleIdx]));
        }
    }, [currentModuleIndex, modules, getModuleStartIndex, submitTest]);

    // Resume from break
    const resumeFromBreak = useCallback(() => {
        const nextModuleIdx = currentModuleIndex + 1;
        if (nextModuleIdx < modules.length) {
            setIsOnBreak(false);
            setCurrentModuleIndex(nextModuleIdx);
            setCurrentQuestionIndex(getModuleStartIndex(nextModuleIdx));
            setTimeRemaining(getModuleTimeLimit(modules[nextModuleIdx]));
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
            setTimeRemaining(getModuleTimeLimit(modules[currentQModuleIdx]));
        }
    }, [currentQuestionIndex, allQuestions, modules, testStarted, isOnBreak, currentModuleIndex]);

    // Warn user and auto-submit when leaving during test
    useEffect(() => {
        if (!testStarted || !sessionId || submitting) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // Show browser's native confirmation dialog
            e.preventDefault();
            e.returnValue = 'You have an incomplete test. Your answers will be submitted if you leave.';
            return e.returnValue;
        };

        const handlePageHide = (e: PageTransitionEvent) => {
            // Only submit if page is actually being unloaded (not cached for back-forward)
            if (!e.persisted && sessionId) {
                // Use sendBeacon for reliable submission during page unload
                const blob = new Blob(
                    [JSON.stringify({ action: 'submit' })],
                    { type: 'application/json' }
                );
                navigator.sendBeacon(`/api/sessions/${sessionId}`, blob);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [testStarted, sessionId, submitting]);

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
                            }).map(module => {
                                // Count questions through questionSets
                                const questionCount = (module.questionSets || []).reduce(
                                    (sum, qs) => sum + (qs.questions?.length || 0), 0
                                );
                                return (
                                    <div key={module.id} className="module-item">
                                        <div className="module-icon">
                                            {module.section === 'Math' ? <Calculator size={24} /> : <BookOpen size={24} />}
                                        </div>
                                        <div className="module-info">
                                            <span className="module-name">
                                                {module.section === 'ReadingWriting' ? 'Reading & Writing' : 'Math'} Module {module.moduleNumber}
                                            </span>
                                            <span className="module-count">
                                                {questionCount} questions
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
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
                {(() => {
                    const setInfo = getSetInfo();

                    // Use split-view for R/W multi-question sets
                    if (setInfo?.shouldSplit && currentQuestion.questionSet) {
                        return (
                            <QuestionSetView
                                questionsInSet={setInfo.questions}
                                currentIndexInSet={setInfo.indexInSet}
                                questionSet={currentQuestion.questionSet}
                                answers={answers}
                                onAnswerSelect={(questionId: number, answer: string) => handleAnswerSelect(questionId, answer)}
                                onPrevInSet={() => {
                                    const prevQ = setInfo.questions[setInfo.indexInSet - 1];
                                    if (prevQ) {
                                        const idx = allQuestions.findIndex(q => q.id === prevQ.id);
                                        if (idx >= 0) goToQuestion(idx);
                                    }
                                }}
                                onNextInSet={() => {
                                    const nextQ = setInfo.questions[setInfo.indexInSet + 1];
                                    if (nextQ) {
                                        const idx = allQuestions.findIndex(q => q.id === nextQ.id);
                                        if (idx >= 0) goToQuestion(idx);
                                    }
                                }}
                                globalQuestionNumber={currentQuestion.questionNumber}
                                isBookmarked={bookmarks.has(currentQuestion.id)}
                                onBookmarkToggle={() => handleToggleBookmark(currentQuestion.id)}
                                crossedOffOptions={crossedOff[currentQuestion.id]}
                                onToggleCrossOff={(option: string) => handleToggleCrossOff(currentQuestion.id, option)}
                            />
                        );
                    }

                    // Default: use QuestionCard for single questions or Math
                    return (
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
                            questionSet={currentQuestion.questionSet}
                            isFirstInSet={currentQuestion.orderInSet === 0 || currentQuestionIndex === 0 ||
                                allQuestions[currentQuestionIndex - 1]?.questionSetId !== currentQuestion.questionSetId}
                            isBookmarked={bookmarks.has(currentQuestion.id)}
                            onBookmarkToggle={() => handleToggleBookmark(currentQuestion.id)}
                            crossedOffOptions={crossedOff[currentQuestion.id]}
                            onToggleCrossOff={(option: string) => handleToggleCrossOff(currentQuestion.id, option)}
                        />
                    );
                })()}
            </div>

            <div className="question-navigator">
                <div className="navigator-header">
                    <button
                        className={`bookmark-filter-btn ${showBookmarkedOnly ? 'active' : ''}`}
                        onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
                        title={showBookmarkedOnly ? 'Show all questions' : 'Show bookmarked only'}
                    >
                        {showBookmarkedOnly ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                        {showBookmarkedOnly ? 'Show All' : `Bookmarked (${bookmarks.size})`}
                    </button>
                </div>
                <div className="question-grid">
                    {allQuestions.map((q, index) => {
                        const isInCurrentModule = q.moduleSection === currentModule?.section &&
                            q.moduleNumber === currentModule?.number;
                        const isBookmarked = bookmarks.has(q.id);

                        // Filter out non-bookmarked questions when filter is active
                        if (showBookmarkedOnly && !isBookmarked) {
                            return null;
                        }

                        return (
                            <button
                                key={q.id}
                                onClick={() => isInCurrentModule && goToQuestion(index)}
                                className={`question-number ${index === currentQuestionIndex ? 'active' : ''} ${answers[q.id] ? 'answered' : ''} ${q.moduleSection === 'Math' ? 'math' : 'rw'} ${!isInCurrentModule ? 'disabled' : ''} ${isBookmarked ? 'bookmarked' : ''}`}
                                title={`${q.moduleSection} M${q.moduleNumber} Q${q.questionNumber}${isBookmarked ? ' (Bookmarked)' : ''}`}
                                disabled={!isInCurrentModule}
                            >
                                {index + 1}
                                {isBookmarked && <span className="bookmark-indicator"><Bookmark size={10} /></span>}
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
