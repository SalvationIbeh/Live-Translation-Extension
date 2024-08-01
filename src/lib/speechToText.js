// src/lib/speechToText.js

import { v4 as uuidv4 } from 'uuid';

class SpeechToText {
  constructor(options = {}) {
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.recognition.continuous = options.continuous ?? true;
    this.recognition.interimResults = options.interimResults ?? true;
    this.recognition.lang = options.lang || 'en-US';
    
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onStateChangeCallback = null;

    this.isListening = false;
    this.currentSessionId = null;
    this.transcriptBuffer = '';
    this.lastPunctuationIndex = 0;

    this.supportedLanguages = ['en-US', 'es-ES', 'fr-FR'];

    this.setupRecognitionCallbacks();
  }

  setupRecognitionCallbacks() {
    this.recognition.onstart = () => this.handleStateChange('listening');
    this.recognition.onend = () => this.handleStateChange('stopped');
    this.recognition.onerror = (event) => this.handleError(event.error);
    this.recognition.onresult = (event) => this.handleResult(event);
  }

  start() {
    if (!this.isListening) {
      this.currentSessionId = uuidv4();
      this.transcriptBuffer = '';
      this.lastPunctuationIndex = 0;
      this.recognition.start();
      this.isListening = true;
    }
  }

  stop() {
    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  setLanguage(lang) {
    if (this.supportedLanguages.includes(lang)) {
      this.recognition.lang = lang;
    } else {
      throw new Error(`Unsupported language: ${lang}`);
    }
  }

  handleResult(event) {
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript;
    const isFinal = result.isFinal;

    this.transcriptBuffer += transcript;

    if (isFinal) {
      const formattedTranscript = this.formatTranscript(this.transcriptBuffer);
      this.transcriptBuffer = '';
      this.lastPunctuationIndex = 0;

      if (this.onResultCallback) {
        this.onResultCallback(formattedTranscript, this.currentSessionId, true);
      }
    } else {
      if (this.onResultCallback) {
        this.onResultCallback(transcript, this.currentSessionId, false);
      }
    }
  }

  formatTranscript(text) {
    // Basic punctuation and capitalization
    let formatted = text.trim();
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    
    // Add period if missing at the end
    if (!['!', '?', '.'].includes(formatted.slice(-1))) {
      formatted += '.';
    }

    return formatted;
  }

  handleError(error) {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }

    // Implement fallback or retry logic
    if (error === 'network') {
      this.retryRecognition();
    }
  }

  retryRecognition() {
    setTimeout(() => {
      if (this.isListening) {
        this.stop();
        this.start();
      }
    }, 1000);
  }

  handleStateChange(state) {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(state);
    }
  }

  setOnResultCallback(callback) {
    this.onResultCallback = callback;
  }

  setOnErrorCallback(callback) {
    this.onErrorCallback = callback;
  }

  setOnStateChangeCallback(callback) {
    this.onStateChangeCallback = callback;
  }
}

export default SpeechToText;