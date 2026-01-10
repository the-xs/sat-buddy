import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))

import { useSession, signOut } from 'next-auth/react'
import Sidebar from '@/components/Sidebar'

describe('Sidebar', () => {
  const mockOnViewChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    })
  })

  it('should render sidebar with logo', () => {
    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    expect(screen.getByText('SAT Buddy')).toBeInTheDocument()
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  it('should render all navigation items', () => {
    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Practice')).toBeInTheDocument()
    expect(screen.getByText('Upload')).toBeInTheDocument()
  })

  it('should highlight active view', () => {
    render(<Sidebar activeView="analytics" onViewChange={mockOnViewChange} />)

    const analyticsButton = screen.getByText('Analytics').closest('button')
    expect(analyticsButton).toHaveClass('active')

    const dashboardButton = screen.getByText('Dashboard').closest('button')
    expect(dashboardButton).not.toHaveClass('active')
  })

  it('should call onViewChange when navigation item is clicked', () => {
    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    fireEvent.click(screen.getByText('Practice'))

    expect(mockOnViewChange).toHaveBeenCalledWith('practice')
  })

  it('should display user info when logged in', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          image: null,
        },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })

    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('should display user initial when no image', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          image: null,
        },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })

    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('should display email initial when no name', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: null,
          email: 'john@example.com',
          image: null,
        },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })

    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getAllByText('J')).toHaveLength(1) // Initial from email
  })

  it('should display user image when available', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          image: 'https://example.com/avatar.jpg',
        },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })

    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    const img = screen.getByAltText('John Doe')
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('should call signOut when logout button is clicked', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          image: null,
        },
        expires: '',
      },
      status: 'authenticated',
      update: vi.fn(),
    })

    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    const logoutButton = screen.getByTitle('Sign out')
    fireEvent.click(logoutButton)

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('should not display user section when not logged in', () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    })

    render(<Sidebar activeView="dashboard" onViewChange={mockOnViewChange} />)

    expect(screen.queryByTitle('Sign out')).not.toBeInTheDocument()
  })
})
