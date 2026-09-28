/**
 * VoiceBridge Camera & MediaPipe Hands Vision Pipeline
 * Streams webcam frames, tracks hand landmarks with MediaPipe Hands,
 * renders skeleton overlays, and calculates real-time FPS and confidence.
 */

class VisionPipeline {
    constructor() {
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasCtx = null;
        this.hands = null;
        this.camera = null;
        this.isRunning = false;
        this.isMirrored = true;
        this.isSimulationMode = false;

        // Telemetry
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.latestLandmarks = null;

        // Visual animation state
        this.currentProgress = 0;
        this.currentCandidate = null;
        this.glowHue = 190;
    }

    init(videoEl, canvasEl) {
        this.videoElement = videoEl;
        this.canvasElement = canvasEl;
        this.canvasCtx = canvasEl.getContext('2d');

        // Setup MediaPipe Hands
        if (typeof Hands !== 'undefined') {
            this.hands = new Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });

            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.65,
                minTrackingConfidence: 0.65
            });

            this.hands.onResults((results) => this.onResults(results));
        } else {
            console.warn("MediaPipe Hands library not yet loaded from CDN.");
        }
    }

    async startCamera() {
        if (this.isRunning) return;

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera API not supported in this browser.");
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                },
                audio: false
            });

            this.videoElement.srcObject = stream;
            await this.videoElement.play();

            this.isRunning = true;
            this.isSimulationMode = false;

            // Start MediaPipe camera loop
            if (typeof Camera !== 'undefined' && this.hands) {
                this.camera = new Camera(this.videoElement, {
                    onFrame: async () => {
                        if (this.isRunning && this.hands) {
                            await this.hands.send({ image: this.videoElement });
                        }
                    },
                    width: 640,
                    height: 480
                });
                this.camera.start();
            } else {
                // Fallback requestAnimationFrame loop if Camera utils not loaded
                this.runCustomFrameLoop();
            }

            return { success: true };
        } catch (err) {
            console.error("Camera access failed:", err);
            this.isRunning = false;
            return {
                success: false,
                error: err.name === "NotAllowedError"
                    ? "Camera permission was denied. You can enable Demo Simulation Mode."
                    : err.message
            };
        }
    }

    runCustomFrameLoop() {
        const loop = async () => {
            if (!this.isRunning) return;
            if (this.videoElement.readyState >= 2 && this.hands) {
                await this.hands.send({ image: this.videoElement });
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    stopCamera() {
        this.isRunning = false;
        if (this.camera) {
            try { this.camera.stop(); } catch (e) {}
            this.camera = null;
        }
        if (this.videoElement && this.videoElement.srcObject) {
            const tracks = this.videoElement.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.videoElement.srcObject = null;
        }
        this.clearCanvas();
    }

    toggleMirror() {
        this.isMirrored = !this.isMirrored;
        if (this.videoElement) {
            this.videoElement.style.transform = this.isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
        }
    }

    updateTelemetry() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            const fpsBadge = document.getElementById('fps-counter');
            if (fpsBadge) fpsBadge.innerText = `${this.fps} FPS`;
        }
    }

    onResults(results) {
        if (!this.isRunning && !this.isSimulationMode) return;
        this.updateTelemetry();

        // Match canvas dimensions to video
        if (this.canvasElement.width !== this.videoElement.videoWidth && this.videoElement.videoWidth > 0) {
            this.canvasElement.width = this.videoElement.videoWidth;
            this.canvasElement.height = this.videoElement.videoHeight;
        }

        this.canvasCtx.save();
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

        if (this.isMirrored) {
            this.canvasCtx.translate(this.canvasElement.width, 0);
            this.canvasCtx.scale(-1, 1);
        }

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            this.latestLandmarks = landmarks;

            // Render skeleton and keypoints
            this.drawHandSkeleton(landmarks);

            // Pass to Gesture Recognizer
            if (window.VoiceBridgeGestureRecognizer) {
                window.VoiceBridgeGestureRecognizer.processLandmarks(landmarks);
            }

            // Draw Hold-to-Confirm Ring & Label overlay
            this.drawHoldRing(landmarks);
        } else {
            this.latestLandmarks = null;
            if (window.VoiceBridgeGestureRecognizer) {
                window.VoiceBridgeGestureRecognizer.processLandmarks(null);
            }
        }

        this.canvasCtx.restore();
    }

    drawHandSkeleton(landmarks) {
        const ctx = this.canvasCtx;
        const w = this.canvasElement.width;
        const h = this.canvasElement.height;

        // MediaPipe 21 Landmark Connections
        const CONNECTIONS = [
            [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],       // Index
            [5, 9], [9, 10], [10, 11], [11, 12],  // Middle
            [9, 13], [13, 14], [14, 15], [15, 16], // Ring
            [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [0, 17]                               // Palm base
        ];

        // Draw bone lines with neon gradient
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 12;

        CONNECTIONS.forEach(([i, j]) => {
            const p1 = landmarks[i];
            const p2 = landmarks[j];
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.stroke();
        });

        // Reset shadow for joints
        ctx.shadowBlur = 0;

        // Draw joint landmarks
        landmarks.forEach((p, idx) => {
            const x = p.x * w;
            const y = p.y * h;

            ctx.beginPath();
            // Fingertips (4, 8, 12, 16, 20) are highlighted with glowing cyan/amber
            if ([4, 8, 12, 16, 20].includes(idx)) {
                ctx.arc(x, y, 7, 0, 2 * Math.PI);
                ctx.fillStyle = '#ff007f';
                ctx.shadowColor = '#ff007f';
                ctx.shadowBlur = 10;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }
        });
    }

    drawHoldRing(landmarks) {
        if (!this.currentCandidate || this.currentProgress <= 0) return;

        const ctx = this.canvasCtx;
        const w = this.canvasElement.width;
        const h = this.canvasElement.height;

        // Center on wrist (landmark 0) or palm base
        const wrist = landmarks[0];
        const cx = wrist.x * w;
        const cy = (wrist.y * h) + 30; // Slightly below wrist
        const radius = 28;

        // Background circle track
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 5;
        ctx.stroke();

        // Active progress arc
        const endAngle = (this.currentProgress * 2 * Math.PI) - (Math.PI / 2);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2, endAngle);
        ctx.strokeStyle = this.currentProgress >= 0.95 ? '#10b981' : '#00f2fe';
        ctx.shadowColor = this.currentProgress >= 0.95 ? '#10b981' : '#00f2fe';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Percentage text inside ring
        ctx.save();
        if (this.isMirrored) {
            // Un-mirror text so it renders right side up
            ctx.translate(cx, cy);
            ctx.scale(-1, 1);
            ctx.translate(-cx, -cy);
        }
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(this.currentProgress * 100)}%`, cx, cy);
        ctx.restore();
    }

    setProgress(candidate, progressRatio) {
        this.currentCandidate = candidate;
        this.currentProgress = progressRatio;
    }

    clearCanvas() {
        if (this.canvasCtx && this.canvasElement) {
            this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        }
    }

    /**
     * Simulation mode for judges testing without physical webcam
     */
    triggerSimulatedGesture(gestureId) {
        const gestures = {
            'HELLO': { id: 'HELLO', text: 'Hello', emoji: '👋' },
            'HELP': { id: 'HELP', text: 'Help', emoji: '👍' },
            'YES': { id: 'YES', text: 'Yes', emoji: '✊' },
            'NO': { id: 'NO', text: 'No', emoji: '👎' },
            'THANK_YOU': { id: 'THANK_YOU', text: 'Thank you', emoji: '🙏' },
            'WATER': { id: 'WATER', text: 'Water', emoji: '💧' },
            'FOOD': { id: 'FOOD', text: 'Food', emoji: '🍲' },
            'PAIN': { id: 'PAIN', text: 'Pain', emoji: '☝️' },
            'PEACE': { id: 'PEACE', text: 'Peace', emoji: '✌️' },
            'OK': { id: 'OK', text: 'OK', emoji: '👌' },
            'ILY': { id: 'ILY', text: 'I love you', emoji: '🤟' },
            'BATHROOM': { id: 'BATHROOM', text: 'Bathroom', emoji: '🚻' },
            'CALL_ME': { id: 'CALL_ME', text: 'Call doctor', emoji: '🤙' }
        };

        const g = gestures[gestureId];
        if (!g) return;

        // Animate simulation hold
        let step = 0;
        const totalSteps = 6;
        const interval = setInterval(() => {
            step++;
            const prog = step / totalSteps;
            this.setProgress(g, prog);
            if (window.VoiceBridgeGestureRecognizer && window.VoiceBridgeGestureRecognizer.onProgressUpdate) {
                window.VoiceBridgeGestureRecognizer.onProgressUpdate(g, prog, 0.98);
            }

            if (step >= totalSteps) {
                clearInterval(interval);
                this.setProgress(null, 0);
                if (window.VoiceBridgeGestureRecognizer && window.VoiceBridgeGestureRecognizer.onGestureConfirmed) {
                    window.VoiceBridgeGestureRecognizer.onGestureConfirmed(g.id, g.text, g.emoji);
                }
                if (window.VoiceBridgeAudio) {
                    window.VoiceBridgeAudio.playSuccessChime();
                }
            }
        }, 80);
    }
}

// Export singleton instance
window.VoiceBridgeVision = new VisionPipeline();
