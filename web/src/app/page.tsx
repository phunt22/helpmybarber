'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import ResultsDisplay from '@/components/ResultsDisplay';
import { ApiService, ImageVariation } from '@/lib/api'; 
import {fileToBase64, compressImage} from '@/utils/imageCompression'

const MAX_SIZE_BYTES = 0.5 * 1024 * 1024; // .5MB

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [results, setResults] = useState<ImageVariation[]>([]);
  const [loading, setLoading] = useState(false);
  const [anglesLoading, setAnglesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');

  const handleImageUpload = (imageDataUrl: string, file: File) => {
    // TODO support heic images
    if (file.name.toLowerCase().endsWith('heic') || file.name.toLowerCase().endsWith('heif')) {
      setError("HEIC images are not supported. Please convert to jpg or png")
      return;
    }

    setUploadedImage(imageDataUrl);
    setUploadedFile(file);
    setResults([]);
    setError(null);
    setPrompt('');
  };

  const handleGenerateReference = async (promptText: string) => {
    if (!uploadedFile) return;
    setLoading(true);
    setError(null);
    setPrompt(promptText);



    let fileToProcess = uploadedFile;

    if(uploadedFile.size > MAX_SIZE_BYTES) {

      try {
        const compressedFile: File | null = await compressImage(uploadedFile, MAX_SIZE_BYTES * 0.9)

        if (!compressedFile) {
          setLoading(false)
          return;
        }

        fileToProcess = compressedFile
        setUploadedFile(fileToProcess)
      } catch(e: unknown) {
        setError(`Image compression failed!, ${e instanceof Error ? e.message : String(e)}`)
        setLoading(false)
        return;
      }       
    }



    try {
      const imageData = await fileToBase64(fileToProcess);
      const response = await ApiService.generateHaircuts({
        prompt: promptText,
        imageData,
      });

      if (response.success && response.variations.length > 0) {
        setResults(response.variations);
      } else {
        setError(response.message || 'Failed to generate reference image');
      }
    } catch (error) {
      setError('Failed to generate reference image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAngles = async () => {
    if (!uploadedFile || !prompt) return;
    setAnglesLoading(true);
    setError(null);

    try {
      const imageData = await fileToBase64(uploadedFile);
      const response = await ApiService.generateHaircuts({
        prompt,
        imageData,
        generateAngles: true,
      });

      if (response.success && response.variations.length > 0) {
        // Merge the new angle results (side & back) with existing front result
        setResults(prev => [...prev, ...response.variations]);
      } else {
        setError(response.message || 'Failed to generate angle images');
      }
    } catch (error) {
      setError('Failed to generate angle images. Please try again.');
    } finally {
      setAnglesLoading(false);
    }
  };








  // Check if we have front result and no angles yet
  const hasFrontResult = results.some(r => r.angle === 'front');
  const hasAngles = results.some(r => r.angle === 'side' || r.angle === 'back');

  return (
    <div className="container">
      <header className="text-center" style={{ marginBottom: '1.5rem' }}>
        <h1>Help My Barber</h1>
        <p style={{ 
          fontSize: '1rem', 
          color: 'var(--gray-600)', 
          maxWidth: '600px', 
          margin: '0 auto'
        }}>
         AI-generated reference images for your next haircut
        </p>
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
              <h3>Your Photo</h3>
              <div style={{ marginTop: '1rem', position: 'relative' }}>
                <div style={{
                  position: 'relative',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',

                  marginBottom: '0.75rem'
                }}>
                  <img
                    src={uploadedImage}
                    alt="Original photo"
                    style={{
                      width: '100%',
                      maxHeight: '400px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={() => {
                      document.getElementById('change-photo-input')?.click();
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem' }}
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
              <h3>Generate Reference</h3>
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
                    placeholder="Low taper fade with textured top"
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
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'var(--gray-500)',
                    marginTop: '0.5rem'
                  }}>
                    Be specific about the style, length, and any special details you want
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn"
                  style={{ width: '100%', fontSize: '1rem', padding: '0.875rem' }}
                >
                  {loading ? (
                    <>
                      <div className="loading"></div>
                      Generating...
                    </>
                  ) : (
                    'Generate Reference Image'
                  )}
                </button>
              </form>
            </div>
          </div>

          <div>
            <ResultsDisplay 
              results={results} 
              loading={loading} 
              hasFrontResult={hasFrontResult}
              hasAngles={hasAngles}
              anglesLoading={anglesLoading}
              onGenerateAngles={handleGenerateAngles}
            />
          </div>
        </div>
      )}
    </div>
  );
}