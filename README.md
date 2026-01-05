# SAT Buddy 📚

SAT Buddy is a state-of-the-art, AI-powered testing companion designed to revolutionize your SAT preparation. Leveraging the power of Google Gemini, it provides on-demand practice questions, intelligent PDF parsing, and persistent progress tracking.

![SAT Buddy Logo](public/logo.png)

## ✨ Features

- **🤖 AI-Powered Practice**: Instantly generate Math, Reading, or Writing practice questions tailored to SAT standards.
- **🧑‍🏫 AI Tutoring**: Get detailed, step-by-step explanations for any question with a single click.
- **⏱ Timed Test Mode**: Simulate real exam conditions with full-length modules and automatic time tracking.
- **📊 Real-time PDF Upload**: Smart PDF parsing with a visual progress bar and background processing—no strict formatting required!
- **📝 Persistent History**: Every attempt is saved to a central database, allowing you to review your growth over time.
- **🎨 Premium Interface**: Modern, responsive layout with a collapsible sidebar and multi-theme support (Dark, Light, Gruvbox, and Tokyo Night).
- **📈 Analytics Dashboard**: Track your accuracy and performance breakdown across categories.
- **🔐 User Authentication**: Secure login with Google OAuth or email/password registration.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18+
- **Database**: MySQL (or any Prisma-supported DB)
- **API Key**: A Google Gemini API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/sat-buddy.git
   cd sat-buddy
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the project root:
   ```env
   DATABASE_URL="mysql://user:pass@localhost:3306/sat_buddy"
   GEMINI_API_KEY="your_api_key_here"
   NEXTAUTH_SECRET="your_nextauth_secret"
   NEXTAUTH_URL="http://localhost:3000"
   GOOGLE_CLIENT_ID="your_google_client_id"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"
   ```

4. **Initialize the database**:
   ```bash
   npx prisma db push
   ```

### Running Locally

```bash
npm run dev
```

Access the app at [http://localhost:3000/](http://localhost:3000/)

## 🏗️ Technical Stack

- **Framework**: Next.js 14 with TypeScript (App Router)
- **Styling**: Vanilla CSS with CSS variables for theming
- **Database**: MySQL with **Prisma ORM**
- **Authentication**: NextAuth.js (Google OAuth + Credentials)
- **AI Engine**: Google Gemini (gemini-3-flash-preview)
- **Icons**: Lucide React

## 🎨 Design Philosophy

SAT Buddy follows a "Zero-Waste" design system:
- **Glassmorphism**: Elegant semi-transparent surfaces with backdrop filters.
- **Micro-animations**: Smooth transitions and loading states for a premium feel.
- **High Information Density**: Minimized whitespace to keep focus on learning.
- **Accessibility**: High-contrast themes for long study sessions.

## 🚢 Deployment

The app includes Docker and AWS Elastic Beanstalk configuration for easy deployment:
- `Dockerfile` for containerized deployment
- `Dockerrun.aws.json` for AWS EB configuration

## 🤝 Contributing

We welcome contributions! Please open an issue or submit a pull request if you have ideas for improvement.

---

Built with ❤️ for students everywhere.
