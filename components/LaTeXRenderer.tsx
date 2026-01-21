'use client';
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Render LaTeX string to HTML
function renderLatex(latex: string, displayMode: boolean = false): string {
    try {
        const result = katex.renderToString(latex, {
            throwOnError: false,
            displayMode,
            strict: false
        });
        // Debug: log if rendering sqrt with frac
        if (latex.includes('sqrt') && latex.includes('frac')) {
            console.log('[LaTeX Debug] Input:', latex);
            console.log('[LaTeX Debug] Output length:', result.length);
        }
        return result;
    } catch (e) {
        console.error('[LaTeX Error]', latex, e);
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
                const next = text[i];
                if (next !== '{' && next !== '^' && next !== '_') {
                    while (i < text.length && /[a-zA-Z0-9]/.test(text[i])) {
                        i++;
                    }
                    break;
                }
            }
        } else if (braceDepth === 0 && !inBraces) {
            if (char === '^' || char === '_') {
                i++;
                if (text[i] !== '{') {
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

// Process text and convert LaTeX to rendered HTML
export function processLatex(text: string): string {
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

    // Find and replace LaTeX commands without delimiters
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

    // Apply replacements in reverse order
    for (let i = replacements.length - 1; i >= 0; i--) {
        const { start, end, replacement } = replacements[i];
        result = result.slice(0, start) + replacement + result.slice(end);
    }

    // Replace standalone Greek letters and symbols
    result = result.replace(/\\(pi|theta|alpha|beta|gamma|delta|infty|pm|times|div|cdot|leq|geq|neq|approx|equiv|degree)(?![a-zA-Z])/g, (match) => {
        return renderLatex(match, false);
    });

    return result;
}

// Simple inline LaTeX text component
export function LaTeXText({ text }: { text: string }) {
    const html = useMemo(() => processLatex(text), [text]);
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// Block-level LaTeX component that preserves newlines
export function LaTeXBlock({ text }: { text: string }) {
    const html = useMemo(() => {
        const processed = processLatex(text);
        // Convert newlines to <br> tags
        return processed.replace(/\n/g, '<br />');
    }, [text]);

    return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// LaTeX-aware Markdown renderer
export function LaTeXMarkdown({ children }: { children: string }) {
    const html = useMemo(() => {
        if (!children) return '';

        // First process LaTeX
        let result = processLatex(children);

        // Then apply basic markdown formatting
        // Bold **text**
        result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic *text* (but not inside LaTeX spans)
        result = result.replace(/(?<!<[^>]*)\*([^*]+)\*(?![^<]*>)/g, '<em>$1</em>');

        // Convert newlines to paragraphs for multi-line content
        const paragraphs = result.split(/\n\n+/);
        if (paragraphs.length > 1) {
            result = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('');
        } else {
            result = result.replace(/\n/g, '<br />');
        }

        // Bullet lists
        result = result.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
        result = result.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>');

        // Numbered lists
        result = result.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

        return result;
    }, [children]);

    return <div className="latex-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default LaTeXText;
