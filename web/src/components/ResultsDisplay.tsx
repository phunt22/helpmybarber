'use client';
import Image from 'next/image';

interface ImageVariation {
  image: string;
  angle: string;
}

interface LoadingItem {
  angle: string;
  loading: true;
}

type DisplayItem = ImageVariation | LoadingItem;

interface ResultsDisplayProps {
  results: ImageVariation[];
  loading: boolean;
  hasFrontResult: boolean;
  hasAngles: boolean;
  anglesLoading: boolean;
  onGenerateAngles: () => void;
}

export default function ResultsDisplay({ 
  results, 
  loading, 
  hasFrontResult, 
  hasAngles, 
  anglesLoading, 
  onGenerateAngles 
}: ResultsDisplayProps) {
  if (loading) {
    return (
      <div className="card">
        <h3>Reference Images</h3>
        <div style={{
          marginTop: '1rem',
          position: 'relative',
          width: '100%',
          height: '300px',
          backgroundColor: 'var(--gray-50)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          flexDirection: 'row',
          border: '2px dashed var(--gray-300)',
          padding: '1.5rem',
          gap: '1rem'
        }}>
          <div className="loading-lg" style={{ flexShrink: 0 }}></div>
          <div>
            <h4 style={{ 
              color: 'var(--gray-600)', 
              marginBottom: '0.5rem',
              fontSize: '1rem',
              textAlign: 'left',
              margin: '0 0 0.5rem 0'
            }}>
              Creating your reference image...
            </h4>
            <p style={{ 
              color: 'var(--gray-500)', 
              fontSize: '0.875rem',
              textAlign: 'left',
              margin: '0'
            }}>
              This may take a few moments. We're analyzing your photo and generating the perfect haircut reference.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="card">
        <h3>Reference Images</h3>
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: 'var(--gray-50)',
          borderRadius: 'var(--radius-lg)',
          border: '2px dashed var(--gray-300)',
          marginTop: '1rem'
        }}>
          <h4 style={{ 
            color: 'var(--gray-600)',
            marginBottom: '0.5rem',
            textAlign: 'left'
          }}>
            Ready to Generate
          </h4>
          <p style={{ 
            color: 'var(--gray-500)', 
            fontSize: '0.875rem',
            textAlign: 'left'
          }}>
            Upload your photo and describe your desired haircut to see AI-generated reference images
          </p>
        </div>
      </div>
    );
  }

  // Create loading placeholders for angles being generated
  const loadingAngles: LoadingItem[] = anglesLoading ? ['side', 'back'].map(angle => ({ angle, loading: true as const })) : [];
  const allItems: DisplayItem[] = [...results, ...loadingAngles];

  return (
    <div className="card">
      <h3>Your Reference Images</h3>
      
      <div style={{
        marginTop: '1rem',
        display: 'grid',
        gridTemplateColumns: allItems.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '1.5rem'
      }}>
        {allItems.map((item, index) => (
          <div key={`${item.angle}-${index}`} style={{ 
            textAlign: 'center'
          }}>
            <h4 style={{ 
              margin: '0 0 0.75rem 0', 
              fontSize: '1.125rem', 
              fontWeight: '600',
              textTransform: 'capitalize',
              color: 'var(--gray-800)'
            }}>
              {item.angle} View
            </h4>
            
            {'loading' in item ? (
              <div style={{
                width: '100%',
                height: '450px',
                backgroundColor: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                border: '2px dashed var(--gray-300)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '1rem',
                marginBottom: '0.75rem'
              }}>
                <div className="loading-lg"></div>
                <p style={{ 
                  color: 'var(--gray-500)', 
                  fontSize: '0.875rem',
                  margin: '0',
                  textAlign: 'center'
                }}>
                  Generating {item.angle} view...
                </p>
              </div>
            ) : 'image' in item && item.image.startsWith('data:') ? (
              <div style={{
                position: 'relative',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                marginBottom: '0.75rem'
              }}>
                <Image
                  src={item.image}
                  alt={`${item.angle} view haircut reference`}
                  style={{
                    width: '100%',
                    maxHeight: '450px',
                    objectFit: 'contain',
                    display: 'block',
                    backgroundColor: 'white'
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div style="
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          height: 450px;
                          color: var(--error-600);
                          font-size: 0.875rem;
                          text-align: center;
                          border: 2px dashed var(--error-300);
                          border-radius: var(--radius-lg);
                          background: var(--error-50);
                          margin-bottom: 1rem;
                        ">
                          Failed to load ${item.angle} image
                        </div>
                      `;
                    }
                  }}
                />

                <div className="image-overlay">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const newWindow = window.open('', '_blank', 'width=800,height=600');
                      if (newWindow) {
                        newWindow.document.write(`
                          <html>
                            <head>
                              <style>
                                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: var(--gray-100); }
                                img { max-width: 100%; max-height: 100vh; object-fit: contain; border-radius: 8px; box-shadow: var(--shadow-lg); }
                              </style>
                            </head>
                            <body>
                              <img src="${item.image}" alt="${item.angle} view haircut reference" />
                            </body>
                          </html>
                        `);
                        newWindow.document.close();
                      }
                    }}
                    className="overlay-btn"
                    title="View full size"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h6v6"/>
                      <path d="M9 21H3v-6"/>
                      <path d="M21 3l-7 7"/>
                      <path d="M3 21l7-7"/>
                    </svg>
                  </button>
                  <a
                    href={item.image}
                    download={`haircut-${item.angle}-view.jpg`}
                    className="overlay-btn"
                    title="Download image"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                </div>
              </div>
            ) : 'image' in item && (
              <div style={{
                backgroundColor: 'var(--error-50)',
                borderRadius: 'var(--radius-lg)',
                padding: '2rem',
                minHeight: '450px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '0.875rem',
                color: 'var(--error-600)',
                border: '2px dashed var(--error-300)',
                marginBottom: '1rem'
              }}>
                <div style={{ marginBottom: '0.5rem', fontWeight: '600' }}>Error</div>
                <div>{item.image}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {hasFrontResult && !hasAngles && !anglesLoading && (
        <div style={{
          marginTop: '2rem',
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'var(--primary-50)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--primary-200)',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          <h4 style={{
            margin: '0 0 1rem 0',
            color: 'var(--gray-800)',
            fontSize: '1.125rem',
            fontWeight: '600'
          }}>
            Want More Angles?
          </h4>
          <p style={{
            margin: '0 0 1.5rem 0',
            fontSize: '0.875rem',
            color: 'var(--gray-600)',
            lineHeight: '1.6',
            maxWidth: '500px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            I think your barber would want the side and back views...
          </p>
          <button
            onClick={onGenerateAngles}
            className="btn"
            style={{
              backgroundColor: 'var(--primary-600)',
              padding: '0.875rem 2rem',
              fontSize: '0.95rem',
              fontWeight: '500'
            }}
          >
            Add Side & Back Views
          </button>
        </div>
      )}
    </div>
  );
}