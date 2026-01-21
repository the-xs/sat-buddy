'use client';
import { useState } from 'react';
import { CheckCircle, XCircle, Award, TrendingUp, Filter } from 'lucide-react';
import QuestionCard from './QuestionCard';
import { LaTeXText } from './LaTeXRenderer';
import './TestResults.css';

interface QuestionSet {
    id: number;
    passage?: string | null;
    passageIntro?: string | null;
    hasFigure?: boolean;
    figureData?: string | null;
    figureCaption?: string | null;
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
    questionSet?: QuestionSet;
}

interface SessionData {
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

interface TestResultsProps {
    sessionData: SessionData | null;
    onReturnHome: () => void;
}

type FilterType = 'all' | 'correct' | 'incorrect';

const TestResults = ({ sessionData, onReturnHome }: TestResultsProps) => {
    const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

    const results = sessionData?.results || [];
    const correctCount = sessionData?.correctCount || results.filter(r => r.isCorrect).length;
    const totalCount = sessionData?.totalQuestions || results.length;
    const incorrectCount = totalCount - correctCount;
    const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    // Filter results - unanswered questions are already marked as incorrect in backend
    const filteredResults = results.filter(result => {
        if (filter === 'all') return true;
        if (filter === 'correct') return result.isCorrect;
        if (filter === 'incorrect') return !result.isCorrect;
        return true;
    });

    const getGrade = () => {
        if (percentage >= 90) return { letter: 'A', color: 'var(--color-success)' };
        if (percentage >= 80) return { letter: 'B', color: 'hsl(142, 76%, 55%)' };
        if (percentage >= 70) return { letter: 'C', color: 'var(--color-warning)' };
        if (percentage >= 60) return { letter: 'D', color: 'hsl(38, 92%, 60%)' };
        return { letter: 'F', color: 'var(--color-error)' };
    };

    const grade = getGrade();

    const toggleExplanation = (index: number) => {
        setExpandedQuestion(expandedQuestion === index ? null : index);
    };

    const getOptionText = (options: Record<string, string> | string[] | undefined, option: string): string => {
        if (!options) return '';
        if (Array.isArray(options)) {
            const idx = ['A', 'B', 'C', 'D'].indexOf(option);
            return options[idx] || '';
        }
        return options[option] || '';
    };

    return (
        <div className="test-results">
            <div className="results-header glass-card">
                <div className="score-display">
                    <Award size={64} className="award-icon" />
                    <h1>Test Complete!</h1>
                    <div className="score-circle" style={{ '--grade-color': grade.color } as React.CSSProperties}>
                        <span className="percentage">{percentage}%</span>
                        <span className="grade">{grade.letter}</span>
                    </div>
                    <div className="score-details">
                        <div className="score-stat">
                            <CheckCircle size={24} className="icon-success" />
                            <span>{correctCount} Correct</span>
                        </div>
                        <div className="score-stat">
                            <XCircle size={24} className="icon-error" />
                            <span>{incorrectCount} Incorrect</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="results-breakdown">
                <div className="results-breakdown-header">
                    <h2>
                        <TrendingUp size={28} />
                        Question Breakdown
                    </h2>
                    <div className="results-filter">
                        <Filter size={18} />
                        <button
                            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            All ({results.length})
                        </button>
                        <button
                            className={`filter-btn correct ${filter === 'correct' ? 'active' : ''}`}
                            onClick={() => setFilter('correct')}
                        >
                            <CheckCircle size={16} />
                            Correct ({correctCount})
                        </button>
                        <button
                            className={`filter-btn incorrect ${filter === 'incorrect' ? 'active' : ''}`}
                            onClick={() => setFilter('incorrect')}
                        >
                            <XCircle size={16} />
                            Wrong ({incorrectCount})
                        </button>
                    </div>
                </div>

                <div className="results-list">
                    {filteredResults.length === 0 ? (
                        <div className="no-results glass-card">
                            <p>No {filter === 'correct' ? 'correct' : 'incorrect'} answers to show.</p>
                        </div>
                    ) : (
                        filteredResults.map((result, index) => (
                        <div key={index} className="result-item glass-card">
                            <div className="result-header">
                                <div className="result-info">
                                    <span className="question-number">Q{result.questionNumber} ({result.moduleSection === 'ReadingWriting' ? 'R&W' : 'Math'} M{result.moduleNumber})</span>
                                    {result.isCorrect ? (
                                        <div className="result-badge correct">
                                            <CheckCircle size={20} />
                                            Correct
                                        </div>
                                    ) : (
                                        <div className="result-badge incorrect">
                                            <XCircle size={20} />
                                            Incorrect
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="result-question">
                                <p><LaTeXText text={result.questionText} /></p>
                            </div>

                            <div className="result-answers">
                                <div className="answer-row">
                                    <span className="answer-label">Your Answer:</span>
                                    <span className={`answer-value ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                                        <LaTeXText text={result.userAnswer || 'Not answered'} />
                                    </span>
                                </div>
                                {!result.isCorrect && (
                                    <div className="answer-row">
                                        <span className="answer-label">Correct Answer:</span>
                                        <span className="answer-value correct">
                                            <LaTeXText text={result.correctAnswer} />
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => toggleExplanation(index)}
                                className="btn btn-outline btn-sm show-why-btn"
                            >
                                {expandedQuestion === index ? 'Hide Details' : 'Show me why'}
                            </button>

                            {expandedQuestion === index && (
                                <div className="explanation-panel">
                                    <h4>Detailed Explanation</h4>

                                    {/* Show passage if available */}
                                    {result.questionSet?.passage && (
                                        <div className="passage-review">
                                            {result.questionSet.passageIntro && (
                                                <p className="passage-intro"><em><LaTeXText text={result.questionSet.passageIntro} /></em></p>
                                            )}
                                            <div className="passage-text">
                                                <LaTeXText text={result.questionSet.passage} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Show figure if available */}
                                    {result.questionSet?.hasFigure && result.questionSet?.figureData && (
                                        <div className="figure-review">
                                            <img
                                                src={`data:image/png;base64,${result.questionSet.figureData}`}
                                                alt={result.questionSet.figureCaption || 'Question figure'}
                                                className="result-figure"
                                            />
                                        </div>
                                    )}

                                    <div className="options-review">
                                        {['A', 'B', 'C', 'D'].map((option) => (
                                            <div
                                                key={option}
                                                className={`option-review ${option === result.correctAnswer ? 'correct' : ''
                                                    } ${option === result.userAnswer && !result.isCorrect ? 'incorrect' : ''
                                                    }`}
                                            >
                                                <span className="option-letter">{option}</span>
                                                <span className="option-text"><LaTeXText text={getOptionText(result.options, option)} /></span>
                                                {option === result.correctAnswer && (
                                                    <CheckCircle size={20} className="check-icon" />
                                                )}
                                                {option === result.userAnswer && !result.isCorrect && (
                                                    <XCircle size={20} className="x-icon" />
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {result.explanation && (
                                        <div className="explanation-text">
                                            <p><strong>Explanation:</strong></p>
                                            <p><LaTeXText text={result.explanation} /></p>
                                        </div>
                                    )}

                                    {!result.explanation && (
                                        <div className="explanation-text">
                                            <p className="no-explanation">
                                                No explanation available for this question.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                    )}
                </div>
            </div>

            <div className="results-actions">
                <button onClick={onReturnHome} className="btn btn-primary btn-lg">
                    Return to Home
                </button>
            </div>
        </div>
    );
};

export default TestResults;
