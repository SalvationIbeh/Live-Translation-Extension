// src/lib/translationPipeline.js

import AudioCapture from './audioCapture';
import SpeechToText from './speechToText';
import Translation from './translation';

class TranslationPipeline {
  constructor(options = {}) {
    this.audioCapture = new AudioCapture(options.audioCapture);
    this.speechToText = new SpeechToText(options.speechToText);
    this.translation = new Translation(options.translation);

    this.isRunning = false;
    this.onTranslatedTextCallback = null;
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.audioCapture.start();

    this.audioCapture.setAudioLevelCallback((level) => {
      // Handle audio level updates if needed
    });

    this.speechToText.setOnResultCallback(async (transcript, sessionId, isFinal) => {
      if (isFinal) {
        const translatedText = await this.translation.translate(transcript);
        if (this.onTranslatedTextCallback) {
          this.onTranslatedTextCallback(translatedText);
        }
      }
    });

    this.speechToText.start();
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.audioCapture.stop();
    this.speechToText.stop();
  }

  setOnTranslatedTextCallback(callback) {
    this.onTranslatedTextCallback = callback;
  }

  setSourceLanguage(lang) {
    this.translation.setSourceLanguage(lang);
  }

  setTargetLanguage(lang) {
    this.translation.setTargetLanguage(lang);
  }
}

export default TranslationPipeline;