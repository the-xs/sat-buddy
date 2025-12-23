# SAT Buddy 📚

A comprehensive SAT testing companion application built with ReactJS. Upload SAT exam questions from PDF files, conduct mock tests, and review results with detailed explanations.

![SAT Buddy](https://img.shields.io/badge/React-19.2.0-blue)
![Vite](https://img.shields.io/badge/Vite-7.2.4-purple)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **📄 PDF Upload**: Drag-and-drop PDF files containing SAT questions
- **💾 Local Storage**: Questions stored in IndexedDB for offline access
- **📝 Mock Tests**: Configurable tests with random question selection
- **✅ Answer Validation**: Automatic grading with visual feedback
- **📊 Detailed Results**: Score display with explanations for each question
- **🎨 Premium UI**: Modern dark mode with glassmorphism effects
- **📱 Responsive**: Works seamlessly on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
# Clone or navigate to the project directory
cd sat-buddy

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your browser.

## 📖 Usage

### 1. Upload Questions

1. Click **"Upload Questions"** from the home page
2. Select category (Math or English)
3. Upload a PDF file with SAT questions
4. Questions are automatically parsed and stored

**Expected PDF Format:**
```
Question 1: What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B

Explanation: Basic arithmetic...
```

### 2. Take Mock Test

1. Click **"Take Mock Test"**
2. Configure test (category and number of questions)
3. Answer questions and navigate using the question grid
4. Submit test when complete

### 3. Review Results

- View your score and letter grade
- See correct/incorrect answers with visual indicators (✓/✗)
- Click **"Show me why"** for detailed explanations

## 🏗️ Project Structure

```
sat-buddy/
├── src/
│   ├── components/          # React components
│   │   ├── PDFUploader.jsx  # PDF upload and parsing
│   │   ├── MockTest.jsx     # Test administration
│   │   ├── QuestionCard.jsx # Question display
│   │   └── TestResults.jsx  # Results and explanations
│   ├── db.js                # IndexedDB configuration
│   ├── App.jsx              # Main application
│   └── index.css            # Global styles
├── package.json
└── vite.config.js
```

## 🛠️ Technologies

- **React 19.2.0** - UI framework
- **Vite 7.2.4** - Build tool and dev server
- **Dexie.js** - IndexedDB wrapper
- **pdfjs-dist** - PDF parsing
- **Lucide React** - Icon library

## 🎨 Design

- **Dark Mode**: Premium dark theme with purple/indigo gradients
- **Glassmorphism**: Semi-transparent cards with backdrop blur
- **Animations**: Smooth transitions and hover effects
- **Typography**: Inter font family
- **Responsive**: Mobile-first design

## 📝 Sample Data

A sample question file is included at `sample-questions.txt`. Convert it to PDF and upload to test the application.

## 🔮 Future Enhancements

- Enhanced PDF parsing for complex formats
- Manual question editing interface
- Test history and analytics
- Timed test mode
- Export results to PDF/CSV
- Dark/light theme toggle

## 📄 License

MIT License - feel free to use this project for your own SAT preparation!

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## 📧 Support

For questions or issues, please open an issue on the repository.

---

Built with ❤️ using React and Vite
