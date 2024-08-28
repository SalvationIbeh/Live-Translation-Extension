// src/lib/translationPipeline.js

import AudioCapture from './audioCapture';
import SpeechToText from './speechToText';
import Translation from './translation';
import TextToSpeech from './textToSpeech';

class TranslationPipeline {
  constructor(options = {}) {
    this.audioCapture = new AudioCapture(options.audioCapture);
    this.speechToText = new SpeechToText(options.speechToText);
    this.translation = new Translation(options.translation);
    this.textToSpeech = new TextToSpeech(options.textToSpeech);

    this.isRunning = false;
    this.onTranslatedTextCallback = null;
    this.onSpokenTranslationCallback = null;
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    await this.textToSpeech.init();
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
        await this.speakTranslation(translatedText);
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

  setOnSpokenTranslationCallback(callback) {
    this.onSpokenTranslationCallback = callback;
  }

  setSourceLanguage(lang) {
    this.translation.setSourceLanguage(lang);
    this.speechToText.setLanguage(lang);
  }

  setTargetLanguage(lang) {
    this.translation.setTargetLanguage(lang);
    this.textToSpeech.setVoice(lang);
  }

  async speakTranslation(text) {
    await this.textToSpeech.speak(text, this.translation.getTargetLanguage());
    if (this.onSpokenTranslationCallback) {
      this.onSpokenTranslationCallback(text);
    }
  }

  setTTSRate(rate) {
    this.textToSpeech.setRate(rate);
  }

  setTTSPitch(pitch) {
    this.textToSpeech.setPitch(pitch);
  }

  setTTSVolume(volume) {
    this.textToSpeech.setVolume(volume);
  }
}

export default TranslationPipeline;