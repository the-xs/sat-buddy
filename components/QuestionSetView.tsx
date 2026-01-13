'use client';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import QuestionCard from './QuestionCard';
import './QuestionSetView.css';

// Render LaTeX string to HTML (duplicated from QuestionCard for passage rendering)
// Note: Content is from trusted source (database, populated by PDF parsing)
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

// Parse text and render LaTeX expressions
// Content is sanitized by KaTeX library which escapes HTML
function LaTeXText({ text }: { text: string }) {
    const html = useMemo(() => {
        if (!text) return '';

        // Replace display math $$...$$ first
        let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => {
            return renderLatex(latex.trim(), true);
        });

        // Replace inline math $...$
        result = result.replace(/\$([^$]+)\$/g, (_, latex) => {
            return renderLatex(latex.trim(), false);
        });

        // Replace \[...\] display math
        result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
            return renderLatex(latex.trim(), true);
        });

        // Replace \(...\) inline math
        result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => {
            return renderLatex(latex.trim(), false);
        });

        return result;
    }, [text]);

    // KaTeX output is safe - it escapes HTML and only produces math markup
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// Format text with underlines, bold, italic, LaTeX, and preserve whitespace
function FormattedText({ text }: { text: string }) {
    const elements = useMemo(() => {
        if (!text) return null;

        type Segment = { type: 'text' | 'underline' | 'bold' | 'italic'; content: string };
        const segments: Segment[] = [];
        let remaining = text;

        while (remaining.length > 0) {
            const underlineMatch = remaining.match(/^([\s\S]*?)<u>([\s\S]*?)<\/u>/);
            if (underlineMatch) {
                if (underlineMatch[1]) {
                    segments.push({ type: 'text', content: underlineMatch[1] });
                }
                segments.push({ type: 'underline', content: underlineMatch[2] });
                remaining = remaining.slice(underlineMatch[0].length);
                continue;
            }

            const boldMatch = remaining.match(/^([\s\S]*?)\*\*([\s\S]*?)\*\*/);
            if (boldMatch && !remaining.match(/^[\s\S]*?<u>/)) {
                if (boldMatch[1]) {
                    segments.push({ type: 'text', content: boldMatch[1] });
                }
                segments.push({ type: 'bold', content: boldMatch[2] });
                remaining = remaining.slice(boldMatch[0].length);
                continue;
            }

            const italicMatch = remaining.match(/^([\s\S]*?)(?<!\*)\*([^*]+)\*(?!\*)/);
            if (italicMatch && !remaining.match(/^[\s\S]*?<u>/) && !remaining.match(/^[\s\S]*?\*\*/)) {
                if (italicMatch[1]) {
                    segments.push({ type: 'text', content: italicMatch[1] });
                }
                segments.push({ type: 'italic', content: italicMatch[2] });
                remaining = remaining.slice(italicMatch[0].length);
                continue;
            }

            segments.push({ type: 'text', content: remaining });
            break;
        }

        return segments.map((segment, segIndex) => {
            const renderContent = (content: string) => {
                const lines = content.split('\n');
                return lines.map((line, i) => {
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
}

interface QuestionSetViewProps {
    questionsInSet: Question[];
    currentIndexInSet: number;
    questionSet: QuestionSet;
    answers: Record<number, string>;
    onAnswerSelect: (questionId: number, answer: string) => void;
    onPrevInSet: () => void;
    onNextInSet: () => void;
    globalQuestionNumber: number;
    // Bookmark functionality
    isBookmarked?: boolean;
    onBookmarkToggle?: () => void;
    // Cross-off functionality
    crossedOffOptions?: Set<string>;
    onToggleCrossOff?: (option: string) => void;
}

const QuestionSetView = ({
    questionsInSet,
    currentIndexInSet,
    questionSet,
    answers,
    onAnswerSelect,
    onPrevInSet,
    onNextInSet,
    globalQuestionNumber,
    isBookmarked = false,
    onBookmarkToggle,
    crossedOffOptions,
    onToggleCrossOff,
}: QuestionSetViewProps) => {
    const [figureModalOpen, setFigureModalOpen] = useState(false);

    const currentQuestion = questionsInSet[currentIndexInSet];
    const totalInSet = questionsInSet.length;
    const isFirst = currentIndexInSet === 0;
    const isLast = currentIndexInSet === totalInSet - 1;

    // Figure URL from questionSet
    const figureUrl = useMemo(() => {
        if (questionSet?.hasFigure && questionSet?.figureData) {
            return `data:image/png;base64,${questionSet.figureData}`;
        }
        return null;
    }, [questionSet]);

    return (
        <div className="question-set-view">
            {/* Left Panel - Passage */}
            <div className="passage-panel">
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

                {figureUrl && (
                    <div className="passage-figure-container">
                        <img
                            src={figureUrl}
                            alt={questionSet?.figureCaption || 'Figure'}
                            className="passage-figure"
                            onClick={() => setFigureModalOpen(true)}
                            title="Click to enlarge"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Right Panel - Question */}
            <div className="question-panel">
                {/* Within-set navigation header */}
                <div className="set-navigation">
                    <button
                        className="set-nav-btn"
                        onClick={onPrevInSet}
                        disabled={isFirst}
                        aria-label="Previous question in set"
                    >
                        <ChevronLeft size={18} />
                        <span>Prev</span>
                    </button>

                    <span className="set-progress">
                        Question {currentIndexInSet + 1} of {totalInSet} in this passage
                    </span>

                    <button
                        className="set-nav-btn"
                        onClick={onNextInSet}
                        disabled={isLast}
                        aria-label="Next question in set"
                    >
                        <span>Next</span>
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Question Card without passage */}
                <QuestionCard
                    question={{
                        id: currentQuestion.id,
                        questionText: currentQuestion.questionText,
                        questionType: currentQuestion.questionType,
                        optionA: currentQuestion.optionA,
                        optionB: currentQuestion.optionB,
                        optionC: currentQuestion.optionC,
                        optionD: currentQuestion.optionD,
                        options: [
                            currentQuestion.optionA,
                            currentQuestion.optionB,
                            currentQuestion.optionC,
                            currentQuestion.optionD,
                        ],
                    }}
                    questionNumber={globalQuestionNumber}
                    selectedAnswer={answers[currentQuestion.id]}
                    onAnswerSelect={(answer) => onAnswerSelect(currentQuestion.id, answer)}
                    showPassage={false}
                    questionSet={null}
                    isFirstInSet={false}
                    isBookmarked={isBookmarked}
                    onBookmarkToggle={onBookmarkToggle}
                    crossedOffOptions={crossedOffOptions}
                    onToggleCrossOff={onToggleCrossOff}
                />
            </div>

            {/* Fullscreen figure modal */}
            {figureModalOpen && figureUrl && (
                <div
                    className="figure-modal-overlay"
                    onClick={() => setFigureModalOpen(false)}
                >
                    <img
                        src={figureUrl}
                        alt={questionSet?.figureCaption || 'Figure'}
                    />
                </div>
            )}
        </div>
    );
};

export default QuestionSetView;
