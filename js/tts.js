/**
 * VoiceBridge Text-to-Speech (TTS) Engine
 * Leverages the browser Web Speech API for zero-latency, offline voice output.
 */

class TextToSpeechEngine {
    constructor() {
        this.synth = window.speechSynthesis || null;
        this.voices = [];
        this.selectedVoice = null;
        this.rate = 1.0;
        this.pitch = 1.0;
        this.volume = 1.0;
        this.isSpeaking = false;
        this.autoSpeak = false; // Auto-speak recognized signs
        this.onSpeakingStateChange = null;
        this.onWordBoundary = null;

        this.init();
    }

    init() {
        if (!this.synth) {
            console.warn("Web Speech API is not supported in this browser.");
            return;
        }

        // Load voices asynchronously
        this.loadVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }

        // Load saved preferences from LocalStorage
        this.loadSettings();
    }

    loadVoices() {
        if (!this.synth) return;
        this.voices = this.synth.getVoices();
        
        // Prefer natural / high quality English voices by default
        if (this.voices.length > 0 && !this.selectedVoice) {
            const savedVoiceURI = localStorage.getItem('voicebridge_voice_uri');
            if (savedVoiceURI) {
                this.selectedVoice = this.voices.find(v => v.voiceURI === savedVoiceURI);
            }
            
            if (!this.selectedVoice) {
                // Find good default
                this.selectedVoice = this.voices.find(v => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('David') || v.name.includes('Zira')) && v.lang.startsWith('en'))
                    || this.voices.find(v => v.lang.startsWith('en'))
                    || this.voices[0];
            }
        }
    }

    getVoices() {
        if (this.voices.length === 0 && this.synth) {
            this.voices = this.synth.getVoices();
        }
        return this.voices;
    }

    setVoice(voiceURI) {
        this.selectedVoice = this.voices.find(v => v.voiceURI === voiceURI) || null;
        if (this.selectedVoice) {
            localStorage.setItem('voicebridge_voice_uri', this.selectedVoice.voiceURI);
        }
    }

    setRate(val) {
        this.rate = Math.max(0.5, Math.min(2.0, parseFloat(val) || 1.0));
        localStorage.setItem('voicebridge_rate', this.rate);
    }

    setPitch(val) {
        this.pitch = Math.max(0.5, Math.min(2.0, parseFloat(val) || 1.0));
        localStorage.setItem('voicebridge_pitch', this.pitch);
    }

    setVolume(val) {
        this.volume = Math.max(0.0, Math.min(1.0, parseFloat(val) || 1.0));
        localStorage.setItem('voicebridge_volume', this.volume);
    }

    applyPreset(presetName) {
        switch (presetName) {
            case 'calm':
                this.rate = 0.85;
                this.pitch = 0.95;
                this.volume = 0.9;
                break;
            case 'clear_slow':
                this.rate = 0.70;
                this.pitch = 1.0;
                this.volume = 1.0;
                break;
            case 'urgent':
                this.rate = 1.30;
                this.pitch = 1.25;
                this.volume = 1.0;
                break;
            case 'natural':
            default:
                this.rate = 1.0;
                this.pitch = 1.0;
                this.volume = 1.0;
                break;
        }
        localStorage.setItem('voicebridge_rate', this.rate);
        localStorage.setItem('voicebridge_pitch', this.pitch);
        localStorage.setItem('voicebridge_volume', this.volume);
        return { rate: this.rate, pitch: this.pitch, volume: this.volume };
    }

    loadSettings() {
        const rate = localStorage.getItem('voicebridge_rate');
        const pitch = localStorage.getItem('voicebridge_pitch');
        const volume = localStorage.getItem('voicebridge_volume');
        const auto = localStorage.getItem('voicebridge_autospeak');

        if (rate) this.rate = parseFloat(rate);
        if (pitch) this.pitch = parseFloat(pitch);
        if (volume) this.volume = parseFloat(volume);
        if (auto) this.autoSpeak = (auto === 'true');
    }

    speak(text, onComplete = null) {
        if (!this.synth) {
            alert("Text-to-Speech is not available in your browser.");
            return;
        }

        const cleanText = (text || "").trim();
        if (!cleanText) return;

        // Cancel existing speech
        this.synth.cancel();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        }
        utterance.rate = this.rate;
        utterance.pitch = this.pitch;
        utterance.volume = this.volume;

        utterance.onstart = () => {
            this.isSpeaking = true;
            if (this.onSpeakingStateChange) this.onSpeakingStateChange(true, cleanText);
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            if (this.onSpeakingStateChange) this.onSpeakingStateChange(false, cleanText);
            if (onComplete) onComplete();
        };

        utterance.onerror = (e) => {
            console.error("Speech synthesis error:", e);
            this.isSpeaking = false;
            if (this.onSpeakingStateChange) this.onSpeakingStateChange(false, cleanText);
        };

        utterance.onboundary = (event) => {
            if (this.onWordBoundary) {
                this.onWordBoundary(event.charIndex, event.charLength);
            }
        };

        this.synth.speak(utterance);
    }

    stop() {
        if (this.synth) {
            this.synth.cancel();
            this.isSpeaking = false;
            if (this.onSpeakingStateChange) this.onSpeakingStateChange(false, "");
        }
    }
}

// Export singleton instance
window.VoiceBridgeTTS = new TextToSpeechEngine();
