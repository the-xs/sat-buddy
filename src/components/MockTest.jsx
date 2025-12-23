import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { questionOperations, testResultOperations } from '../db';
import QuestionCard from './QuestionCard';
import './MockTest.css';

const MockTest = ({ onTestComplete }) => {
    const [testConfig, setTestConfig] = useState({
        category: 'Math',
        questionCount: 10
    });
    const [testStarted, setTestStarted] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [availableQuestions, setAvailableQuestions] = useState({ Math: 0, English: 0 });

    useEffect(() => {
        loadQuestionCounts();
    }, []);

    const loadQuestionCounts = async () => {
        const mathCount = await questionOperations.getQuestionCount('Math');
        const englishCount = await questionOperations.getQuestionCount('English');
        setAvailableQuestions({ Math: mathCount, English: englishCount });
    };

    const startTest = async () => {
        const selectedQuestions = await questionOperations.getRandomQuestions(
            testConfig.category,
            testConfig.questionCount
        );

        if (selectedQuestions.length === 0) {
            alert('No questions available for this category. Please upload questions first.');
            return;
        }

        setQuestions(selectedQuestions);
        setAnswers({});
        setCurrentQuestionIndex(0);
        setTestStarted(true);
    };

    const handleAnswerSelect = (questionId, answer) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }));
    };

    const goToQuestion = (index) => {
        setCurrentQuestionIndex(index);
    };

    const nextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const previousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const submitTest = async () => {
        // Calculate results
        const results = questions.map(question => {
            const userAnswer = answers[question.id] || null;
            const isCorrect = userAnswer === question.correctAnswer;

            return {
                questionId: question.id,
                question: question.questionText,
                options: question.options,
                userAnswer,
                correctAnswer: question.correctAnswer,
                explanation: question.explanation,
                isCorrect,
                category: question.category
            };
        });

        // Save to database
        const testSessionId = `test_${Date.now()}`;
        await testResultOperations.saveTestResults(results, testSessionId);

        // Pass results to parent
        if (onTestComplete) {
            onTestComplete(results, testSessionId);
        }
    };

    const getAnsweredCount = () => {
        return Object.keys(answers).length;
    };

    if (!testStarted) {
        return (
            <div className="test-config">
                <div className="config-header">
                    <h2>Configure Your Mock Test</h2>
                    <p>Select category and number of questions</p>
                </div>

                <div className="config-form glass-card">
                    <div className="form-group">
                        <label htmlFor="category">Category</label>
                        <select
                            id="category"
                            value={testConfig.category}
                            onChange={(e) => setTestConfig({ ...testConfig, category: e.target.value })}
                        >
                            <option value="Math">Math ({availableQuestions.Math} available)</option>
                            <option value="English">English ({availableQuestions.English} available)</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="questionCount">Number of Questions</label>
                        <input
                            type="number"
                            id="questionCount"
                            min="1"
                            max={availableQuestions[testConfig.category]}
                            value={testConfig.questionCount}
                            onChange={(e) => setTestConfig({ ...testConfig, questionCount: parseInt(e.target.value) || 1 })}
                        />
                        <small>Maximum: {availableQuestions[testConfig.category]} questions</small>
                    </div>

                    <button
                        onClick={startTest}
                        className="btn btn-primary btn-lg"
                        disabled={availableQuestions[testConfig.category] === 0}
                    >
                        Start Test
                    </button>

                    {availableQuestions[testConfig.category] === 0 && (
                        <p className="warning-text">No questions available for this category. Please upload questions first.</p>
                    )}
                </div>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
        <div className="mock-test">
            <div className="test-header">
                <div className="test-info">
                    <h2>{testConfig.category} Test</h2>
                    <p>Question {currentQuestionIndex + 1} of {questions.length}</p>
                </div>
                <div className="test-stats">
                    <div className="stat">
                        <span className="stat-label">Answered</span>
                        <span className="stat-value">{getAnsweredCount()}/{questions.length}</span>
                    </div>
                </div>
            </div>

            <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>

            <div className="question-container">
                <QuestionCard
                    question={currentQuestion}
                    questionNumber={currentQuestionIndex + 1}
                    selectedAnswer={answers[currentQuestion.id]}
                    onAnswerSelect={(answer) => handleAnswerSelect(currentQuestion.id, answer)}
                />
            </div>

            <div className="question-navigator">
                <div className="question-grid">
                    {questions.map((q, index) => (
                        <button
                            key={q.id}
                            onClick={() => goToQuestion(index)}
                            className={`question-number ${index === currentQuestionIndex ? 'active' : ''} ${answers[q.id] ? 'answered' : ''}`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            </div>

            <div className="test-navigation">
                <button
                    onClick={previousQuestion}
                    disabled={currentQuestionIndex === 0}
                    className="btn btn-secondary"
                >
                    <ArrowLeft size={20} />
                    Previous
                </button>

                {currentQuestionIndex === questions.length - 1 ? (
                    <button
                        onClick={submitTest}
                        className="btn btn-success btn-lg"
                    >
                        <CheckCircle size={20} />
                        Submit Test
                    </button>
                ) : (
                    <button
                        onClick={nextQuestion}
                        className="btn btn-primary"
                    >
                        Next
                        <ArrowRight size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default MockTest;
