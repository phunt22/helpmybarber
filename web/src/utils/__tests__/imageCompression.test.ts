import { fileToBase64, compressImage, loadImage } from '../imageCompression'

describe('imageCompression', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('fileToBase64', () => {
    it('should convert file to base64 successfully with data URL', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      // Mock FileReader to return data URL
      const mockFileReader = {
        onload: null,
        onerror: null,
        readAsDataURL: jest.fn(function() {
          setTimeout(() => {
            this.onload({
              target: { result: 'data:image/jpeg;base64,testdata' }
            })
          }, 0)
        })
      }
      
      global.FileReader = jest.fn(() => mockFileReader) as any

      const result = await fileToBase64(mockFile)
      expect(result).toBe('testdata')
      expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile)
    })

    it('should handle data URL without base64 prefix', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const mockFileReader = {
        onload: null,
        onerror: null,
        readAsDataURL: jest.fn(function() {
          setTimeout(() => {
            this.onload({
              target: { result: 'rawdata' }
            })
          }, 0)
        })
      }
      
      global.FileReader = jest.fn(() => mockFileReader) as any

      const result = await fileToBase64(mockFile)
      expect(result).toBe('rawdata')
    })

    it('should handle FileReader errors', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const mockFileReader = {
        onload: null,
        onerror: null,
        readAsDataURL: jest.fn(function() {
          setTimeout(() => {
            this.onerror(new Error('File read error'))
          }, 0)
        })
      }
      
      global.FileReader = jest.fn(() => mockFileReader) as any

      await expect(fileToBase64(mockFile)).rejects.toThrow('Failed to read file')
    })
  })

  describe('loadImage', () => {
    it('should load image successfully', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      class MockImage {
        onload = null
        onerror = null
        src = ''
        width = 100
        height = 100
        
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload()
          }, 0)
        }
      }
      
      global.Image = MockImage as any
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url')
      
      const result = await loadImage(mockFile)
      expect(result).toBeInstanceOf(MockImage)
      expect(result.src).toBe('blob:url')
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockFile)
    })

    it('should handle image load errors', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      class MockImage {
        onload = null
        onerror = null
        src = ''
        
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror(new Error('Image load error'))
          }, 0)
        }
      }
      
      global.Image = MockImage as any
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url')

      await expect(loadImage(mockFile)).rejects.toThrow('Image load error')
    })
  })

  describe('compressImage', () => {
    let mockCanvas: any
    let mockContext: any
    let mockImage: any

    beforeEach(() => {
      mockContext = {
        drawImage: jest.fn(),
      }

      mockCanvas = {
        width: 0,
        height: 0,
        getContext: jest.fn().mockReturnValue(mockContext),
        toBlob: jest.fn(),
      }

      mockImage = {
        width: 200,
        height: 200,
        onload: null,
        onerror: null,
        src: '',
      }

      document.createElement = jest.fn().mockReturnValue(mockCanvas)
      global.Image = jest.fn(() => mockImage) as any
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url')
    })

    it('should compress image successfully', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(mockFile, 'size', { value: 1000000 }) // 1MB
      
      // Mock successful image loading
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)

      // Mock successful canvas toBlob
      mockCanvas.toBlob.mockImplementation((callback: any) => {
        const blob = new Blob(['compressed'], { type: 'image/jpeg' })
        Object.defineProperty(blob, 'size', { value: 400000 }) // 400KB
        callback(blob)
      })

      const result = await compressImage(mockFile, 500000) // 500KB target
      
      expect(result).toBeInstanceOf(File)
      expect(result.name).toBe('test.jpg')
      expect(result.type).toBe('image/jpeg')
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
      expect(mockContext.drawImage).toHaveBeenCalled()
    })

    it('should handle canvas context error', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(mockFile, 'size', { value: 1000000 })
      
      mockCanvas.getContext.mockReturnValue(null)

      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)

      await expect(compressImage(mockFile, 500000)).rejects.toThrow('could not generate canvas context')
    })

    it('should handle toBlob returning null', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(mockFile, 'size', { value: 1000000 })
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)

      mockCanvas.toBlob.mockImplementation((callback: any) => {
        callback(null)
      })

      await expect(compressImage(mockFile, 500000)).rejects.toThrow('could not generate blob from canvas')
    })

    it('should recursively compress when file is still too large', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(mockFile, 'size', { value: 1000000 })
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)

      let compressionAttempts = 0
      mockCanvas.toBlob.mockImplementation((callback: any) => {
        compressionAttempts++
        const size = compressionAttempts === 1 ? 600000 : 300000 // First attempt still too large
        const blob = new Blob(['compressed'], { type: 'image/jpeg' })
        Object.defineProperty(blob, 'size', { value: size })
        callback(blob)
      })

      const result = await compressImage(mockFile, 500000)
      
      expect(compressionAttempts).toBeGreaterThan(1)
      expect(result.size).toBeLessThanOrEqual(500000)
    })

    it('should stop compressing when quality gets too low', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(mockFile, 'size', { value: 1000000 })
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)

      // Always return a large blob to force quality reduction
      mockCanvas.toBlob.mockImplementation((callback: any) => {
        const blob = new Blob(['compressed'], { type: 'image/jpeg' })
        Object.defineProperty(blob, 'size', { value: 900000 }) // Always too large
        callback(blob)
      })

      const result = await compressImage(mockFile, 100000) // Very small target
      
      expect(result).toBeInstanceOf(File)
      // Should eventually stop even if target not reached
    })

    it('should calculate compression ratios correctly', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(mockFile, 'size', { value: 2000000 }) // 2MB
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)

      mockCanvas.toBlob.mockImplementation((callback: any) => {
        const blob = new Blob(['compressed'], { type: 'image/jpeg' })
        Object.defineProperty(blob, 'size', { value: 400000 })
        callback(blob)
      })

      const result = await compressImage(mockFile, 1000000) // 1MB target
      
      expect(mockCanvas.width).toBeGreaterThan(0)
      expect(mockCanvas.height).toBeGreaterThan(0)
    })

    it('should use default target size', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(mockFile, 'size', { value: 2000000 })
      
      setTimeout(() => {
        if (mockImage.onload) mockImage.onload()
      }, 0)

      mockCanvas.toBlob.mockImplementation((callback: any) => {
        const blob = new Blob(['compressed'], { type: 'image/jpeg' })
        Object.defineProperty(blob, 'size', { value: 500000 })
        callback(blob)
      })

      const result = await compressImage(mockFile) // No target size specified
      
      expect(result).toBeInstanceOf(File)
    })
  })
})
