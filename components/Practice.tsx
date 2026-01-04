'use client';
import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle, XCircle, HelpCircle, ArrowRight, Loader2, History, ChevronDown, ChevronUp } from 'lucide-react';
import './Practice.css';

interface QuestionData {
    id?: number;
    category?: string;
    passage?: string;
    question: string;
    options?: string[];
    correctAnswer?: string;
    correctLetter?: string;
    explanation?: string;
}

interface HistoryItem {
    id: number;
    questionText: string;
    category: string;
    isCorrect: boolean;
    answeredAt: string;
    passage?: string;
    options: string[];
    userAnswer: string;
    correctAnswer: string;
    explanation?: string;
}

const Practice = () => {
    const [activeTab, setActiveTab] = useState('practice');
    const [category, setCategory] = useState('random');
    const [question, setQuestion] = useState<QuestionData | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [result, setResult] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(null);
    const [explanation, setExplanation] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAnswer, setCheckingAnswer] = useState(false);
    const [loadingExplanation, setLoadingExplanation] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const categories = [
        { id: 'random', label: 'Random' },
        { id: 'math', label: 'Math' },
        { id: 'reading', label: 'Reading' },
        { id: 'writing', label: 'Writing & Language' },
    ];

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const response = await fetch('/api/practice?action=history');
            const data = await response.json();
            if (data.success) {
                setHistory(data.data);
            }
        } catch (err) {
            console.error('Error loading history:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const generateQuestion = async () => {
        setLoading(true);
        setQuestion(null);
        setUserAnswer('');
        setResult(null);
        setExplanation('');

        try {
            const response = await fetch('/api/practice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate', category })
            });
            const data = await response.json();
            if (data.success) {
                setQuestion(data.data);
            }
        } catch (err) {
            console.error('Error generating question:', err);
        } finally {
            setLoading(false);
        }
    };

    const checkAnswer = async () => {
        if (!question || !userAnswer) return;

        setCheckingAnswer(true);
        try {
            const response = await fetch('/api/practice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'check', questionId: question.id, questionData: question, userAnswer })
            });
            const data = await response.json();
            if (data.success) {
                setResult(data.data);
            }
        } catch (err) {
            console.error('Error checking answer:', err);
        } finally {
            setCheckingAnswer(false);
        }
    };

    const getExplanation = async () => {
        if (!question) return;

        setLoadingExplanation(true);
        try {
            const response = await fetch('/api/practice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'explain', questionId: question.id, questionData: question, userAnswer })
            });
            const data = await response.json();
            if (data.success) {
                setExplanation(data.data.explanation);
            }
        } catch (err) {
            console.error('Error getting explanation:', err);
        } finally {
            setLoadingExplanation(false);
        }
    };

    const nextQuestion = () => {
        generateQuestion();
    };

    const toggleExpanded = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const renderPracticeTab = () => (
        <>
            {/* Category Selector */}
            <div className="category-selector">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        className={`category-btn ${category === cat.id ? 'active' : ''}`}
                        onClick={() => setCategory(cat.id)}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Question Area */}
            <div className="practice-content">
                {!question && !loading && (
                    <div className="start-prompt glass-card">
                        <Sparkles size={48} />
                        <h3>Ready to Practice?</h3>
                        <p>Click the button below to generate an AI-powered SAT question.</p>
                        <button className="btn btn-primary btn-lg" onClick={generateQuestion}>
                            Generate Question
                        </button>
                    </div>
                )}

                {loading && (
                    <div className="loading-state glass-card">
                        <Loader2 size={48} className="spinner" />
                        <p>Generating your question...</p>
                    </div>
                )}

                {question && !loading && (
                    <div className="question-area glass-card">
                        <div className="question-category-badge">
                            {question.category || category}
                        </div>
                        <div className="question-text">
                            {question.passage && (
                                <div className="question-passage">
                                    <p>{question.passage}</p>
                                </div>
                            )}
                            <p className="question-prompt">{question.question}</p>
                        </div>

                        {/* Options */}
                        {question.options && (
                            <div className="answer-options">
                                {question.options.map((option, index) => (
                                    <button
                                        key={index}
                                        className={`option-btn ${userAnswer === option ? 'selected' : ''} ${result ? (option === result.correctAnswer ? 'correct' : userAnswer === option && !result.isCorrect ? 'incorrect' : '') : ''
                                            }`}
                                        onClick={() => !result && setUserAnswer(option)}
                                        disabled={!!result}
                                    >
                                        <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                                        <span className="option-text">{option}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Free Response */}
                        {!question.options && (
                            <div className="free-response">
                                <input
                                    type="text"
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    placeholder="Enter your answer..."
                                    disabled={!!result}
                                />
                            </div>
                        )}

                        {/* Actions */}
                        <div className="question-actions">
                            {!result ? (
                                <button
                                    className="btn btn-primary"
                                    onClick={checkAnswer}
                                    disabled={!userAnswer || checkingAnswer}
                                >
                                    {checkingAnswer ? (
                                        <>
                                            <Loader2 size={18} className="spinner" />
                                            Checking...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle size={18} />
                                            Check Answer
                                        </>
                                    )}
                                </button>
                            ) : (
                                <>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={getExplanation}
                                        disabled={loadingExplanation || !!explanation}
                                    >
                                        {loadingExplanation ? (
                                            <>
                                                <Loader2 size={18} className="spinner" />
                                                Loading...
                                            </>
                                        ) : (
                                            <>
                                                <HelpCircle size={18} />
                                                Why?
                                            </>
                                        )}
                                    </button>
                                    <button className="btn btn-primary" onClick={nextQuestion}>
                                        Next Question
                                        <ArrowRight size={18} />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Result */}
                        {result && (
                            <div className={`result-banner ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                                {result.isCorrect ? (
                                    <>
                                        <CheckCircle size={24} />
                                        <span>Correct! Well done.</span>
                                    </>
                                ) : (
                                    <>
                                        <XCircle size={24} />
                                        <span>Incorrect. The correct answer is: {result.correctAnswer}</span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Explanation */}
                        {explanation && (
                            <div className="explanation-box">
                                <h4>Explanation</h4>
                                <p>{explanation}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );

    const renderHistoryTab = () => (
        <div className="history-content">
            {loadingHistory ? (
                <div className="loading-state glass-card">
                    <Loader2 size={48} className="spinner" />
                    <p>Loading practice history...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="empty-state glass-card">
                    <History size={48} />
                    <h3>No Practice History Yet</h3>
                    <p>Complete some practice questions to see your history here.</p>
                    <button className="btn btn-primary" onClick={() => setActiveTab('practice')}>
                        Start Practicing
                    </button>
                </div>
            ) : (
                <div className="history-list">
                    {history.map((item) => (
                        <div key={item.id} className="history-item glass-card">
                            <div
                                className="history-header"
                                onClick={() => toggleExpanded(item.id)}
                            >
                                <div className="history-info">
                                    <span className={`history-badge ${item.isCorrect ? 'correct' : 'incorrect'}`}>
                                        {item.isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                        {item.isCorrect ? 'Correct' : 'Incorrect'}
                                    </span>
                                    <span className="history-category">{item.category}</span>
                                    <span className="history-date">
                                        {new Date(item.answeredAt).toLocaleDateString()} at {new Date(item.answeredAt).toLocaleTimeString()}
                                    </span>
                                </div>
                                <button className="expand-btn">
                                    {expandedId === item.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                            </div>
                            <p className="history-question">{item.questionText}</p>

                            {expandedId === item.id && (
                                <div className="history-details">
                                    {item.passage && (
                                        <div className="history-passage">
                                            <strong>Passage:</strong>
                                            <p>{item.passage}</p>
                                        </div>
                                    )}
                                    <div className="history-options">
                                        {item.options.map((option, idx) => (
                                            <div
                                                key={idx}
                                                className={`history-option ${option === item.correctAnswer ? 'correct' : ''} ${option === item.userAnswer && option !== item.correctAnswer ? 'incorrect' : ''}`}
                                            >
                                                <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                                                <span>{option}</span>
                                                {option === item.correctAnswer && <CheckCircle size={16} />}
                                                {option === item.userAnswer && option !== item.correctAnswer && <XCircle size={16} />}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="history-answer-info">
                                        <p><strong>Your Answer:</strong> {item.userAnswer}</p>
                                        <p><strong>Correct Answer:</strong> {item.correctAnswer}</p>
                                    </div>
                                    {item.explanation && (
                                        <div className="history-explanation">
                                            <strong>Explanation:</strong>
                                            <p>{item.explanation}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="practice">
            <div className="practice-header">
                <h1><Sparkles size={28} /> AI Practice</h1>
                <p>Practice with AI-generated SAT questions tailored to your needs.</p>
            </div>

            {/* Tab Selector */}
            <div className="practice-tabs">
                <button
                    className={`tab-btn ${activeTab === 'practice' ? 'active' : ''}`}
                    onClick={() => setActiveTab('practice')}
                >
                    <Sparkles size={18} />
                    Practice
                </button>
                <button
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <History size={18} />
                    History
                </button>
            </div>

            {activeTab === 'practice' ? renderPracticeTab() : renderHistoryTab()}
        </div>
    );
};

export default Practice;
