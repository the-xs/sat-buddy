import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Analytics from '@/components/Analytics'

// Mock recharts
vi.mock('recharts', () => ({
  RadarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="radar-chart">{children}</div>,
  PolarGrid: () => <div data-testid="polar-grid" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
  Radar: () => <div data-testid="radar" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  const mockPastSessions = [
    { totalQuestions: 50, totalScore: 40 },
    { totalQuestions: 50, totalScore: 45 },
  ]

  const mockAnalyticsResponse = {
    success: true,
    data: {
      skillData: [
        { subject: 'Algebra', target: 100, you: 75 },
        { subject: 'Geometry', target: 100, you: 80 },
        { subject: 'Grammar', target: 100, you: 65 },
        { subject: 'Reading', target: 100, you: 70 },
        { subject: 'Problem Solving', target: 100, you: 85 },
        { subject: 'Vocabulary', target: 100, you: 60 },
      ],
      topicMastery: [
        { topic: 'Heart of Algebra', progress: 75, status: 'Improving' },
        { topic: 'Geometry', progress: 85, status: 'Mastered' },
        { topic: 'Grammar', progress: 45, status: 'Needs Focus' },
      ],
    },
  }

  it('should show loading state initially', () => {
    vi.mocked(global.fetch).mockImplementation(() => new Promise(() => {}))

    render(<Analytics pastSessions={mockPastSessions} />)

    expect(screen.getByText('Calculating your performance metrics...')).toBeInTheDocument()
  })

  it('should fetch and display analytics data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve(mockAnalyticsResponse),
    } as Response)

    render(<Analytics pastSessions={mockPastSessions} />)

    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument()
    })

    expect(screen.getByText('Skill Distribution')).toBeInTheDocument()
    expect(screen.getByText('Topic Mastery')).toBeInTheDocument()
  })

  it('should display topic mastery items', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve(mockAnalyticsResponse),
    } as Response)

    render(<Analytics pastSessions={mockPastSessions} />)

    await waitFor(() => {
      expect(screen.getByText('Heart of Algebra')).toBeInTheDocument()
    })

    expect(screen.getByText('Geometry')).toBeInTheDocument()
    expect(screen.getByText('Grammar')).toBeInTheDocument()
    expect(screen.getByText('Improving')).toBeInTheDocument()
    expect(screen.getByText('Mastered')).toBeInTheDocument()
    expect(screen.getByText('Needs Focus')).toBeInTheDocument()
  })

  it('should calculate overall stats from pastSessions', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve(mockAnalyticsResponse),
    } as Response)

    render(<Analytics pastSessions={mockPastSessions} />)

    await waitFor(() => {
      // Total questions: 100, correct: 85, accuracy: 85%
      expect(screen.getByText('85%')).toBeInTheDocument()
      expect(screen.getByText('Based on 100 total questions')).toBeInTheDocument()
    })
  })

  it('should show error state when fetch fails', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'))

    render(<Analytics pastSessions={mockPastSessions} />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load real-time analytics data.')).toBeInTheDocument()
    })

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('should retry fetching on button click', async () => {
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockAnalyticsResponse),
      } as Response)

    render(<Analytics pastSessions={mockPastSessions} />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Retry'))

    await waitFor(() => {
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument()
    })
  })

  it('should show empty state when no topic mastery data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        data: {
          skillData: [],
          topicMastery: [],
        },
      }),
    } as Response)

    render(<Analytics pastSessions={mockPastSessions} />)

    await waitFor(() => {
      expect(screen.getByText('Not enough data yet. Complete more practice questions to see topic breakdowns.')).toBeInTheDocument()
    })
  })

  it('should handle 0% accuracy when no sessions', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve(mockAnalyticsResponse),
    } as Response)

    render(<Analytics pastSessions={[]} />)

    await waitFor(() => {
      expect(screen.getByText('0%')).toBeInTheDocument()
    })
  })

  it('should render radar chart', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve(mockAnalyticsResponse),
    } as Response)

    render(<Analytics pastSessions={mockPastSessions} />)

    await waitFor(() => {
      expect(screen.getByTestId('radar-chart')).toBeInTheDocument()
    })
  })

  it('should display avg time stat', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve(mockAnalyticsResponse),
    } as Response)

    render(<Analytics pastSessions={mockPastSessions} />)

    await waitFor(() => {
      expect(screen.getByText('AVG. TIME / Q')).toBeInTheDocument()
      expect(screen.getByText('42s')).toBeInTheDocument()
    })
  })
})
