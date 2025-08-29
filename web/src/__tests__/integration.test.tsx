import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '../app/page'
import { ApiService } from '../lib/api'

// Mock all external dependencies
jest.mock('../lib/api', () => ({
  ApiService: {
    generateHaircuts: jest.fn(),
  },
}))

jest.mock('../utils/imageCompression', () => ({
  fileToBase64: jest.fn().mockResolvedValue('mock-base64-data'),
  compressImage: jest.fn().mockResolvedValue(new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' })),
}))

describe('Integration Tests - Complete User Workflows', () => {
  const mockGenerateHaircuts = ApiService.generateHaircuts as jest.MockedFunction<typeof ApiService.generateHaircuts>
  const mockFileToBase64 = require('../utils/imageCompression').fileToBase64 as jest.MockedFunction<any>
  const mockCompressImage = require('../utils/imageCompression').compressImage as jest.MockedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()
    mockFileToBase64.mockResolvedValue('mock-base64-data')
    mockCompressImage.mockResolvedValue(new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' }))
    
    // Mock console methods to reduce noise
    global.console.log = jest.fn()
    global.console.error = jest.fn()
  })

  describe('Happy Path - Complete Successful Workflow', () => {
    it('should complete full user workflow successfully with small image', async () => {
      const user = userEvent.setup()
      
      // Mock successful API response
      mockGenerateHaircuts.mockResolvedValue({
        success: true,
        variations: ['data:image/jpeg;base64,generated_image_data'],
        message: undefined,
      })

      render(<Home />)

      // Step 1: Verify initial state
      expect(screen.getByText('Help My Barber')).toBeInTheDocument()
      expect(screen.getByText('Upload your photo to get a haircut reference image')).toBeInTheDocument()
      expect(screen.getByText('Upload Your Photo')).toBeInTheDocument()

      // Step 2: Upload image via drag and drop
      const file = new File(['test image content'], 'portrait.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100000 }) // 100KB - under compression limit
      
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      })

      // Wait for FileReader mock to complete
      await new Promise(resolve => setTimeout(resolve, 10))

      // Step 3: Verify upload success and UI transition
      expect(screen.getByText('Original Photo')).toBeInTheDocument()
      expect(screen.getByAltText('Original photo')).toBeInTheDocument()
      expect(screen.getByText('Generate Reference Image')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Low taper fade')).toBeInTheDocument()

      // Step 4: Enter haircut prompt
      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, 'Classic crew cut with fade')

      // Step 5: Submit form
      const submitButton = screen.getByText('Generate Reference Image')
      expect(submitButton).not.toBeDisabled()
      await user.click(submitButton)

      // Step 6: Verify loading state
      expect(screen.getByText('Generating...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()

      // Step 7: Wait for API call and verify result display
      await waitFor(() => {
        expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
        expect(screen.getByAltText('Haircut reference image')).toBeInTheDocument()
        expect(screen.getByText('View Full Size')).toBeInTheDocument()
        expect(screen.getByText('Download')).toBeInTheDocument()
        expect(screen.getByText('Generate angles')).toBeInTheDocument()
      })

      // Step 8: Verify API was called correctly (no compression needed)
      expect(mockCompressImage).not.toHaveBeenCalled()
      expect(mockFileToBase64).toHaveBeenCalledWith(file)
      expect(mockGenerateHaircuts).toHaveBeenCalledWith({
        prompt: 'Classic crew cut with fade',
        imageData: 'mock-base64-data',
      })

      // Step 9: Verify UI is back to interactive state
      expect(screen.getByText('Generate Reference Image')).toBeInTheDocument()
      expect(submitButton).not.toBeDisabled()
    })

    it('should complete full workflow with large image requiring compression', async () => {
      const user = userEvent.setup()
      
      mockGenerateHaircuts.mockResolvedValue({
        success: true,
        variations: ['data:image/jpeg;base64,compressed_result'],
        message: undefined,
      })

      render(<Home />)

      // Upload large image
      const largeFile = new File(['x'.repeat(1000000)], 'large-portrait.jpg', { type: 'image/jpeg' })
      Object.defineProperty(largeFile, 'size', { value: 1000000 }) // 1MB - over compression limit
      
      const compressedFile = new File(['compressed'], 'compressed.jpg', { type: 'image/jpeg' })
      Object.defineProperty(compressedFile, 'size', { value: 400000 })
      mockCompressImage.mockResolvedValue(compressedFile)

      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [largeFile] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, 'Modern undercut')
      
      const submitButton = screen.getByText('Generate Reference Image')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
      })

      // Verify compression workflow
      expect(mockCompressImage).toHaveBeenCalledWith(largeFile, expect.any(Number))
      expect(mockFileToBase64).toHaveBeenCalledWith(compressedFile)
      expect(mockGenerateHaircuts).toHaveBeenCalledWith({
        prompt: 'Modern undercut',
        imageData: 'mock-base64-data',
      })
    })
  })

  describe('Error Recovery Workflows', () => {
    it('should handle API failure and allow retry', async () => {
      const user = userEvent.setup()
      
      // First call fails
      mockGenerateHaircuts.mockResolvedValueOnce({
        success: false,
        variations: [],
        message: 'Server temporarily unavailable',
      })

      render(<Home />)

      // Upload and submit
      const file = new File(['test'], 'portrait.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100000 })
      
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, 'Test style')
      
      const submitButton = screen.getByText('Generate Reference Image')
      await user.click(submitButton)

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText('Server temporarily unavailable')).toBeInTheDocument()
      })

      // Verify user can retry - mock success for retry
      mockGenerateHaircuts.mockResolvedValueOnce({
        success: true,
        variations: ['data:image/jpeg;base64,retry_success'],
        message: undefined,
      })

      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
        expect(screen.queryByText('Server temporarily unavailable')).not.toBeInTheDocument()
      })
    })

    it('should handle compression failure gracefully', async () => {
      const user = userEvent.setup()
      
      const largeFile = new File(['x'.repeat(1000000)], 'large.jpg', { type: 'image/jpeg' })
      Object.defineProperty(largeFile, 'size', { value: 1000000 })
      
      mockCompressImage.mockRejectedValueOnce(new Error('Compression failed - insufficient memory'))

      render(<Home />)

      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [largeFile] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, 'Test style')
      
      const submitButton = screen.getByText('Generate Reference Image')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Image compression failed!, Compression failed - insufficient memory')).toBeInTheDocument()
      })

      // Verify API was not called due to compression failure
      expect(mockGenerateHaircuts).not.toHaveBeenCalled()
    })

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup()
      
      mockGenerateHaircuts.mockRejectedValueOnce(new Error('Network connection failed'))

      render(<Home />)

      const file = new File(['test'], 'portrait.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100000 })
      
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, 'Network test')
      
      const submitButton = screen.getByText('Generate Reference Image')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to generate reference image. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('File Type Validation Workflows', () => {
    it('should reject HEIC files and allow user to upload different format', async () => {
      render(<Home />)

      // Try to upload HEIC file
      const heicFile = new File(['heic content'], 'photo.heic', { type: 'image/heic' })
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [heicFile] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(screen.getByText('HEIC images are not supported. Please convert to jpg or png')).toBeInTheDocument()
      expect(screen.queryByText('Generate Reference Image')).not.toBeInTheDocument()

      // Upload valid file
      const validFile = new File(['jpg content'], 'photo.jpg', { type: 'image/jpeg' })
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [validFile] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      // Error should be cleared and form should appear
      expect(screen.queryByText('HEIC images are not supported. Please convert to jpg or png')).not.toBeInTheDocument()
      expect(screen.getByText('Generate Reference Image')).toBeInTheDocument()
    })

    it('should reject HEIF files (uppercase extension)', async () => {
      render(<Home />)

      const heifFile = new File(['heif content'], 'photo.HEIF', { type: 'image/heif' })
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [heifFile] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(screen.getByText('HEIC images are not supported. Please convert to jpg or png')).toBeInTheDocument()
    })
  })

  describe('State Management Workflows', () => {
    it('should maintain state correctly during image changes', async () => {
      const user = userEvent.setup()
      
      mockGenerateHaircuts.mockResolvedValue({
        success: true,
        variations: ['data:image/jpeg;base64,first_result'],
        message: undefined,
      })

      render(<Home />)

      // Upload first image and generate result
      const file1 = new File(['image1'], 'photo1.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file1, 'size', { value: 100000 })
      
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file1] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, 'First haircut')
      
      const submitButton = screen.getByText('Generate Reference Image')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
      })

      // Upload second image - should clear result and error
      const file2 = new File(['image2'], 'photo2.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file2, 'size', { value: 100000 })
      
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file2] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      // Result should be cleared, showing placeholder
      expect(screen.getByText('Fill out the form to generate your haircut reference image')).toBeInTheDocument()
      expect(screen.queryByText('Haircut Reference Image')).not.toBeInTheDocument()
    })

    it('should handle change photo functionality correctly', async () => {
      const user = userEvent.setup()
      render(<Home />)

      // Upload initial image
      const file1 = new File(['image1'], 'photo1.jpg', { type: 'image/jpeg' })
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file1] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(screen.getByText('Original Photo')).toBeInTheDocument()
      expect(screen.getByText('Change Photo')).toBeInTheDocument()

      // Click change photo button
      const changePhotoButton = screen.getByText('Change Photo')
      await user.click(changePhotoButton)

      // Upload new image via hidden input
      const file2 = new File(['image2'], 'photo2.jpg', { type: 'image/jpeg' })
      const hiddenInput = document.getElementById('change-photo-input') as HTMLInputElement
      
      fireEvent.change(hiddenInput, { target: { files: [file2] } })

      await new Promise(resolve => setTimeout(resolve, 10))

      // Should still show original photo section with new image
      expect(screen.getByText('Original Photo')).toBeInTheDocument()
      expect(screen.getByAltText('Original photo')).toBeInTheDocument()
    })
  })

  describe('User Interaction Workflows', () => {
    it('should handle Enter key submission correctly', async () => {
      const user = userEvent.setup()
      
      mockGenerateHaircuts.mockResolvedValue({
        success: true,
        variations: ['data:image/jpeg;base64,enter_key_result'],
        message: undefined,
      })

      render(<Home />)

      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100000 })
      
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, 'Enter key test')
      
      // Press Enter key instead of clicking button
      fireEvent.keyDown(promptInput, { key: 'Enter', code: 'Enter' })

      await waitFor(() => {
        expect(mockGenerateHaircuts).toHaveBeenCalledWith({
          prompt: 'Enter key test',
          imageData: 'mock-base64-data',
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
      })
    })

    it('should handle result interactions correctly', async () => {
      const user = userEvent.setup()
      
      mockGenerateHaircuts.mockResolvedValue({
        success: true,
        variations: ['data:image/jpeg;base64,interaction_test'],
        message: undefined,
      })

      // Mock window.open for view full size
      const mockWindow = {
        document: {
          write: jest.fn(),
          close: jest.fn(),
        },
      }
      global.window.open = jest.fn().mockReturnValue(mockWindow)

      // Mock window.location.reload for generate angles
      const mockReload = jest.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      })

      render(<Home />)

      // Upload and generate result
      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100000 })
      
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, 'Interaction test')
      
      const submitButton = screen.getByText('Generate Reference Image')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Haircut Reference Image')).toBeInTheDocument()
      })

      // Test View Full Size
      const viewFullSizeLink = screen.getByText('View Full Size')
      await user.click(viewFullSizeLink)
      
      expect(global.window.open).toHaveBeenCalledWith('', '_blank', 'width=800,height=600')
      expect(mockWindow.document.write).toHaveBeenCalled()
      expect(mockWindow.document.close).toHaveBeenCalled()

      // Test Download link attributes
      const downloadLink = screen.getByText('Download').closest('a')
      expect(downloadLink).toHaveAttribute('href', 'data:image/jpeg;base64,interaction_test')
      expect(downloadLink).toHaveAttribute('download', 'haircut-reference.jpg')

      // Test Generate angles
      const generateAnglesLink = screen.getByText('Generate angles')
      await user.click(generateAnglesLink)
      
      expect(mockReload).toHaveBeenCalled()
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty prompt submission', async () => {
      const user = userEvent.setup()
      
      render(<Home />)

      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100000 })
      
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      // Try to submit without entering prompt (should be prevented by HTML5 validation)
      const promptInput = screen.getByPlaceholderText('Low taper fade')
      expect(promptInput).toHaveAttribute('required')
      
      const submitButton = screen.getByText('Generate Reference Image')
      
      // HTML5 validation should prevent submission
      expect(promptInput.validity.valid).toBe(false)
    })

    it('should handle very long prompts', async () => {
      const user = userEvent.setup()
      
      mockGenerateHaircuts.mockResolvedValue({
        success: true,
        variations: ['data:image/jpeg;base64,long_prompt_result'],
        message: undefined,
      })

      render(<Home />)

      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100000 })
      
      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const veryLongPrompt = 'A'.repeat(1000) // 1000 character prompt
      const promptInput = screen.getByPlaceholderText('Low taper fade')
      await user.type(promptInput, veryLongPrompt)
      
      const submitButton = screen.getByText('Generate Reference Image')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockGenerateHaircuts).toHaveBeenCalledWith({
          prompt: veryLongPrompt,
          imageData: 'mock-base64-data',
        })
      })
    })

    it('should handle rapid successive uploads', async () => {
      render(<Home />)

      const uploadArea = screen.getByText('Upload Your Photo').closest('div')!
      
      // Upload multiple files in rapid succession
      const file1 = new File(['image1'], 'photo1.jpg', { type: 'image/jpeg' })
      const file2 = new File(['image2'], 'photo2.jpg', { type: 'image/jpeg' })
      const file3 = new File(['image3'], 'photo3.jpg', { type: 'image/jpeg' })

      fireEvent.drop(uploadArea, { dataTransfer: { files: [file1] } })
      fireEvent.drop(uploadArea, { dataTransfer: { files: [file2] } })
      fireEvent.drop(uploadArea, { dataTransfer: { files: [file3] } })

      await new Promise(resolve => setTimeout(resolve, 20))

      // Should handle the last upload
      expect(screen.getByText('Original Photo')).toBeInTheDocument()
      expect(screen.getByText('Generate Reference Image')).toBeInTheDocument()
    })
  })
})
