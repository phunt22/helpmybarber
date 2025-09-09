'use client';

import { useRef, useState } from 'react';
import { validateFile } from '@/utils/validation';

interface ImageUploadProps {
  onImageUpload: (imageDataUrl: string, file: File) => void;
}

export default function ImageUpload({ onImageUpload }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);


  const handleFileSelect = (file: File) => {
    // Validate file before processing
    const validationError = validateFile(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onImageUpload(result, file);
    };
    reader.onerror = () => {
      alert('Failed to read the selected file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  return (
    <div className="card">
      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        

        
        <h3 style={{ marginBottom: '0.75rem' }}>Upload Your Photo</h3>
        <p style={{ 
          margin: '0 0 1.5rem 0', 
          color: 'var(--gray-500)',
          fontSize: '1rem',
          lineHeight: '1.6'
        }}>
          {dragActive 
            ? 'Drop your photo here!' 
            : 'Drag and drop your photo here, or click to browse'
          }
        </p>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn"
          style={{ 
            fontSize: '1rem',
            padding: '0.875rem 1rem',
            marginBottom: '1rem'
          }}
        >
Choose Photo
        </button>
        
        <p style={{ marginTop: '15px', fontSize: '14px', color: '#999' }}>
          Supports JPG and PNG
        </p>
      </div>
    </div>
  );
}