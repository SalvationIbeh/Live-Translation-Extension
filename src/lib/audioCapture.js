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
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass({
        sampleRate: this.options.sampleRate,
      });
    }

    async captureMicAudio() {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.options.enableEchoCancellation,
          noiseSuppression: this.options.enableNoiseReduction,
          sampleRate: this.options.sampleRate,
        },
      });
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
    }

    async captureTabAudio() {
      this.tabStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: false,
      });
      this.tabSource = this.audioContext.createMediaStreamSource(this.tabStream);
    }
  
    setupAudioProcessing() {
      this.processor = this.audioContext.createScriptProcessor(4096, 2, 2);
      this.analyser = this.audioContext.createAnalyser();
  
      this.micSource.connect(this.processor);
      this.tabSource.connect(this.processor);
      this.processor.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
  
      this.processor.onaudioprocess = (e) => {
        if (this.isCapturing && !this.isPaused) {
          const left = e.inputBuffer.getChannelData(0);
          const right = e.inputBuffer.getChannelData(1);
          this.capturedChunks.push({ left, right });
          this.updateAudioLevel();
        }
      };
    }
  
    startVisualization() {
      const updateVisualization = () => {
        if (this.isCapturing) {
          this.updateAudioLevel();
          requestAnimationFrame(updateVisualization);
        }
      };
      updateVisualization();
    }

    handleError(error) {
      console.error('Audio Capture Error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
    }
}

export default AudioCapture;