/**
 * VoiceBridge Application Orchestrator
 * Connects Computer Vision, Audio Synthesizer, Web Speech Engine, AAC Board, and UI.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const videoEl = document.getElementById('webcam-video');
    const canvasEl = document.getElementById('landmark-canvas');
    const toggleCameraBtn = document.getElementById('btn-toggle-camera');
    const mirrorCameraBtn = document.getElementById('btn-mirror-camera');
    const simModeBtn = document.getElementById('btn-sim-mode');

    // Sentence Buffer Elements
    const sentenceBufferEl = document.getElementById('sentence-buffer');
    const speakBtn = document.getElementById('btn-speak');
    const stopSpeakBtn = document.getElementById('btn-stop-speak');
    const clearBtn = document.getElementById('btn-clear-buffer');
    const backspaceBtn = document.getElementById('btn-backspace');
    const copyBtn = document.getElementById('btn-copy-buffer');
    const aiSmoothBtn = document.getElementById('btn-ai-smooth');
    const autoSpeakCheckbox = document.getElementById('checkbox-auto-speak');
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');

    // Telemetry & HUD Elements
    const gestureHudBadge = document.getElementById('gesture-hud-badge');
    const gestureHudText = document.getElementById('gesture-hud-text');
    const gestureHudEmoji = document.getElementById('gesture-hud-emoji');
    const gestureHudProgress = document.getElementById('gesture-hud-progress');
    const detectionStatus = document.getElementById('detection-status');

    // AAC Board Container
    const aacContainer = document.getElementById('aac-container');

    // Modals
    const guideModal = document.getElementById('modal-guide');
    const openGuideBtn = document.getElementById('btn-open-guide');
    const closeGuideBtn = document.getElementById('btn-close-guide');
    const guideContentEl = document.getElementById('guide-modal-body');

    const voiceModal = document.getElementById('modal-voice-settings');
    const openVoiceBtn = document.getElementById('btn-open-voice-settings');
    const closeVoiceBtn = document.getElementById('btn-close-voice-settings');
    const voiceSelect = document.getElementById('voice-select');
    const rateSlider = document.getElementById('rate-slider');
    const pitchSlider = document.getElementById('pitch-slider');
    const volumeSlider = document.getElementById('volume-slider');
    const rateValBadge = document.getElementById('rate-val');
    const pitchValBadge = document.getElementById('pitch-val');
    const volumeValBadge = document.getElementById('volume-val');

    const addPhraseModal = document.getElementById('modal-add-phrase');
    const openAddPhraseBtn = document.getElementById('btn-open-add-phrase');
    const closeAddPhraseBtn = document.getElementById('btn-close-add-phrase');
    const savePhraseBtn = document.getElementById('btn-save-custom-phrase');
    const newPhraseInput = document.getElementById('input-new-phrase');
    const newPhraseIcon = document.getElementById('select-new-phrase-icon');

    // Quick Simulation Toolbar
    const simToolbar = document.getElementById('sim-toolbar');

    // --- State Initialization ---
    let sentenceBuffer = "";

    // 1. Initialize Vision Pipeline
    if (window.VoiceBridgeVision) {
        window.VoiceBridgeVision.init(videoEl, canvasEl);
    }

    // 2. Setup Gesture Recognizer Callbacks
    if (window.VoiceBridgeGestureRecognizer) {
        // On continuous progress
        window.VoiceBridgeGestureRecognizer.onProgressUpdate = (candidate, progressRatio, confidence) => {
            if (window.VoiceBridgeVision) {
                window.VoiceBridgeVision.setProgress(candidate, progressRatio);
            }

            if (candidate) {
                gestureHudBadge.classList.remove('hidden');
                gestureHudText.innerText = candidate.label || candidate.text;
                gestureHudEmoji.innerText = candidate.emoji || '✋';
                gestureHudProgress.style.width = `${Math.round(progressRatio * 100)}%`;
                detectionStatus.innerHTML = `<span class="status-dot tracking"></span> Tracking Hand (${Math.round(confidence * 100)}%)`;
            } else {
                gestureHudProgress.style.width = '0%';
                detectionStatus.innerHTML = `<span class="status-dot searching"></span> Searching for Hand...`;
            }
        };

        // On gesture confirmed
        window.VoiceBridgeGestureRecognizer.onGestureConfirmed = (gestureId, text, emoji) => {
            appendWordToBuffer(text);

            // Flash visual confirmation effect
            flashConfirmationBanner(text, emoji);

            // Auto-speak if enabled
            if (autoSpeakCheckbox && autoSpeakCheckbox.checked && window.VoiceBridgeTTS) {
                window.VoiceBridgeTTS.speak(text);
            }
        };
    }

    // 3. Sentence Buffer Operations
    function updateBufferStats() {
        const text = sentenceBuffer.trim();
        const words = text ? text.split(/\s+/).length : 0;
        const chars = sentenceBuffer.length;

        if (wordCountEl) wordCountEl.innerText = `${words} word${words === 1 ? '' : 's'}`;
        if (charCountEl) charCountEl.innerText = `${chars} char${chars === 1 ? '' : 's'}`;
    }

    function appendWordToBuffer(word) {
        if (!word) return;
        const trimmed = word.trim();
        if (!trimmed) return;

        if (sentenceBuffer.length > 0 && !sentenceBuffer.endsWith(' ')) {
            sentenceBuffer += ' ';
        }
        sentenceBuffer += trimmed;
        sentenceBufferEl.value = sentenceBuffer;
        sentenceBufferEl.scrollTop = sentenceBufferEl.scrollHeight;
        updateBufferStats();
    }

    function flashConfirmationBanner(text, emoji) {
        const banner = document.getElementById('confirmation-toast');
        if (banner) {
            banner.innerHTML = `<span class="toast-emoji">${emoji}</span> Recognized: <strong>${text}</strong>`;
            banner.classList.add('visible');
            setTimeout(() => {
                banner.classList.remove('visible');
            }, 1800);
        }
    }

    // Sentence Buffer Event Listeners
    sentenceBufferEl.addEventListener('input', (e) => {
        sentenceBuffer = e.target.value;
        updateBufferStats();
    });

    speakBtn.addEventListener('click', () => {
        const text = sentenceBuffer.trim();
        if (!text) {
            if (window.VoiceBridgeAudio) window.VoiceBridgeAudio.playClickSound();
            return;
        }

        if (window.VoiceBridgeTTS) {
            speakBtn.classList.add('speaking-active');
            window.VoiceBridgeTTS.speak(text, () => {
                speakBtn.classList.remove('speaking-active');
            });
        }
    });

    stopSpeakBtn.addEventListener('click', () => {
        if (window.VoiceBridgeTTS) {
            window.VoiceBridgeTTS.stop();
            speakBtn.classList.remove('speaking-active');
        }
    });

    clearBtn.addEventListener('click', () => {
        if (sentenceBuffer.length > 0 && window.VoiceBridgeAudio) {
            window.VoiceBridgeAudio.playDeleteSound();
        }
        sentenceBuffer = "";
        sentenceBufferEl.value = "";
        updateBufferStats();
    });

    backspaceBtn.addEventListener('click', () => {
        if (sentenceBuffer.length === 0) return;
        if (window.VoiceBridgeAudio) window.VoiceBridgeAudio.playClickSound();

        const words = sentenceBuffer.trim().split(/\s+/);
        words.pop();
        sentenceBuffer = words.join(' ');
        sentenceBufferEl.value = sentenceBuffer;
        updateBufferStats();
    });

    copyBtn.addEventListener('click', () => {
        const text = sentenceBuffer.trim();
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            const original = copyBtn.innerHTML;
            copyBtn.innerHTML = '✅ Copied!';
            setTimeout(() => { copyBtn.innerHTML = original; }, 1600);
        });
    });

    // AI Sentence Smoother
    aiSmoothBtn.addEventListener('click', async () => {
        const text = sentenceBuffer.trim();
        if (!text) return;

        aiSmoothBtn.classList.add('loading');
        aiSmoothBtn.innerText = '✨ Smoothing...';

        try {
            let smoothed = "";
            if (window.VoiceBridgeAISmoother) {
                smoothed = await window.VoiceBridgeAISmoother.smoothLocally(text);
            }
            if (smoothed) {
                sentenceBuffer = smoothed;
                sentenceBufferEl.value = sentenceBuffer;
                updateBufferStats();
                if (window.VoiceBridgeAudio) window.VoiceBridgeAudio.playSuccessChime();
            }
        } catch (e) {
            console.error(e);
        } finally {
            aiSmoothBtn.classList.remove('loading');
            aiSmoothBtn.innerText = '✨ AI Expand Sentence';
        }
    });

    // 4. Camera & Simulation Controls
    toggleCameraBtn.addEventListener('click', async () => {
        if (window.VoiceBridgeVision.isRunning) {
            window.VoiceBridgeVision.stopCamera();
            toggleCameraBtn.innerHTML = '🎥 Start Camera';
            toggleCameraBtn.classList.remove('btn-danger');
            toggleCameraBtn.classList.add('btn-primary');
            detectionStatus.innerHTML = `<span class="status-dot idle"></span> Camera Stopped`;
        } else {
            toggleCameraBtn.innerHTML = '⌛ Starting...';
            const res = await window.VoiceBridgeVision.startCamera();
            if (res.success) {
                toggleCameraBtn.innerHTML = '⏹️ Stop Camera';
                toggleCameraBtn.classList.remove('btn-primary');
                toggleCameraBtn.classList.add('btn-danger');
                detectionStatus.innerHTML = `<span class="status-dot tracking"></span> Camera Active`;
            } else {
                toggleCameraBtn.innerHTML = '🎥 Start Camera';
                alert(res.error || "Could not start camera. Try Demo Simulation Mode.");
            }
        }
    });

    mirrorCameraBtn.addEventListener('click', () => {
        if (window.VoiceBridgeVision) {
            window.VoiceBridgeVision.toggleMirror();
            mirrorCameraBtn.classList.toggle('active');
        }
    });

    simModeBtn.addEventListener('click', () => {
        if (simToolbar) {
            simToolbar.classList.toggle('hidden');
            simModeBtn.classList.toggle('active');
        }
    });

    // Simulation Quick Bar buttons
    document.querySelectorAll('.sim-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const gestureId = btn.dataset.gesture;
            if (window.VoiceBridgeVision) {
                window.VoiceBridgeVision.triggerSimulatedGesture(gestureId);
            }
        });
    });

    // 5. AAC Board Setup
    function initAAC() {
        if (window.VoiceBridgeAAC && aacContainer) {
            window.VoiceBridgeAAC.render(
                aacContainer,
                (phrase) => {
                    // Speak directly
                    if (window.VoiceBridgeTTS) {
                        window.VoiceBridgeTTS.speak(phrase);
                    }
                },
                (phrase) => {
                    // Append to sentence buffer
                    appendWordToBuffer(phrase);
                    if (window.VoiceBridgeAudio) window.VoiceBridgeAudio.playClickSound();
                }
            );
        }
    }
    initAAC();

    // 6. Voice Settings Modal & Controls
    function populateVoiceList() {
        if (!window.VoiceBridgeTTS) return;
        const voices = window.VoiceBridgeTTS.getVoices();
        if (!voiceSelect) return;

        voiceSelect.innerHTML = '';
        voices.forEach(voice => {
            const opt = document.createElement('option');
            opt.value = voice.voiceURI;
            opt.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — Default' : ''}`;
            if (window.VoiceBridgeTTS.selectedVoice && window.VoiceBridgeTTS.selectedVoice.voiceURI === voice.voiceURI) {
                opt.selected = true;
            }
            voiceSelect.appendChild(opt);
        });
    }

    // Populate voices when ready
    populateVoiceList();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoiceList;
    }

    if (openVoiceBtn && voiceModal) {
        openVoiceBtn.addEventListener('click', () => {
            populateVoiceList();
            voiceModal.classList.remove('hidden');
        });
    }

    if (closeVoiceBtn && voiceModal) {
        closeVoiceBtn.addEventListener('click', () => {
            voiceModal.classList.add('hidden');
        });
    }

    if (voiceSelect) {
        voiceSelect.addEventListener('change', () => {
            if (window.VoiceBridgeTTS) {
                window.VoiceBridgeTTS.setVoice(voiceSelect.value);
            }
        });
    }

    if (rateSlider && rateValBadge) {
        rateSlider.value = window.VoiceBridgeTTS.rate;
        rateValBadge.innerText = `${window.VoiceBridgeTTS.rate}x`;
        rateSlider.addEventListener('input', () => {
            const val = parseFloat(rateSlider.value);
            rateValBadge.innerText = `${val}x`;
            window.VoiceBridgeTTS.setRate(val);
        });
    }

    if (pitchSlider && pitchValBadge) {
        pitchSlider.value = window.VoiceBridgeTTS.pitch;
        pitchValBadge.innerText = `${window.VoiceBridgeTTS.pitch}x`;
        pitchSlider.addEventListener('input', () => {
            const val = parseFloat(pitchSlider.value);
            pitchValBadge.innerText = `${val}x`;
            window.VoiceBridgeTTS.setPitch(val);
        });
    }

    if (volumeSlider && volumeValBadge) {
        volumeSlider.value = window.VoiceBridgeTTS.volume;
        volumeValBadge.innerText = `${Math.round(window.VoiceBridgeTTS.volume * 100)}%`;
        volumeSlider.addEventListener('input', () => {
            const val = parseFloat(volumeSlider.value);
            volumeValBadge.innerText = `${Math.round(val * 100)}%`;
            window.VoiceBridgeTTS.setVolume(val);
        });
    }

    // Voice Preset Buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (window.VoiceBridgeTTS) {
                const vals = window.VoiceBridgeTTS.applyPreset(preset);
                rateSlider.value = vals.rate;
                pitchSlider.value = vals.pitch;
                volumeSlider.value = vals.volume;
                rateValBadge.innerText = `${vals.rate}x`;
                pitchValBadge.innerText = `${vals.pitch}x`;
                volumeValBadge.innerText = `${Math.round(vals.volume * 100)}%`;

                // Test speak preset tone
                window.VoiceBridgeTTS.speak("Voice preset applied.");
            }
        });
    });

    // 7. Reference Guide Modal
    if (openGuideBtn && guideModal) {
        openGuideBtn.addEventListener('click', () => {
            if (window.VoiceBridgeGuide && guideContentEl) {
                window.VoiceBridgeGuide.render(guideContentEl);
            }
            guideModal.classList.remove('hidden');
        });
    }

    if (closeGuideBtn && guideModal) {
        closeGuideBtn.addEventListener('click', () => {
            guideModal.classList.add('hidden');
        });
    }

    // 8. Add Custom Phrase Modal
    if (openAddPhraseBtn && addPhraseModal) {
        openAddPhraseBtn.addEventListener('click', () => {
            addPhraseModal.classList.remove('hidden');
        });
    }

    if (closeAddPhraseBtn && addPhraseModal) {
        closeAddPhraseBtn.addEventListener('click', () => {
            addPhraseModal.classList.add('hidden');
        });
    }

    if (savePhraseBtn && newPhraseInput) {
        savePhraseBtn.addEventListener('click', () => {
            const text = newPhraseInput.value.trim();
            const icon = newPhraseIcon ? newPhraseIcon.value : "💬";
            if (text && window.VoiceBridgeAAC) {
                window.VoiceBridgeAAC.addCustomPhrase(text, icon);
                window.VoiceBridgeAAC.currentCategory = 'custom';
                initAAC();
                newPhraseInput.value = '';
                addPhraseModal.classList.add('hidden');
                if (window.VoiceBridgeAudio) window.VoiceBridgeAudio.playSuccessChime();
            }
        });
    }

    // Close modals on clicking backdrop
    window.addEventListener('click', (e) => {
        if (e.target === guideModal) guideModal.classList.add('hidden');
        if (e.target === voiceModal) voiceModal.classList.add('hidden');
        if (e.target === addPhraseModal) addPhraseModal.classList.add('hidden');
    });

    // Automatically prompt to start camera on user gesture if desired, or let user click Start Camera
    console.log("VoiceBridge initialized successfully.");
});
