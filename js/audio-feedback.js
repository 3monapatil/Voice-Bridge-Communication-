/**
 * VoiceBridge Audio Feedback Engine
 * Handles synthesized audio chimes for gesture confirmations using Web Audio API
 * and audio clip recording/playback via MediaRecorder API.
 */

class AudioFeedback {
    constructor() {
        this.audioCtx = null;
        this.enabled = true;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordedAudioUrl = null;
    }

    initAudioContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    playSuccessChime() {
        if (!this.enabled) return;
        this.initAudioContext();
        if (!this.audioCtx) return;

        try {
            const now = this.audioCtx.currentTime;
            
            // Primary Oscillator (Sine wave for sweet pleasant tone)
            const osc1 = this.audioCtx.createOscillator();
            const gain1 = this.audioCtx.createGain();
            
            // Secondary Oscillator (Harmonic layer)
            const osc2 = this.audioCtx.createOscillator();
            const gain2 = this.audioCtx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now); // D5
            osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5
            osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.28); // D6

            gain1.gain.setValueAtTime(0.001, now);
            gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1174.66, now + 0.08);
            osc2.frequency.exponentialRampToValueAtTime(1760.00, now + 0.25);

            gain2.gain.setValueAtTime(0.001, now + 0.08);
            gain2.gain.linearRampToValueAtTime(0.08, now + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

            osc1.connect(gain1);
            gain1.connect(this.audioCtx.destination);
            
            osc2.connect(gain2);
            gain2.connect(this.audioCtx.destination);

            osc1.start(now);
            osc1.stop(now + 0.36);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.39);
        } catch (err) {
            console.warn("Audio chime error:", err);
        }
    }

    playProgressBeep(progressRatio = 0.5) {
        if (!this.enabled) return;
        this.initAudioContext();
        if (!this.audioCtx) return;

        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            const baseFreq = 440;
            const targetFreq = baseFreq + (progressRatio * 440); // 440Hz -> 880Hz

            osc.type = 'sine';
            osc.frequency.setValueAtTime(targetFreq, now);

            gain.gain.setValueAtTime(0.02, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.06);
        } catch (err) {
            // Ignore minor audio context interrupts
        }
    }

    playClickSound() {
        if (!this.enabled) return;
        this.initAudioContext();
        if (!this.audioCtx) return;

        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.05);
        } catch (err) {}
    }

    playDeleteSound() {
        if (!this.enabled) return;
        this.initAudioContext();
        if (!this.audioCtx) return;

        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(450, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);

            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.1);
        } catch (err) {}
    }

    toggleMute() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// Export singleton instance
window.VoiceBridgeAudio = new AudioFeedback();
