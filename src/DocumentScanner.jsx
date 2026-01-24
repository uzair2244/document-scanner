import React, { useRef, useEffect, useState } from 'react';

const DocumentScanner = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const procCanvasRef = useRef(null);
  
  const [isDocDetected, setIsDocDetected] = useState(false);
  const [points, setPoints] = useState(null);
  
  // New State for Batch Processing
  const [scannedImages, setScannedImages] = useState([]);
  
  const lastValidCorners = useRef(null);
  const cornerBuffer = useRef([]);
  const stabilityCounter = useRef(0);

  useEffect(() => {
    if (!procCanvasRef.current) procCanvasRef.current = document.createElement('canvas');
    let animationId = null;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          animationId = requestAnimationFrame(renderLoop);
        }
      } catch (e) { console.error("Camera access error:", e); }
    }

    function renderLoop() {
      if (videoRef.current?.readyState >= 2) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        ctx.drawImage(video, 0, 0);
        const raw = strictDocumentDetection(video);
        
        if (raw) {
          if (lastValidCorners.current && isClose(raw, lastValidCorners.current)) {
            stabilityCounter.current = Math.min(15, stabilityCounter.current + 1);
          } else {
            stabilityCounter.current = 0;
          }

          cornerBuffer.current.push(raw);
          if (cornerBuffer.current.length > 10) cornerBuffer.current.shift();
          const averaged = averagePoints(cornerBuffer.current);
          lastValidCorners.current = averaged;
          
          if (stabilityCounter.current > 5) {
            setIsDocDetected(true);
            setPoints(averaged);
          }
        } else {
          stabilityCounter.current = Math.max(0, stabilityCounter.current - 2);
          if (stabilityCounter.current === 0) {
            lastValidCorners.current = null;
            setIsDocDetected(false);
            setPoints(null);
          }
        }
      }
      animationId = requestAnimationFrame(renderLoop);
    }

    startCamera();
    return () => cancelAnimationFrame(animationId);
  }, []);

  // --- Logic Helpers (Kept from your original) ---
  const isClose = (c1, c2) => {
    const dist = Math.abs(c1.tl[0] - c2.tl[0]) + Math.abs(c1.tl[1] - c2.tl[1]);
    return dist < 50;
  };

  const strictDocumentDetection = (video) => {
    const scale = 0.15;
    const w = Math.floor(video.videoWidth * scale);
    const h = Math.floor(video.videoHeight * scale);
    const pCtx = procCanvasRef.current.getContext('2d');
    procCanvasRef.current.width = w; procCanvasRef.current.height = h;
    pCtx.drawImage(video, 0, 0, w, h);
    const data = pCtx.getImageData(0, 0, w, h).data;
    let tl = [w,h], tr = [0,h], bl = [w,0], br = [0,0];
    let hits = 0;
    for (let y = 10; y < h-10; y++) {
      for (let x = 10; x < w-10; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        const isWhite = r > 180 && g > 180 && b > 170 && Math.abs(r - g) < 25 && Math.abs(g - b) < 25;
        if (isWhite) {
          hits++;
          if (x + y < tl[0] + tl[1]) tl = [x, y];
          if (x - y > tr[0] - tr[1]) tr = [x, y];
          if (x - y < bl[0] - bl[1]) bl = [x, y];
          if (x + y > br[0] + br[1]) br = [x, y];
        }
      }
    }
    const width = tr[0] - tl[0]; const height = bl[1] - tl[1];
    if (hits < (w * h * 0.08) || width < w * 0.3 || height < h * 0.3) return null;
    return {
      tl: [tl[0]/scale, tl[1]/scale], tr: [tr[0]/scale, tr[1]/scale],
      bl: [bl[0]/scale, bl[1]/scale], br: [br[0]/scale, br[1]/scale]
    };
  };

  const averagePoints = (buf) => {
    const avg = { tl: [0,0], tr: [0,0], bl: [0,0], br: [0,0] };
    buf.forEach(c => {
      ['tl', 'tr', 'bl', 'br'].forEach(k => {
        avg[k][0] += c[k][0] / buf.length;
        avg[k][1] += c[k][1] / buf.length;
      });
    });
    return avg;
  };

  // --- Actions ---
  const captureBatch = () => {
    const video = videoRef.current;
    const c = lastValidCorners.current;
    if (!video || !c) return;

    const outW = 1240, outH = 1754; 
    const resCanvas = document.createElement('canvas');
    resCanvas.width = outW; resCanvas.height = outH;
    const rCtx = resCanvas.getContext('2d');
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth; tempCanvas.height = video.videoHeight;
    tempCanvas.getContext('2d').drawImage(video, 0, 0);
    const imgData = tempCanvas.getContext('2d').getImageData(0,0, tempCanvas.width, tempCanvas.height);
    const outData = rCtx.createImageData(outW, outH);
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const u = x / outW, v = y / outH;
        const px = Math.floor((1-u)*(1-v)*c.tl[0] + u*(1-v)*c.tr[0] + (1-u)*v*c.bl[0] + u*v*c.br[0]);
        const py = Math.floor((1-u)*(1-v)*c.tl[1] + u*(1-v)*c.tr[1] + (1-u)*v*c.bl[1] + u*v*c.br[1]);
        const outIdx = (y * outW + x) * 4;
        const srcIdx = (py * tempCanvas.width + px) * 4;
        outData.data[outIdx] = imgData.data[srcIdx];
        outData.data[outIdx+1] = imgData.data[srcIdx+1];
        outData.data[outIdx+2] = imgData.data[srcIdx+2];
        outData.data[outIdx+3] = 255;
      }
    }
    rCtx.putImageData(outData, 0, 0);
    const dataUrl = resCanvas.toDataURL('image/jpeg', 0.92);
    
    // Save to list instead of firing callback
    setScannedImages(prev => [...prev, dataUrl]);
  };

  const handleFinish = () => {
    if (scannedImages.length > 0) {
      onCapture(scannedImages); // Returns array of all captured images
    }
  };

  const getPolygonPoints = () => {
    if (!points || !videoRef.current) return "";
    const vW = videoRef.current.videoWidth;
    const vH = videoRef.current.videoHeight;
    const p = (pt) => `${(pt[0] / vW) * 100},${(pt[1] / vH) * 100}`;
    return `${p(points.tl)} ${p(points.tr)} ${p(points.br)} ${p(points.bl)}`;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: '#000', 
      fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden'
    }}>
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
      <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', objectFit: 'cover' }} />

      {/* Stable SVG Overlay */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
        {points && (
          <polygon points={getPolygonPoints()} fill="rgba(0, 255, 70, 0.15)" stroke="#00FF46" strokeWidth="0.5"
            style={{ transition: 'all 0.1s ease-out' }} />
        )}
      </svg>

      {/* Top Status */}
      <div style={{ position: 'absolute', top: 0, width: '100%', padding: '40px 0 20px', background: 'linear-gradient(rgba(0,0,0,0.6), transparent)', textAlign: 'center', zIndex: 20 }}>
        <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '20px', backgroundColor: isDocDetected ? '#00FF46' : 'rgba(255,255,255,0.2)', color: isDocDetected ? '#000' : '#fff', fontSize: '12px', fontWeight: 'bold' }}>
          {isDocDetected ? 'READY TO SCAN' : 'POSITION DOCUMENT'}
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '160px', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 20 }}>
        
        {/* Thumbnail Clickable to Return Images */}
        <div 
          onClick={handleFinish}
          style={{ 
            width: '64px', height: '64px', position: 'relative', cursor: scannedImages.length > 0 ? 'pointer' : 'default',
            opacity: scannedImages.length > 0 ? 1 : 0.4, transition: 'transform 0.2s'
          }}
          onMouseDown={(e) => scannedImages.length > 0 && (e.currentTarget.style.transform = 'scale(0.9)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          {scannedImages.length > 0 ? (
            <>
              <img src={scannedImages[scannedImages.length - 1]} style={{ width: '100%', height: '100%', objectFit: 'cover', border: '2px solid #fff', borderRadius: '4px' }} alt="preview" />
              {/* Batch Counter Badge */}
              <div style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#00FF46', color: '#000', width: '22px', height: '22px', borderRadius: '50%', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #000' }}>
                {scannedImages.length}
              </div>
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', border: '1px dashed #555' }} />
          )}
          <span style={{ fontSize: '10px', display: 'block', textAlign: 'center', marginTop: '4px', color: '#fff' }}>DONE</span>
        </div>

        {/* Shutter Button */}
        <button onClick={captureBatch} disabled={!isDocDetected} style={{ width: '84px', height: '84px', borderRadius: '50%', border: `4px solid ${isDocDetected ? '#00FF46' : '#555'}`, backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', backgroundColor: isDocDetected ? '#fff' : '#444' }} />
        </button>

        {/* Symmetry spacer */}
        <div style={{ width: '64px' }} />
      </div>
    </div>
  );
};

export default DocumentScanner;