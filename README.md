# @uziee/document-scanner

A high-performance, lightweight React component for real-time document detection, stability filtering, and perspective-corrected scanning. 

## 🚀 Key Features

* **Real-Time Edge Detection:** Custom pixel-analysis algorithm to identify documents without the overhead of OpenCV.
* **Anti-Jitter Stability:** Built-in "Stability Counter" that prevents false triggers from noisy backgrounds or rugs.
* **Bilinear Warp Transformation:** Automatically "flattens" skewed documents into a clean, rectangular A4-proportioned image.
* **Zero Dependencies:** Runs entirely on native Canvas API—no massive WASM files or external ML models.
* **High-Res Capture:** Analyzes a low-res stream for performance but captures the final document from the full-resolution camera feed.

---

## 📦 Installation

```bash
npm install @uziee/document-scanner
```

## 📖 Usage

Import the `DocumentScanner` component into your React application and provide an `onCapture` callback to handle the scanned images.

```jsx
import React, { useState } from 'react';
import DocumentScanner from '@uziee/document-scanner';

function App() {
  const [showScanner, setShowScanner] = useState(false);

  const handleCapture = (images) => {
    images.forEach((image, index) => {
      console.log(`Captured image ${index + 1}:`, image);
    });
    setShowScanner(false);
  };

  return (
    <div>
      <button onClick={() => setShowScanner(true)}>Scan Document</button>
      {showScanner && <DocumentScanner onCapture={handleCapture} />}
    </div>
  );
}

export default App;
```

The component renders a full-screen camera interface for document scanning. It detects documents in real-time, applies stability filtering, and captures high-resolution images with perspective correction. Ensure your application has camera permissions enabled for the component to function properly.
