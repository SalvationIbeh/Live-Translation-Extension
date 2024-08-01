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
    this.debug = options.debug || false;
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

  async createMediaStreamSource() {
    this.log('Creating MediaStreamSource');
    
    if (!this.audioContext) {
      this.log('AudioContext not initialized, attempting to set up');
      await this.setupAudioContext();
    }

    if (!this.audioContext) {
      throw new Error('Failed to initialize AudioContext');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.log('Got user media stream');
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.log('Created MediaStreamSource successfully');
    } catch (error) {
      this.log('Error in createMediaStreamSource:', error);
      this.handleError(error);
      throw error;
    }
  }

  async requestPermissions() {
    try {
      const micPermission = await navigator.permissions.query({ name: 'microphone' });
      const displayPermission = await navigator.permissions.query({ name: 'display-capture' });
      
      if (micPermission.state !== 'granted' || displayPermission.state !== 'granted') {
        throw new Error('Microphone or display capture permission not granted');
      }
    } catch (error) {
      throw new Error(`Permission request failed: ${error.message}`);
    }
  }

  log(...args) {
    if (this.debug) {
      console.log('[AudioCapture]', ...args);
    }
  }

  async setupAudioContext() {
    this.log('Setting up AudioContext');
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API is not supported in this browser');
      }
      this.audioContext = new AudioContextClass({
        sampleRate: this.options.sampleRate,
      });
    }
    this.log('AudioContext set up successfully');
  }

  async createMediaStreamSource() {
    this.log('Creating MediaStreamSource');
    if (!this.audioContext) {
      this.log('AudioContext not initialized, attempting to set up');
      await this.setupAudioContext();
    }

    if (!this.audioContext) {
      throw new Error('Failed to initialize AudioContext');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.log('Got user media stream');
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      this.log('Created MediaStreamSource successfully');
    } catch (error) {
      this.log('Error in createMediaStreamSource:', error);
      this.handleError(error);
      throw error;
    }
  }

  handleError(error) {
    this.log('Audio Capture Error:', error);
    console.error('Audio Capture Error:', error);
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }
  async captureMicAudio() {
    if (!this.audioContext) {
      throw new Error('AudioContext is not initialized');
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.options.enableEchoCancellation,
          noiseSuppression: this.options.enableNoiseReduction,
          sampleRate: this.options.sampleRate,
        },
      });
      this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
    } catch (error) {
      throw new Error(`Failed to capture microphone audio: ${error.message}`);
    }
  }

  async captureTabAudio() {
    if (!this.audioContext) {
      throw new Error('AudioContext is not initialized');
    }
    try {
      this.tabStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: false,
      });
      this.tabSource = this.audioContext.createMediaStreamSource(this.tabStream);
    } catch (error) {
      throw new Error(`Failed to capture tab audio: ${error.message}`);
    }
  }

  setupAudioProcessing() {
    if (!this.audioContext || !this.micSource || !this.tabSource) {
      throw new Error('Audio sources not properly initialized');
    }

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
   
     updateAudioLevel() {
      if (!this.analyser || !this.audioLevelCallback) return;
  
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);
  
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = average / 255;
  
      this.audioLevelCallback(normalizedLevel);
    }
  
    stop() {
      if (!this.isCapturing) return;
  
      this.isCapturing = false;
      this.isPaused = false;
  
      if (this.micStream) {
        this.micStream.getTracks().forEach(track => track.stop());
      }
      if (this.tabStream) {
        this.tabStream.getTracks().forEach(track => track.stop());
      }
  
      if (this.audioContext) {
        this.audioContext.close();
      }
  
      this.capturedChunks = [];
    }
  
    pause() {
      this.isPaused = true;
    }
  
    resume() {
      this.isPaused = false;
    }
  
    async selectAudioInput(deviceId) {
      if (this.isCapturing) {
        throw new Error('Cannot change audio input while capturing');
      }
  
      const constraints = {
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: this.options.enableEchoCancellation,
          noiseSuppression: this.options.enableNoiseReduction,
          sampleRate: this.options.sampleRate,
        },
      };
  
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
      } catch (error) {
        this.handleError(error);
      }
    }
  
    async getAudioInputs() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    }
  
    setAudioLevelCallback(callback) {
      this.audioLevelCallback = callback;
    }
  
    setErrorCallback(callback) {
      this.onErrorCallback = callback;
    }


    getAudioData() {
      // Combine left and right channels
      const combinedChunks = this.capturedChunks.map(chunk => {
        const combined = new Float32Array(chunk.left.length + chunk.right.length);
        for (let i = 0; i < chunk.left.length; i++) {
          combined[i * 2] = chunk.left[i];
          combined[i * 2 + 1] = chunk.right[i];
        }
        return combined;
      });
  
      // Convert to 16-bit PCM
      const pcmData = new Int16Array(combinedChunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of combinedChunks) {
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]));
          pcmData[offset++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
      }
  
      return pcmData;
    }
  
    // Additional method to change configuration at runtime
    updateConfiguration(newOptions) {
      this.options = { ...this.options, ...newOptions };
      // Reinitialize audio context and streams if necessary
      if (this.isCapturing) {
        this.stop();
        this.start();
      }
    }
  }
  
export default AudioCapture;