'use client';
import { useState, useEffect, useMemo } from 'react';
import { Bookmark, BookmarkCheck, X } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './QuestionCard.css';

// Render LaTeX string to HTML
function renderLatex(latex: string, displayMode: boolean = false): string {
    try {
        return katex.renderToString(latex, {
            throwOnError: false,
            displayMode,
            strict: false
        });
    } catch {
        return latex;
    }
}

// Extract a complete LaTeX expression starting from a command
function extractLatexExpression(text: string, startIndex: number): { expr: string; endIndex: number } {
    let i = startIndex;
    let braceDepth = 0;
    let inBraces = false;

    // Skip the backslash and command name
    while (i < text.length && /[a-zA-Z]/.test(text[i])) {
        i++;
    }

    // Now consume any braced arguments and subscripts/superscripts
    while (i < text.length) {
        const char = text[i];

        if (char === '{') {
            braceDepth++;
            inBraces = true;
            i++;
        } else if (char === '}') {
            braceDepth--;
            i++;
            if (braceDepth === 0) {
                // Check if there's another argument or operator following
                const next = text[i];
                if (next !== '{' && next !== '^' && next !== '_') {
                    // Include trailing variable/number if part of expression
                    while (i < text.length && /[a-zA-Z0-9]/.test(text[i])) {
                        i++;
                    }
                    break;
                }
            }
        } else if (braceDepth === 0 && !inBraces) {
            // Not inside braces, check for subscript/superscript
            if (char === '^' || char === '_') {
                i++;
                if (text[i] === '{') {
                    // Will be handled in next iteration
                } else {
                    // Single character subscript/superscript
                    i++;
                }
            } else {
                break;
            }
        } else {
            i++;
        }
    }

    return { expr: text.slice(startIndex, i), endIndex: i };
}

