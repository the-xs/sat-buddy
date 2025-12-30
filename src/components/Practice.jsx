import { useState } from 'react';
import { Sparkles, CheckCircle, XCircle, HelpCircle, ArrowRight, Loader2 } from 'lucide-react';
import { practiceAPI } from '../services/api';
import './Practice.css';

const Practice = () => {
    const [category, setCategory] = useState('random');
    const [question, setQuestion] = useState(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [result, setResult] = useState(null);
    const [explanation, setExplanation] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAnswer, setCheckingAnswer] = useState(false);
    const [loadingExplanation, setLoadingExplanation] = useState(false);

    const categories = [
        { id: 'random', label: 'Random' },
        { id: 'math', label: 'Math' },
        { id: 'reading', label: 'Reading' },
        { id: 'writing', label: 'Writing & Language' },
    ];

    const generateQuestion = async () => {
        setLoading(true);
        setQuestion(null);
        setUserAnswer('');
        setResult(null);
        setExplanation('');

        try {
            const response = await practiceAPI.generateQuestion(category);
            if (response.success) {
                setQuestion(response.data);
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
            const response = await practiceAPI.checkAnswer(question.id, question, userAnswer);
            if (response.success) {
                setResult(response.data);
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
            const response = await practiceAPI.explainAnswer(question.id, question, userAnswer);
            if (response.success) {
                setExplanation(response.data.explanation);
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

    return (
        <div className="practice">
            <div className="practice-header">
                <h1><Sparkles size={28} /> AI Practice</h1>
                <p>Practice with AI-generated SAT questions tailored to your needs.</p>
            </div>

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
                                        disabled={loadingExplanation || explanation}
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
        </div>
    );
};

export default Practice;
