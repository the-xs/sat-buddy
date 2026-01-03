'use client';
import { useState, useEffect } from 'react';
import './QuestionCard.css';

const QuestionCard = ({ question, questionNumber, selectedAnswer, onAnswerSelect, showCorrectAnswer = false, figureUrl = null }) => {
    const options = ['A', 'B', 'C', 'D'];
    const [freeResponseValue, setFreeResponseValue] = useState(selectedAnswer || '');

    // Sync local state when selectedAnswer changes (e.g., navigating between questions)
    useEffect(() => {
        setFreeResponseValue(selectedAnswer || '');
    }, [selectedAnswer, question.id]);

    // Check if this is a free response question
    const isFreeResponse = question.questionType === 'FreeResponse';

    const getOptionClass = (option) => {
        const classes = ['option'];

        if (showCorrectAnswer) {
            if (option === question.correctAnswer) {
                classes.push('correct');
            }
            if (option === selectedAnswer && option !== question.correctAnswer) {
                classes.push('incorrect');
            }
        } else if (option === selectedAnswer) {
            classes.push('selected');
        }

        return classes.join(' ');
    };

    const handleFreeResponseChange = (e) => {
        const value = e.target.value;
        setFreeResponseValue(value);
    };

    const handleFreeResponseSubmit = () => {
        if (freeResponseValue.trim()) {
            onAnswerSelect(freeResponseValue.trim());
        }
    };

    const handleFreeResponseKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleFreeResponseSubmit();
        }
    };

    // Check if free response answer is correct (case-insensitive, trimmed comparison)
    const isFreeResponseCorrect = () => {
        if (!selectedAnswer || !question.correctAnswer) return false;
        return selectedAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    };

    return (
        <div className="question-card glass-card">
            <div className="question-header">
                <span className="question-badge">Question {questionNumber}</span>
                {isFreeResponse && <span className="question-type-badge">Free Response</span>}
            </div>

            {figureUrl && (
                <div className="question-figure-container">
                    <img
                        src={figureUrl}
                        alt={question.figureCaption || 'Question figure'}
                        className="question-figure"
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
            )}

            <div className="question-text">
                <p>{question.questionText}</p>
            </div>

            {isFreeResponse ? (
                <div className="free-response-container">
                    <div className="free-response-input-wrapper">
                        <input
                            type="text"
                            className={`free-response-input ${showCorrectAnswer ? (isFreeResponseCorrect() ? 'correct' : 'incorrect') : ''}`}
                            placeholder="Enter your answer..."
                            value={freeResponseValue}
                            onChange={handleFreeResponseChange}
                            onKeyDown={handleFreeResponseKeyDown}
                            onBlur={handleFreeResponseSubmit}
                            disabled={showCorrectAnswer}
                        />
                        {!showCorrectAnswer && (
                            <button
                                className="btn btn-primary btn-sm free-response-submit"
                                onClick={handleFreeResponseSubmit}
                                disabled={!freeResponseValue.trim()}
                            >
                                Save
                            </button>
                        )}
                    </div>
                    {showCorrectAnswer && (
                        <div className={`free-response-result ${isFreeResponseCorrect() ? 'correct' : 'incorrect'}`}>
                            {isFreeResponseCorrect() ? (
                                <p>✓ Correct!</p>
                            ) : (
                                <p>✗ Incorrect. The correct answer is: <strong>{question.correctAnswer}</strong></p>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="options-container">
                    {options.map((option, index) => (
                        <button
                            key={option}
                            onClick={() => !showCorrectAnswer && onAnswerSelect(option)}
                            className={getOptionClass(option)}
                            disabled={showCorrectAnswer}
                        >
                            <span className="option-letter">{option}</span>
                            <span className="option-text">{question.options[index]}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuestionCard;

