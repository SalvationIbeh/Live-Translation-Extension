// src/lib/textToSpeech.js

import CacheService from './cacheService.js';

class TextToSpeech {
  constructor() {
    this.cache = null;
    this.voices = [];
    this.selectedVoice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
  }

  async init() {
    // Initialize cache
    this.cache = new CacheService('tts-cache');
    await this.cache.init();

    // Initialize voices
    if ('speechSynthesis' in window) {
      this.voices = await this.getVoices();
    } else {
      throw new Error('Text-to-speech not supported in this browser.');
    }
  }

  async getVoices() {
    return new Promise((resolve) => {
      let voices = window.speechSynthesis.getVoices();
      if (voices.length) {
        resolve(voices);
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          voices = window.speechSynthesis.getVoices();
          resolve(voices);
        };
      }
    });
  }

  setVoice(languageCode) {
    this.selectedVoice = this.voices.find(voice => voice.lang.includes(languageCode));
    if (!this.selectedVoice) {
      console.warn(`No voice found for language code: ${languageCode}. Using default voice.`);
      this.selectedVoice = this.voices[0];
    }
  }

  setRate(rate) {
    this.rate = rate;
  }

  setPitch(pitch) {
    this.pitch = pitch;
  }

  setVolume(volume) {
    this.volume = volume;
  }

  async speak(text, languageCode) {
    // Check cache first
    const cachedAudio = await this.cache.get(`${languageCode}-${text}`);
    if (cachedAudio) {
      return this.playAudio(cachedAudio);
    }

    // If not in cache, use Google TTS API
    try {
      const audioContent = await this.getGoogleTTSAudio(text, languageCode);
      await this.cache.set(`${languageCode}-${text}`, audioContent);
      return this.playAudio(audioContent);
    } catch (error) {
      console.error('Error in TTS:', error);
      // Fallback to browser's built-in TTS
      this.speakWithBrowserTTS(text, languageCode);
    }
  }

  async getGoogleTTSAudio(text, languageCode) {
    // Implement Google TTS API call here
    // This is a placeholder and needs to be implemented with actual API credentials
    const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode },
        audioConfig: { audioEncoding: 'MP3' }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get audio from Google TTS API');
    }

    const data = await response.json();
    return data.audioContent; // This is base64 encoded audio content
  }

  playAudio(audioContent) {
    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    audio.play();
  }

  speakWithBrowserTTS(text, languageCode) {
    this.setVoice(languageCode);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.selectedVoice;
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;
    window.speechSynthesis.speak(utterance);
  }
}

export default TextToSpeech;