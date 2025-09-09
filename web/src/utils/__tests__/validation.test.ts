import { validateFile, validatePrompt } from '../validation';

// Mock File constructor for testing
function createMockFile(name: string, type: string, size: number): File {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateFile', () => {
  // ===== HAPPY PATH TESTS =====

  test('should accept valid JPEG file', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 1024 * 1024); // 1MB
    expect(validateFile(file)).toBeNull();
  });

  test('should accept valid PNG file', () => {
    const file = createMockFile('test.png', 'image/png', 500 * 1024); // 500KB
    expect(validateFile(file)).toBeNull();
  });

  test('should accept valid WebP file', () => {
    const file = createMockFile('test.webp', 'image/webp', 2 * 1024 * 1024); // 2MB
    expect(validateFile(file)).toBeNull();
  });

  test('should accept minimum valid file size', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 1024); // 1KB
    expect(validateFile(file)).toBeNull();
  });

  test('should accept maximum valid file size', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 10 * 1024 * 1024); // 10MB
    expect(validateFile(file)).toBeNull();
  });

  // ===== EDGE CASE TESTS =====

  test('should reject invalid file type - text file', () => {
    const file = createMockFile('test.txt', 'text/plain', 1024);
    expect(validateFile(file)).toBe('Please select a JPG, PNG, or WebP image file.');
  });

  test('should reject invalid file type - PDF', () => {
    const file = createMockFile('test.pdf', 'application/pdf', 1024);
    expect(validateFile(file)).toBe('Please select a JPG, PNG, or WebP image file.');
  });

  test('should reject invalid file type - GIF', () => {
    const file = createMockFile('test.gif', 'image/gif', 1024);
    expect(validateFile(file)).toBe('Please select a JPG, PNG, or WebP image file.');
  });

  test('should reject file too large', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 15 * 1024 * 1024); // 15MB
    expect(validateFile(file)).toBe('File size too large. Please select an image under 10MB.');
  });

  test('should reject file too small', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 500); // 500 bytes
    expect(validateFile(file)).toBe('File appears to be too small or corrupted.');
  });

  test('should reject empty file', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 0);
    expect(validateFile(file)).toBe('File appears to be too small or corrupted.');
  });

  test('should handle boundary size - exactly 10MB', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 10 * 1024 * 1024);
    expect(validateFile(file)).toBeNull();
  });

  test('should handle boundary size - exactly 1KB', () => {
    const file = createMockFile('test.jpg', 'image/jpeg', 1024);
    expect(validateFile(file)).toBeNull();
  });
});

describe('validatePrompt', () => {
  // ===== HAPPY PATH TESTS =====

  test('should accept valid haircut description', () => {
    const prompt = 'Low taper fade with textured top';
    expect(validatePrompt(prompt)).toBeNull();
  });

  test('should accept complex haircut description', () => {
    const prompt = 'Classic pompadour with undercut sides, medium length on top, faded sides and back';
    expect(validatePrompt(prompt)).toBeNull();
  });

  test('should accept single word prompt', () => {
    const prompt = 'Mohawk';
    expect(validatePrompt(prompt)).toBeNull();
  });

  test('should accept prompt with numbers and special characters', () => {
    const prompt = '2-inch fade on sides with 4-inch top';
    expect(validatePrompt(prompt)).toBeNull();
  });

  test('should accept maximum length prompt', () => {
    const prompt = 'a'.repeat(500);
    expect(validatePrompt(prompt)).toBeNull();
  });

  test('should accept prompt with various styling terms', () => {
    const prompt = 'Quiff hairstyle with side part and light styling product';
    expect(validatePrompt(prompt)).toBeNull();
  });

  // ===== EDGE CASE TESTS =====

  test('should reject empty prompt', () => {
    const prompt = '';
    expect(validatePrompt(prompt)).toBe('Please enter a description for your desired haircut.');
  });

  test('should reject whitespace-only prompt', () => {
    const prompt = '   \n\t   ';
    expect(validatePrompt(prompt)).toBe('Please enter a description for your desired haircut.');
  });

  test('should reject prompt too long', () => {
    const prompt = 'a'.repeat(501);
    expect(validatePrompt(prompt)).toBe('Description is too long. Please keep it under 500 characters.');
  });

  test('should handle boundary length - exactly 500 characters', () => {
    const prompt = 'a'.repeat(500);
    expect(validatePrompt(prompt)).toBeNull();
  });

  test('should reject prompt with script tag', () => {
    const prompt = 'I want a <script> haircut';
    expect(validatePrompt(prompt)).toBe('Please use a different description for your haircut.');
  });

  test('should reject prompt with javascript', () => {
    const prompt = 'javascript injection attempt';
    expect(validatePrompt(prompt)).toBe('Please use a different description for your haircut.');
  });

  test('should reject prompt with HTML', () => {
    const prompt = 'HTML styling please';
    expect(validatePrompt(prompt)).toBe('Please use a different description for your haircut.');
  });

  test('should reject prompt with CSS', () => {
    const prompt = 'CSS changes needed';
    expect(validatePrompt(prompt)).toBe('Please use a different description for your haircut.');
  });

  test('should reject prompt with script closing tag', () => {
    const prompt = 'Some haircut </script> with styling';
    expect(validatePrompt(prompt)).toBe('Please use a different description for your haircut.');
  });

  test('should be case insensitive for blocked words', () => {
    const prompt = 'I want a JaVaScRiPt haircut';
    expect(validatePrompt(prompt)).toBe('Please use a different description for your haircut.');
  });

  test('should be case insensitive for HTML', () => {
    const prompt = 'HtMl styling needed';
    expect(validatePrompt(prompt)).toBe('Please use a different description for your haircut.');
  });

  // ===== INTEGRATION TESTS =====

  test('should handle prompt with special characters but no blocked words', () => {
    const prompt = 'I want a haircut with @ symbols and # hashtags!';
    expect(validatePrompt(prompt)).toBeNull();
  });

  test('should handle prompt with blocked word in middle of sentence', () => {
    const prompt = 'This haircut needs some javascript magic';
    expect(validatePrompt(prompt)).toBe('Please use a different description for your haircut.');
  });

  test('should handle empty prompt after trimming', () => {
    const prompt = '   ';
    expect(validatePrompt(prompt)).toBe('Please enter a description for your desired haircut.');
  });

  test('should handle very short valid prompt', () => {
    const prompt = 'Buzz';
    expect(validatePrompt(prompt)).toBeNull();
  });
});
