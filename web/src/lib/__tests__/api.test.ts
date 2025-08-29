import { ApiService } from '../api'

// Mock fetch
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateHaircuts', () => {
    it('should successfully generate haircuts with valid response', async () => {
      const mockResponse = {
        success: true,
        variations: ['data:image/jpeg;base64,test1', 'data:image/jpeg;base64,test2'],
        message: undefined
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any)

      const result = await ApiService.generateHaircuts({
        prompt: 'Test haircut',
        imageData: 'test-image-data'
      })

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:3001/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Test haircut',
          imageData: 'test-image-data'
        }),
      })

      expect(result).toEqual(mockResponse)
    })

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any)

      const result = await ApiService.generateHaircuts({
        prompt: 'Test haircut',
        imageData: 'test-image-data'
      })

      expect(result).toEqual({
        success: false,
        variations: [],
        message: 'HTTP error! status: 500 message: Internal Server Error'
      })
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await ApiService.generateHaircuts({
        prompt: 'Test haircut',
        imageData: 'test-image-data'
      })

      expect(result).toEqual({
        success: false,
        variations: [],
        message: 'Network error'
      })
    })

    it('should handle non-Error objects in catch block', async () => {
      mockFetch.mockRejectedValueOnce('String error')

      const result = await ApiService.generateHaircuts({
        prompt: 'Test haircut',
        imageData: 'test-image-data'
      })

      expect(result).toEqual({
        success: false,
        variations: [],
        message: 'Unknown error occurred'
      })
    })

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any)

      const result = await ApiService.generateHaircuts({
        prompt: 'Test haircut',
        imageData: 'test-image-data'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Invalid JSON')
    })

    it('should handle different HTTP status codes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any)

      const result = await ApiService.generateHaircuts({
        prompt: 'Test haircut',
        imageData: 'test-image-data'
      })

      expect(result.message).toBe('HTTP error! status: 404 message: Not Found')
    })

    it('should handle empty prompt', async () => {
      const mockResponse = {
        success: true,
        variations: ['data:image/jpeg;base64,result'],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any)

      const result = await ApiService.generateHaircuts({
        prompt: '',
        imageData: 'test-image-data'
      })

      expect(result.success).toBe(true)
    })

    it('should handle empty imageData', async () => {
      const mockResponse = {
        success: true,
        variations: ['data:image/jpeg;base64,result'],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      } as any)

      const result = await ApiService.generateHaircuts({
        prompt: 'Test haircut',
        imageData: ''
      })

      expect(result.success).toBe(true)
    })
  })
})
