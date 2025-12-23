import { useState, useEffect } from 'react';
import { BookOpen, Upload, PlayCircle, BarChart3, FileText } from 'lucide-react';
import PDFUploader from './components/PDFUploader';
import MockTest from './components/MockTest';
import TestResults from './components/TestResults';
import { satTestAPI } from './services/api';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [testResults, setTestResults] = useState(null);
  const [satTests, setSatTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [questionStats, setQuestionStats] = useState({ Math: 0, ReadingWriting: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSATTests();
  }, []);

  const loadSATTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await satTestAPI.getAll();
      if (response.success) {
        setSatTests(response.data);
        // Calculate total stats from all tests
        let totalMath = 0;
        let totalRW = 0;
        response.data.forEach(test => {
          test.modules?.forEach(module => {
            const count = module._count?.questions || 0;
            if (module.section === 'Math') {
              totalMath += count;
            } else if (module.section === 'ReadingWriting') {
              totalRW += count;
            }
          });
        });
        setQuestionStats({
          Math: totalMath,
          ReadingWriting: totalRW,
          total: totalMath + totalRW
        });
      }
    } catch (err) {
      console.error('Error loading SAT tests:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    loadSATTests();
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
    setSelectedTest(null);
  };

  const handleSelectTest = (test) => {
    setSelectedTest(test);
    setCurrentView('test');
  };

  const renderView = () => {
    switch (currentView) {
      case 'upload':
        return <PDFUploader onUploadComplete={handleUploadComplete} />;
      case 'test':
        return <MockTest test={selectedTest} onTestComplete={handleTestComplete} />;
      case 'results':
        return <TestResults sessionData={testResults} onReturnHome={handleReturnHome} />;
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
                    <span className="stat-number">{loading ? '...' : questionStats.total}</span>
                    <span className="stat-label">Total Questions</span>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon">
                    <BookOpen size={32} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{loading ? '...' : questionStats.Math}</span>
                    <span className="stat-label">Math Questions</span>
                  </div>
                </div>
                <div className="stat-card glass-card">
                  <div className="stat-icon">
                    <FileText size={32} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{loading ? '...' : questionStats.ReadingWriting}</span>
                    <span className="stat-label">Reading & Writing</span>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="error-banner">
                <p>⚠️ {error}</p>
                <button onClick={loadSATTests} className="btn btn-secondary btn-sm">Retry</button>
              </div>
            )}

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

            {/* Available Tests Section */}
            {satTests.length > 0 && (
              <div className="tests-section">
                <h2>Available Tests</h2>
                <div className="tests-grid">
                  {satTests.map(test => (
                    <div key={test.id} className="test-card glass-card" onClick={() => handleSelectTest(test)}>
                      <FileText size={32} />
                      <h4>{test.name}</h4>
                      <p className="test-date">Uploaded {new Date(test.uploadedAt).toLocaleDateString()}</p>
                      <div className="test-stats">
                        {test.modules?.map(module => (
                          <span key={module.id} className="module-badge">
                            {module.section} M{module.moduleNumber}: {module._count?.questions || 0}
                          </span>
                        ))}
                      </div>
                      <button className="btn btn-primary btn-sm">Take Test</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
