import { useState, useEffect } from 'react';
import { BookOpen, Upload, PlayCircle, BarChart3 } from 'lucide-react';
import PDFUploader from './components/PDFUploader';
import MockTest from './components/MockTest';
import TestResults from './components/TestResults';
import { questionOperations } from './db';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [testResults, setTestResults] = useState(null);
  const [questionStats, setQuestionStats] = useState({ Math: 0, English: 0, total: 0 });

  useEffect(() => {
    loadQuestionStats();
  }, []);

  const loadQuestionStats = async () => {
    const mathCount = await questionOperations.getQuestionCount('Math');
    const englishCount = await questionOperations.getQuestionCount('English');
    setQuestionStats({
      Math: mathCount,
      English: englishCount,
      total: mathCount + englishCount
    });
  };

  const handleUploadComplete = () => {
    loadQuestionStats();
    setTimeout(() => {
      setCurrentView('home');
    }, 2000);
  };

  const handleTestComplete = (results) => {
    setTestResults(results);
    setCurrentView('results');
  };

  const handleReturnHome = () => {
    setCurrentView('home');
    setTestResults(null);
  };

  const renderView = () => {
    switch (currentView) {
      case 'upload':
        return <PDFUploader onUploadComplete={handleUploadComplete} />;
      case 'test':
        return <MockTest onTestComplete={handleTestComplete} />;
      case 'results':
        return <TestResults results={testResults} onReturnHome={handleReturnHome} />;
      default:
        return (
          <div className="home-view">
            <div className="hero-section">
              <div className="hero-content">
                <BookOpen size={80} className="hero-icon" />
                <h1>SAT Buddy</h1>
                <p className="hero-subtitle">Your intelligent SAT testing companion</p>
                <p className="hero-description">
                  Upload SAT questions, take mock tests, and track your progress with detailed explanations
                </p>
              </div>

              <div className="stats-grid">
                <div className="stat-card glass-card">
                  <div className="stat-icon">
                    <BarChart3 size={32} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{questionStats.total}</span>
                    <span className="stat-label">Total Questions</span>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon">
                    <BookOpen size={32} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{questionStats.Math}</span>
                    <span className="stat-label">Math Questions</span>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon">
                    <BookOpen size={32} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{questionStats.English}</span>
                    <span className="stat-label">English Questions</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="action-cards">
              <div className="action-card glass-card" onClick={() => setCurrentView('upload')}>
                <Upload size={48} />
                <h3>Upload Questions</h3>
                <p>Import SAT questions from PDF files</p>
                <button className="btn btn-primary">
                  Get Started
                </button>
              </div>

              <div
                className={`action-card glass-card ${questionStats.total === 0 ? 'disabled' : ''}`}
                onClick={() => questionStats.total > 0 && setCurrentView('test')}
              >
                <PlayCircle size={48} />
                <h3>Take Mock Test</h3>
                <p>Practice with your uploaded questions</p>
                <button
                  className="btn btn-primary"
                  disabled={questionStats.total === 0}
                >
                  Start Test
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <div className="logo" onClick={handleReturnHome}>
              <BookOpen size={32} />
              <span>SAT Buddy</span>
            </div>
            {currentView !== 'home' && (
              <button onClick={handleReturnHome} className="btn btn-secondary btn-sm">
                Back to Home
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          {renderView()}
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>SAT Buddy - Your intelligent testing companion</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
