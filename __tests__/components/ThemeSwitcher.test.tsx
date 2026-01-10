import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ThemeSwitcher from '@/components/ThemeSwitcher'

describe('ThemeSwitcher', () => {
  const mockOnThemeChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all theme options', () => {
    render(<ThemeSwitcher currentTheme="dark" onThemeChange={mockOnThemeChange} />)

    expect(screen.getByText('Dark')).toBeInTheDocument()
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Gruvbox')).toBeInTheDocument()
    expect(screen.getByText('Tokyo Night')).toBeInTheDocument()
  })

  it('should highlight current theme', () => {
    render(<ThemeSwitcher currentTheme="gruvbox" onThemeChange={mockOnThemeChange} />)

    const gruvboxButton = screen.getByText('Gruvbox').closest('button')
    expect(gruvboxButton).toHaveClass('active')

    const darkButton = screen.getByText('Dark').closest('button')
    expect(darkButton).not.toHaveClass('active')
  })

  it('should call onThemeChange when theme is clicked', () => {
    render(<ThemeSwitcher currentTheme="dark" onThemeChange={mockOnThemeChange} />)

    fireEvent.click(screen.getByText('Light'))

    expect(mockOnThemeChange).toHaveBeenCalledWith('light')
  })

  it('should call onThemeChange for tokyo-night', () => {
    render(<ThemeSwitcher currentTheme="dark" onThemeChange={mockOnThemeChange} />)

    fireEvent.click(screen.getByText('Tokyo Night'))

    expect(mockOnThemeChange).toHaveBeenCalledWith('tokyo-night')
  })

  it('should have title attributes for accessibility', () => {
    render(<ThemeSwitcher currentTheme="dark" onThemeChange={mockOnThemeChange} />)

    expect(screen.getByTitle('Dark Theme')).toBeInTheDocument()
    expect(screen.getByTitle('Light Theme')).toBeInTheDocument()
    expect(screen.getByTitle('Gruvbox Theme')).toBeInTheDocument()
    expect(screen.getByTitle('Tokyo Night Theme')).toBeInTheDocument()
  })

  it('should render all four themes', () => {
    render(<ThemeSwitcher currentTheme="dark" onThemeChange={mockOnThemeChange} />)

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(4)
  })
})
