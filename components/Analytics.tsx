'use client';
import { useState, useEffect } from 'react';
import { Clock, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts';
import './Analytics.css';

interface PastSession {
    totalQuestions?: number | null;
    totalScore?: number | null;
}

interface AnalyticsProps {
    pastSessions: PastSession[];
}

interface TopicMastery {
    topic: string;
    progress: number;
    status: string;
}

interface SkillData {
    subject: string;
    target: number;
    you: number;
}

const Analytics = ({ pastSessions }: AnalyticsProps) => {
    const [data, setData] = useState<{ skillData: SkillData[]; topicMastery: TopicMastery[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAnalytics();
    }, [pastSessions]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/analytics');
            const result = await response.json();
            if (result.success) {
                setData(result.data);
            }
        } catch (err) {
            console.error('Error fetching analytics:', err);
            setError('Failed to load real-time analytics data.');
        } finally {
            setLoading(false);
        }
    };

    // Overall stats calculations
    const totalQuestions = pastSessions.reduce((sum, s) => sum + (s.totalQuestions || 0), 0);
    const totalCorrect = pastSessions.reduce((sum, s) => sum + (s.totalScore || 0), 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    // Mock avg time for now (time tracking per question not yet implemented in backend core)
    const avgTime = '42s';
    const timeChange = 'Consistent with baseline';

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'Mastered': return 'mastered';
            case 'Improving': return 'improving';
            case 'Needs Focus': return 'needs-focus';
            default: return 'new-topic';
        }
    };

    if (loading) {
        return (
            <div className="analytics-loading">
                <Loader2 className="animate-spin" size={48} />
                <p>Calculating your performance metrics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="analytics-error card glass-card">
                <AlertCircle size={48} />
                <p>{error}</p>
                <button onClick={fetchAnalytics} className="btn btn-primary">Retry</button>
            </div>
        );
    }

    const { skillData, topicMastery } = data || { skillData: [], topicMastery: [] };

    return (
        <div className="analytics">
            <div className="analytics-header">
                <h1>Performance Analytics</h1>
                <p>Real-time insights derived from your practice history and test results.</p>
            </div>

            <div className="analytics-grid">
                {/* Skill Distribution Radar Chart */}
                <section className="analytics-card glass-card">
                    <h2>Skill Distribution</h2>
                    <div className="chart-container">
                        <ResponsiveContainer width="100%" height={300}>
                            <RadarChart data={skillData}>
                                <PolarGrid stroke="var(--color-border)" />
                                <PolarAngleAxis
                                    dataKey="subject"
                                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                                />
                                <PolarRadiusAxis
                                    angle={30}
                                    domain={[0, 100]}
                                    tick={{ fill: 'var(--color-text-tertiary)', fontSize: 10 }}
                                />
                                <Radar
                                    name="Target"
                                    dataKey="target"
                                    stroke="var(--color-border)"
                                    fill="var(--color-border)"
                                    fillOpacity={0.1}
                                />
                                <Radar
                                    name="Your Accuracy"
                                    dataKey="you"
                                    stroke="var(--color-primary)"
                                    fill="var(--color-primary)"
                                    fillOpacity={0.5}
                                />
                                <Legend />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Topic Mastery */}
                <section className="analytics-card glass-card">
                    <h2>Topic Mastery</h2>
                    {topicMastery.length === 0 ? (
                        <div className="empty-state">
                            <p>Not enough data yet. Complete more practice questions to see topic breakdowns.</p>
                        </div>
                    ) : (
                        <div className="topic-list">
                            {topicMastery.map((topic, index) => (
                                <div key={index} className="topic-item">
                                    <div className="topic-header">
                                        <span className="topic-name">{topic.topic}</span>
                                        <span className={`topic-status ${getStatusClass(topic.status)}`}>
                                            {topic.status}
                                        </span>
                                    </div>
                                    <div className="topic-progress">
                                        <div
                                            className={`topic-progress-fill ${getStatusClass(topic.status)}`}
                                            style={{ width: `${topic.progress}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="analytics-stats">
                        <div className="analytics-stat">
                            <div className="stat-icon">
                                <Clock size={20} />
                            </div>
                            <div className="stat-info">
                                <span className="stat-label">AVG. TIME / Q</span>
                                <span className="stat-value">{avgTime}</span>
                                <span className="stat-change">{timeChange}</span>
                            </div>
                        </div>
                        <div className="analytics-stat">
                            <div className="stat-icon">
                                <Zap size={20} />
                            </div>
                            <div className="stat-info">
                                <span className="stat-label">OVERALL ACCURACY</span>
                                <span className="stat-value">{accuracy}%</span>
                                <span className="stat-change positive">Based on {totalQuestions} total questions</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Analytics;
