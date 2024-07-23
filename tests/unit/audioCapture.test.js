// src/__tests__/audioCapture.test.js

import AudioCapture from '../../src/lib/audioCapture';

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

describe('AudioCapture', () => {
  let audioCapture;
  let mockQuery;

  beforeEach(() => {
    audioCapture = new AudioCapture();
    jest.clearAllMocks();
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


  // Add more tests for other methods...
});