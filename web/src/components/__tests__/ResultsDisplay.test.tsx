import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResultsDisplay from '../ResultsDisplay'

describe('ResultsDisplay', () => {
  const mockWindowOpen = jest.fn()
  const mockDocumentWrite = jest.fn()
  const mockDocumentClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock window.open
    global.window.open = mockWindowOpen
    
    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { reload: jest.fn() },
      writable: true,
    })
  })

  it('should show loading spinner when loading', () => {
    render(<ResultsDisplay result={null} loading={true} />)
    
    expect(screen.getByText('Reference Image')).toBeInTheDocument()
    expect(screen.getByText('Generating reference image...')).toBeInTheDocument()
    
    // Check for loading spinner
    const spinner = document.querySelector('.loading-spinner')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveStyle({
      width: '40px',
      height: '40px',
      border: '3px solid #e0e0e0',
      borderTop: '3px solid #007bff',
      borderRadius: '50%'
    })
  })

  it('should show placeholder when no result and not loading', () => {
    render(<ResultsDisplay result={null} loading={false} />)
    
    expect(screen.getByText('Reference Image')).toBeInTheDocument()
    expect(screen.getByText('Fill out the form to generate your haircut reference image')).toBeInTheDocument()
  })

  it('should display image result with data URL', () => {
    const testImage = 'data:image/jpeg;base64,testdata'
    render(<ResultsDisplay result={testImage} loading={false} />)
    
    expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
    
    const img = screen.getByAltText('Haircut reference image')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', testImage)
    expect(img).toHaveStyle({
      width: '100%',
      maxHeight: '400px',
      borderRadius: '8px',
      objectFit: 'contain',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      marginBottom: '15px'
    })
    
    expect(screen.getByText('View Full Size')).toBeInTheDocument()
    expect(screen.getByText('Download')).toBeInTheDocument()
    expect(screen.getByText('Generate angles')).toBeInTheDocument()
  })

  it('should display text result', () => {
    const testText = 'This is a text description of the haircut'
    render(<ResultsDisplay result={testText} loading={false} />)
    
    expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
    expect(screen.getByText(testText)).toBeInTheDocument()
    expect(screen.getByText('Reference Generated')).toBeInTheDocument()
    
    // Check text container styles
    const textContainer = screen.getByText(testText).closest('div')
    expect(textContainer).toHaveStyle({
      backgroundColor: 'white',
      padding: '15px',
      borderRadius: '6px',
      border: '1px solid #e9ecef',
      fontSize: '14px',
      maxHeight: '300px',
      overflowY: 'auto'
    })
  })

  it('should handle view full size click with successful window.open', async () => {
    const user = userEvent.setup()
    const testImage = 'data:image/jpeg;base64,testdata'
    
    const mockWindow = {
      document: {
        write: mockDocumentWrite,
        close: mockDocumentClose,
      },
    }
    
    mockWindowOpen.mockReturnValue(mockWindow)

    render(<ResultsDisplay result={testImage} loading={false} />)
    
    const viewFullSizeLink = screen.getByText('View Full Size')
    await user.click(viewFullSizeLink)
    
    expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank', 'width=800,height=600')
    expect(mockDocumentWrite).toHaveBeenCalledWith(
      expect.stringContaining(`<img src="${testImage}" alt="Haircut reference image" />`)
    )
    expect(mockDocumentClose).toHaveBeenCalled()
  })

  it('should handle view full size click when window.open returns null', async () => {
    const user = userEvent.setup()
    const testImage = 'data:image/jpeg;base64,testdata'
    
    mockWindowOpen.mockReturnValue(null)

    render(<ResultsDisplay result={testImage} loading={false} />)
    
    const viewFullSizeLink = screen.getByText('View Full Size')
    await user.click(viewFullSizeLink)
    
    expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank', 'width=800,height=600')
    expect(mockDocumentWrite).not.toHaveBeenCalled()
    expect(mockDocumentClose).not.toHaveBeenCalled()
  })

  it('should have correct download link attributes', () => {
    const testImage = 'data:image/jpeg;base64,testdata'
    render(<ResultsDisplay result={testImage} loading={false} />)
    
    const downloadLink = screen.getByText('Download').closest('a')
    expect(downloadLink).toHaveAttribute('href', testImage)
    expect(downloadLink).toHaveAttribute('download', 'haircut-reference.jpg')
    expect(downloadLink).toHaveStyle({
      display: 'inline-block',
      padding: '8px 16px',
      backgroundColor: '#28a745',
      color: 'white',
      textDecoration: 'none',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: '500'
    })
  })

  it('should handle generate angles click', async () => {
    const user = userEvent.setup()
    const testImage = 'data:image/jpeg;base64,testdata'
    
    const mockReload = jest.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    })

    render(<ResultsDisplay result={testImage} loading={false} />)
    
    const generateAnglesLink = screen.getByText('Generate angles')
    await user.click(generateAnglesLink)
    
    expect(mockReload).toHaveBeenCalled()
  })

  it('should handle image load error', () => {
    const testImage = 'data:image/jpeg;base64,testdata'
    render(<ResultsDisplay result={testImage} loading={false} />)
    
    const img = screen.getByAltText('Haircut reference image')
    
    // Trigger error event
    fireEvent.error(img)
    
    expect(img).toHaveStyle({ display: 'none' })
    expect(screen.getByText('❌ Failed to load image')).toBeInTheDocument()
    expect(screen.getByText('Please try generating again')).toBeInTheDocument()
  })

  it('should handle image load error when parent element is null', () => {
    const testImage = 'data:image/jpeg;base64,testdata'
    render(<ResultsDisplay result={testImage} loading={false} />)
    
    const img = screen.getByAltText('Haircut reference image')
    
    // Mock parentElement to be null
    Object.defineProperty(img, 'parentElement', {
      value: null,
      configurable: true,
    })
    
    // Should not throw error
    expect(() => fireEvent.error(img)).not.toThrow()
  })

  it('should have correct link styles for view full size', () => {
    const testImage = 'data:image/jpeg;base64,testdata'
    render(<ResultsDisplay result={testImage} loading={false} />)
    
    const viewFullSizeLink = screen.getByText('View Full Size')
    expect(viewFullSizeLink).toHaveStyle({
      display: 'inline-block',
      padding: '8px 16px',
      backgroundColor: '#007bff',
      color: 'white',
      textDecoration: 'none',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: '500'
    })
  })

  it('should have correct styles for text result container', () => {
    const testText = 'Test text result'
    render(<ResultsDisplay result={testText} loading={false} />)
    
    const outerContainer = screen.getByText(testText).closest('div')?.parentElement
    expect(outerContainer).toHaveStyle({
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      padding: '20px',
      minHeight: '200px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'left',
      lineHeight: '1.6',
      color: '#333'
    })
  })

  it('should have correct styles for reference generated badge', () => {
    const testText = 'Test text result'
    render(<ResultsDisplay result={testText} loading={false} />)
    
    const badge = screen.getByText('Reference Generated')
    expect(badge).toHaveStyle({
      padding: '8px 16px',
      backgroundColor: '#6c757d',
      color: 'white',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: '500',
      display: 'inline-block'
    })
  })

  it('should detect data URLs correctly', () => {
    // Test with data URL
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    render(<ResultsDisplay result={dataUrl} loading={false} />)
    
    expect(screen.getByAltText('Haircut reference image')).toBeInTheDocument()
    expect(screen.queryByText('Reference Generated')).not.toBeInTheDocument()
  })

  it('should detect non-data URLs as text', () => {
    const textResult = 'http://example.com/image.jpg'
    render(<ResultsDisplay result={textResult} loading={false} />)
    
    expect(screen.queryByAltText('Haircut reference image')).not.toBeInTheDocument()
    expect(screen.getByText('Reference Generated')).toBeInTheDocument()
    expect(screen.getByText(textResult)).toBeInTheDocument()
  })

  it('should have correct container structure for loading state', () => {
    render(<ResultsDisplay result={null} loading={true} />)
    
    const container = screen.getByText('Generating reference image...').closest('div')
    expect(container).toHaveStyle({
      marginTop: '20px',
      position: 'relative',
      width: '100%',
      height: '400px',
      backgroundColor: '#f0f0f0',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column'
    })
  })
})
