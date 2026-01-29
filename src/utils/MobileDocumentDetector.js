/**
 * Smart Document Detector - Texture-Aware
 * 
 * Handles textured backgrounds (marble, granite, etc.):
 * - Paper is UNIFORMLY bright (low local variance)
 * - Textured backgrounds have scattered bright spots (high variance)
 * - Uses erosion to break up thin veins/patterns
 */

export class MobileDocumentDetector {
    constructor() {
        this.procCanvas = document.createElement("canvas");
        this.procCtx = this.procCanvas.getContext("2d", { willReadFrequently: true });

        this.smoothCorners = null;
        this.missCount = 0;
    }

    detect(video, scale = 0.18) {
        const w = Math.floor(video.videoWidth * scale);
        const h = Math.floor(video.videoHeight * scale);
        if (!w || !h) return null;

        this.procCanvas.width = w;
        this.procCanvas.height = h;
        this.procCtx.drawImage(video, 0, 0, w, h);

        const imageData = this.procCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Get brightness and analyze image
        const { brightness, saturation, avgBright, isTexturedBackground } = this.analyzeImage(data, w, h);

        // Create paper mask with texture filtering
        const mask = this.createPaperMask(data, brightness, saturation, w, h, avgBright, isTexturedBackground);

        // Apply morphological operations to clean up
        this.cleanMask(mask, w, h, isTexturedBackground);

        // Find largest blob
        const paperRegion = this.findLargestBlob(mask, w, h);
        if (!paperRegion || paperRegion.size < w * h * 0.06) {
            return this.handleMiss();
        }

        // Find corners
        const corners = this.findRegionCorners(paperRegion.pixels, w, h);
        if (!corners) return this.handleMiss();

        if (!this.validateQuad(corners, w, h)) return this.handleMiss();

        // Scale to original
        const scaled = {
            tl: [corners.tl[0] / scale, corners.tl[1] / scale],
            tr: [corners.tr[0] / scale, corners.tr[1] / scale],
            br: [corners.br[0] / scale, corners.br[1] / scale],
            bl: [corners.bl[0] / scale, corners.bl[1] / scale]
        };

        this.missCount = 0;
        return this.smooth(scaled);
    }

    analyzeImage(data, w, h) {
        const brightness = new Float32Array(w * h);
        const saturation = new Float32Array(w * h);

        let totalBright = 0;
        let brightPixelCount = 0;

        for (let i = 0, j = 0; i < data.length; i += 4, j++) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const bright = (r + g + b) / 3;
            brightness[j] = bright;
            totalBright += bright;

            if (bright > 150) brightPixelCount++;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            saturation[j] = max > 0 ? (max - min) / max : 0;
        }

        const avgBright = totalBright / (w * h);
        const brightRatio = brightPixelCount / (w * h);

        // Detect textured/light background
        // If more than 50% of image is bright, it's likely a light background
        const isTexturedBackground = brightRatio > 0.5 || avgBright > 160;

