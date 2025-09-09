// Frontend validation utilities for the Help My Barber app

export const validateFile = (file: File): string | null => {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return 'Please select a JPG, PNG, or WebP image file.';
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return 'File size too large. Please select an image under 10MB.';
  }

  // Check minimum file size (prevent empty files)
  if (file.size < 1000) { // 1KB
    return 'File appears to be too small or corrupted.';
  }

  return null;
};

export const validatePrompt = (prompt: string): string | null => {
  // Check if empty
  if (prompt.trim().length === 0) {
    return 'Please enter a description for your desired haircut.';
  }

  // Check length
  if (prompt.length > 500) {
    return 'Description is too long. Please keep it under 500 characters.';
  }

  // Basic content check
  const lowerPrompt = prompt.toLowerCase();
  const blockedWords = ['script', 'javascript', 'html', 'css', '<script', '</script'];

  for (const word of blockedWords) {
    if (lowerPrompt.includes(word)) {
      return 'Please use a different description for your haircut.';
    }
  }

  return null;
};