// Parse text and render LaTeX expressions
function LaTeXText({ text }: { text: string }) {
    const html = useMemo(() => {
        if (!text) return '';

        // Skip if already contains rendered KaTeX (prevent double-processing)
        if (text.includes('class="katex"') || text.includes('class=\\"katex\\"')) {
            return text;
        }

        // Replace display math $$...$$ first
        let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
            return renderLatex(latex.trim(), true);
        });

        // First, protect currency patterns like $27, $3.50, $1,000 from being treated as LaTeX
        // But NOT if followed by LaTeX chars like ^ _ \ { . or letters (e.g., $18^\circ$, $4x$, $2.5b$ are LaTeX)
        // Include . in negative lookahead to prevent backtracking from $2.5 to $2 when followed by more decimals
        const currencyPlaceholders: string[] = [];
        result = result.replace(/\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\\^_.{\da-zA-Z])/g, (match) => {
            currencyPlaceholders.push(match);
            return `__CURRENCY_${currencyPlaceholders.length - 1}__`;
        });

        // Replace inline math $...$
        result = result.replace(/\$([^$]+)\$/g, (_, latex) => {
            return renderLatex(latex.trim(), false);
        });

        // Restore currency placeholders
        result = result.replace(/__CURRENCY_(\d+)__/g, (_, index) => {
            return currencyPlaceholders[parseInt(index)];
        });

        // Replace \[...\] display math
        result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
            return renderLatex(latex.trim(), true);
        });

        // Replace \(...\) inline math
        result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => {
            return renderLatex(latex.trim(), false);
        });

        // Skip additional LaTeX command processing if we already rendered $...$ math
        // This prevents double-rendering of \sqrt, \frac inside KaTeX annotation tags
        if (result.includes('class="katex"')) {
            return result;
        }

        // Find and replace LaTeX commands without delimiters (like \frac{}{}, \sqrt{})
        // Only runs if no $...$ math was found above
        const latexCommandPattern = /\\(frac|sqrt|sum|prod|int|lim|sin|cos|tan|log|ln|exp|overline|underline|text|mathrm|mathbf)/g;
        let match;
        const replacements: { start: number; end: number; replacement: string }[] = [];

        while ((match = latexCommandPattern.exec(result)) !== null) {
            const { expr, endIndex } = extractLatexExpression(result, match.index + 1);
            const fullExpr = '\\' + expr;
            if (fullExpr.includes('{')) {
                replacements.push({
                    start: match.index,
                    end: match.index + 1 + endIndex - (match.index + 1),
                    replacement: renderLatex(fullExpr, false)
                });
            }
        }

        // Apply replacements in reverse order to preserve indices
        for (let i = replacements.length - 1; i >= 0; i--) {
            const { start, end, replacement } = replacements[i];
            result = result.slice(0, start) + replacement + result.slice(end);
        }

        // Replace standalone Greek letters and symbols
        result = result.replace(/\\(pi|theta|alpha|beta|gamma|delta|infty|pm|times|div|cdot|leq|geq|neq|approx|equiv|degree)(?![a-zA-Z])/g, (match) => {
            return renderLatex(match, false);
        });

        return result;
    }, [text]);

    return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// Format text with underlines, bold, italic, LaTeX, and preserve whitespace
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

        // Now render segments, handling newlines and LaTeX within each segment
        return segments.map((segment, segIndex) => {
            const renderContent = (content: string) => {
                // Split by newlines and render with <br /> tags
                const lines = content.split('\n');
                return lines.map((line, i) => {
                    // Check for line numbers at the start of lines (e.g., "5  " or "10  ")
                    const lineNumberMatch = line.match(/^(\d{1,3})(\s{2,})/);
                    if (lineNumberMatch) {
                        const lineNum = lineNumberMatch[1];
                        const rest = line.slice(lineNumberMatch[0].length);
                        return (
                            <span key={i}>
                                <span className="line-number">{lineNum}</span>
                                <LaTeXText text={rest} />
                                {i < lines.length - 1 && <br />}
                            </span>
                        );
                    }
                    return (
                        <span key={i}>
                            <LaTeXText text={line} />
                            {i < lines.length - 1 && <br />}
                        </span>
                    );
                });
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

interface QuestionSet {
    id: number;
    passage?: string | null;
    passageIntro?: string | null;
    hasFigure?: boolean;
    figureData?: string | null;
    figureCaption?: string | null;
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
    };
    questionNumber: number;
    selectedAnswer?: string;
    onAnswerSelect: (answer: string) => void;
    showCorrectAnswer?: boolean;
    // QuestionSet data for passage/figure display
    questionSet?: QuestionSet | null;
    isFirstInSet?: boolean; // Whether to show passage/figure (only for first question in set)
    // Legacy support - figureUrl can still be passed directly
    figureUrl?: string | null;
    // Control passage/figure display (used by QuestionSetView for split layout)
    showPassage?: boolean;
    // Bookmark functionality
    isBookmarked?: boolean;
    onBookmarkToggle?: () => void;
    // Cross-off functionality (for multiple choice only)
    crossedOffOptions?: Set<string>;
    onToggleCrossOff?: (option: string) => void;
}

const QuestionCard = ({ question, questionNumber, selectedAnswer, onAnswerSelect, showCorrectAnswer = false, questionSet = null, isFirstInSet = true, figureUrl = null, showPassage = true, isBookmarked = false, onBookmarkToggle, crossedOffOptions, onToggleCrossOff }: QuestionCardProps) => {
    const options = ['A', 'B', 'C', 'D'];
    const [freeResponseValue, setFreeResponseValue] = useState(selectedAnswer || '');
    const [figureModalOpen, setFigureModalOpen] = useState(false);

    // Sync local state when selectedAnswer changes (e.g., navigating between questions)
    useEffect(() => {
        setFreeResponseValue(selectedAnswer || '');
    }, [selectedAnswer, question.id]);

    // Check if this is a free response question
    const isFreeResponse = question.questionType === 'FreeResponse';

    // Determine figure URL - prefer questionSet figure, fall back to legacy figureUrl
    const effectiveFigureUrl = useMemo(() => {
        if (showPassage && isFirstInSet && questionSet?.hasFigure && questionSet?.figureData) {
            return `data:image/png;base64,${questionSet.figureData}`;
        }
        return showPassage ? figureUrl : null;
    }, [showPassage, isFirstInSet, questionSet, figureUrl]);

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

        // Add crossed-off class if option is crossed off
        if (crossedOffOptions?.has(option)) {
            classes.push('crossed-off');
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
                <div className="question-header-left">
                    <span className="question-badge">Question {questionNumber}</span>
                    {isFreeResponse && <span className="question-type-badge">Free Response</span>}
                </div>
                {onBookmarkToggle && (
                    <button
                        className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
                        onClick={onBookmarkToggle}
                        title={isBookmarked ? 'Remove bookmark' : 'Bookmark for review'}
                        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark for review'}
                    >
                        {isBookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                    </button>
                )}
            </div>

            {/* Show passage intro and passage for first question in set */}
            {showPassage && isFirstInSet && (questionSet?.passage || questionSet?.passageIntro) && (
                <div className="passage-container">
                    {questionSet?.passageIntro && (
                        <div className="passage-intro">
                            <FormattedText text={questionSet.passageIntro} />
                        </div>
                    )}
                    {questionSet?.passage && (
                        <div className="passage-text">
                            <FormattedText text={questionSet.passage} />
                        </div>
                    )}
                </div>
            )}

            {/* Show figure for first question in set or from legacy figureUrl */}
            {effectiveFigureUrl && (
                <div className="question-figure-container">
                    <img
                        src={effectiveFigureUrl}
                        alt={questionSet?.figureCaption || 'Question figure'}
                        className="question-figure"
                        onClick={() => setFigureModalOpen(true)}
                        title="Click to enlarge"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>
            )}

            {/* Fullscreen figure modal */}
            {figureModalOpen && effectiveFigureUrl && (
                <div
                    className="figure-modal-overlay"
                    onClick={() => setFigureModalOpen(false)}
                >
                    <img
                        src={effectiveFigureUrl}
                        alt={questionSet?.figureCaption || 'Question figure'}
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
                        <div key={option} className="option-wrapper">
                            <button
                                onClick={() => !showCorrectAnswer && onAnswerSelect(option)}
                                className={getOptionClass(option)}
                                disabled={showCorrectAnswer}
                            >
                                <span className="option-letter">{option}</span>
                                <span className="option-text"><FormattedText text={question.options?.[index] || ''} /></span>
                            </button>
                            {onToggleCrossOff && !showCorrectAnswer && (
                                <button
                                    className={`cross-off-btn ${crossedOffOptions?.has(option) ? 'active' : ''}`}
                                    onClick={() => onToggleCrossOff(option)}
                                    title={crossedOffOptions?.has(option) ? 'Remove cross-off' : 'Cross off this option'}
                                    aria-label={crossedOffOptions?.has(option) ? 'Remove cross-off' : 'Cross off this option'}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default QuestionCard;

