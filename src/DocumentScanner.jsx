import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MobileDocumentDetector } from './utils/MobileDocumentDetector';

const DocumentScanner = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const animationFrameRef = useRef(null);

  // State from Ultra-Stable implementation
  const [isDocDetected, setIsDocDetected] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [scannedImages, setScannedImages] = useState([]);
  const [facingMode, setFacingMode] = useState('environment');

  // Logic Refs
  const frameCounterRef = useRef(0);
  const prevCornersRef = useRef(null);

  // Initialize detector
  useEffect(() => {
    detectorRef.current = new MobileDocumentDetector();

    return () => {
      if (detectorRef.current && detectorRef.current.reset) {
        detectorRef.current.reset();
      }
    };
  }, []);

  // Smooth corner interpolation for zero flicker
  const interpolateCorners = useCallback((current, previous, alpha = 0.4) => {
    if (!previous) return current;
    if (!current) return previous;

    return {
      tl: [
        previous.tl[0] + (current.tl[0] - previous.tl[0]) * alpha,
        previous.tl[1] + (current.tl[1] - previous.tl[1]) * alpha
      ],
      tr: [
        previous.tr[0] + (current.tr[0] - previous.tr[0]) * alpha,
        previous.tr[1] + (current.tr[1] - previous.tr[1]) * alpha
      ],
      br: [
        previous.br[0] + (current.br[0] - previous.br[0]) * alpha,
        previous.br[1] + (current.br[1] - previous.br[1]) * alpha
      ],
      bl: [
        previous.bl[0] + (current.bl[0] - previous.bl[0]) * alpha,
        previous.bl[1] + (current.bl[1] - previous.bl[1]) * alpha
      ]
    };
  }, []);

  // Draw overlay with smooth animation
  const drawOverlay = useCallback((ctx, corners, confidence) => {
    if (!corners) return;

    // Smooth opacity based on confidence
    const opacity = Math.min(1.0, confidence);
    const primaryColor = '#00FF46'; // Success Green

    // Clear previous drawing
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw Video Frame (if not handled by video element, but here we overlay on top of video)
    // Actually, we are using canvas as the view, so we must draw the video first
    if (videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    // Semi-transparent fill
    ctx.fillStyle = `rgba(0, 255, 70, ${0.15 * opacity})`;
    ctx.beginPath();
    ctx.moveTo(...corners.tl);
    ctx.lineTo(...corners.tr);
    ctx.lineTo(...corners.br);
    ctx.lineTo(...corners.bl);
    ctx.closePath();
    ctx.fill();

    // Boundary with glow
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = confidence > 0.8 ? 20 : 10;
    ctx.shadowColor = primaryColor;
    ctx.globalAlpha = opacity;

    ctx.beginPath();
    ctx.moveTo(...corners.tl);
    ctx.lineTo(...corners.tr);
    ctx.lineTo(...corners.br);
    ctx.lineTo(...corners.bl);
    ctx.closePath();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    // Draw corner markers (only when very confident)
    if (confidence > 0.7) {
      const cornerSize = 12;
      ['tl', 'tr', 'br', 'bl'].forEach(key => {
        // Outer glow
        ctx.fillStyle = primaryColor;
        ctx.shadowBlur = 12;
        ctx.shadowColor = primaryColor;

        ctx.beginPath();
        ctx.arc(corners[key][0], corners[key][1], cornerSize, 0, 2 * Math.PI);
        ctx.fill();

        // Inner white dot
        ctx.fillStyle = 'white';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(corners[key][0], corners[key][1], cornerSize * 0.45, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }, []);

  // Main Camera & Detection Loop
  useEffect(() => {
    let mounted = true;
    let confidenceCounter = 0;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode, width: { ideal: 1920 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          animationFrameRef.current = requestAnimationFrame(renderLoop);
        }
      } catch (e) { console.error("Camera access error:", e); }
    }

    function renderLoop() {
      if (!mounted) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const ctx = canvas.getContext('2d');

      // Match canvas size to video size
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      // Process every 2nd frame for performance and stability
      frameCounterRef.current++;
      const shouldDetect = frameCounterRef.current % 2 === 0;

      if (shouldDetect && detectorRef.current) {
        try {
          const result = detectorRef.current.detect(video, 0.18); // Use 0.18 scale from original config

          if (result) {
            // Smooth interpolation
            const smoothed = interpolateCorners(result, prevCornersRef.current, 0.35); // Alpha 0.35
            prevCornersRef.current = smoothed;

            // Increase confidence
            confidenceCounter = Math.min(20, confidenceCounter + 1);

            const conf = confidenceCounter / 20;
            setDetectionConfidence(conf);
            setIsDocDetected(conf > 0.6);
          } else {
            // Decrease confidence smoothly
            confidenceCounter = Math.max(0, confidenceCounter - 2);

            if (confidenceCounter === 0) {
              prevCornersRef.current = null;
              setDetectionConfidence(0);
              setIsDocDetected(false);
            } else {
              setDetectionConfidence(confidenceCounter / 20);
            }
          }
        } catch (err) {
          console.error(err);
        }
      }

      // Draw - Loop acts as the view updater
      // If we have corners (even old ones fading out), draw them
      if (prevCornersRef.current && confidenceCounter > 0) {
        drawOverlay(ctx, prevCornersRef.current, confidenceCounter / 20);
      } else {
        // Just draw video if no detection
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    }

    startCamera();

    return () => {
      mounted = false;
      cancelAnimationFrame(animationFrameRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, interpolateCorners, drawOverlay]);

  // --- Actions ---
  const captureBatch = () => {
    if (!videoRef.current || !prevCornersRef.current || detectionConfidence < 0.6) return;

    const video = videoRef.current;
    const c = prevCornersRef.current;

    const outW = 1240, outH = 1754; // A4 approx
    const resCanvas = document.createElement('canvas');
    resCanvas.width = outW; resCanvas.height = outH;
    const rCtx = resCanvas.getContext('2d');

    // High-res capture from video
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    tempCanvas.getContext('2d').drawImage(video, 0, 0);

    const imgData = tempCanvas.getContext('2d').getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const outData = rCtx.createImageData(outW, outH);

    // Perspective Transform
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const u = x / outW, v = y / outH;
        // Bilinear interpolation for mapped coordinate
        const px = Math.floor((1 - u) * (1 - v) * c.tl[0] + u * (1 - v) * c.tr[0] + (1 - u) * v * c.bl[0] + u * v * c.br[0]);
        const py = Math.floor((1 - u) * (1 - v) * c.tl[1] + u * (1 - v) * c.tr[1] + (1 - u) * v * c.bl[1] + u * v * c.br[1]);

        const outIdx = (y * outW + x) * 4;
        const srcIdx = (py * tempCanvas.width + px) * 4;

        if (srcIdx >= 0 && srcIdx < imgData.data.length) {
          outData.data[outIdx] = imgData.data[srcIdx];
          outData.data[outIdx + 1] = imgData.data[srcIdx + 1];
          outData.data[outIdx + 2] = imgData.data[srcIdx + 2];
          outData.data[outIdx + 3] = 255;
        }
      }
    }

    rCtx.putImageData(outData, 0, 0);
    const dataUrl = resCanvas.toDataURL('image/jpeg', 0.92);

    setScannedImages(prev => [...prev, dataUrl]);
  };

  const handleFinish = () => {
    if (scannedImages.length > 0) {
      onCapture(scannedImages);
    }
  };

  const statusText = detectionConfidence > 0.8 ? 'READY TO SCAN' : (detectionConfidence > 0.4 ? 'HOLD STEADY...' : 'POSITION DOCUMENT');
  const statusColor = detectionConfidence > 0.8 ? '#00FF46' : (detectionConfidence > 0.4 ? '#FFEB3B' : 'rgba(255,255,255,0.5)');
  const statusBg = detectionConfidence > 0.8 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.5)';

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#000',
      fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden'
    }}>
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
      {/* Canvas acts as the viewfinder, drawing video + overlay */}
      <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', objectFit: 'cover' }} />

      {/* Top Status Area */}
      <div style={{ position: 'absolute', top: 0, width: '100%', padding: '40px 16px 20px', background: 'linear-gradient(rgba(0,0,0,0.6), transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
        {/* Close Button */}
        {onClose && (
          <button onClick={onClose} style={{
            position: 'absolute', right: '16px', top: '40px', width: '40px', height: '40px',
            borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff',
            backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}

        {/* Switch Camera */}
        <button onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')} style={{
          position: 'absolute', right: '64px', top: '40px', width: '40px', height: '40px',
          borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff',
          backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.025.75 3.875 2 5.25" /><path d="M4 14c0 4.418 3.582 8 8 8s8-3.582 8-8c0-2.025-.75-3.875-2-5.25" /><path d="M10 2l2 3L8 2z" /><path d="M14 22l-2-3 4 3z" /></svg>
        </button>

        {/* Status Pill */}
        <div style={{
          padding: '8px 24px', borderRadius: '30px',
          backgroundColor: statusBg, border: `1px solid ${statusColor}`,
          color: statusColor, fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px',
          boxShadow: `0 4px 20px ${detectionConfidence > 0.6 ? 'rgba(0,255,70,0.3)' : 'transparent'}`,
          transition: 'all 0.3s ease'
        }}>
          {statusText}
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '160px', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))', display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 20 }}>

        {/* Preview Thumbnail */}
        <div onClick={handleFinish} style={{
          width: '60px', height: '60px', position: 'relative', cursor: scannedImages.length > 0 ? 'pointer' : 'default',
          opacity: scannedImages.length > 0 ? 1 : 0.5, transition: 'transform 0.2s', border: '2px solid rgba(255,255,255,0.5)', borderRadius: '8px', overflow: 'hidden'
        }}>
          {scannedImages.length > 0 ? (
            <img src={scannedImages[scannedImages.length - 1]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="last scanned" />
          ) : <div style={{ width: '100%', height: '100%', background: '#333' }} />}

          {scannedImages.length > 0 && <div style={{
            position: 'absolute', top: -5, right: -5, background: '#00FF46', color: '#000',
            width: '20px', height: '20px', borderRadius: '50%', fontSize: '11px', fontWeight: '900',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #000'
          }}>{scannedImages.length}</div>}
        </div>

        {/* Capture Button */}
        <button onClick={captureBatch} disabled={detectionConfidence < 0.6} style={{
          width: '80px', height: '80px', borderRadius: '50%',
          border: `4px solid ${detectionConfidence > 0.8 ? '#00FF46' : 'rgba(255,255,255,0.3)'}`,
          backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '50%',
            backgroundColor: detectionConfidence > 0.8 ? '#fff' : 'rgba(255,255,255,0.5)',
            transform: detectionConfidence > 0.8 ? 'scale(1)' : 'scale(0.9)',
            transition: 'all 0.2s'
          }} />
        </button>

        {/* Spacer for symmetry */}
        <div style={{ width: '60px' }} />
      </div>
    </div>
  );
};

export default DocumentScanner;