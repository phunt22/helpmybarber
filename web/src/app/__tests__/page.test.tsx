import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../page'
import { ApiService } from '@/lib/api'

// Mock the API service
jest.mock('@/lib/api', () => ({
  ApiService: {
    generateHaircuts: jest.fn(),
  },
}))

// Mock image compression utilities
jest.mock('@/utils/imageCompression', () => ({
  fileToBase64: jest.fn(),
  compressImage: jest.fn(),
}))

describe('Home', () => {
  const mockGenerateHaircuts = ApiService.generateHaircuts as jest.MockedFunction<typeof ApiService.generateHaircuts>
  const mockFileToBase64 = require('@/utils/imageCompression').fileToBase64 as jest.MockedFunction<any>
  const mockCompressImage = require('@/utils/imageCompression').compressImage as jest.MockedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()
    mockFileToBase64.mockResolvedValue('base64data')
    mockCompressImage.mockResolvedValue(new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' }))
    
    // Mock console methods
    global.console.log = jest.fn()
    global.console.error = jest.fn()
  })

  it('should render initial state', () => {
    render(<Home />)
    
    expect(screen.getByText('Help My Barber')).toBeInTheDocument()
    expect(screen.getByText('Upload your photo to get a haircut reference image')).toBeInTheDocument()
    expect(screen.getByText('Upload Your Photo')).toBeInTheDocument()
  })

  it('should handle image upload successfully', async () => {
    render(<Home />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    // Wait for FileReader mock
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(screen.getByText('Original Photo')).toBeInTheDocument()
    expect(screen.getByText('Generate Reference Image')).toBeInTheDocument()
    expect(screen.getByAltText('Original photo')).toBeInTheDocument()
  })

  it('should reject HEIC files', async () => {
    render(<Home />)
    
    const file = new File(['test'], 'test.heic', { type: 'image/heic' })
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(screen.getByText('HEIC images are not supported. Please convert to jpg or png')).toBeInTheDocument()
    expect(screen.queryByText('Generate Reference Image')).not.toBeInTheDocument()
  })

  it('should reject HEIF files', async () => {
    render(<Home />)
    
    const file = new File(['test'], 'test.HEIF', { type: 'image/heif' })
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(screen.getByText('HEIC images are not supported. Please convert to jpg or png')).toBeInTheDocument()
  })

  it('should handle form submission successfully without compression', async () => {
    const user = userEvent.setup()
    
    mockGenerateHaircuts.mockResolvedValue({
      success: true,
      variations: ['data:image/jpeg;base64,result'],
      message: undefined,
    })

    render(<Home />)
    
    // Upload small image first
    const smallFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(smallFile, 'size', { value: 100000 }) // 100KB - under limit
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [smallFile] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Fill form and submit
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockFileToBase64).toHaveBeenCalledWith(smallFile)
      expect(mockGenerateHaircuts).toHaveBeenCalledWith({
        prompt: 'Test haircut',
        imageData: 'base64data',
      })
    })
    
    expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
    expect(mockCompressImage).not.toHaveBeenCalled()
  })

  it('should handle form submission with compression for large files', async () => {
    const user = userEvent.setup()
    
    const largeFile = new File(['x'.repeat(1000000)], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { value: 1000000 }) // 1MB - over 0.5MB limit
    
    const compressedFile = new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' })
    Object.defineProperty(compressedFile, 'size', { value: 400000 })
    mockCompressImage.mockResolvedValue(compressedFile)
    
    mockGenerateHaircuts.mockResolvedValue({
      success: true,
      variations: ['data:image/jpeg;base64,result'],
      message: undefined,
    })

    render(<Home />)
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [largeFile] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockCompressImage).toHaveBeenCalledWith(largeFile, expect.any(Number))
      expect(mockFileToBase64).toHaveBeenCalledWith(compressedFile)
      expect(mockGenerateHaircuts).toHaveBeenCalledWith({
        prompt: 'Test haircut',
        imageData: 'base64data',
      })
    })
  })

  it('should handle compression returning null', async () => {
    const user = userEvent.setup()
    
    const largeFile = new File(['x'.repeat(1000000)], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { value: 1000000 })
    
    mockCompressImage.mockResolvedValue(null)

    render(<Home />)
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [largeFile] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockCompressImage).toHaveBeenCalled()
    })
    
    // Should not proceed to API call
    expect(mockGenerateHaircuts).not.toHaveBeenCalled()
  })

  it('should handle API success with empty variations', async () => {
    const user = userEvent.setup()
    
    mockGenerateHaircuts.mockResolvedValue({
      success: true,
      variations: [],
      message: undefined,
    })

    render(<Home />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 100000 })
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to generate reference image')).toBeInTheDocument()
    })
  })

  it('should handle API failure with message', async () => {
    const user = userEvent.setup()
    
    mockGenerateHaircuts.mockResolvedValue({
      success: false,
      variations: [],
      message: 'API Error Message',
    })

    render(<Home />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 100000 })
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('API Error Message')).toBeInTheDocument()
    })
  })

  it('should handle API failure without message', async () => {
    const user = userEvent.setup()
    
    mockGenerateHaircuts.mockResolvedValue({
      success: false,
      variations: [],
      message: undefined,
    })

    render(<Home />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 100000 })
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to generate reference image')).toBeInTheDocument()
    })
  })

  it('should handle compression errors', async () => {
    const user = userEvent.setup()
    
    const largeFile = new File(['x'.repeat(1000000)], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { value: 1000000 })
    
    mockCompressImage.mockRejectedValue(new Error('Compression failed'))

    render(<Home />)
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [largeFile] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Image compression failed!, Compression failed')).toBeInTheDocument()
    })
  })

  it('should handle compression errors with non-Error objects', async () => {
    const user = userEvent.setup()
    
    const largeFile = new File(['x'.repeat(1000000)], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { value: 1000000 })
    
    mockCompressImage.mockRejectedValue('String error')

    render(<Home />)
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [largeFile] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Image compression failed!, String error')).toBeInTheDocument()
    })
  })

  it('should handle API throwing errors', async () => {
    const user = userEvent.setup()
    
    mockGenerateHaircuts.mockRejectedValue(new Error('Network error'))

    render(<Home />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 100000 })
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Failed to generate reference image. Please try again.')).toBeInTheDocument()
    })
  })

  it('should handle change photo functionality', async () => {
    const user = userEvent.setup()
    render(<Home />)
    
    // Upload initial image
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file1] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Click change photo
    const changePhotoButton = screen.getByText('Change Photo')
    await user.click(changePhotoButton)
    
    // Upload new image via hidden input
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    const hiddenInput = document.getElementById('change-photo-input') as HTMLInputElement
    
    fireEvent.change(hiddenInput, { target: { files: [file2] } })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(screen.getByText('Original Photo')).toBeInTheDocument()
  })

  it('should handle change photo with no file selected', async () => {
    const user = userEvent.setup()
    render(<Home />)
    
    // Upload initial image
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file1] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Click change photo
    const changePhotoButton = screen.getByText('Change Photo')
    await user.click(changePhotoButton)
    
    // Simulate no file selected
    const hiddenInput = document.getElementById('change-photo-input') as HTMLInputElement
    fireEvent.change(hiddenInput, { target: { files: null } })
    
    // Should not crash or change anything
    expect(screen.getByText('Original Photo')).toBeInTheDocument()
  })

  it('should handle Enter key submission', async () => {
    const user = userEvent.setup()
    
    mockGenerateHaircuts.mockResolvedValue({
      success: true,
      variations: ['data:image/jpeg;base64,result'],
      message: undefined,
    })

    render(<Home />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 100000 })
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    await user.type(promptInput, 'Test haircut')
    
    // Simulate Enter key press
    fireEvent.keyDown(promptInput, { key: 'Enter', code: 'Enter' })
    
    await waitFor(() => {
      expect(mockGenerateHaircuts).toHaveBeenCalledWith({
        prompt: 'Test haircut',
        imageData: 'base64data',
      })
    })
  })

  it('should handle Enter key when form is null', async () => {
    const user = userEvent.setup()
    
    render(<Home />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    
    // Mock form to be null
    Object.defineProperty(promptInput, 'form', {
      value: null,
      configurable: true,
    })
    
    // Should not crash
    fireEvent.keyDown(promptInput, { key: 'Enter', code: 'Enter' })
    
    expect(mockGenerateHaircuts).not.toHaveBeenCalled()
  })

  it('should handle form submission without uploaded file', async () => {
    const user = userEvent.setup()
    
    render(<Home />)
    
    // Try to submit without uploading file - this scenario shouldn't be possible
    // since the form only appears after upload, but test defensive programming
    
    // We can't test this directly since the form only appears after upload
    // This is good defensive design - the form is only shown when there's a file
    expect(screen.queryByText('Generate Reference Image')).not.toBeInTheDocument()
  })

  it('should show loading state during generation', async () => {
    const user = userEvent.setup()
    
    // Create a promise that we can control
    let resolvePromise: (value: any) => void
    const controlledPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    
    mockGenerateHaircuts.mockReturnValue(controlledPromise)

    render(<Home />)
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 100000 })
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    // Should show loading state
    expect(screen.getByText('Generating...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
    
    // Resolve the promise
    resolvePromise!({
      success: true,
      variations: ['data:image/jpeg;base64,result'],
    })
    
    await waitFor(() => {
      expect(screen.getByText('Generate Reference Image')).toBeInTheDocument()
      expect(submitButton).not.toBeDisabled()
    })
  })

  it('should clear error when uploading new image', async () => {
    render(<Home />)
    
    // First upload a HEIC file to trigger error
    const heicFile = new File(['test'], 'test.heic', { type: 'image/heic' })
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [heicFile] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    expect(screen.getByText('HEIC images are not supported. Please convert to jpg or png')).toBeInTheDocument()
    
    // Now upload a valid file
    const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [validFile] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Error should be cleared
    expect(screen.queryByText('HEIC images are not supported. Please convert to jpg or png')).not.toBeInTheDocument()
    expect(screen.getByText('Generate Reference Image')).toBeInTheDocument()
  })

  it('should clear result when uploading new image', async () => {
    const user = userEvent.setup()
    
    mockGenerateHaircuts.mockResolvedValue({
      success: true,
      variations: ['data:image/jpeg;base64,result'],
    })

    render(<Home />)
    
    // Upload and generate result
    const file1 = new File(['test1'], 'test1.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file1, 'size', { value: 100000 })
    
    const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file1] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    const promptInput = screen.getByPlaceholderText('Low taper fade')
    const submitButton = screen.getByText('Generate Reference Image')
    
    await user.type(promptInput, 'Test haircut')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
    })
    
    // Upload new image
    const file2 = new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
    fireEvent.drop(uploadArea, {
      dataTransfer: { files: [file2] },
    })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Result should be cleared, showing placeholder
    expect(screen.getByText('Fill out the form to generate your haircut reference image')).toBeInTheDocument()
  })
})