        return { brightness, saturation, avgBright, isTexturedBackground };
    }

    createPaperMask(data, brightness, saturation, w, h, avgBright, isTexturedBackground) {
        const mask = new Uint8Array(w * h);

        // For textured backgrounds, we need to check local uniformity
        // Paper is UNIFORMLY white, marble veins are scattered
        const localVariance = isTexturedBackground ? this.calcLocalVariance(brightness, w, h) : null;

        // Thresholds
        let brightThresh;
        if (isTexturedBackground) {
            // For light backgrounds, paper is the MOST uniform bright area
            brightThresh = avgBright + 15;  // Paper should be brighter than average
        } else {
            brightThresh = Math.max(120, avgBright);
        }

        const satThresh = 0.30;
        const varianceThresh = isTexturedBackground ? 400 : 9999;  // Low variance = uniform

        for (let j = 0; j < w * h; j++) {
            const bright = brightness[j];
            const sat = saturation[j];

            // Basic brightness and saturation check
            if (bright < brightThresh || sat > satThresh) continue;

            // Color neutrality
            const i = j * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const colorDiff = Math.abs(r - g) + Math.abs(g - b) + Math.abs(r - b);
            if (colorDiff > 80) continue;

            // For textured backgrounds, check uniformity
            if (isTexturedBackground && localVariance) {
                if (localVariance[j] > varianceThresh) continue;  // High variance = texture
            }

            mask[j] = 1;
        }

        return mask;
    }

    calcLocalVariance(brightness, w, h) {
        const variance = new Float32Array(w * h);
        const windowSize = 3;  // 3x3 window
        const halfW = Math.floor(windowSize / 2);

        for (let y = halfW; y < h - halfW; y++) {
            for (let x = halfW; x < w - halfW; x++) {
                let sum = 0;
                let sumSq = 0;
                let count = 0;

                for (let dy = -halfW; dy <= halfW; dy++) {
                    for (let dx = -halfW; dx <= halfW; dx++) {
                        const val = brightness[(y + dy) * w + (x + dx)];
                        sum += val;
                        sumSq += val * val;
                        count++;
                    }
                }

                const mean = sum / count;
                variance[y * w + x] = (sumSq / count) - (mean * mean);
            }
        }

        return variance;
    }

    cleanMask(mask, w, h, isTexturedBackground) {
        // For textured backgrounds, apply stronger erosion to break up patterns
        const iterations = isTexturedBackground ? 2 : 1;

        // Erosion - shrinks and breaks up thin patterns like marble veins
        for (let iter = 0; iter < iterations; iter++) {
            const temp = new Uint8Array(w * h);

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;
                    // All 4 neighbors must be set (stricter erosion)
                    if (mask[idx] && mask[idx - 1] && mask[idx + 1] &&
                        mask[idx - w] && mask[idx + w]) {
                        temp[idx] = 1;
                    }
                }
            }

            // Copy back
            for (let i = 0; i < w * h; i++) {
                mask[i] = temp[i];
            }
        }

        // Dilation - restore size of remaining regions
        for (let iter = 0; iter < iterations; iter++) {
            const temp = new Uint8Array(w * h);

            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    const idx = y * w + x;
                    if (mask[idx] || mask[idx - 1] || mask[idx + 1] ||
                        mask[idx - w] || mask[idx + w]) {
                        temp[idx] = 1;
                    }
                }
            }

            for (let i = 0; i < w * h; i++) {
                mask[i] = temp[i];
            }
        }
    }

    findLargestBlob(mask, w, h) {
        const visited = new Uint8Array(w * h);
        let largest = null;
        let largestSize = 0;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const idx = y * w + x;
                if (!mask[idx] || visited[idx]) continue;

                const pixels = new Set();
                const stack = [[x, y]];

                while (stack.length > 0) {
                    const [cx, cy] = stack.pop();
                    if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

                    const cidx = cy * w + cx;
                    if (visited[cidx] || !mask[cidx]) continue;

                    visited[cidx] = 1;
                    pixels.add(cidx);

                    stack.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
                }

                if (pixels.size > largestSize) {
                    largestSize = pixels.size;
                    largest = { pixels, size: pixels.size };
                }
            }
        }

        return largest;
    }

    findRegionCorners(pixels, w, h) {
        // First, find the centroid and bounds of the blob
        let sumX = 0, sumY = 0;
        let minX = w, maxX = 0, minY = h, maxY = 0;

        for (const idx of pixels) {
            const x = idx % w;
            const y = Math.floor(idx / w);
            sumX += x;
            sumY += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        const centroidX = sumX / pixels.size;
        const centroidY = sumY / pixels.size;

        // Find corners from their respective QUADRANTS only
        // This prevents stray pixels in wrong areas from affecting corners
        let tlBest = null, tlScore = Infinity;
        let trBest = null, trScore = -Infinity;
        let brBest = null, brScore = -Infinity;
        let blBest = null, blScore = -Infinity;

        for (const idx of pixels) {
            const x = idx % w;
            const y = Math.floor(idx / w);

            // Top-left quadrant: x < centroid, y < centroid
            if (x <= centroidX && y <= centroidY) {
                const tlS = x + y;
                if (tlS < tlScore) { tlScore = tlS; tlBest = [x, y]; }
            }

            // Top-right quadrant: x > centroid, y < centroid
            if (x >= centroidX && y <= centroidY) {
                const trS = x - y;
                if (trS > trScore) { trScore = trS; trBest = [x, y]; }
            }

            // Bottom-right quadrant: x > centroid, y > centroid
            if (x >= centroidX && y >= centroidY) {
                const brS = x + y;
                if (brS > brScore) { brScore = brS; brBest = [x, y]; }
            }

            // Bottom-left quadrant: x < centroid, y > centroid
            if (x <= centroidX && y >= centroidY) {
                const blS = y - x;
                if (blS > blScore) { blScore = blS; blBest = [x, y]; }
            }
        }

        if (!tlBest || !trBest || !brBest || !blBest) return null;

        return { tl: tlBest, tr: trBest, br: brBest, bl: blBest };
    }

    validateQuad(corners, w, h) {
        const { tl, tr, br, bl } = corners;

        for (const p of [tl, tr, br, bl]) {
            if (!p || p[0] < 0 || p[0] >= w || p[1] < 0 || p[1] >= h) {
                return false;
            }
        }

        if (tl[0] >= tr[0] - 5) return false;
        if (bl[0] >= br[0] - 5) return false;
        if (tl[1] >= bl[1] - 5) return false;
        if (tr[1] >= br[1] - 5) return false;

        const topW = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
        const botW = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
        const leftH = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
        const rightH = Math.hypot(br[0] - tr[0], br[1] - tr[1]);

        const avgW = (topW + botW) / 2;
        const avgH = (leftH + rightH) / 2;

        if (avgW < 10 || avgH < 10) return false;

        const ar = avgW / avgH;
        if (ar < 0.3 || ar > 3.5) return false;

        if (topW / botW > 2.5 || botW / topW > 2.5) return false;
        if (leftH / rightH > 2.5 || rightH / leftH > 2.5) return false;

        const area = 0.5 * Math.abs(
            (tr[0] - bl[0]) * (tl[1] - br[1]) -
            (tl[0] - br[0]) * (tr[1] - bl[1])
        );
        if (area < w * h * 0.05) return false;

        return true;
    }

    smooth(corners) {
        if (!this.smoothCorners) {
            this.smoothCorners = corners;
            return corners;
        }

        const dist = this.cornerDistance(this.smoothCorners, corners);
        if (dist > 50) {
            this.smoothCorners = corners;
            return corners;
        }

        const alpha = 0.35;
        this.smoothCorners = {
            tl: this.lerp(this.smoothCorners.tl, corners.tl, alpha),
            tr: this.lerp(this.smoothCorners.tr, corners.tr, alpha),
            br: this.lerp(this.smoothCorners.br, corners.br, alpha),
            bl: this.lerp(this.smoothCorners.bl, corners.bl, alpha)
        };

        return this.smoothCorners;
    }

    cornerDistance(c1, c2) {
        let total = 0;
        for (const k of ['tl', 'tr', 'br', 'bl']) {
            const dx = c1[k][0] - c2[k][0];
            const dy = c1[k][1] - c2[k][1];
            total += Math.sqrt(dx * dx + dy * dy);
        }
        return total / 4;
    }

    lerp(prev, curr, alpha) {
        return [
            prev[0] + alpha * (curr[0] - prev[0]),
            prev[1] + alpha * (curr[1] - prev[1])
        ];
    }

    handleMiss() {
        this.missCount++;
        if (this.missCount < 8 && this.smoothCorners) {
            return this.smoothCorners;
        }
        return null;
    }

    reset() {
        this.smoothCorners = null;
        this.missCount = 0;
    }
}

export default MobileDocumentDetector;
