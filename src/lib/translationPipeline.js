// src/lib/translationPipeline.js

import AudioCapture from './audioCapture';
import SpeechToText from './speechToText';
import Translation from './translation';
import TextToSpeech from './textToSpeech';

class TranslationPipeline {
  constructor(options = {}) {
    this.audioCapture = new AudioCapture(options.audioCapture);
    this.localSpeechToText = new SpeechToText(options.speechToText);
    this.remoteSpeechToText = new SpeechToText(options.speechToText);
    this.localToRemoteTranslation = new Translation(options.translation);
    this.remoteToLocalTranslation = new Translation(options.translation);
    this.localTextToSpeech = new TextToSpeech(options.textToSpeech);
    this.remoteTextToSpeech = new TextToSpeech(options.textToSpeech);

    this.isRunning = false;
    this.onLocalTranslatedTextCallback = null;
    this.onRemoteTranslatedTextCallback = null;
    this.onLocalSpokenTranslationCallback = null;
    this.onRemoteSpokenTranslationCallback = null;
  }

  async start() {
    if (this.isRunning) return;

    try {
      this.isRunning = true;
      await Promise.all([
        this.localTextToSpeech.init(),
        this.remoteTextToSpeech.init()
      ]);
      
      await this.audioCapture.start();

      this.setupAudioLevelCallback();
      this.setupSpeechToTextProcessing();

      await Promise.all([
        this.localSpeechToText.start(),
        this.remoteSpeechToText.start()
      ]);
    } catch (error) {
      this.isRunning = false;
      console.error('Failed to start translation pipeline:', error);
      throw new Error('Failed to start translation pipeline: ' + error.message);
    }
  }

  setupAudioLevelCallback() {
    this.audioCapture.setAudioLevelCallback((level, source) => {
      try {
        if (source === 'tab') {
          // Handle remote audio level
          // Implement your logic here
        } else if (source === 'mic') {
          // Handle local audio level
          // Implement your logic here
        }
      } catch (error) {
        console.error('Error in audio level callback:', error);
      }
    });
  }

  setupSpeechToTextProcessing() {
    const processAudio = async (audioData, source) => {
      try {
        const sttInstance = source === 'tab' ? this.remoteSpeechToText : this.localSpeechToText;
        await sttInstance.processAudio(audioData);
      } catch (error) {
        console.error(`Error processing ${source} audio:`, error);
      }
    };

    this.audioCapture.setAudioDataCallback(processAudio);
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.audioCapture.stop();
    this.localSpeechToText.stop();
    this.remoteSpeechToText.stop();
  }

  setOnLocalTranslatedTextCallback(callback) {
    this.onLocalTranslatedTextCallback = callback;
  }

  setOnRemoteTranslatedTextCallback(callback) {
    this.onRemoteTranslatedTextCallback = callback;
  }

  setOnLocalSpokenTranslationCallback(callback) {
    this.onLocalSpokenTranslationCallback = callback;
  }

  setOnRemoteSpokenTranslationCallback(callback) {
    this.onRemoteSpokenTranslationCallback = callback;
  }

  setLocalLanguage(lang) {
    this.localToRemoteTranslation.setSourceLanguage(lang);
    this.remoteToLocalTranslation.setTargetLanguage(lang);
    this.localSpeechToText.setLanguage(lang);
    this.localTextToSpeech.setVoice(lang);
  }

  setRemoteLanguage(lang) {
    this.localToRemoteTranslation.setTargetLanguage(lang);
    this.remoteToLocalTranslation.setSourceLanguage(lang);
    this.remoteSpeechToText.setLanguage(lang);
    this.remoteTextToSpeech.setVoice(lang);
  }

  async speakTranslation(text, target) {
    if (target === 'local') {
      await this.localTextToSpeech.speak(text, this.remoteToLocalTranslation.getTargetLanguage());
      if (this.onLocalSpokenTranslationCallback) {
        this.onLocalSpokenTranslationCallback(text);
      }
    } else {
      await this.remoteTextToSpeech.speak(text, this.localToRemoteTranslation.getTargetLanguage());
      if (this.onRemoteSpokenTranslationCallback) {
        this.onRemoteSpokenTranslationCallback(text);
      }
    }
  }

  setLocalTTSRate(rate) {
    this.localTextToSpeech.setRate(rate);
  }

  setRemoteTTSRate(rate) {
    this.remoteTextToSpeech.setRate(rate);
  }

  setLocalTTSPitch(pitch) {
    this.localTextToSpeech.setPitch(pitch);
  }

  setRemoteTTSPitch(pitch) {
    this.remoteTextToSpeech.setPitch(pitch);
  }

  setLocalTTSVolume(volume) {
    this.localTextToSpeech.setVolume(volume);
  }

  setRemoteTTSVolume(volume) {
    this.remoteTextToSpeech.setVolume(volume);
  }
}

export default TranslationPipeline;