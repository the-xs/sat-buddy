import { Clock, Zap } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts';
import './Analytics.css';

const Analytics = ({ pastSessions }) => {
    // Calculate skill distribution from past sessions
    // For now, using mock data - in production, this would come from detailed question tracking
    const skillData = [
        { subject: 'Algebra', target: 100, you: 75 },
        { subject: 'Geometry', target: 100, you: 65 },
        { subject: 'Grammar', target: 100, you: 80 },
        { subject: 'Reading', target: 100, you: 70 },
        { subject: 'Problem Solving', target: 100, you: 60 },
        { subject: 'Vocabulary', target: 100, you: 85 },
    ];

    // Topic mastery data
    const topicMastery = [
        { topic: 'Heart of Algebra', progress: 92, status: 'Mastered' },
        { topic: 'Standard Conventions', progress: 68, status: 'Improving' },
        { topic: 'Data Analysis', progress: 45, status: 'Needs Focus' },
        { topic: 'Advanced Math', progress: 30, status: 'New Topic' },
    ];

    // Calculate overall stats
    const totalQuestions = pastSessions.reduce((sum, s) => sum + s.totalQuestions, 0);
    const totalCorrect = pastSessions.reduce((sum, s) => sum + s.totalScore, 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    // Mock avg time (in a real app, this would be tracked)
    const avgTime = '42s';
    const timeChange = '12% faster than last week';

    const getStatusClass = (status) => {
        switch (status) {
            case 'Mastered': return 'mastered';
            case 'Improving': return 'improving';
            case 'Needs Focus': return 'needs-focus';
            default: return 'new-topic';
        }
    };

    return (
        <div className="analytics">
            <div className="analytics-header">
                <h1>Performance Analytics</h1>
                <p>Deep dive into your strengths and growth areas.</p>
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
                                    fillOpacity={0.3}
                                />
                                <Radar
                                    name="You"
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

                    {/* Stats Cards */}
                    <div className="analytics-stats">
                        <div className="analytics-stat">
                            <div className="stat-icon">
                                <Clock size={20} />
                            </div>
                            <div className="stat-info">
                                <span className="stat-label">AVG. TIME / Q</span>
                                <span className="stat-value">{avgTime}</span>
                                <span className="stat-change positive">{timeChange}</span>
                            </div>
                        </div>
                        <div className="analytics-stat">
                            <div className="stat-icon">
                                <Zap size={20} />
                            </div>
                            <div className="stat-info">
                                <span className="stat-label">ACCURACY</span>
                                <span className="stat-value">{accuracy}%</span>
                                <span className="stat-change">Consistent with target</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Analytics;
