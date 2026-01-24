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