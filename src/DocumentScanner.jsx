import React, { useRef, useEffect, useState } from 'react';

const DocumentScanner = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const procCanvasRef = useRef(null);
  
  const [isDocDetected, setIsDocDetected] = useState(false);
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
        const ctx = canvas.getContext('2d');
        
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        ctx.drawImage(video, 0, 0);

        // 1. STRICTOR DETECTION
        const raw = strictDocumentDetection(video);
        
        // 2. STABILITY LOGIC (The "Anti-Rug" Filter)
        if (raw) {
          // Check if new corners are close to previous corners (Stability)
          if (lastValidCorners.current && isClose(raw, lastValidCorners.current)) {
            stabilityCounter.current = Math.min(15, stabilityCounter.current + 1);
          } else {
            stabilityCounter.current = 0; // Reset if it jumps (e.g., to a rug pattern)
          }

          cornerBuffer.current.push(raw);
          if (cornerBuffer.current.length > 10) cornerBuffer.current.shift();
          lastValidCorners.current = averagePoints(cornerBuffer.current);
          
          // Only show the box if it has been stable for at least 5 frames
          if (stabilityCounter.current > 5) setIsDocDetected(true);
        } else {
          stabilityCounter.current = Math.max(0, stabilityCounter.current - 2);
          if (stabilityCounter.current === 0) {
            lastValidCorners.current = null;
            setIsDocDetected(false);
          }
        }

        if (isDocDetected && lastValidCorners.current) {
          drawOverlay(ctx, lastValidCorners.current);
        }
      }
      animationId = requestAnimationFrame(renderLoop);
    }

    startCamera();
    return () => cancelAnimationFrame(animationId);
  }, [isDocDetected]);

  // Check if detection is stable or jumping wildly
  const isClose = (c1, c2) => {
    const dist = Math.abs(c1.tl[0] - c2.tl[0]) + Math.abs(c1.tl[1] - c2.tl[1]);
    return dist < 50; // Threshold for "jumping"
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
        // COLOR CONSTANCY: Ensure it's white/gray (R, G, and B are close to each other)
        const r = data[i], g = data[i+1], b = data[i+2];
        const isWhite = r > 190 && g > 190 && b > 180 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20;
        
        if (isWhite) {
          hits++;
          if (x + y < tl[0] + tl[1]) tl = [x, y];
          if (x - y > tr[0] - tr[1]) tr = [x, y];
          if (x - y < bl[0] - bl[1]) bl = [x, y];
          if (x + y > br[0] + br[1]) br = [x, y];
        }
      }
    }

    // Geometry validation
    const width = tr[0] - tl[0];
    const height = bl[1] - tl[1];
    if (hits < (w * h * 0.08) || width < w * 0.3 || height < h * 0.3) return null;

    return {
      tl: [tl[0]/scale, tl[1]/scale],
      tr: [tr[0]/scale, tr[1]/scale],
      bl: [bl[0]/scale, bl[1]/scale],
      br: [br[0]/scale, br[1]/scale]
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

  const drawOverlay = (ctx, c) => {
    ctx.strokeStyle = '#00FF44';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00FF44';
    ctx.beginPath();
    ctx.moveTo(...c.tl); ctx.lineTo(...c.tr);
    ctx.lineTo(...c.br); ctx.lineTo(...c.bl);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const capture = () => {
    const video = videoRef.current;
    const c = lastValidCorners.current;
    if (!video || !c) return;

    // Use a high-quality capture canvas
    const outW = 1240, outH = 1754; // A4 @ 150DPI
    const resCanvas = document.createElement('canvas');
    resCanvas.width = outW; resCanvas.height = outH;
    const rCtx = resCanvas.getContext('2d');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth; tempCanvas.height = video.videoHeight;
    tempCanvas.getContext('2d').drawImage(video, 0, 0);
    const imgData = tempCanvas.getContext('2d').getImageData(0,0, tempCanvas.width, tempCanvas.height);
    const outData = rCtx.createImageData(outW, outH);

    // Bilinear Warp
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
    onCapture(resCanvas.toDataURL('image/jpeg', 0.92));
  };

  return (
    <div style={{ textAlign: 'center', background: '#111', minHeight: '100vh', padding: '20px' }}>
      <div style={{ position: 'relative', borderRadius: '30px', overflow: 'hidden', border: '5px solid #333', display: 'inline-block' }}>
        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: '500px', display: 'block' }} />
        
        {isDocDetected && (
          <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#00FF44', color: '#000', padding: '8px 20px', borderRadius: '20px', fontWeight: 'bold' }}>
            READY TO SCAN
          </div>
        )}
      </div>

      <button onClick={capture} disabled={!isDocDetected} style={{
        display: 'block', margin: '20px auto', padding: '20px 50px', borderRadius: '50px', border: 'none',
        backgroundColor: isDocDetected ? '#00FF44' : '#444',
        color: isDocDetected ? '#000' : '#888', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer'
      }}>
        CROP & SAVE DOCUMENT
      </button>
    </div>
  );
};

export default DocumentScanner;