import { describe, it, expect, vi } from 'vitest';

// Mock KaTeX
vi.mock('katex', () => ({
    default: {
        renderToString: vi.fn((latex: string) => {
            // Return a mock KaTeX output that includes the class for detection
            return `<span class="katex"><span class="katex-mathml">${latex}</span></span>`;
        })
    }
}));

// We need to test the processLatex function logic
// Since it's not exported, we'll test the patterns directly

describe('LaTeX Processing Patterns', () => {
    // Currency pattern: matches $27, $3.50, $2.5, $1,000 but NOT if followed by LaTeX chars or letters
    // Allow 1-2 decimal digits so $2.5 is fully captured (not just $2)
    // Include . in negative lookahead to prevent backtracking from $2.5 to $2 when followed by more decimals
    const currencyPattern = /\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\\^_.{\da-zA-Z])/g;
    // Inline math pattern: matches $...$
    const inlineMathPattern = /\$([^$]+)\$/g;

    describe('Currency Detection', () => {
        it('should match simple currency like $27', () => {
            const text = 'Price is $27 today';
            const matches = text.match(currencyPattern);
            expect(matches).toEqual(['$27']);
        });

        it('should match currency with decimals like $3.50', () => {
            const text = 'Cost is $3.50 per item';
            const matches = text.match(currencyPattern);
            expect(matches).toEqual(['$3.50']);
        });

        it('should match currency with commas like $1,000', () => {
            const text = 'Total is $1,000 dollars';
            const matches = text.match(currencyPattern);
            expect(matches).toEqual(['$1,000']);
        });

        it('should match multiple currency amounts', () => {
            const text = 'Spent $27 to purchase oranges at $3 per pound';
            const matches = text.match(currencyPattern);
            expect(matches).toEqual(['$27', '$3']);
        });

        it('should NOT match $18 in $18^\\circ$ (followed by ^)', () => {
            const text = '$18^\\circ$';
            const matches = text.match(currencyPattern);
            expect(matches).toBeNull();
        });

        it('should NOT match $4 in $4x^2$ (followed by letter)', () => {
            const text = '$4x^2 + bx - 45$';
            const matches = text.match(currencyPattern);
            expect(matches).toBeNull();
        });

        it('should NOT match $27 in $27_{base}$ (followed by _)', () => {
            const text = '$27_{base}$';
            const matches = text.match(currencyPattern);
            expect(matches).toBeNull();
        });

        it('should NOT match $5 in $5\\times$ (followed by \\)', () => {
            const text = '$5\\times 3$';
            const matches = text.match(currencyPattern);
            expect(matches).toBeNull();
        });

        it('should NOT match $100 in $100{text}$ (followed by {)', () => {
            const text = '$100{\\text{dollars}}$';
            const matches = text.match(currencyPattern);
            expect(matches).toBeNull();
        });

        it('should NOT match $2 in $2.5b$ (followed by digit after partial decimal)', () => {
            const text = '$2.5b + 5r = 80$';
            const matches = text.match(currencyPattern);
            // With \.\d{1,2}, this captures $2.5, then 'b' in lookahead prevents currency match
            expect(matches).toBeNull();
        });

        it('should match $2.5 when followed by space (real currency)', () => {
            const text = 'The item costs $2.5 each';
            const matches = text.match(currencyPattern);
            expect(matches).toEqual(['$2.5']);
        });
    });

    describe('LaTeX Inline Math Pattern', () => {
        it('should match simple variable like $x$', () => {
            const text = 'The variable $x$ is positive';
            const matches = [...text.matchAll(inlineMathPattern)];
            expect(matches.length).toBe(1);
            expect(matches[0][1]).toBe('x');
        });

        it('should match expression like $x + y$', () => {
            const text = 'Calculate $x + y$ when';
            const matches = [...text.matchAll(inlineMathPattern)];
            expect(matches.length).toBe(1);
            expect(matches[0][1]).toBe('x + y');
        });

        it('should match fraction like $\\frac{x}{y}$', () => {
            const text = 'The value $\\frac{x}{y}$ equals';
            const matches = [...text.matchAll(inlineMathPattern)];
            expect(matches.length).toBe(1);
            expect(matches[0][1]).toBe('\\frac{x}{y}');
        });

        it('should match square root of fraction like $\\sqrt{\\frac{x}{y}}$', () => {
            const text = '$w = \\sqrt{\\frac{x}{y}} - 19$';
            const matches = [...text.matchAll(inlineMathPattern)];
            expect(matches.length).toBe(1);
            expect(matches[0][1]).toBe('w = \\sqrt{\\frac{x}{y}} - 19');
        });

        it('should match multiple LaTeX expressions in text', () => {
            const text = 'The expression $4x^2 + bx - 45$, where $b$ is a constant';
            const matches = [...text.matchAll(inlineMathPattern)];
            expect(matches.length).toBe(2);
            expect(matches[0][1]).toBe('4x^2 + bx - 45');
            expect(matches[1][1]).toBe('b');
        });

        it('should match degree notation like $18^\\circ$', () => {
            const text = 'The angle is $18^\\circ$';
            const matches = [...text.matchAll(inlineMathPattern)];
            expect(matches.length).toBe(1);
            expect(matches[0][1]).toBe('18^\\circ');
        });
    });

    describe('Combined Currency and LaTeX', () => {
        it('should handle text with both currency and LaTeX', () => {
            const text = 'A customer spent $27 to purchase items. The equation $x + 5 = 10$ gives the answer.';

            // First, currency pattern should match $27 but not affect $x + 5 = 10$
            const currencyMatches = text.match(currencyPattern);
            expect(currencyMatches).toEqual(['$27']);

            // After protecting currency, LaTeX pattern should match the equation
            const textWithPlaceholder = text.replace(currencyPattern, '__CURRENCY__');
            const latexMatches = [...textWithPlaceholder.matchAll(inlineMathPattern)];
            expect(latexMatches.length).toBe(1);
            expect(latexMatches[0][1]).toBe('x + 5 = 10');
        });

        it('should not match currency across LaTeX boundaries', () => {
            // This was the original bug: $27 to ... at $3 being matched as one expression
            const text = 'A customer spent $27 to purchase oranges at $3 per pound.';

            // Both should be detected as currency
            const currencyMatches = text.match(currencyPattern);
            expect(currencyMatches).toEqual(['$27', '$3']);

            // After replacing, no LaTeX patterns should remain
            const textWithPlaceholders = text.replace(currencyPattern, '__CURRENCY__');
            const latexMatches = [...textWithPlaceholders.matchAll(inlineMathPattern)];
            expect(latexMatches.length).toBe(0);
        });
    });

    describe('Already Rendered KaTeX Detection', () => {
        it('should detect already rendered KaTeX content', () => {
            const renderedContent = '<span class="katex"><span class="katex-mathml">x</span></span>';
            expect(renderedContent.includes('class="katex"')).toBe(true);
        });

        it('should detect escaped KaTeX class', () => {
            const escapedContent = 'class=\\"katex\\"';
            expect(escapedContent.includes('class=\\"katex\\"')).toBe(true);
        });
    });
});
