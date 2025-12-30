import { useState, useEffect } from 'react';
import PDFUploader from './components/PDFUploader';
import MockTest from './components/MockTest';
import TestResults from './components/TestResults';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Analytics from './components/Analytics';
import Practice from './components/Practice';
import ThemeSwitcher from './components/ThemeSwitcher';
import { satTestAPI } from './services/api';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [testResults, setTestResults] = useState(null);
  const [satTests, setSatTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pastSessions, setPastSessions] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem('sat-buddy-theme') || 'dark');

  useEffect(() => {
    loadSATTests();
    loadPastSessions();
  }, []);

  useEffect(() => {
    // Apply theme to body
    document.body.className = '';
    if (theme !== 'dark') {
      document.body.classList.add(`theme-${theme}`);
    }
    localStorage.setItem('sat-buddy-theme', theme);
  }, [theme]);

  const loadSATTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await satTestAPI.getAll();
      if (response.success) {
        setSatTests(response.data);
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
      setCurrentView('dashboard');
    }, 2000);
  };

  const handleTestComplete = (results) => {
    setTestResults(results);
    loadPastSessions(); // Refresh past sessions
    setCurrentView('results');
  };

  const handleReturnHome = () => {
    setCurrentView('dashboard');
    setTestResults(null);
    setSelectedTest(null);
  };

  const handleSelectTest = (test) => {
    setSelectedTest(test);
    setCurrentView('test');
  };

  const handleViewPastResults = async (sessionId) => {
    try {
      setLoading(true);
      const response = await satTestAPI.getSessionResults(sessionId);
      if (response.success) {
        setTestResults(response.data);
        setCurrentView('results');
      }
    } catch (err) {
      console.error('Error loading session results:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPastSessions = async () => {
    try {
      const response = await satTestAPI.getCompletedSessions();
      if (response.success) {
        setPastSessions(response.data);
      }
    } catch (err) {
      console.error('Error loading past sessions:', err);
    }
  };

  const handleViewChange = (view) => {
    setCurrentView(view);
    setTestResults(null);
    setSelectedTest(null);
  };

  const renderView = () => {
    switch (currentView) {
      case 'upload':
        return <PDFUploader onUploadComplete={handleUploadComplete} />;
      case 'test':
        return <MockTest test={selectedTest} onTestComplete={handleTestComplete} />;
      case 'results':
        return <TestResults sessionData={testResults} onReturnHome={handleReturnHome} />;
      case 'analytics':
        return <Analytics pastSessions={pastSessions} />;
      case 'practice':
        return <Practice />;
      case 'dashboard':
      default:
        return (
          <Dashboard
            satTests={satTests}
            pastSessions={pastSessions}
            onSelectTest={handleSelectTest}
            onViewResults={handleViewPastResults}
            loading={loading}
          />
        );
    }
  };

  return (
    <div className="app">
      <div className="app-layout">
        <Sidebar activeView={currentView} onViewChange={handleViewChange} />
        <div className="app-content">
          <header className="app-header">
            <div className="container">
              <div className="header-content">
                <div className="header-actions">
                  <ThemeSwitcher currentTheme={theme} onThemeChange={setTheme} />
                  {(currentView === 'test' || currentView === 'results') && (
                    <button onClick={handleReturnHome} className="btn btn-secondary btn-sm">
                      Back to Dashboard
                    </button>
                  )}
                </div>
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
      </div>
    </div>
  );
}

export default App;
