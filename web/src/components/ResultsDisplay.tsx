'use client';

interface ResultsDisplayProps {
  result: string | null;
  loading: boolean;
}

export default function ResultsDisplay({ result, loading }: ResultsDisplayProps) {
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

  if (!result) {
    return (
      <div className="card">
        <h3>Reference Image</h3>
        <p style={{ padding: '40px 0', textAlign: 'center', color: '#666' }}>
          Fill out the form to generate your haircut reference image
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Haircut Reference Image</h3>
      <div style={{ marginTop: '20px', position: 'relative' }}>
        {/* Check if it's a data URL (image) or text */}
        {result.startsWith('data:') ? (
          <>
            <img
              src={result}
              alt="Haircut reference image"
              style={{
                width: '100%',
                maxHeight: '400px',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '15px'
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
                      height: 400px;
                      color: #666;
                      font-size: 16px;
                      text-align: center;
                    ">
                      ❌ Failed to load image<br/>
                      <small style="font-size: 12px; margin-top: 8px;">
                        Please try generating again
                      </small>
                    </div>
                  `;
                }
              }}
            />
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <a
                href={result}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
                onClick={(e) => {
                  e.preventDefault();
                  // Open in a modal-like popup for better full-size viewing
                  const newWindow = window.open('', '_blank', 'width=800,height=600');
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head>
                          <title>Haircut Reference Image</title>
                          <style>
                            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8f9fa; }
                            img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                          </style>
                        </head>
                        <body>
                          <img src="${result}" alt="Haircut reference image" />
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
                href={result}
                download="haircut-reference.jpg"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Download
              </a>
            </div>
          </>
        ) : (
          // Display text description
          <div style={{
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            padding: '20px',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'left',
            lineHeight: '1.6',
            color: '#333'
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '15px',
              borderRadius: '6px',
              border: '1px solid #e9ecef',
              fontSize: '14px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {result}
            </div>
            <div style={{
              marginTop: '15px',
              textAlign: 'center'
            }}>
              <div style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                display: 'inline-block'
              }}>
                Reference Generated
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}