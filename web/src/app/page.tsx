'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import ResultsDisplay from '@/components/ResultsDisplay';
import { ApiService } from '@/lib/api'; 
import {fileToBase64, compressImage} from '@/utils/imageCompression'

const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (imageDataUrl: string, file: File) => {
    setUploadedImage(imageDataUrl);
    setUploadedFile(file);
    setResult(null);
    setError(null);
  };

    const handleGenerateReference = async (prompt: string) => {
    if (!uploadedFile) return;

    // TODO support heic images
    if (uploadedFile.name.toLowerCase().endsWith('heic') || uploadedFile.name.toLowerCase().endsWith('heif')) {
      setError("HEIC images are not supported. Please convert to jpg or png")
      return;
    }

    setLoading(true);
    setError(null);

    if(uploadedFile.size > MAX_SIZE_BYTES) {
      const compressedFile: File | null = await compressImage(uploadedFile, MAX_SIZE_BYTES * 0.9)
      if(!compressedFile) {
        setError("Failed to compress image. Please try uploading a different image")
        return;
      }
      setUploadedFile(compressedFile)
    }

    try {
      const imageData = await fileToBase64(uploadedFile);
      const response = await ApiService.generateHaircuts({
        prompt,
        imageData,
      });

      if (response.success && response.variations.length > 0) {
        setResult(response.variations[0]); // take the first (and only) result
      } else {
        setError(response.message || 'Failed to generate reference image');
      }
    } catch (error) {
      console.error('Error generating reference image:', error);
      setError('Failed to generate reference image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="text-center" style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Help My Barber</h1>
        <p>Upload your photo to get a haircut reference image</p>
      </header>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!uploadedImage ? (
        <ImageUpload onImageUpload={handleImageUpload} />
      ) : (
        <div className="grid grid-two-cols">
          <div>
            <div className="card">
              <h3>Original Photo</h3>
              <div style={{ marginTop: '20px', position: 'relative' }}>
                <img
                  src={uploadedImage}
                  alt="Original photo"
                  style={{
                    width: '100%',
                    maxHeight: '400px',
                    borderRadius: '8px',
                    objectFit: 'contain',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    marginBottom: '15px'
                  }}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={() => {
                      document.getElementById('change-photo-input')?.click();
                    }}
                    style={{
                      display: 'inline-block',
                      padding: '8px 16px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Change Photo
                  </button>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id="change-photo-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const result = event.target?.result as string;
                      handleImageUpload(result, file);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>

                        <div className="card">
              <h3>Generate Reference Image</h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const prompt = formData.get('prompt') as string;
                  handleGenerateReference(prompt);
                }}
              >
                <div className="form-group">
                  <label htmlFor="prompt" className="form-label">
                    Describe your desired haircut:
                  </label>
                  <input
                    id="prompt"
                    name="prompt"
                    type="text"
                    className="form-input"
                    placeholder="Low taper fade"
                    required
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const form = e.currentTarget.form;
                        if (form) {
                          form.requestSubmit();
                        }
                      }
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn"
                  style={{ width: '100%' }}
                >
                  {loading ? 'Generating...' : 'Generate Reference Image'}
                </button>
              </form>
            </div>
          </div>

          <div>
            <ResultsDisplay result={result} loading={loading} />
          </div>
        </div>
      )}
    </div>
  );
}