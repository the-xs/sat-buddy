# SAT Buddy

AI-powered SAT preparation platform with intelligent tutoring, practice question generation, and progress tracking.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: MySQL with Prisma ORM
- **Auth**: NextAuth.js v5 (Google OAuth + credentials)
- **AI**: Google Gemini API (`@google/generative-ai`)
- **PDF Processing**: `pdfjs-dist`, `pdf-to-img`, `sharp`
- **Styling**: Vanilla CSS with CSS variables (supports Dark/Light/Gruvbox/Tokyo Night themes)

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run lint             # Run ESLint
npx prisma db push       # Push schema changes to database
npx prisma generate      # Regenerate Prisma client
```

## Project Structure

```
app/
├── api/                 # API routes (auth, tests, sessions, practice, upload, analytics)
├── (auth)/              # Auth pages (login, register, forgot-password, reset-password)
├── layout.tsx           # Root layout with SessionProvider
└── page.tsx             # Main dashboard page

components/              # React components
├── Dashboard.tsx        # Home view with test list
├── Practice.tsx         # AI question generation
├── MockTest.tsx         # Test-taking interface with timer
├── TestResults.tsx      # Results review with explanations
├── Analytics.tsx        # Charts and skill mastery
├── PDFUploader.tsx      # PDF upload with progress
├── QuestionCard.tsx     # Question display component
├── Sidebar.tsx          # Navigation
└── auth/                # Auth form components

lib/
├── prisma.ts            # Prisma client singleton
├── auth/index.ts        # Auth helper functions
└── services/            # Business logic
    ├── pdfService.ts        # PDF parsing with Gemini
    ├── practiceService.ts   # AI practice questions
    ├── satTestService.ts    # Test management & sessions
    └── analyticsService.ts  # Analytics calculation

prisma/schema.prisma     # Database schema
```

## Key Patterns

- **Service Layer**: Business logic in `lib/services/`, API routes call services
- **API Response Format**: `{ success: boolean, data?: T, error?: string }`
- **Auth Middleware**: `middleware.ts` protects routes, redirects unauthenticated users
- **Progress Tracking**: In-memory Map for async PDF processing with polling

## Database Models

Key models in Prisma schema:
- `User`, `Account`, `Session` - Auth (NextAuth.js)
- `SATTest`, `Module`, `Question` - Uploaded tests with parsed content
- `TestSession`, `TestResult` - User test-taking data
- `PracticeQuestion` - AI-generated practice with responses

## Environment Variables

```env
DATABASE_URL="mysql://user:pass@localhost:3306/sat_buddy"
GEMINI_API_KEY="..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

## Code Conventions

- TypeScript strict mode
- camelCase for variables/functions, PascalCase for components
- Consistent error handling with try-catch and console logging
- React hooks for state management (useState, useEffect)
- Markdown rendering for AI explanations (`react-markdown`)

## File Uploads

- Development: `public/uploads/` (pdfs/, figures/, temp/)
- Production: `/tmp/uploads/` (serverless-friendly)

## API Endpoints

- `POST /api/upload` - Upload PDF, returns async processing
- `GET /api/upload?file=filename` - Poll processing progress
- `GET /api/tests` - List all tests
- `POST /api/practice` - Generate/check/explain practice questions
- `GET /api/analytics` - User performance data
