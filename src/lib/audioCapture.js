// src/lib/audioCapture.js

class AudioCapture {
    constructor(options = {}) {
      this.options = {
        sampleRate: options.sampleRate || 44100,
        bitDepth: options.bitDepth || 16,
        enableNoiseReduction: options.enableNoiseReduction !== false,
        enableEchoCancellation: options.enableEchoCancellation !== false,
      };
      this.micStream = null;
      this.tabStream = null;
      this.isCapturing = false;
      this.isPaused = false;
      this.audioContext = null;
      this.micSource = null;
      this.tabSource = null;
      this.processor = null;
      this.analyser = null;
      this.audioLevelCallback = null;
      this.onErrorCallback = null;
      this.capturedChunks = [];
    }
  
    async start() {
      if (this.isCapturing) return;
  
      try {
        await this.requestPermissions();
        await this.setupAudioContext();
        await this.captureMicAudio();
        await this.captureTabAudio();
        this.setupAudioProcessing();
        this.isCapturing = true;
        this.startVisualization();
      } catch (error) {
        this.handleError(error);
      }
    }
    async requestPermissions() {
      try {
        await navigator.permissions.query({ name: 'microphone' });
        await navigator.permissions.query({ name: 'display-capture' });
      } catch (error) {
        throw new Error('Permission denied: ' + error.message);
      }
    }
  
    async setupAudioContext() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.options.sampleRate,
      });
    }
}