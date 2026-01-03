'use client';
import { FileText, CheckCircle, XCircle, History, PlayCircle, BarChart3 } from 'lucide-react';
import './Dashboard.css';

const Dashboard = ({
    satTests,
    pastSessions,
    onSelectTest,
    onViewResults,
    loading
}) => {
    // Calculate overall stats from past sessions
    const totalAnswered = pastSessions.reduce((sum, s) => sum + s.totalQuestions, 0);
    const totalCorrect = pastSessions.reduce((sum, s) => sum + s.totalScore, 0);
    const totalWrong = totalAnswered - totalCorrect;
    const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>Dashboard</h1>
                <p>Welcome back! Here's your progress overview.</p>
            </div>

            {/* Stats Cards */}
            <div className="stats-row">
                <div className="stat-card glass-card">
                    <div className="stat-icon">
                        <BarChart3 size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{totalAnswered}</span>
                        <span className="stat-label">Questions Answered</span>
                    </div>
                </div>
                <div className="stat-card glass-card">
                    <div className="stat-icon success">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{totalCorrect}</span>
                        <span className="stat-label">Correct Answers</span>
                    </div>
                </div>
                <div className="stat-card glass-card">
                    <div className="stat-icon error">
                        <XCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{totalWrong}</span>
                        <span className="stat-label">Wrong Answers</span>
                    </div>
                </div>
                <div className="stat-card glass-card">
                    <div className="stat-icon primary">
                        <BarChart3 size={24} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{accuracy}%</span>
                        <span className="stat-label">Accuracy</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* Available Tests */}
                <section className="dashboard-section">
                    <div className="section-header">
                        <h2><FileText size={20} /> Available Tests</h2>
                    </div>
                    <div className="section-content">
                        {loading ? (
                            <p className="loading-text">Loading tests...</p>
                        ) : satTests.length === 0 ? (
                            <p className="empty-text">No tests uploaded yet. Upload a PDF to get started!</p>
                        ) : (
                            <div className="test-list">
                                {satTests.map(test => (
                                    <div key={test.id} className="test-item glass-card">
                                        <div className="test-info">
                                            <h4>{test.name}</h4>
                                            <p className="test-meta">
                                                {test.modules?.length || 0} modules •
                                                Uploaded {new Date(test.uploadedAt).toLocaleDateString()}
                                            </p>
                                            <div className="module-badges">
                                                {test.modules?.map(m => (
                                                    <span key={m.id} className="module-badge">
                                                        {m.section === 'ReadingWriting' ? 'R/W' : 'Math'} M{m.moduleNumber}: {m._count?.questions || 0}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => onSelectTest(test)}
                                        >
                                            <PlayCircle size={16} />
                                            Take Test
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Past Results */}
                <section className="dashboard-section">
                    <div className="section-header">
                        <h2><History size={20} /> Past Results</h2>
                    </div>
                    <div className="section-content">
                        {pastSessions.length === 0 ? (
                            <p className="empty-text">No completed tests yet. Take a test to see your results!</p>
                        ) : (
                            <div className="results-list">
                                {pastSessions.slice(0, 5).map(session => {
                                    const percentage = session.totalQuestions > 0
                                        ? Math.round((session.totalScore / session.totalQuestions) * 100)
                                        : 0;
                                    return (
                                        <div
                                            key={session.sessionId}
                                            className="result-item glass-card"
                                            onClick={() => onViewResults(session.sessionId)}
                                        >
                                            <div className="result-info">
                                                <h4>{session.testName}</h4>
                                                <p className="result-meta">
                                                    {new Date(session.completedAt).toLocaleDateString()} at {new Date(session.completedAt).toLocaleTimeString()}
                                                </p>
                                            </div>
                                            <div className="result-score">
                                                <span className={`score-badge ${percentage >= 70 ? 'good' : percentage >= 50 ? 'medium' : 'low'}`}>
                                                    {percentage}%
                                                </span>
                                                <span className="score-detail">
                                                    {session.totalScore}/{session.totalQuestions}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
