import React, { useState } from 'react';
import DocumentScanner from './DocumentScanner';

function App() {
  const [scannedImage, setScannedImage] = useState(null);

  return (
    <div style={{ textAlign: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>JS Doc Scanner</h1>
      {!scannedImage ? (
        <DocumentScanner onCapture={(img) => setScannedImage(img)} />
      ) : (
        <div>
          <h3>Scanned Result:</h3>
          <img src={scannedImage} style={{ width: '100%', maxWidth: '400px', border: '2px solid #ccc' }} />
          <br />
          <button onClick={() => setScannedImage(null)}>Scan Again</button>
        </div>
      )}
    </div>
  );
}

export default App;