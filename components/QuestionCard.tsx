'use client';
import { useState, useEffect, useMemo } from 'react';
import './QuestionCard.css';

// Format text with underlines, bold, italic, and preserve whitespace
function FormattedText({ text }: { text: string }) {
    const elements = useMemo(() => {
        if (!text) return null;

        // First, tokenize the text into segments
        type Segment = { type: 'text' | 'underline' | 'bold' | 'italic'; content: string };
        const segments: Segment[] = [];
        let remaining = text;

        while (remaining.length > 0) {
            // Check for <u>...</u> (can span multiple lines)
            const underlineMatch = remaining.match(/^([\s\S]*?)<u>([\s\S]*?)<\/u>/);
            if (underlineMatch) {
                if (underlineMatch[1]) {
                    segments.push({ type: 'text', content: underlineMatch[1] });
                }
                segments.push({ type: 'underline', content: underlineMatch[2] });
                remaining = remaining.slice(underlineMatch[0].length);
                continue;
            }

            // Check for **bold**
            const boldMatch = remaining.match(/^([\s\S]*?)\*\*([\s\S]*?)\*\*/);
            if (boldMatch && !remaining.match(/^[\s\S]*?<u>/)) {
                if (boldMatch[1]) {
                    segments.push({ type: 'text', content: boldMatch[1] });
                }
                segments.push({ type: 'bold', content: boldMatch[2] });
                remaining = remaining.slice(boldMatch[0].length);
                continue;
            }

            // Check for *italic* (single asterisks, not double)
            const italicMatch = remaining.match(/^([\s\S]*?)(?<!\*)\*([^*]+)\*(?!\*)/);
            if (italicMatch && !remaining.match(/^[\s\S]*?<u>/) && !remaining.match(/^[\s\S]*?\*\*/)) {
                if (italicMatch[1]) {
                    segments.push({ type: 'text', content: italicMatch[1] });
                }
                segments.push({ type: 'italic', content: italicMatch[2] });
                remaining = remaining.slice(italicMatch[0].length);
                continue;
            }

            // No more formatting matches, add the rest as text
            segments.push({ type: 'text', content: remaining });
            break;
        }

        // Now render segments, handling newlines within each segment
        return segments.map((segment, segIndex) => {
            const renderContent = (content: string) => {
                // Split by newlines and render with <br /> tags
                const lines = content.split('\n');
                return lines.map((line, i) => (
                    <span key={i}>
                        {line}
                        {i < lines.length - 1 && <br />}
                    </span>
                ));
            };

            switch (segment.type) {
                case 'underline':
                    return <u key={segIndex}>{renderContent(segment.content)}</u>;
                case 'bold':
                    return <strong key={segIndex}>{renderContent(segment.content)}</strong>;
                case 'italic':
                    return <em key={segIndex}>{renderContent(segment.content)}</em>;
                default:
                    return <span key={segIndex}>{renderContent(segment.content)}</span>;
            }
        });
    }, [text]);

    return <>{elements}</>;
}

interface QuestionCardProps {
    question: {
        id: number;
        questionText: string;
        questionType: string;
        correctAnswer?: string;
        optionA?: string;
        optionB?: string;
        optionC?: string;
        optionD?: string;
        options?: (string | undefined)[];
        figureCaption?: string;
    };
    questionNumber: number;
    selectedAnswer?: string;
    onAnswerSelect: (answer: string) => void;
    showCorrectAnswer?: boolean;
    figureUrl?: string | null;
}

const QuestionCard = ({ question, questionNumber, selectedAnswer, onAnswerSelect, showCorrectAnswer = false, figureUrl = null }: QuestionCardProps) => {
    const options = ['A', 'B', 'C', 'D'];
    const [freeResponseValue, setFreeResponseValue] = useState(selectedAnswer || '');

    // Sync local state when selectedAnswer changes (e.g., navigating between questions)
    useEffect(() => {
        setFreeResponseValue(selectedAnswer || '');
    }, [selectedAnswer, question.id]);

    // Check if this is a free response question
    const isFreeResponse = question.questionType === 'FreeResponse';

    const getOptionClass = (option: string) => {
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

    const handleFreeResponseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFreeResponseValue(value);
    };

    const handleFreeResponseSubmit = () => {
        if (freeResponseValue.trim()) {
            onAnswerSelect(freeResponseValue.trim());
        }
    };

    const handleFreeResponseKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            )}

            <div className="question-text">
                <FormattedText text={question.questionText} />
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
                            <span className="option-text">{question.options?.[index]}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuestionCard;

