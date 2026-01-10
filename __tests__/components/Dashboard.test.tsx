import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Dashboard from '@/components/Dashboard'

describe('Dashboard', () => {
  const mockOnSelectTest = vi.fn()
  const mockOnViewResults = vi.fn()

  const mockTests = [
    {
      id: 1,
      name: 'SAT Practice Test 1',
      uploadedAt: '2024-01-15T10:00:00Z',
      modules: [
        { id: 1, section: 'ReadingWriting', moduleNumber: 1, _count: { questions: 27 } },
        { id: 2, section: 'Math', moduleNumber: 1, _count: { questions: 22 } },
      ],
    },
    {
      id: 2,
      name: 'SAT Practice Test 2',
      uploadedAt: '2024-01-16T10:00:00Z',
      modules: [],
    },
  ]

  const mockSessions = [
    {
      sessionId: 'sess_1',
      testId: 1,
      testName: 'Test 1',
      rwScore: 25,
      mathScore: 20,
      totalScore: 45,
      totalQuestions: 50,
      startedAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T11:00:00Z',
    },
    {
      sessionId: 'sess_2',
      testId: 1,
      testName: 'Test 1',
      rwScore: 27,
      mathScore: 22,
      totalScore: 49,
      totalQuestions: 50,
      startedAt: '2024-01-16T10:00:00Z',
      completedAt: '2024-01-16T11:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render dashboard with header', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={[]}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText("Welcome back! Here's your progress overview.")).toBeInTheDocument()
  })

  it('should display loading state', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={[]}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={true}
      />
    )

    expect(screen.getByText('Loading tests...')).toBeInTheDocument()
  })

  it('should display empty state when no tests', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={[]}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    expect(screen.getByText('No tests uploaded yet. Upload a PDF to get started!')).toBeInTheDocument()
  })

  it('should display empty state when no sessions', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={[]}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    expect(screen.getByText('No completed tests yet. Take a test to see your results!')).toBeInTheDocument()
  })

  it('should display tests list', () => {
    render(
      <Dashboard
        satTests={mockTests}
        pastSessions={[]}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    expect(screen.getByText('SAT Practice Test 1')).toBeInTheDocument()
    expect(screen.getByText('SAT Practice Test 2')).toBeInTheDocument()
  })

  it('should display module badges for tests', () => {
    render(
      <Dashboard
        satTests={mockTests}
        pastSessions={[]}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    expect(screen.getByText('R/W M1: 27')).toBeInTheDocument()
    expect(screen.getByText('Math M1: 22')).toBeInTheDocument()
  })

  it('should call onSelectTest when Take Test button is clicked', () => {
    render(
      <Dashboard
        satTests={mockTests}
        pastSessions={[]}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    const takeTestButtons = screen.getAllByText('Take Test')
    fireEvent.click(takeTestButtons[0])

    expect(mockOnSelectTest).toHaveBeenCalledWith(mockTests[0])
  })

  it('should display past sessions', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={mockSessions}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    expect(screen.getAllByText('Test 1')).toHaveLength(2)
  })

  it('should call onViewResults when session is clicked', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={mockSessions}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    const sessionItems = screen.getAllByText('Test 1')
    fireEvent.click(sessionItems[0])

    expect(mockOnViewResults).toHaveBeenCalledWith('sess_1')
  })

  it('should calculate and display stats correctly', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={mockSessions}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    // Total questions: 50 + 50 = 100
    expect(screen.getByText('100')).toBeInTheDocument()
    // Total correct: 45 + 49 = 94
    expect(screen.getByText('94')).toBeInTheDocument()
    // Total wrong: 100 - 94 = 6
    expect(screen.getByText('6')).toBeInTheDocument()
    // Accuracy: 94%
    expect(screen.getByText('94%')).toBeInTheDocument()
  })

  it('should show 0% accuracy when no sessions', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={[]}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('should display percentage badges for sessions', () => {
    render(
      <Dashboard
        satTests={[]}
        pastSessions={mockSessions}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    // 45/50 = 90% and 49/50 = 98%
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('98%')).toBeInTheDocument()
  })

  it('should limit displayed sessions to 5', () => {
    const manySessions = Array.from({ length: 10 }, (_, i) => ({
      sessionId: `sess_${i}`,
      testId: 1,
      testName: `Test ${i}`,
      rwScore: 25,
      mathScore: 20,
      totalScore: 45,
      totalQuestions: 50,
      startedAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T11:00:00Z',
    }))

    render(
      <Dashboard
        satTests={[]}
        pastSessions={manySessions}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    // Should only show first 5
    expect(screen.getByText('Test 0')).toBeInTheDocument()
    expect(screen.getByText('Test 4')).toBeInTheDocument()
    expect(screen.queryByText('Test 5')).not.toBeInTheDocument()
  })

  it('should handle null scores gracefully', () => {
    const sessionsWithNulls = [
      {
        sessionId: 'sess_1',
        testId: 1,
        testName: 'Test 1',
        rwScore: null,
        mathScore: null,
        totalScore: null,
        totalQuestions: 50,
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: null,
      },
    ]

    render(
      <Dashboard
        satTests={[]}
        pastSessions={sessionsWithNulls}
        onSelectTest={mockOnSelectTest}
        onViewResults={mockOnViewResults}
        loading={false}
      />
    )

    // Should show 0% for null scores - there are multiple 0% elements (stats and session badge)
    const zeroPercents = screen.getAllByText('0%')
    expect(zeroPercents.length).toBeGreaterThanOrEqual(1)
  })
})
