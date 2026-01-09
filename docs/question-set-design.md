# QuestionSet Model Design

## Problem Statement

In SAT Reading and Writing sections, questions are structured as:
- One passage (1-4 paragraphs of text)
- Multiple questions (1-4) that reference that passage
- Each question has 4 answer choices

The current `Question` model stores everything per-question, including the full passage text in `questionText`. This causes:
1. **Data duplication**: Same passage stored multiple times
2. **Awkward UI**: Must deduplicate passages on render
3. **No semantic grouping**: Can't easily identify which questions share context

Similarly, some Math questions share a figure/diagram/table that multiple questions reference.

## Solution: QuestionSet Model

Introduce a `QuestionSet` entity that groups related questions with their shared context.

```
Module → QuestionSet → Question
```

### Design Decisions

1. **Every question belongs to a QuestionSet** (not nullable)
   - Standalone questions = QuestionSet with one question and null passage
   - Simpler UI logic: always render `questionSet.passage` if it exists
   - Future-proof for adding context to "standalone" questions

2. **Figures belong to QuestionSet, not Question**
   - Shared figures stored once at set level
   - Individual question figures still possible (edge case)

3. **Preserve order with `orderIndex`**
   - QuestionSets ordered within Module
   - Questions ordered within QuestionSet

## Schema Changes

### New QuestionSet Model

```prisma
model QuestionSet {
  id                Int       @id @default(autoincrement())
  moduleId          Int       @map("module_id")
  orderIndex        Int       @map("order_index")

  // Shared context (all nullable for standalone questions)
  passage           String?   @db.Text
  passageIntro      String?   @db.Text                   // "The following is adapted from..."

  // Figure data (moved from Question)
  hasFigure         Boolean   @default(false)
  figureData        String?   @db.LongText               // Base64-encoded PNG
  figureCaption     String?   @db.Text
  figureBoundingBox String?   @map("figure_bounding_box") // JSON: [ymin, xmin, ymax, xmax]
  figurePageNumber  Int?      @map("figure_page_number")

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  module            Module    @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  questions         Question[]

  @@index([moduleId])
}
```

### Modified Question Model

```prisma
model Question {
  id              Int       @id @default(autoincrement())
  questionSetId   Int       @map("question_set_id")
  questionNumber  Int       @map("question_number")     // Global number within module
  orderInSet      Int       @map("order_in_set")        // Order within the set (0-based)
  questionType    String    @map("question_type")

  // Question content (NO embedded passage anymore)
  questionText    String    @map("question_text") @db.Text

  // Options
  optionA         String?   @db.Text
  optionB         String?   @db.Text
  optionC         String?   @db.Text
  optionD         String?   @db.Text

  // Metadata
  correctAnswer   String    @db.Text
  explanation     String?   @db.Text
  difficulty      String?
  topic           String?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  questionSet     QuestionSet @relation(fields: [questionSetId], references: [id], onDelete: Cascade)
  testResults     TestResult[]

  @@index([questionSetId])
  @@index([questionType])
}
```

### Module Model Update

```prisma
model Module {
  // ... existing fields
  questionSets  QuestionSet[]
  // questions     Question[]  // Remove direct relation
}
```

## Gemini Prompt Changes

### New Output Schema

```json
{
  "questionSets": [
    {
      "passage": "Full passage text here...",
      "passageIntro": "The following is adapted from a 2019 study...",
      "hasFigure": false,
      "figureDescription": null,
      "boundingBox": null,
      "pageNumber": null,
      "questions": [
        {
          "questionNumber": 1,
          "questionText": "Which choice best states the main idea of the passage?",
          "questionType": "MultipleChoice",
          "optionA": "...",
          "optionB": "...",
          "optionC": "...",
          "optionD": "...",
          "correctAnswer": "B",
          "explanation": "...",
          "difficulty": "Medium",
          "topic": "Main Idea"
        },
        {
          "questionNumber": 2,
          "questionText": "As used in line 12, 'striking' most nearly means",
          "questionType": "MultipleChoice",
          "optionA": "...",
          "optionB": "...",
          "optionC": "...",
          "optionD": "...",
          "correctAnswer": "A",
          "explanation": "...",
          "difficulty": "Easy",
          "topic": "Vocabulary"
        }
      ]
    },
    {
      "passage": null,
      "passageIntro": null,
      "hasFigure": true,
      "figureDescription": "Bar chart showing population growth by decade",
      "boundingBox": [100, 50, 400, 950],
      "pageNumber": 5,
      "questions": [
        {
          "questionNumber": 3,
          "questionText": "Based on the figure, which decade showed the greatest increase?",
          "questionType": "MultipleChoice",
          "optionA": "...",
          "optionB": "...",
          "optionC": "...",
          "optionD": "...",
          "correctAnswer": "C",
          "explanation": "...",
          "difficulty": "Medium",
          "topic": "Data Analysis"
        }
      ]
    }
  ]
}
```

### Grouping Rules for Prompt

Add to Gemini prompt:

