# SAT Buddy �

SAT Buddy is a state-of-the-art, AI-powered testing companion designed to revolutionize your SAT preparation. Leveraging the power of Google Gemini, it provides on-demand practice questions, intelligent PDF parsing, and persistent progress tracking.

![SAT Buddy Logo](public/logo.png)

## ✨ Features

- **🤖 AI-Powered Practice**: Instantly generate Math, Reading, or Writing practice questions tailored to SAT standards.
- **🧑‍🏫 AI Tutoring**: Get detailed, step-by-step explanations for any question with a single click.
- **� Timed Test Mode**: Simulate real exam conditions with full-length modules and automatic time tracking.
- **📊 Real-time PDF Upload**: Smart PDF parsing with a visual progress bar and background processing—no strict formatting required!
- **� Persistent History**: Every attempt is saved to a central database, allowing you to review your growth over time.
- **🎨 Premium Interface**: Modern, responsive layout with a collapsible sidebar and multi-theme support (Dark, Light, Gruvbox, and Tokyo Night).
- **� Analytics Dashboard**: Track your accuracy and performance breakdown across categories.

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

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   ```
   Create a `.env` file in the `backend` directory:
   ```env
   PORT=3000
   DATABASE_URL="mysql://user:pass@localhost:3306/sat_buddy"
   GEMINI_API_KEY="your_api_key_here"
   ```
   Initialize the database:
   ```bash
   npx prisma db push
   ```

3. **Frontend Setup**:
   ```bash
   cd ..
   npm install
   ```

### Running Locally

1. **Start Backend**:
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend**:
   ```bash
   cd ..
   npm run dev
   ```

Access the app at [http://localhost:5173/](http://localhost:5173/)

## 🏗️ Technical Stack

- **Frontend**: React 19, Vite, Lucide Icons, Vanilla CSS (Modern CSS variables)
- **Backend**: Node.js, Express
- **Database**: MySQL with **Prisma ORM**
- **AI Engine**: Google Gemini (Pro & Flash models)
- **API Communication**: Axios with polling for long-running tasks

## 🎨 Design Philosophy

SAT Buddy follows a "Zero-Waste" design system:
- **Glassmorphism**: Elegant semi-transparent surfaces with backdrop filters.
- **Micro-animations**: Smooth transitions and loading states for a premium feel.
- **High Information Density**: Minimized whitespace to keep focus on learning.
- **Accessibility**: High-contrast themes for long study sessions.

## 🤝 Contributing

We welcome contributions! Please open an issue or submit a pull request if you have ideas for improvement.

---

Built with ❤️ for students everywhere.
