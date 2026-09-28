/**
 * VoiceBridge Gesture Recognizer Engine
 * High-accuracy geometric landmark classifier for American Sign Language (ASL)
 * and essential AAC communication gestures with Hold-to-Confirm temporal stabilization.
 */

class GestureRecognizer {
    constructor() {
        this.holdDurationMs = 700; // Hold time required to lock in a gesture
        this.cooldownMs = 1200; // Cooldown before same gesture can be triggered again

        this.currentCandidate = null;
        this.candidateStartTime = 0;
        this.lastTriggeredGesture = null;
        this.lastTriggeredTime = 0;
        this.isLocked = false;

        // Callback hooks
        this.onGestureConfirmed = null; // (gestureName, label, emoji)
        this.onProgressUpdate = null; // (candidate, progressRatio, confidence)
    }

    dist(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = (p1.z || 0) - (p2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    dist2D(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Analyze landmark geometry and return detailed finger states
     */
    getFingerStates(landmarks) {
        const wrist = landmarks[0];
        const thumbTip = landmarks[4];
        const thumbIP = landmarks[3];
        const thumbMCP = landmarks[2];
        const indexTip = landmarks[8];
        const indexPIP = landmarks[6];
        const indexMCP = landmarks[5];
        const middleTip = landmarks[12];
        const middlePIP = landmarks[10];
        const middleMCP = landmarks[9];
        const ringTip = landmarks[16];
        const ringPIP = landmarks[14];
        const ringMCP = landmarks[13];
        const pinkyTip = landmarks[20];
        const pinkyPIP = landmarks[18];
        const pinkyMCP = landmarks[17];

        // Hand scale reference (wrist to middle MCP distance)
        const handScale = this.dist(wrist, middleMCP) || 0.2;

        // Finger extended checks relative to wrist and PIP
        const indexExtended = (this.dist(indexTip, wrist) > this.dist(indexPIP, wrist) * 1.15) && (indexTip.y < indexPIP.y + 0.05);
        const middleExtended = (this.dist(middleTip, wrist) > this.dist(middlePIP, wrist) * 1.15) && (middleTip.y < middlePIP.y + 0.05);
        const ringExtended = (this.dist(ringTip, wrist) > this.dist(ringPIP, wrist) * 1.15) && (ringTip.y < ringPIP.y + 0.05);
        const pinkyExtended = (this.dist(pinkyTip, wrist) > this.dist(pinkyPIP, wrist) * 1.15) && (pinkyTip.y < pinkyPIP.y + 0.05);

        // Thumb extension
        const thumbDistToPinky = this.dist(thumbTip, pinkyMCP) / handScale;
        const thumbDistToWrist = this.dist(thumbTip, wrist) / handScale;
        const thumbExtended = (thumbDistToPinky > 0.8) && (thumbDistToWrist > 0.7);

        // Specific relative distances (normalized by hand scale)
        const thumbIndexDist = this.dist(thumbTip, indexTip) / handScale;
        const thumbMiddleDist = this.dist(thumbTip, middleTip) / handScale;
        const indexMiddleDist = this.dist(indexTip, middleTip) / handScale;
        const ringPinkyDist = this.dist(ringTip, pinkyTip) / handScale;
        const allTipsDist = (
            this.dist(thumbTip, indexTip) +
            this.dist(indexTip, middleTip) +
            this.dist(middleTip, ringTip) +
            this.dist(ringTip, pinkyTip)
        ) / (4 * handScale);

        // Thumbs up / down orientation
        const isThumbPointingUp = thumbTip.y < thumbMCP.y - 0.08 && thumbTip.y < indexMCP.y;
        const isThumbPointingDown = thumbTip.y > wrist.y + 0.05;

        return {
            thumbExtended,
            indexExtended,
            middleExtended,
            ringExtended,
            pinkyExtended,
            thumbIndexDist,
            thumbMiddleDist,
            indexMiddleDist,
            ringPinkyDist,
            allTipsDist,
            isThumbPointingUp,
            isThumbPointingDown,
            handScale
        };
    }

    /**
     * Classify raw frame landmarks into a sign candidate
     */
    classifyFrame(landmarks) {
        if (!landmarks || landmarks.length < 21) return null;

        const f = this.getFingerStates(landmarks);
        const extCount = (f.thumbExtended ? 1 : 0) + (f.indexExtended ? 1 : 0) +
                         (f.middleExtended ? 1 : 0) + (f.ringExtended ? 1 : 0) + (f.pinkyExtended ? 1 : 0);

        let match = null;
        let confidence = 0.85;

        // 1. "I LOVE YOU" (ASL: Thumb, Index, Pinky extended; Middle and Ring folded)
        if (f.thumbExtended && f.indexExtended && !f.middleExtended && !f.ringExtended && f.pinkyExtended) {
            match = { id: 'ILY', text: 'I love you', emoji: '🤟', label: 'I Love You (ASL)' };
            confidence = 0.95;
        }
        // 2. "HELP" / "THUMBS UP" / "YES / GOOD"
        else if (f.isThumbPointingUp && !f.indexExtended && !f.middleExtended && !f.ringExtended && !f.pinkyExtended) {
            match = { id: 'HELP', text: 'Help', emoji: '👍', label: 'Help / Good (Thumbs Up)' };
            confidence = 0.94;
        }
        // 3. "NO" / "BAD" (Thumbs Down)
        else if (f.isThumbPointingDown && !f.indexExtended && !f.middleExtended && !f.ringExtended && !f.pinkyExtended) {
            match = { id: 'NO', text: 'No', emoji: '👎', label: 'No / Disagree' };
            confidence = 0.92;
        }
        // 4. "YES" / "FIST" (All fingers folded into a fist)
        else if (!f.thumbExtended && !f.indexExtended && !f.middleExtended && !f.ringExtended && !f.pinkyExtended) {
            match = { id: 'YES', text: 'Yes', emoji: '✊', label: 'Yes (Fist / Agree)' };
            confidence = 0.90;
        }
        // 5. "HELLO" / "STOP" / "5" (All 5 fingers extended spread wide)
        else if (f.thumbExtended && f.indexExtended && f.middleExtended && f.ringExtended && f.pinkyExtended && f.allTipsDist > 0.45) {
            match = { id: 'HELLO', text: 'Hello', emoji: '👋', label: 'Hello / Stop (Open Hand)' };
            confidence = 0.96;
        }
        // 6. "THANK YOU" / "B" (4 fingers extended together straight up, thumb tucked)
        else if (!f.thumbExtended && f.indexExtended && f.middleExtended && f.ringExtended && f.pinkyExtended && f.indexMiddleDist < 0.25) {
            match = { id: 'THANK_YOU', text: 'Thank you', emoji: '🙏', label: 'Thank You / Please' };
            confidence = 0.92;
        }
        // 7. "WATER" / "W" (Index, Middle, Ring extended in W shape, Thumb holds pinky)
        else if (f.indexExtended && f.middleExtended && f.ringExtended && !f.pinkyExtended) {
            match = { id: 'WATER', text: 'Water', emoji: '💧', label: 'Water (ASL "W")' };
            confidence = 0.93;
        }
        // 8. "PEACE" / "V" / "VICTORY" (Index & Middle extended in V shape, others folded)
        else if (f.indexExtended && f.middleExtended && !f.ringExtended && !f.pinkyExtended && !f.thumbExtended && f.indexMiddleDist > 0.22) {
            match = { id: 'PEACE', text: 'Peace', emoji: '✌️', label: 'Peace / Two (V Sign)' };
            confidence = 0.94;
        }
        // 9. "OK" / "FINE" / "F" (Thumb & Index touching in circle, Middle, Ring, Pinky extended)
        else if (f.thumbIndexDist < 0.28 && f.middleExtended && f.ringExtended && f.pinkyExtended) {
            match = { id: 'OK', text: 'OK', emoji: '👌', label: 'OK / All Good' };
            confidence = 0.95;
        }
        // 10. "PAIN" / "POINT" / "1" (Only Index finger extended pointing up)
        else if (f.indexExtended && !f.middleExtended && !f.ringExtended && !f.pinkyExtended && !f.thumbExtended) {
            match = { id: 'PAIN', text: 'Pain', emoji: '☝️', label: 'Pain / Need Attention' };
            confidence = 0.93;
        }
        // 11. "L" SIGN / "LATER" (Thumb and Index at 90 degrees, others folded)
        else if (f.thumbExtended && f.indexExtended && !f.middleExtended && !f.ringExtended && !f.pinkyExtended) {
            match = { id: 'L_SIGN', text: 'Look', emoji: '👆', label: 'Look / "L" Sign' };
            confidence = 0.91;
        }
        // 12. "FOOD" / "EAT" / "MORE" (All 5 fingertips pinched together in a cluster)
        else if (f.allTipsDist < 0.30 && extCount >= 2) {
            match = { id: 'FOOD', text: 'Food', emoji: '🍲', label: 'Food / Eat (Pinched Hand)' };
            confidence = 0.89;
        }
        // 13. "BATHROOM" / "RESTROOM" / "T" / "EMERGENCY" (Pinky only extended or Rock-on)
        else if (!f.indexExtended && !f.middleExtended && !f.ringExtended && f.pinkyExtended && !f.thumbExtended) {
            match = { id: 'BATHROOM', text: 'Bathroom', emoji: '🚻', label: 'Bathroom (ASL "I")' };
            confidence = 0.90;
        }
        // 14. "ROCK ON" / "CALL ME" / "Y" (Thumb and Pinky extended, middle three folded)
        else if (f.thumbExtended && !f.indexExtended && !f.middleExtended && !f.ringExtended && f.pinkyExtended) {
            match = { id: 'CALL_ME', text: 'Call doctor', emoji: '🤙', label: 'Call / "Y" Sign' };
            confidence = 0.93;
        }

        return match ? { ...match, confidence, rawStates: f } : null;
    }

    /**
     * Process continuous stream of landmarks with temporal smoothing and hold confirmation
     */
    processLandmarks(landmarks) {
        const now = performance.now();
        const candidate = this.classifyFrame(landmarks);

        if (!candidate) {
            // Hand lost or indeterminate gesture -> reset progress
            this.currentCandidate = null;
            this.candidateStartTime = 0;
            if (this.onProgressUpdate) {
                this.onProgressUpdate(null, 0, 0);
            }
            return null;
        }

        // Check if candidate matches current active candidate
        if (this.currentCandidate && this.currentCandidate.id === candidate.id) {
            const elapsed = now - this.candidateStartTime;
            const progressRatio = Math.min(1.0, elapsed / this.holdDurationMs);

            if (this.onProgressUpdate) {
                this.onProgressUpdate(this.currentCandidate, progressRatio, candidate.confidence);
            }

            // Play progressive acoustic tick when crossing thresholds
            if (progressRatio >= 0.5 && progressRatio < 0.55 && window.VoiceBridgeAudio) {
                window.VoiceBridgeAudio.playProgressBeep(0.5);
            }

            // Trigger confirmation once hold duration is achieved
            if (progressRatio >= 1.0) {
                const canTrigger = (this.lastTriggeredGesture !== candidate.id) ||
                                  (now - this.lastTriggeredTime > this.cooldownMs);

                if (canTrigger) {
                    this.lastTriggeredGesture = candidate.id;
                    this.lastTriggeredTime = now;

                    // Trigger confirmed callback
                    if (this.onGestureConfirmed) {
                        this.onGestureConfirmed(candidate.id, candidate.text, candidate.emoji);
                    }

                    // Play pleasant success chime
                    if (window.VoiceBridgeAudio) {
                        window.VoiceBridgeAudio.playSuccessChime();
                    }

                    // Reset candidate to require fresh hold or change
                    this.candidateStartTime = now + 400; // Small delay before next count
                }
            }
        } else {
            // New gesture candidate detected
            this.currentCandidate = candidate;
            this.candidateStartTime = now;
            if (this.onProgressUpdate) {
                this.onProgressUpdate(candidate, 0.05, candidate.confidence);
            }
        }

        return candidate;
    }

    reset() {
        this.currentCandidate = null;
        this.candidateStartTime = 0;
        this.lastTriggeredGesture = null;
        this.lastTriggeredTime = 0;
    }
}

// Export singleton instance
window.VoiceBridgeGestureRecognizer = new GestureRecognizer();
