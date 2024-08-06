// src/tests/audioCapture.test.js

import AudioCapture from '../../../../src/lib/audioCapture';
import mockMediaDevices from '../../../../mocks/navigator.mediaDevices';

// Mock the global objects and methods
global.navigator = {
  mediaDevices: {
    getUserMedia: jest.fn(),
    getDisplayMedia: jest.fn(),
  },
  permissions: {
    query: jest.fn(),
  },
};

global.window = {
  AudioContext: jest.fn(),
};

const mockCreateMediaStreamSource = jest.fn().mockReturnValue({});
const mockAudioContext = {
  createMediaStreamSource: mockCreateMediaStreamSource,
};

global.window.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);

describe('AudioCapture', () => {
  let audioCapture;
  let mockQuery;

  beforeEach(() => {
    audioCapture = new AudioCapture();
    jest.clearAllMocks();
    mockMediaDevices.getUserMedia.mockReset();
    mockMediaDevices.enumerateDevices.mockReset();
    mockMediaDevices.getDisplayMedia.mockReset();
  });

    describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(audioCapture.options).toEqual({
        sampleRate: 44100,
        bitDepth: 16,
        enableNoiseReduction: true,
        enableEchoCancellation: true,
      });
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        sampleRate: 48000,
        bitDepth: 24,
        enableNoiseReduction: false,
        enableEchoCancellation: false,
      };
      const customAudioCapture = new AudioCapture(customOptions);
      expect(customAudioCapture.options).toEqual(customOptions);
    });
  });

  describe('start', () => {
    let mockQuery;
  
  beforeEach(() => {
    mockQuery = jest.fn();
    audioCapture.requestPermissions = mockQuery;
  });

    it('should not start capturing if already capturing', async () => {
      audioCapture.isCapturing = true;
      await audioCapture.start();
      expect(mockQuery).not.toHaveBeenCalled();
    });
  
    it('should start capturing if not already capturing', async () => {
      const mockRequestPermissions = jest.spyOn(audioCapture, 'requestPermissions').mockResolvedValue();
      const mockSetupAudioContext = jest.spyOn(audioCapture, 'setupAudioContext').mockResolvedValue();
      const mockCaptureMicAudio = jest.spyOn(audioCapture, 'captureMicAudio').mockResolvedValue();
      const mockCaptureTabAudio = jest.spyOn(audioCapture, 'captureTabAudio').mockResolvedValue();
      const mockSetupAudioProcessing = jest.spyOn(audioCapture, 'setupAudioProcessing').mockImplementation();
      const mockStartVisualization = jest.spyOn(audioCapture, 'startVisualization').mockImplementation();
  
      await audioCapture.start();
  
      expect(mockRequestPermissions).toHaveBeenCalled();
      expect(mockSetupAudioContext).toHaveBeenCalled();
      expect(mockCaptureMicAudio).toHaveBeenCalled();
      expect(mockCaptureTabAudio).toHaveBeenCalled();
      expect(mockSetupAudioProcessing).toHaveBeenCalled();
      expect(mockStartVisualization).toHaveBeenCalled();
      expect(audioCapture.isCapturing).toBe(true);
    });
  
    it('should handle errors during start', async () => {
      const mockError = new Error('Test error');
      jest.spyOn(audioCapture, 'requestPermissions').mockRejectedValue(mockError);
      const mockHandleError = jest.spyOn(audioCapture, 'handleError').mockImplementation();
  
      await audioCapture.start();
  
      expect(mockHandleError).toHaveBeenCalledWith(mockError);
      expect(audioCapture.isCapturing).toBe(false);
    });
  });

  describe('requestPermissions', () => {
    let mockQuery;
  
    beforeEach(() => {
      global.navigator.permissions = {
        query: jest.fn()
      };
      mockQuery = jest.spyOn(navigator.permissions, 'query');
    });
  
    it('should request microphone and display-capture permissions', async () => {
      mockQuery.mockResolvedValue({ state: 'granted' });
  
      await audioCapture.requestPermissions();
  
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenCalledWith({ name: 'microphone' });
      expect(mockQuery).toHaveBeenCalledWith({ name: 'display-capture' });
    });
  
    it('should throw an error if permissions are denied', async () => {
      mockQuery.mockRejectedValue(new Error('Permission denied'));
  
      await expect(audioCapture.requestPermissions()).rejects.toThrow('Permission denied');
    });
  });
  

  describe('setupAudioContext', () => {
    it('should create a new AudioContext with the specified sample rate', async () => {
      const mockAudioContext = jest.fn();
      window.AudioContext = mockAudioContext;

      await audioCapture.setupAudioContext();

      expect(mockAudioContext).toHaveBeenCalledWith({ sampleRate: 44100 });
      expect(audioCapture.audioContext).toBeInstanceOf(mockAudioContext);
    });

    it('should use webkitAudioContext if AudioContext is not available', async () => {
      const mockWebkitAudioContext = jest.fn();
      delete window.AudioContext;
      window.webkitAudioContext = mockWebkitAudioContext;

      await audioCapture.setupAudioContext();

      expect(mockWebkitAudioContext).toHaveBeenCalledWith({ sampleRate: 44100 });
      expect(audioCapture.audioContext).toBeInstanceOf(mockWebkitAudioContext);
    });
  });

  describe('updateAudioLevel', () => {
    it('should not update audio level if analyser or callback is not set', () => {
      const audioCapture = new AudioCapture();
      audioCapture.updateAudioLevel();
      // No error should be thrown
    });

    it('should update audio level when analyser and callback are set', () => {
      const audioCapture = new AudioCapture();
      const mockCallback = jest.fn();
      audioCapture.setAudioLevelCallback(mockCallback);
      
      audioCapture.analyser = {
        frequencyBinCount: 4,
        getByteFrequencyData: jest.fn(array => {
          array.set([100, 150, 200, 250]);
        }),
      };

      audioCapture.updateAudioLevel();

      expect(mockCallback).toHaveBeenCalledWith(0.6862745098039216); // (100 + 150 + 200 + 250) / (4 * 255)
    });
  });

  describe('stop', () => {
    it('should not do anything if not capturing', () => {
      const audioCapture = new AudioCapture();
      audioCapture.stop();
      // No error should be thrown
    });

    it('should stop all tracks and close audio context when capturing', () => {
      const audioCapture = new AudioCapture();
      audioCapture.isCapturing = true;
      
      const mockTrackStop = jest.fn();
      audioCapture.micStream = { getTracks: () => [{ stop: mockTrackStop }] };
      audioCapture.tabStream = { getTracks: () => [{ stop: mockTrackStop }] };
      audioCapture.audioContext = { close: jest.fn() };

      audioCapture.stop();

      expect(audioCapture.isCapturing).toBe(false);
      expect(audioCapture.isPaused).toBe(false);
      expect(mockTrackStop).toHaveBeenCalledTimes(2);
      expect(audioCapture.audioContext.close).toHaveBeenCalled();
      expect(audioCapture.capturedChunks).toEqual([]);
    });
  });

  describe('pause and resume', () => {
    it('should set isPaused to true when paused', () => {
      const audioCapture = new AudioCapture();
      audioCapture.pause();
      expect(audioCapture.isPaused).toBe(true);
    });

    it('should set isPaused to false when resumed', () => {
      const audioCapture = new AudioCapture();
      audioCapture.isPaused = true;
      audioCapture.resume();
      expect(audioCapture.isPaused).toBe(false);
    });
  });

  describe('selectAudioInput', () => {
    it('should throw an error if attempting to change input while capturing', async () => {
      const audioCapture = new AudioCapture();
      audioCapture.isCapturing = true;
      await expect(audioCapture.selectAudioInput('device-id')).rejects.toThrow('Cannot change audio input while capturing');
    });
  });

  test('selectAudioInput should set up new mic stream with correct constraints', async () => {
    const mockStream = { id: 'mock-stream' };
    mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);
  
    const audioCapture = new AudioCapture();
    await audioCapture.selectAudioInput('audio1');
  
    expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'audio1' },
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    });
  });
  
  describe('getAudioInputs', () => {
    it('should return only audio input devices', async () => {
      const mockDevices = [
        { kind: 'audioinput', deviceId: 'audio1' },
        { kind: 'videoinput', deviceId: 'video1' },
        { kind: 'audioinput', deviceId: 'audio2' },
      ];
      mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);

      const audioCapture = new AudioCapture();
      const result = await audioCapture.getAudioInputs();
    
      expect(result).toEqual([
        { kind: 'audioinput', deviceId: 'audio1' },
        { kind: 'audioinput', deviceId: 'audio2' },
      ]);
    });
  });

  describe('setAudioLevelCallback', () => {
    it('should set the audio level callback', () => {
      const audioCapture = new AudioCapture();
      const mockCallback = jest.fn();
      audioCapture.setAudioLevelCallback(mockCallback);
      expect(audioCapture.audioLevelCallback).toBe(mockCallback);
    });
  });

  describe('setErrorCallback', () => {
    it('should set the error callback', () => {
      const audioCapture = new AudioCapture();
      const mockCallback = jest.fn();
      audioCapture.setErrorCallback(mockCallback);
      expect(audioCapture.onErrorCallback).toBe(mockCallback);
    });
  });

  describe('getAudioData', () => {
    it('should combine and convert captured chunks to 16-bit PCM', () => {
      const audioCapture = new AudioCapture();
      audioCapture.capturedChunks = [
        { left: new Float32Array([0.5, -0.5]), right: new Float32Array([0.25, -0.25]) },
        { left: new Float32Array([1, -1]), right: new Float32Array([0.75, -0.75]) },
      ];

      const result = audioCapture.getAudioData();

      expect(result).toBeInstanceOf(Int16Array);
      expect(result).toEqual(new Int16Array([
        16383, 8191, -16384, -8192,
        32767, 24575, -32768, -24576
      ]));
    });
  });

  describe('updateConfiguration', () => {
    it('should update options and restart capture if currently capturing', () => {
      const audioCapture = new AudioCapture();
      audioCapture.isCapturing = true;
      audioCapture.stop = jest.fn();
      audioCapture.start = jest.fn();

      audioCapture.updateConfiguration({ sampleRate: 48000, enableNoiseReduction: false });

      expect(audioCapture.options).toEqual({
        sampleRate: 48000,
        bitDepth: 16,
        enableNoiseReduction: false,
        enableEchoCancellation: true,
      });
      expect(audioCapture.stop).toHaveBeenCalled();
      expect(audioCapture.start).toHaveBeenCalled();
    });

    it('should update options without restarting if not currently capturing', () => {
      const audioCapture = new AudioCapture();
      audioCapture.isCapturing = false;
      audioCapture.stop = jest.fn();
      audioCapture.start = jest.fn();

      audioCapture.updateConfiguration({ bitDepth: 24 });

      expect(audioCapture.options).toEqual({
        sampleRate: 44100,
        bitDepth: 24,
        enableNoiseReduction: true,
        enableEchoCancellation: true,
      });
      expect(audioCapture.stop).not.toHaveBeenCalled();
      expect(audioCapture.start).not.toHaveBeenCalled();
    });
  });

  describe('createMediaStreamSource', () => {
    it('should create a media stream source', async () => {
      const audioCapture = new AudioCapture();
      const mockStream = { id: 'mock-stream' };
      const mockCreateMediaStreamSource = jest.fn().mockReturnValue({});
      
      global.navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue(mockStream);
      audioCapture.audioContext = {
        createMediaStreamSource: mockCreateMediaStreamSource
      };
  
      await audioCapture.createMediaStreamSource();
  
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(mockCreateMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(audioCapture.sourceNode).toBeDefined();
    });

    it('should handle errors when creating media stream source', async () => {
      const audioCapture = new AudioCapture();
      await audioCapture.setupAudioContext();

      const mockError = new Error('getUserMedia error');
      mockMediaDevices.getUserMedia.mockRejectedValue(mockError);

      const mockHandleError = jest.spyOn(audioCapture, 'handleError').mockImplementation();

      await expect(audioCapture.createMediaStreamSource()).rejects.toThrow('getUserMedia error');
      expect(mockHandleError).toHaveBeenCalledWith(mockError);
    });
  });
});