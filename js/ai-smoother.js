/**
 * VoiceBridge AI Sentence Smoother
 * Converts telegram-style sign sequences into fluent, grammatically natural sentences.
 * Features an intelligent offline heuristic engine and optional live LLM API bridge.
 */

class AISentenceSmoother {
    constructor() {
        this.apiKey = localStorage.getItem('voicebridge_llm_key') || '';
        this.apiEndpoint = localStorage.getItem('voicebridge_llm_endpoint') || 'https://api.openai.com/v1/chat/completions';
    }

    /**
     * Intelligent local heuristic grammar expander (100% offline, zero-latency)
     */
    smoothLocally(rawText) {
        if (!rawText || !rawText.trim()) return "";

        const tokens = rawText.trim().split(/\s+/).map(t => t.toUpperCase().replace(/[.,!]/g, ''));
        if (tokens.length === 0) return "";

        // Check exact combinations
        const joined = tokens.join(' ');

        // Heuristic mapping rules for common ASL sequences
        const patternMap = [
            {
                pattern: ['WATER', 'PAIN', 'HELP'],
                result: "I need some water and I am in severe pain. Please help me."
            },
            {
                pattern: ['HELP', 'DOCTOR'],
                result: "Please help me call a doctor immediately."
            },
            {
                pattern: ['CALL', 'DOCTOR', 'PAIN'],
                result: "Please call a doctor right away, I am in pain."
            },
            {
                pattern: ['HELLO', 'THANK', 'YOU'],
                result: "Hello! Thank you very much for your time and assistance."
            },
            {
                pattern: ['HELLO', 'HELP'],
                result: "Hello, could you please assist me for a moment?"
            },
            {
                pattern: ['BATHROOM', 'PLEASE'],
                result: "Excuse me, could you please direct me to the nearest bathroom?"
            },
            {
                pattern: ['FOOD', 'WATER'],
                result: "I would like some food and a glass of water, please."
            },
            {
                pattern: ['FOOD', 'PLEASE'],
                result: "I am feeling hungry, could I please have something to eat?"
            },
            {
                pattern: ['WATER', 'PLEASE'],
                result: "Could you please give me a glass of water?"
            },
            {
                pattern: ['YES', 'THANK', 'YOU'],
                result: "Yes, that is correct. Thank you very much!"
            },
            {
                pattern: ['NO', 'THANK', 'YOU'],
                result: "No, thank you, but I appreciate your offer."
            },
            {
                pattern: ['PAIN', 'HELP'],
                result: "I am experiencing pain and need immediate assistance."
            },
            {
                pattern: ['I', 'LOVE', 'YOU'],
                result: "I love you very much!"
            }
        ];

        // Search for matching preset pattern
        for (const entry of patternMap) {
            const allPresent = entry.pattern.every(word => tokens.includes(word));
            if (allPresent && tokens.length <= entry.pattern.length + 2) {
                return entry.result;
            }
        }

        // Generic intelligent transformer for arbitrary word sequences
        const wordExpansions = {
            'HELLO': 'Hello',
            'HELP': 'I need assistance',
            'YES': 'yes',
            'NO': 'no',
            'WATER': 'a glass of water',
            'FOOD': 'something to eat',
            'PAIN': 'I am having pain',
            'DOCTOR': 'a medical professional',
            'BATHROOM': 'the restroom',
            'THANK': 'thank',
            'YOU': 'you',
            'PLEASE': 'please',
            'PEACE': 'peace',
            'OK': 'everything is alright',
            'LOVE': 'I love you'
        };

        const converted = tokens.map(t => wordExpansions[t] || t.toLowerCase());

        // Capitalize first letter and append punctuation
        let sentence = converted.join(' ');
        sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        if (!/[.!?]$/.test(sentence)) {
            sentence += '.';
        }

        return sentence;
    }

    /**
     * Cloud LLM smoothing (if API key is supplied)
     */
    async smoothWithLLM(rawText) {
        if (!this.apiKey) {
            // Fallback to local smoothing if no key configured
            return this.smoothLocally(rawText);
        }

        try {
            const prompt = `You are VoiceBridge AI, an assistive communication assistant. 
Convert the following raw sign language keyword sequence into a natural, polite, first-person spoken sentence for a non-verbal person.
Keep it concise, clear, and natural.
Raw signs: "${rawText}"
Expanded Sentence:`;

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You convert raw keywords into natural first-person spoken speech for a non-verbal communication app.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 60,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.statusText}`);
            }

            const data = await response.json();
            const smoothed = data.choices[0].message.content.trim().replace(/^"|"$/g, '');
            return smoothed;
        } catch (err) {
            console.warn("LLM API call failed, falling back to local heuristic:", err);
            return this.smoothLocally(rawText);
        }
    }
}

// Export singleton instance
window.VoiceBridgeAISmoother = new AISentenceSmoother();
