'use client';

interface ImageVariation {
  image: string;
  angle: string;
}

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
        <h3>Reference Image</h3>
        <div style={{
          marginTop: '20px',
          position: 'relative',
          width: '100%',
          height: '400px',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e0e0e0',
              borderTop: '3px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '15px'
            }}
            className="loading-spinner"
          ></div>
          <span style={{ color: '#666', fontSize: '14px' }}>Generating reference image...</span>
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .loading-spinner {
                animation: spin 1s linear infinite;
              }
            `
          }} />
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="card">
        <h3>Reference Images</h3>
        <p style={{ padding: '40px 0', textAlign: 'center', color: '#666' }}>
          Fill out the form to generate your haircut reference image
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Haircut Reference Images</h3>
      
      <div style={{
        marginTop: '20px',
        display: 'grid',
        gridTemplateColumns: results.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px'
      }}>
        {results.map((variation, index) => (
          <div key={`${variation.angle}-${index}`} style={{ textAlign: 'center' }}>
            <h4 style={{ 
              margin: '0 0 10px 0', 
              fontSize: '16px', 
              fontWeight: '600',
              textTransform: 'capitalize',
              color: '#333'
            }}>
              {variation.angle} View
            </h4>
            
            {variation.image.startsWith('data:') ? (
              <>
                <img
                  src={variation.image}
                  alt={`${variation.angle} view haircut reference`}
                  style={{
                    width: '100%',
                    maxHeight: '300px',
                    borderRadius: '8px',
                    objectFit: 'contain',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    marginBottom: '10px'
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
                          height: 300px;
                          color: #666;
                          font-size: 14px;
                          text-align: center;
                          border: 1px solid #ddd;
                          border-radius: 8px;
                        ">
                          ❌ Failed to load ${variation.angle} image
                        </div>
                      `;
                    }
                  }}
                />
                
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  <a
                    href={variation.image}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      const newWindow = window.open('', '_blank', 'width=800,height=600');
                      if (newWindow) {
                        newWindow.document.write(`
                          <html>
                            <head>
                              <title>${variation.angle} View - Haircut Reference</title>
                              <style>
                                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8f9fa; }
                                img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                              </style>
                            </head>
                            <body>
                              <img src="${variation.image}" alt="${variation.angle} view haircut reference" />
                            </body>
                          </html>
                        `);
                        newWindow.document.close();
                      }
                    }}
                  >
                    View Full Size
                  </a>
                  <a
                    href={variation.image}
                    download={`haircut-${variation.angle}-view.jpg`}
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    Download
                  </a>
                </div>
              </>
            ) : (
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '15px',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: '12px',
                color: '#666'
              }}>
                {variation.image}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasFrontResult && !hasAngles && !anglesLoading && (
        <div style={{ marginTop: '25px', textAlign: 'center', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
            Want to see side and back angles too?
          </p>
          <button
            onClick={onGenerateAngles}
            style={{
              padding: '8px 16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            onMouseOver={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#138496';
            }}
            onMouseOut={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#17a2b8';
            }}
          >
            Add Side & Back Views
          </button>
        </div>
      )}

      {anglesLoading && (
        <div style={{
          marginTop: '25px',
          textAlign: 'center',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              border: '3px solid #e0e0e0',
              borderTop: '3px solid #17a2b8',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 10px'
            }}
            className="loading-spinner"
          ></div>
          <span style={{ color: '#666', fontSize: '14px' }}>
            Generating side and back angle images...
          </span>
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .loading-spinner {
                animation: spin 1s linear infinite;
              }
            `
          }} />
        </div>
      )}
    </div>
  );
}