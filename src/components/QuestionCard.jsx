import './QuestionCard.css';

const QuestionCard = ({ question, questionNumber, selectedAnswer, onAnswerSelect, showCorrectAnswer = false }) => {
    const options = ['A', 'B', 'C', 'D'];

    const getOptionClass = (option) => {
        const classes = ['option'];

        if (showCorrectAnswer) {
            if (option === question.correctAnswer) {
                classes.push('correct');
            }
            if (option === selectedAnswer && option !== question.correctAnswer) {
                classes.push('incorrect');
            }
        } else if (option === selectedAnswer) {
            classes.push('selected');
        }

        return classes.join(' ');
    };

    return (
        <div className="question-card glass-card">
            <div className="question-header">
                <span className="question-badge">Question {questionNumber}</span>
            </div>

            <div className="question-text">
                <p>{question.questionText}</p>
            </div>

            <div className="options-container">
                {options.map((option, index) => (
                    <button
                        key={option}
                        onClick={() => !showCorrectAnswer && onAnswerSelect(option)}
                        className={getOptionClass(option)}
                        disabled={showCorrectAnswer}
                    >
                        <span className="option-letter">{option}</span>
                        <span className="option-text">{question.options[index]}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default QuestionCard;
