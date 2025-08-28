'use client';

import { useRef, useState } from 'react';

interface ImageUploadProps {
  onImageUpload: (imageDataUrl: string, file: File) => void;
}

export default function ImageUpload({ onImageUpload }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onImageUpload(result, file);
      };
      reader.readAsDataURL(file);
    }
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
        className="upload-area"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          borderColor: dragActive ? '#007bff' : '#ccc',
          backgroundColor: dragActive ? '#f0f8ff' : 'transparent'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
        
        <h3>Upload Your Photo</h3>
        <p style={{ margin: '20px 0', color: '#666' }}>
          Drag and drop your photo here, or click to select
        </p>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn"
        >
          Choose Photo
        </button>
        
        <p style={{ marginTop: '15px', fontSize: '14px', color: '#999' }}>
          Supports JPG, PNG, GIF up to 10MB
        </p>
      </div>
    </div>
  );
}