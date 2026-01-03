import prisma from '@/lib/prisma';

interface TopicStats {
    [topic: string]: {
        total: number;
        correct: number;
    };
}

interface SkillData {
    subject: string;
    target: number;
    you: number;
}

interface TopicMastery {
    topic: string;
    progress: number;
    status: string;
}

export const analyticsService = {
    // Get aggregated analytics data for the user
    async getAnalytics(): Promise<{ skillData: SkillData[]; topicMastery: TopicMastery[] }> {
        // 1. Fetch data from test_results (uploaded PDF tests)
        const testResults = await prisma.testResult.findMany({
            include: {
                question: true
            }
        });

        // 2. Fetch data from practice_questions (AI-generated practice)
        const practiceQuestions = await prisma.practiceQuestion.findMany({
            where: { answeredAt: { not: null } }
        });

        // Combine both sources of question outcomes
        const allResults = [
            ...testResults.map(r => ({
                topic: r.question.topic || 'Uncategorized',
                isCorrect: r.isCorrect,
                type: 'test' as const
            })),
            ...practiceQuestions.map(q => ({
                topic: q.topic || 'Uncategorized',
                isCorrect: q.isCorrect,
                type: 'practice' as const
            }))
        ];

        // Aggregation map
        const topicStats: TopicStats = {};

        allResults.forEach(res => {
            const topic = res.topic;
            if (!topicStats[topic]) {
                topicStats[topic] = { total: 0, correct: 0 };
            }
            topicStats[topic].total++;
            if (res.isCorrect) {
                topicStats[topic].correct++;
            }
        });

        // Prepare skillData for Radar chart
        const radarMapping: Record<string, string> = {
            'Heart of Algebra': 'Algebra',
            'Passport to Advanced Math': 'Algebra',
            'Algebra': 'Algebra',
            'Geometry and Trigonometry': 'Geometry',
            'Geometry': 'Geometry',
            'Standard English Conventions': 'Grammar',
            'Grammar': 'Grammar',
            'Information and Ideas': 'Reading',
            'Reading Comprehension': 'Reading',
            'Rhetoric': 'Reading',
            'Problem Solving and Data Analysis': 'Problem Solving',
            'Problem Solving': 'Problem Solving',
            'Vocabulary': 'Vocabulary',
            'Words in Context': 'Vocabulary'
        };

        const skillDataMap: Record<string, { total: number; correct: number }> = {
            'Algebra': { total: 0, correct: 0 },
            'Geometry': { total: 0, correct: 0 },
            'Grammar': { total: 0, correct: 0 },
            'Reading': { total: 0, correct: 0 },
            'Problem Solving': { total: 0, correct: 0 },
            'Vocabulary': { total: 0, correct: 0 }
        };

        Object.entries(topicStats).forEach(([topic, stats]) => {
            const mappedKey = radarMapping[topic] || (topic.toLowerCase().includes('math') ? 'Algebra' : 'Reading');
            if (skillDataMap[mappedKey]) {
                skillDataMap[mappedKey].total += stats.total;
                skillDataMap[mappedKey].correct += stats.correct;
            }
        });

        const skillData: SkillData[] = Object.entries(skillDataMap).map(([subject, stats]) => ({
            subject,
            target: 100,
            you: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
        }));

        // Prepare topicMastery for progress bars
        const topicMastery: TopicMastery[] = Object.entries(topicStats).map(([topic, stats]) => {
            const progress = Math.round((stats.correct / stats.total) * 100);
            let status = 'New Topic';
            if (stats.total >= 5) {
                if (progress >= 85) status = 'Mastered';
                else if (progress >= 60) status = 'Improving';
                else status = 'Needs Focus';
            } else if (stats.total > 0) {
                status = 'Improving';
            }

            return {
                topic: topic === 'General' ? 'Uncategorized' : topic,
                progress,
                status
            };
        }).sort((a, b) => b.progress - a.progress);

        return {
            skillData,
            topicMastery: topicMastery.slice(0, 6) // Return top 6 for UI
        };
    }
};
