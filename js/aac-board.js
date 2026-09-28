/**
 * VoiceBridge AAC (Augmentative and Alternative Communication) Board
 * Provides categorized high-frequency phrases and individual words for rapid 1-tap communication.
 */

class AACBoard {
    constructor() {
        this.categories = {
            emergency: {
                title: "Emergency & Medical",
                icon: "🚨",
                color: "#ef4444",
                phrases: [
                    { text: "I need immediate help!", icon: "🆘", emergency: true },
                    { text: "I am in severe pain.", icon: "⚡", emergency: true },
                    { text: "Please call a doctor.", icon: "👨‍⚕️", emergency: true },
                    { text: "I am having trouble breathing.", icon: "🫁", emergency: true },
                    { text: "Please call my family.", icon: "📞", emergency: false },
                    { text: "I need my medication.", icon: "💊", emergency: false }
                ]
            },
            needs: {
                title: "Daily Needs",
                icon: "💧",
                color: "#0284c7",
                phrases: [
                    { text: "I need a glass of water.", icon: "💧" },
                    { text: "I am hungry and need food.", icon: "🍲" },
                    { text: "I need to go to the bathroom.", icon: "🚻" },
                    { text: "I am very tired and need rest.", icon: "🛌" },
                    { text: "I am too cold.", icon: "❄️" },
                    { text: "I am too hot.", icon: "🔥" }
                ]
            },
            social: {
                title: "Greetings & Social",
                icon: "👋",
                color: "#10b981",
                phrases: [
                    { text: "Hello, good day!", icon: "👋" },
                    { text: "Thank you very much.", icon: "🙏" },
                    { text: "Yes, I agree.", icon: "✅" },
                    { text: "No, thank you.", icon: "❌" },
                    { text: "I love you.", icon: "❤️" },
                    { text: "Please give me a moment.", icon: "⏳" }
                ]
            },
            questions: {
                title: "Questions & Clarifications",
                icon: "❓",
                color: "#8b5cf6",
                phrases: [
                    { text: "Where is it located?", icon: "📍" },
                    { text: "Could you please repeat that?", icon: "🔁" },
                    { text: "Could you please write it down?", icon: "✍️" },
                    { text: "What time is it?", icon: "⏰" },
                    { text: "How much is this?", icon: "💳" }
                ]
            }
        };

        this.customPhrases = [];
        this.currentCategory = 'emergency';
        this.loadCustomPhrases();
    }

    loadCustomPhrases() {
        try {
            const saved = localStorage.getItem('voicebridge_custom_phrases');
            if (saved) {
                this.customPhrases = JSON.parse(saved);
            }
        } catch (e) {
            this.customPhrases = [];
        }
    }

    saveCustomPhrases() {
        try {
            localStorage.setItem('voicebridge_custom_phrases', JSON.stringify(this.customPhrases));
        } catch (e) {}
    }

    addCustomPhrase(text, icon = "💬") {
        if (!text || !text.trim()) return false;
        this.customPhrases.push({
            id: Date.now().toString(),
            text: text.trim(),
            icon: icon || "💬"
        });
        this.saveCustomPhrases();
        return true;
    }

    removeCustomPhrase(id) {
        this.customPhrases = this.customPhrases.filter(p => p.id !== id);
        this.saveCustomPhrases();
    }

    render(containerEl, onSpeak, onAppend) {
        if (!containerEl) return;

        let html = `
            <div class="aac-category-tabs">
                ${Object.keys(this.categories).map(catKey => {
                    const cat = this.categories[catKey];
                    const activeClass = (this.currentCategory === catKey) ? 'active' : '';
                    return `
                        <button class="aac-tab-btn ${activeClass}" data-category="${catKey}">
                            <span>${cat.icon}</span> ${cat.title}
                        </button>
                    `;
                }).join('')}
                <button class="aac-tab-btn ${this.currentCategory === 'custom' ? 'active' : ''}" data-category="custom">
                    <span>⭐</span> Custom Phrases (${this.customPhrases.length})
                </button>
            </div>

            <div class="aac-grid">
        `;

        if (this.currentCategory === 'custom') {
            if (this.customPhrases.length === 0) {
                html += `
                    <div class="aac-empty-state">
                        <p>No custom phrases yet. Add your frequently used sentences below!</p>
                    </div>
                `;
            } else {
                this.customPhrases.forEach(item => {
                    html += `
                        <div class="aac-card custom-card">
                            <div class="aac-card-icon">${item.icon}</div>
                            <div class="aac-card-text">${item.text}</div>
                            <div class="aac-card-actions">
                                <button class="aac-speak-btn" data-text="${encodeURIComponent(item.text)}" title="Speak Instantly">
                                    🔊 Speak
                                </button>
                                <button class="aac-append-btn" data-text="${encodeURIComponent(item.text)}" title="Add to Sentence">
                                    ➕ Add
                                </button>
                                <button class="aac-del-btn" data-id="${item.id}" title="Delete">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
        } else {
            const activeCat = this.categories[this.currentCategory];
            if (activeCat) {
                activeCat.phrases.forEach(item => {
                    const emClass = item.emergency ? 'emergency-card' : '';
                    html += `
                        <div class="aac-card ${emClass}">
                            <div class="aac-card-icon">${item.icon}</div>
                            <div class="aac-card-text">${item.text}</div>
                            <div class="aac-card-actions">
                                <button class="aac-speak-btn ${item.emergency ? 'btn-emergency' : ''}" data-text="${encodeURIComponent(item.text)}" title="Speak Instantly">
                                    🔊 Speak
                                </button>
                                <button class="aac-append-btn" data-text="${encodeURIComponent(item.text)}" title="Add to Sentence">
                                    ➕ Add
                                </button>
                            </div>
                        </div>
                    `;
                });
            }
        }

        html += `</div>`;
        containerEl.innerHTML = html;

        // Attach event listeners
        containerEl.querySelectorAll('.aac-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentCategory = btn.dataset.category;
                this.render(containerEl, onSpeak, onAppend);
            });
        });

        containerEl.querySelectorAll('.aac-speak-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = decodeURIComponent(btn.dataset.text);
                if (onSpeak) onSpeak(text);
            });
        });

        containerEl.querySelectorAll('.aac-append-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const text = decodeURIComponent(btn.dataset.text);
                if (onAppend) onAppend(text);
            });
        });

        containerEl.querySelectorAll('.aac-del-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.removeCustomPhrase(id);
                this.render(containerEl, onSpeak, onAppend);
            });
        });
    }
}

// Export singleton instance
window.VoiceBridgeAAC = new AACBoard();
