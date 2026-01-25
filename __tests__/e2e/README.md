# E2E Test Suite

End-to-end tests for SAT Buddy's PDF parsing and verification system using real Gemini API calls.

## Running E2E Tests

**All E2E tests require `GEMINI_API_KEY`:**

```bash
# Run all E2E tests
GEMINI_API_KEY=your_key npm test -- __tests__/e2e/

# Run specific test
GEMINI_API_KEY=your_key npm test -- __tests__/e2e/radical-exponent-verification.e2e.test.ts

# Skip E2E tests (they're skipped automatically if no API key)
npm test  # E2E tests will be skipped
```

---

## Test Categories

### 1. Verification Tests (Individual Question Types)

Test that verification logic can catch and correct specific error types:

| Test File | Question Type | Wrong → Correct | Time |
|-----------|---------------|-----------------|------|
| `radical-exponent-verification.e2e.test.ts` | M1-Q21: Radicals/Exponents | 47.5 → 45.125 | ~60s |
| `parabola-vertex-verification.e2e.test.ts` | M1-Q26: Parabola/Quadratic | A → D (-12) | ~54s |
| `exponential-function-verification.e2e.test.ts` | M1-Q27: Exponential Functions | 13/7 → 5 | ~39s |
| `systems-of-equations-verification.e2e.test.ts` | Systems of Equations | 3 → (3, 1) | ~38s |
| `rational-expressions-verification.e2e.test.ts` | Rational Expressions | 2 → 3.5 | ~20s |
| `circle-equations-verification.e2e.test.ts` | Circle Equations | (x+2)² → (x-2)² | ~21s |
| `statistics-verification.e2e.test.ts` | Statistics (Mean/Median) | 10.75 → 10.5 | ~24s |
| `linear-equation-verification.e2e.test.ts` | Linear Equations (Graphs) | y = -2x - 1 → y = -x - 8 | ~varies |
| `grammar-verification.e2e.test.ts` | Grammar/Verb Forms | creating → to create | ~varies |

**Total Coverage:** 9 major question types

---

### 2. Integration Test (Multi-Question Pipeline)

**File:** `pdf-parsing-integration.e2e.test.ts`

Tests the complete verification pipeline with all 5 critical math question types in one test:

```bash
GEMINI_API_KEY=your_key npm test -- __tests__/e2e/pdf-parsing-integration.e2e.test.ts
```

**What it tests:**
- ✅ M1-Q21: Radical/exponent (47.5 → 45.125)
- ✅ M1-Q26: Parabola vertex (A → D)
- ✅ M1-Q27: Exponential function (13/7 → 5)
- ✅ Q101: System of equations (3 → (3, 1))
- ✅ Q102: Rational expression (2 → 3.5)

**Runtime:** ~132s (all 5 questions)

**Purpose:** Simulates the real-world scenario where:
1. PDF parsing extracts wrong answers (initial extraction phase)
2. Verification catches ALL errors (verification phase)
3. Database stores corrected answers

---

## Test Structure

All E2E tests follow this pattern:

```typescript
// 1. Skip if no API key
const SKIP_E2E = !process.env.GEMINI_API_KEY;

// 2. Mock Prisma (to avoid DB writes)
vi.mock('@/lib/prisma', () => ({
  default: {
    question: { update: mockUpdate },
    answerVerificationLog: { create: mockLog },
  },
}));

// 3. Test with real Gemini API
describe.skipIf(SKIP_E2E)('E2E: ...', () => {
  it('should correct wrong answer', async () => {
    await pdfService.verifyBatch(/* wrong answer */);
    
    // Verify correction was made
    expect(mockUpdate).toHaveBeenCalledWith({
      data: { correctAnswer: 'correct_value' }
    });
  });
});
```

---

## What's NOT Tested

These E2E tests focus on **verification logic**, not:
- ❌ Actual PDF file reading (requires binary PDF files)
- ❌ OCR/image extraction (requires PDF processing)
- ❌ Database writes (Prisma is mocked)
- ❌ UI rendering (backend tests only)

**To test full PDF upload flow:**
1. Upload an actual SAT PDF via the web interface
2. Check the database for extracted questions
3. Verify answers match expected values

---

## Adding New E2E Tests

When adding new question types:

1. **Create test file:** `__tests__/e2e/{topic}-verification.e2e.test.ts`

2. **Follow the pattern:**
```typescript
const QUESTION = `Your question text with $LaTeX$`;
const WRONG_ANSWER = 'common_wrong_answer';
const CORRECT_ANSWER = 'correct_answer';

it('should correct from WRONG to CORRECT', async () => {
  await pdfService.verifyBatch(/* ... */);
  expect(mockUpdate).toHaveBeenCalledWith({
    data: { correctAnswer: CORRECT_ANSWER }
  });
});
```

3. **Add to this README** in the table above

4. **Update integration test** if it's a high-priority question type

---

## Troubleshooting

**Tests are skipped:**
- Set `GEMINI_API_KEY` environment variable
- Check `.env` file has valid API key

**Tests timeout:**
- Increase timeout in test: `it('...', async () => {...}, 180000)` (3 minutes)
- Default timeout is 120s (2 minutes)

**Tests fail with "INVALID_ARGUMENT":**
- This usually means the test is trying to use file URIs incorrectly
- E2E tests should use `verifyBatch()` directly, not `parsePDF()`

**Verification doesn't correct answer:**
- Check if verification is disabled: `GEMINI_SKIP_VERIFICATION=true`
- Verify the wrong answer is actually wrong (Gemini might accept it as valid)
- Check verification prompt in `lib/services/pdfService.ts` has instructions for this question type

---

## Performance Notes

**Total runtime for all E2E tests:** ~5-7 minutes

**Why so long?**
- Real Gemini API calls (not mocked)
- Each test makes 2-4 API requests
- API latency varies (10-60s per request)

**Optimization tips:**
- Run specific tests during development
- Run full suite in CI/CD only
- Tests run in parallel by default (vitest)

---

## CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Run E2E Tests
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npm test -- __tests__/e2e/
```

**Note:** Store `GEMINI_API_KEY` as a GitHub secret, not in code!
