import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, BookOpen, Calculator, Loader2 } from 'lucide-react';
import { satTestAPI } from '../services/api';
import QuestionCard from './QuestionCard';
import './MockTest.css';

const MockTest = ({ test, onTestComplete }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [testData, setTestData] = useState(null);
    const [allQuestions, setAllQuestions] = useState([]);
    const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [testStarted, setTestStarted] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (test?.id) {
            loadTestData();
        }
    }, [test]);

    const loadTestData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await satTestAPI.getById(test.id);
            if (response.success) {
                setTestData(response.data);

                // Flatten all questions from all modules in order
                const questions = [];
                const sortedModules = [...response.data.modules].sort((a, b) => {
                    // Sort: ReadingWriting before Math, then by module number
                    if (a.section !== b.section) {
                        return a.section === 'ReadingWriting' ? -1 : 1;
                    }
                    return a.moduleNumber - b.moduleNumber;
                });

                sortedModules.forEach(module => {
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
            } else {
                setError('Failed to load test data');
            }
        } catch (err) {
            console.error('Error loading test:', err);
            setError(err.message || 'Failed to load test');
        } finally {
            setLoading(false);
        }
    };

    const startTest = async () => {
        try {
            setLoading(true);
            // Create session via API
            const response = await satTestAPI.createSession(test.id);
            if (response.success) {
                setSessionId(response.data.sessionId);
                setTestStarted(true);
                setCurrentQuestionIndex(0);
                setAnswers({});
            } else {
                setError('Failed to create test session');
            }
        } catch (err) {
            console.error('Error creating session:', err);
            setError(err.message || 'Failed to create test session');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerSelect = async (questionId, answer) => {
        // Update local state immediately for responsiveness
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }));

        // Record answer in backend (fire and forget for better UX)
        if (sessionId) {
            try {
                await satTestAPI.recordAnswer(sessionId, questionId, answer);
            } catch (err) {
                console.error('Error recording answer:', err);
                // Don't block the user, they can still navigate
            }
        }
    };

    const goToQuestion = (index) => {
        setCurrentQuestionIndex(index);
    };

    const nextQuestion = () => {
        if (currentQuestionIndex < allQuestions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const previousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const submitTest = async () => {
        if (!sessionId) {
            console.error('No session ID');
            return;
        }

        try {
            setSubmitting(true);

            // Submit session and get results from API
            await satTestAPI.submitSession(sessionId);
            const resultsResponse = await satTestAPI.getSessionResults(sessionId);

            if (resultsResponse.success && onTestComplete) {
                onTestComplete({
                    sessionId,
                    ...resultsResponse.data
                });
            }
        } catch (err) {
            console.error('Error submitting test:', err);
            setError(err.message || 'Failed to submit test');
        } finally {
            setSubmitting(false);
        }
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
                        options: [
                            currentQuestion.optionA,
                            currentQuestion.optionB,
                            currentQuestion.optionC,
                            currentQuestion.optionD
                        ].filter(Boolean)
                    }}
                    questionNumber={currentQuestion.questionNumber}
                    selectedAnswer={answers[currentQuestion.id]}
                    onAnswerSelect={(answer) => handleAnswerSelect(currentQuestion.id, answer)}
                    figureUrl={currentQuestion.hasFigure ? `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/tests/figure/${currentQuestion.id}` : null}
                />
            </div>

            <div className="question-navigator">
                <div className="question-grid">
                    {allQuestions.map((q, index) => (
                        <button
                            key={q.id}
                            onClick={() => goToQuestion(index)}
                            className={`question-number ${index === currentQuestionIndex ? 'active' : ''} ${answers[q.id] ? 'answered' : ''} ${q.moduleSection === 'Math' ? 'math' : 'rw'}`}
                            title={`${q.moduleSection} M${q.moduleNumber} Q${q.questionNumber}`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            </div>

            <div className="test-navigation">
                <button
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="btn btn-secondary"
                >
                    <ArrowLeft size={20} />
                    Previous
                </button>

                {currentQuestionIndex === allQuestions.length - 1 ? (
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
                ) : (
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
