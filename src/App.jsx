import React, { useState } from 'react';
import DocumentScanner from './DocumentScanner';
import './index.css';

// SVG Icons as components
const ScanIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <rect x="7" y="7" width="10" height="10" rx="1" />
  </svg>
);

const DocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10,9 9,9 8,9" />
  </svg>
);

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

function App() {
  const [scannedImages, setScannedImages] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleCapture = (images) => {
    setScannedImages(images);
    setIsScanning(false);
  };

  const handleStartScanning = () => {
    setIsScanning(true);
  };

  const handleScanAgain = () => {
    setScannedImages(null);
    setIsScanning(true);
  };

  const handleDownload = (imgSrc, index) => {
    const link = document.createElement('a');
    link.href = imgSrc;
    link.download = `scanned-document-${index + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAll = () => {
    scannedImages?.forEach((img, index) => {
      setTimeout(() => handleDownload(img, index), index * 200);
    });
  };

  const handleCloseScanner = () => {
    setIsScanning(false);
  };

  // Show scanner in fullscreen mode
  if (isScanning) {
    return <DocumentScanner onCapture={handleCapture} onClose={handleCloseScanner} />;
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <a href="/" className="logo">
            <div className="logo-icon">
              <ScanIcon />
            </div>
            <span className="logo-text">DocScanner</span>
          </a>
          <span className="header-badge">✨ 100% Browser-based</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Hero Section */}
        <section className="hero-section">
          <h1 className="hero-title">
            {scannedImages ? 'Your Scanned Documents' : 'Smart Document Scanner'}
          </h1>
          <p className="hero-subtitle">
            {scannedImages
              ? `Successfully captured ${scannedImages.length} document${scannedImages.length > 1 ? 's' : ''}`
              : 'Capture, enhance, and digitize your documents with precision edge detection — all in your browser'
            }
          </p>
        </section>

        {/* Results or Empty State */}
        {scannedImages ? (
          <section className="results-section">
            <div className="results-header">
              <h2 className="results-title">
                <DocumentIcon />
                <span>Scanned Documents</span>
                <span className="results-count">{scannedImages.length}</span>
              </h2>
              <div className="results-actions">
                <button className="btn btn-secondary" onClick={handleDownloadAll}>
                  <DownloadIcon />
                  <span>Download All</span>
                </button>
                <button className="btn btn-primary" onClick={handleScanAgain}>
                  <RefreshIcon />
                  <span>Scan More</span>
                </button>
              </div>
            </div>

            <div className="results-grid">
              {scannedImages.map((imgSrc, index) => (
                <article
                  key={index}
                  className="result-card animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <span className="result-card-number">#{index + 1}</span>
                  <img
                    src={imgSrc}
                    alt={`Scanned document ${index + 1}`}
                    className="result-card-image"
                  />
                  <div className="result-card-overlay" />
                  <div className="result-card-actions">
                    <button
                      className="btn btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(imgSrc, index);
                      }}
                      title="Download"
                    >
                      <DownloadIcon />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="empty-state animate-fade-in">
            <div className="empty-state-icon">
              <DocumentIcon />
            </div>
            <h3 className="empty-state-title">No Documents Scanned Yet</h3>
            <p className="empty-state-text">
              Start scanning to capture and enhance your documents instantly
            </p>
            <button className="btn btn-primary" onClick={handleStartScanning}>
              <ScanIcon /> Start Scanning
            </button>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-links">
            <a
              href="https://github.com/uzair2244/document-scanner"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              <GitHubIcon />
              <span>View on GitHub</span>
            </a>
            <a
              href="https://www.linkedin.com/in/muhammad-uzair-shahid-rao/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link"
            >
              <LinkedInIcon />
              <span>Connect on LinkedIn</span>
            </a>
          </div>
          <p className="footer-text">
            Built with ❤️ by{' '}
            <a
              href="https://www.linkedin.com/in/muhammad-uzair-shahid-rao/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Muhammad Uzair Shahid Rao
            </a>
            {' '}• © {new Date().getFullYear()} DocScanner
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;