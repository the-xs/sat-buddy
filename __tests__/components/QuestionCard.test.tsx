import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QuestionCard from '@/components/QuestionCard'

// Mock KaTeX
vi.mock('katex', () => ({
  default: {
    renderToString: vi.fn((latex) => `<span class="katex">${latex}</span>`),
  },
}))

describe('QuestionCard', () => {
  const mockOnAnswerSelect = vi.fn()

  const baseQuestion = {
    id: 1,
    questionText: 'What is 2 + 2?',
    questionType: 'MultipleChoice',
    correctAnswer: 'B',
    optionA: '3',
    optionB: '4',
    optionC: '5',
    optionD: '6',
    options: ['3', '4', '5', '6'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render question text', () => {
    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(screen.getByText('Question 1')).toBeInTheDocument()
  })

  it('should render all four options', () => {
    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('should call onAnswerSelect when option is clicked', () => {
    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const optionB = screen.getByText('B').closest('button')
    fireEvent.click(optionB!)

    expect(mockOnAnswerSelect).toHaveBeenCalledWith('B')
  })

  it('should highlight selected answer', () => {
    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        selectedAnswer="C"
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const optionC = screen.getByText('C').closest('button')
    expect(optionC).toHaveClass('selected')
  })

  it('should show correct answer when showCorrectAnswer is true', () => {
    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        selectedAnswer="A"
        onAnswerSelect={mockOnAnswerSelect}
        showCorrectAnswer={true}
      />
    )

    const optionB = screen.getByText('B').closest('button')
    expect(optionB).toHaveClass('correct')

    const optionA = screen.getByText('A').closest('button')
    expect(optionA).toHaveClass('incorrect')
  })

  it('should disable options when showCorrectAnswer is true', () => {
    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        showCorrectAnswer={true}
      />
    )

    const options = screen.getAllByRole('button')
    options.forEach((option) => {
      expect(option).toBeDisabled()
    })
  })

  it('should render free response input for FreeResponse type', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(screen.getByText('Free Response')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your answer...')).toBeInTheDocument()
  })

  it('should call onAnswerSelect on free response submit', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const input = screen.getByPlaceholderText('Enter your answer...')
    fireEvent.change(input, { target: { value: '42' } })
    fireEvent.blur(input)

    expect(mockOnAnswerSelect).toHaveBeenCalledWith('42')
  })

  it('should submit on Enter key', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const input = screen.getByPlaceholderText('Enter your answer...')
    fireEvent.change(input, { target: { value: '42' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockOnAnswerSelect).toHaveBeenCalledWith('42')
  })

  it('should show correct/incorrect for free response when showCorrectAnswer is true', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        selectedAnswer="41"
        onAnswerSelect={mockOnAnswerSelect}
        showCorrectAnswer={true}
      />
    )

    expect(screen.getByText(/Incorrect/)).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('should render passage when questionSet has passage', () => {
    const questionSet = {
      id: 1,
      passage: 'This is a test passage.',
      passageIntro: 'Adapted from a novel.',
      hasFigure: false,
      figureData: null,
      figureCaption: null,
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={true}
      />
    )

    expect(screen.getByText('This is a test passage.')).toBeInTheDocument()
    expect(screen.getByText('Adapted from a novel.')).toBeInTheDocument()
  })

  it('should not render passage when isFirstInSet is false', () => {
    const questionSet = {
      id: 1,
      passage: 'This is a test passage.',
      passageIntro: 'Adapted from a novel.',
      hasFigure: false,
      figureData: null,
      figureCaption: null,
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={2}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={false}
      />
    )

    expect(screen.queryByText('This is a test passage.')).not.toBeInTheDocument()
  })

  it('should render figure when questionSet has figure', () => {
    const questionSet = {
      id: 1,
      passage: null,
      passageIntro: null,
      hasFigure: true,
      figureData: 'base64imagedata',
      figureCaption: 'Test figure',
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={true}
      />
    )

    const img = screen.getByAltText('Test figure')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,base64imagedata')
  })

  it('should render legacy figureUrl', () => {
    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        figureUrl="/api/tests/figure/1"
      />
    )

    const img = screen.getByAltText('Question figure')
    expect(img).toHaveAttribute('src', '/api/tests/figure/1')
  })

  it('should not submit empty free response', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const input = screen.getByPlaceholderText('Enter your answer...')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)

    expect(mockOnAnswerSelect).not.toHaveBeenCalled()
  })

  it('should show correct result for correct free response', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        selectedAnswer="42"
        onAnswerSelect={mockOnAnswerSelect}
        showCorrectAnswer={true}
      />
    )

    expect(screen.getByText(/Correct/)).toBeInTheDocument()
  })

  it('should handle case-insensitive free response comparison', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: 'ANSWER',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        selectedAnswer="answer"
        onAnswerSelect={mockOnAnswerSelect}
        showCorrectAnswer={true}
      />
    )

    expect(screen.getByText(/Correct/)).toBeInTheDocument()
  })

  it('should open figure modal on image click', () => {
    const questionSet = {
      id: 1,
      passage: null,
      passageIntro: null,
      hasFigure: true,
      figureData: 'base64imagedata',
      figureCaption: 'Test figure',
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={true}
      />
    )

    const img = screen.getByAltText('Test figure')
    fireEvent.click(img)

    // Modal should be open, showing two images (original + modal)
    const images = screen.getAllByAltText('Test figure')
    expect(images.length).toBe(2)
  })

  it('should close figure modal on overlay click', () => {
    const questionSet = {
      id: 1,
      passage: null,
      passageIntro: null,
      hasFigure: true,
      figureData: 'base64imagedata',
      figureCaption: 'Test figure',
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={true}
      />
    )

    const img = screen.getByAltText('Test figure')
    fireEvent.click(img)

    // Click the overlay to close
    const overlay = document.querySelector('.figure-modal-overlay')
    fireEvent.click(overlay!)

    // Only one image should remain
    const images = screen.getAllByAltText('Test figure')
    expect(images.length).toBe(1)
  })

  it('should hide image on error', () => {
    const questionSet = {
      id: 1,
      passage: null,
      passageIntro: null,
      hasFigure: true,
      figureData: 'invaliddata',
      figureCaption: 'Test figure',
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={true}
      />
    )

    const img = screen.getByAltText('Test figure') as HTMLImageElement
    fireEvent.error(img)

    expect(img.style.display).toBe('none')
  })

  it('should render bold text formatting', () => {
    const questionWithBold = {
      ...baseQuestion,
      questionText: 'What is **bold** text?',
    }

    render(
      <QuestionCard
        question={questionWithBold}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const strongElement = document.querySelector('strong')
    expect(strongElement).toBeInTheDocument()
  })

  it('should render italic text formatting', () => {
    const questionWithItalic = {
      ...baseQuestion,
      questionText: 'What is *italic* text?',
    }

    render(
      <QuestionCard
        question={questionWithItalic}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const emElement = document.querySelector('em')
    expect(emElement).toBeInTheDocument()
  })

  it('should render underline text formatting', () => {
    const questionWithUnderline = {
      ...baseQuestion,
      questionText: 'What is <u>underlined</u> text?',
    }

    render(
      <QuestionCard
        question={questionWithUnderline}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const uElement = document.querySelector('u')
    expect(uElement).toBeInTheDocument()
  })

  it('should render line numbers in passages', () => {
    const questionSet = {
      id: 1,
      passage: '5  This is line five.\n10  This is line ten.',
      passageIntro: null,
      hasFigure: false,
      figureData: null,
      figureCaption: null,
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={true}
      />
    )

    const lineNumbers = document.querySelectorAll('.line-number')
    expect(lineNumbers.length).toBe(2)
    expect(lineNumbers[0].textContent).toBe('5')
    expect(lineNumbers[1].textContent).toBe('10')
  })

  it('should sync free response value when selectedAnswer changes', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    const { rerender } = render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        selectedAnswer="10"
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const input = screen.getByPlaceholderText('Enter your answer...') as HTMLInputElement
    expect(input.value).toBe('10')

    rerender(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        selectedAnswer="20"
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(input.value).toBe('20')
  })

  it('should submit free response on Save button click', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const input = screen.getByPlaceholderText('Enter your answer...')
    fireEvent.change(input, { target: { value: '42' } })

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    expect(mockOnAnswerSelect).toHaveBeenCalledWith('42')
  })

  it('should disable Save button when input is empty', () => {
    const freeResponseQuestion = {
      ...baseQuestion,
      questionType: 'FreeResponse',
      correctAnswer: '42',
    }

    render(
      <QuestionCard
        question={freeResponseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    const saveButton = screen.getByText('Save')
    expect(saveButton).toBeDisabled()
  })

  it('should not call onAnswerSelect when options are disabled', () => {
    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        showCorrectAnswer={true}
      />
    )

    const optionA = screen.getByText('A').closest('button')
    fireEvent.click(optionA!)

    expect(mockOnAnswerSelect).not.toHaveBeenCalled()
  })

  it('should not show passage when questionSet has no passage', () => {
    const questionSet = {
      id: 1,
      passage: null,
      passageIntro: null,
      hasFigure: false,
      figureData: null,
      figureCaption: null,
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={true}
      />
    )

    expect(document.querySelector('.passage-container')).not.toBeInTheDocument()
  })

  it('should render LaTeX expressions', () => {
    const questionWithLatex = {
      ...baseQuestion,
      questionText: 'What is $x^2$?',
    }

    render(
      <QuestionCard
        question={questionWithLatex}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    // KaTeX mock wraps content in span with class katex
    expect(document.querySelector('.katex')).toBeInTheDocument()
  })

  it('should render LaTeX commands without dollar delimiters', () => {
    const questionWithLatexCommand = {
      ...baseQuestion,
      questionText: 'The answer is \\frac{1}{2}',
    }

    render(
      <QuestionCard
        question={questionWithLatexCommand}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    // KaTeX mock should be called for the frac command
    expect(document.querySelector('.katex')).toBeInTheDocument()
  })

  it('should render Greek letters without delimiters', () => {
    const questionWithGreek = {
      ...baseQuestion,
      questionText: 'The value of \\pi is approximately 3.14',
    }

    render(
      <QuestionCard
        question={questionWithGreek}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(document.querySelector('.katex')).toBeInTheDocument()
  })

  it('should render display mode LaTeX with $$', () => {
    const questionWithDisplayLatex = {
      ...baseQuestion,
      questionText: 'Calculate: $$x^2 + y^2 = z^2$$',
    }

    render(
      <QuestionCard
        question={questionWithDisplayLatex}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(document.querySelector('.katex')).toBeInTheDocument()
  })

  it('should render LaTeX with \\[ \\] delimiters', () => {
    const questionWithBracketLatex = {
      ...baseQuestion,
      questionText: 'Calculate: \\[x + y = z\\]',
    }

    render(
      <QuestionCard
        question={questionWithBracketLatex}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(document.querySelector('.katex')).toBeInTheDocument()
  })

  it('should render inline LaTeX with \\( \\) delimiters', () => {
    const questionWithParenLatex = {
      ...baseQuestion,
      questionText: 'The value \\(x = 5\\) is correct',
    }

    render(
      <QuestionCard
        question={questionWithParenLatex}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(document.querySelector('.katex')).toBeInTheDocument()
  })

  it('should handle complex LaTeX commands like sqrt', () => {
    const questionWithSqrt = {
      ...baseQuestion,
      questionText: 'What is \\sqrt{16}?',
    }

    render(
      <QuestionCard
        question={questionWithSqrt}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(document.querySelector('.katex')).toBeInTheDocument()
  })

  it('should handle empty text gracefully', () => {
    const questionWithEmpty = {
      ...baseQuestion,
      questionText: '',
    }

    render(
      <QuestionCard
        question={questionWithEmpty}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
      />
    )

    expect(screen.getByText('Question 1')).toBeInTheDocument()
  })

  it('should render passage intro separately from passage', () => {
    const questionSet = {
      id: 1,
      passage: 'Main passage content',
      passageIntro: 'Introduction text',
      hasFigure: false,
      figureData: null,
      figureCaption: null,
    }

    render(
      <QuestionCard
        question={baseQuestion}
        questionNumber={1}
        onAnswerSelect={mockOnAnswerSelect}
        questionSet={questionSet}
        isFirstInSet={true}
      />
    )

    expect(document.querySelector('.passage-intro')).toBeInTheDocument()
    expect(document.querySelector('.passage-text')).toBeInTheDocument()
  })
})
