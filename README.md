# @uziee/document-scanner

[![npm version](https://img.shields.io/npm/v/@uziee/document-scanner.svg)](https://www.npmjs.com/package/@uziee/document-scanner)
[![license](https://img.shields.io/npm/l/@uziee/document-scanner.svg)](https://github.com/uzair2244/document-scanner/blob/main/LICENSE)

A high-performance, lightweight React component for real-time document detection, stability filtering, and perspective-corrected scanning.

## 🔗 [Live Demo](https://document-scanner.vercel.app)

> **Try it now:** [https://document-scanner.vercel.app](https://document-scanner.vercel.app)

## 🚀 Key Features

* **Real-Time Edge Detection:** Custom pixel-analysis algorithm to identify documents without the overhead of OpenCV.
* **Anti-Jitter Stability:** Built-in "Stability Counter" that prevents false triggers from noisy backgrounds or rugs.
* **Bilinear Warp Transformation:** Automatically "flattens" skewed documents into a clean, rectangular A4-proportioned image.
* **Zero Dependencies:** Runs entirely on native Canvas API—no massive WASM files or external ML models.
* **High-Res Capture:** Analyzes a low-res stream for performance but captures the final document from the full-resolution camera feed.
* **Close Button:** Users can exit the scanner anytime without capturing.

---

## 📦 Installation

```bash
npm install @uziee/document-scanner
```

## 📖 Usage

Import the `DocumentScanner` component into your React application and provide the callback props to handle scanning events.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onCapture` | `(images: string[]) => void` | Yes | Callback fired when user finishes scanning. Receives an array of base64 image data URLs. |
| `onClose` | `() => void` | No | Callback fired when user taps the close button (X) to exit the scanner without capturing. |

### Example

```jsx
import React, { useState } from 'react';
import DocumentScanner from '@uziee/document-scanner';

function App() {
  const [showScanner, setShowScanner] = useState(false);
  const [scannedImages, setScannedImages] = useState([]);

  const handleCapture = (images) => {
    console.log(`Captured ${images.length} document(s)`);
    setScannedImages(images);
    setShowScanner(false);
  };

  const handleClose = () => {
    // User closed the scanner without capturing
    setShowScanner(false);
  };

  return (
    <div>
      <button onClick={() => setShowScanner(true)}>Scan Document</button>
      
      {showScanner && (
        <DocumentScanner 
          onCapture={handleCapture} 
          onClose={handleClose} 
        />
      )}

      {scannedImages.map((img, i) => (
        <img key={i} src={img} alt={`Scanned ${i + 1}`} />
      ))}
    </div>
  );
}

export default App;
```

The component renders a full-screen camera interface for document scanning. It detects documents in real-time, applies stability filtering, and captures high-resolution images with perspective correction.

### UI Controls

- **Close Button (X)**: Located in the top-right corner. Calls `onClose` to exit without capturing.
- **Status Indicator**: Shows "POSITION DOCUMENT" or "READY TO SCAN" based on detection state.
- **Shutter Button**: Captures the current document when detection is stable.
- **Thumbnail/Done**: Shows captured images count; tap to finish and return all images via `onCapture`.

Ensure your application has camera permissions enabled for the component to function properly.