```
QUESTION GROUPING RULES:
1. If multiple consecutive questions reference the same passage, group them in ONE questionSet
2. Look for explicit cues like "Questions 5-7 refer to the following passage"
3. A standalone question with no passage = a questionSet with one question and passage: null
4. If a figure/chart/table is shared by multiple questions, attach it to the questionSet
5. For Math: if a diagram or table is referenced by multiple questions, group them together
6. Preserve the order of question sets and questions as they appear in the PDF

PASSAGE EXTRACTION:
- passage: The main text that questions reference (paragraphs, excerpts, etc.)
- passageIntro: Any introductory text like "The following is adapted from..." (separate from main passage)
- If no passage exists, set both to null

FIGURE HANDLING:
- hasFigure: true if the questionSet has a shared figure/chart/table
- figureDescription: Brief description of what the figure shows
- boundingBox: [ymin, xmin, ymax, xmax] normalized 0-1000
- pageNumber: 1-indexed PDF page number where figure appears
```

## Implementation Plan

### Phase 1: Schema Changes
- [ ] Add `QuestionSet` model to `prisma/schema.prisma`
- [ ] Modify `Question` model (add `questionSetId`, remove figure fields, keep only question-specific content)
- [ ] Update `Module` model relation
- [ ] Run `npx prisma db push` and `npx prisma generate`

### Phase 2: PDF Parser Updates (lib/services/pdfService.ts)
- [ ] Update `ParsedQuestion` interface → `ParsedQuestionSet` with nested questions
- [ ] Modify Gemini prompt with new output schema and grouping rules
- [ ] Update `extractModuleWithGemini()` to parse nested structure
- [ ] Update `extractFiguresFromPdf()` to iterate QuestionSets instead of Questions
- [ ] Update `storeInDatabase()` to create QuestionSet → Question hierarchy

### Phase 3: API Updates
- [ ] Modify `GET /api/tests` to include QuestionSet in response with nested questions
- [ ] Update any other endpoints that return question data

### Phase 4: UI Component Updates
- [ ] `QuestionCard.tsx`: Render passage/figure from `questionSet`, not `question`
- [ ] `MockTest.tsx`: Handle navigation (by question or by set?)
- [ ] `TestResults.tsx`: Group results display by QuestionSet where applicable
- [ ] Consider: Show "Question 1-3 of Passage 1" vs just "Question 1"

### Phase 5: Testing
- [ ] Test with real SAT PDF - verify passage grouping works correctly
- [ ] Test standalone questions (no passage)
- [ ] Test shared figures in Math section
- [ ] Test multi-page passages (if applicable)
- [ ] Verify figure extraction still works with new structure

## UI Considerations

### Question Navigation
Option A: Navigate by question (current behavior)
- Keep question-by-question navigation
- Show passage only when displaying first question of a set
- Collapse/show passage toggle

Option B: Navigate by QuestionSet
- Show entire passage + all related questions at once
- More natural for reading comprehension
- May need pagination within a set

Recommendation: Start with Option A (minimal UI changes), consider Option B as enhancement.

### QuestionCard Rendering Logic
```tsx
function QuestionCard({ question, questionSet, isFirstInSet }) {
  return (
    <div>
      {/* Only show passage for first question in set */}
      {isFirstInSet && questionSet.passage && (
        <Passage
          intro={questionSet.passageIntro}
          text={questionSet.passage}
        />
      )}

      {/* Show figure if set has one */}
      {isFirstInSet && questionSet.figureData && (
        <Figure
          src={questionSet.figureData}
          caption={questionSet.figureCaption}
        />
      )}

      {/* Question content */}
      <QuestionContent question={question} />
    </div>
  );
}
```

## Migration Strategy

For existing data, two options:

### Option A: Re-parse existing PDFs
- Simpler implementation
- Requires keeping original PDF files
- Better data quality with new parsing logic

### Option B: Database migration
- Create QuestionSet for each existing Question
- Move figure data from Question to QuestionSet
- Attempt passage deduplication (complex, may need manual review)

Recommendation: Option A if PDFs are available, otherwise Option B with manual review.

## Open Questions

1. **Analytics impact**: Should analytics track performance by QuestionSet (passage) or just Question?
2. **Practice mode**: How does AI-generated practice work with QuestionSets?
3. **Partial sets**: What if Gemini fails to group correctly? Validation/correction UI?

---

*Last updated: January 2025*
*Status: Implementation complete*

## Implementation Summary

All phases have been implemented:

- **Phase 1**: Prisma schema updated with `QuestionSet` model
- **Phase 2**: PDF parser (`pdfService.ts`) updated with new prompt and nested parsing
- **Phase 3**: API routes and `satTestService.ts` updated for QuestionSet queries
- **Phase 4**: UI components (`QuestionCard`, `MockTest`, `TestResults`) updated
- **Phase 5**: TypeScript verified, migration scripts updated

### Next Steps

1. Start your database and run `npx prisma db push` to apply schema changes
2. Re-parse existing PDFs with the new parser to populate QuestionSet data
3. Test the application with real SAT PDFs to verify passage grouping works correctly
