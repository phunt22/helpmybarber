import '@testing-library/jest-dom'

// Mock fetch globally
global.fetch = jest.fn()

// Mock FileReader
class MockFileReader {
    onload = null
    onerror = null
    result = null

    readAsDataURL = jest.fn(function () {
        // Simulate successful read
        setTimeout(() => {
            this.result = 'data:image/jpeg;base64,mockbase64data'
            if (this.onload) {
                this.onload({ target: { result: this.result } })
            }
        }, 0)
    })

    readAsArrayBuffer = jest.fn()
}

global.FileReader = MockFileReader

// Mock URL.createObjectURL and revokeObjectURL
global.URL = {
    createObjectURL: jest.fn(() => 'mock-blob-url'),
    revokeObjectURL: jest.fn(),
}

// Mock Image constructor
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

global.Image = MockImage

// Mock HTMLCanvasElement and CanvasRenderingContext2D
class MockCanvasRenderingContext2D {
    drawImage = jest.fn()
    getImageData = jest.fn()
    putImageData = jest.fn()
}

class MockHTMLCanvasElement {
    width = 100
    height = 100

    getContext = jest.fn(() => new MockCanvasRenderingContext2D())

    toBlob = jest.fn((callback, type, quality) => {
        const blob = new Blob(['mock canvas data'], { type: type || 'image/jpeg' })
        setTimeout(() => callback(blob), 0)
    })

    toDataURL = jest.fn(() => 'data:image/jpeg;base64,mockcanvasdata')
}

// Mock document.createElement for canvas
const originalCreateElement = document.createElement
document.createElement = jest.fn((tagName) => {
    if (tagName === 'canvas') {
        return new MockHTMLCanvasElement()
    }
    return originalCreateElement.call(document, tagName)
})

// Mock window.location.reload
delete window.location
window.location = {
    reload: jest.fn(),
}

// Mock console methods to avoid noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}
