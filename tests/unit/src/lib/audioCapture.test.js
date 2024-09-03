// tests/unit/src/lib/audioCapture.test.js

import AudioCapture from '../../../../src/lib/audioCapture';
import mockMediaDevices from '../../../../mocks/navigator.mediaDevices';

// Existing mocks and setup
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
  createScriptProcessor: jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
  destination: {},
};

global.window.AudioContext = jest.fn().mockImplementation(() => mockAudioContext);

describe('AudioCapture', () => {
  let audioCapture;
  let mockQuery;

  beforeEach(() => {
    // Mock navigator.mediaDevices
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue('mockStream'),
      getDisplayMedia: jest.fn().mockResolvedValue('mockDisplayStream'),
      enumerateDevices: jest.fn().mockResolvedValue([])
    };

    // Mock navigator.permissions
    global.navigator.permissions = {
      query: jest.fn().mockResolvedValue({ state: 'granted' })
    };

    // Mock AudioContext
    global.AudioContext = jest.fn().mockImplementation(() => ({
      createMediaStreamSource: jest.fn().mockReturnValue({
        connect: jest.fn()
      }),
      createScriptProcessor: jest.fn().mockReturnValue({
        connect: jest.fn(),
        disconnect: jest.fn()
      }),
      destination: {}
    }));

    // Mock RTCPeerConnection
    global.RTCPeerConnection = jest.fn().mockImplementation(() => ({
      addTrack: jest.fn()
    }));

    audioCapture = new AudioCapture();
    jest.clearAllMocks();
  });

  // Existing tests
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
  
    test('should start capturing if not already capturing', async () => {
      const mockRequestPermissions = jest.spyOn(audioCapture, 'requestPermissions').mockResolvedValue();
      const mockSetupAudioContext = jest.spyOn(audioCapture, 'setupAudioContext').mockResolvedValue();
      const mockCaptureTabAudio = jest.spyOn(audioCapture, 'captureTabAudio').mockResolvedValue();
      const mockCaptureMicAudio = jest.spyOn(audioCapture, 'captureMicAudio').mockResolvedValue();
      const mockSetupAudioProcessing = jest.spyOn(audioCapture, 'setupAudioProcessing').mockImplementation();
      const mockStartVisualization = jest.spyOn(audioCapture, 'startVisualization').mockImplementation();
  
      await audioCapture.start();
  
      expect(audioCapture.isCapturing).toBe(true);
      expect(mockRequestPermissions).toHaveBeenCalled();
      expect(mockSetupAudioContext).toHaveBeenCalled();
      expect(mockCaptureTabAudio).toHaveBeenCalled();
      expect(mockCaptureMicAudio).toHaveBeenCalled();
      expect(mockSetupAudioProcessing).toHaveBeenCalled();
      expect(mockStartVisualization).toHaveBeenCalled();
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
      
      audioCapture.capturedChunks = [{ source: 'tab', left: new Float32Array([0.5, 0.5]), right: new Float32Array([0.5, 0.5]) }];
      
      audioCapture.updateAudioLevel('tab');

      expect(mockCallback).toHaveBeenCalledWith(expect.any(Number), 'tab');
    });
  });

  describe('stop', () => {
    test('should stop all tracks and close audio context when capturing', () => {
      audioCapture.isCapturing = true;
      const mockStop = jest.fn();
      audioCapture.localStream = { getTracks: () => [{ stop: mockStop }] };
      audioCapture.remoteStream = { getTracks: () => [{ stop: mockStop }] };
      audioCapture.tabAudioStream = { getTracks: () => [{ stop: mockStop }] };
      audioCapture.micAudioStream = { getTracks: () => [{ stop: mockStop }] };
      audioCapture.audioContext = { close: jest.fn() };

      audioCapture.stop();

      expect(audioCapture.isCapturing).toBe(false);
      expect(audioCapture.isPaused).toBe(false);
      expect(mockStop).toHaveBeenCalledTimes(4); // Called for each stream
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
    global.navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue(mockStream);
  
    await audioCapture.selectAudioInput('audio1');
  
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
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
      global.navigator.mediaDevices.enumerateDevices = jest.fn().mockResolvedValue(mockDevices);

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
      global.navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(mockError);
      const mockHandleError = jest.spyOn(audioCapture, 'handleError').mockImplementation();

      await expect(audioCapture.createMediaStreamSource()).rejects.toThrow('getUserMedia error');
      expect(mockHandleError).toHaveBeenCalledWith(mockError);
    });
  });

  // New tests for updated functionality
  describe('Dual audio capture', () => {
    test('start method initializes tab and mic audio capture', async () => {
      const mockTabStream = { id: 'mock-tab-stream' };
      const mockMicStream = { id: 'mock-mic-stream' };
      
      global.navigator.mediaDevices.getDisplayMedia = jest.fn().mockResolvedValue(mockTabStream);
      global.navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue(mockMicStream);
      
      jest.spyOn(audioCapture, 'requestPermissions').mockResolvedValue();
      jest.spyOn(audioCapture, 'setupAudioContext').mockResolvedValue();
      jest.spyOn(audioCapture, 'captureTabAudio').mockResolvedValue();
      jest.spyOn(audioCapture, 'captureMicAudio').mockResolvedValue();
      jest.spyOn(audioCapture, 'setupAudioProcessing').mockImplementation();
      jest.spyOn(audioCapture, 'startVisualization').mockImplementation();

      await audioCapture.start();

      expect(audioCapture.isCapturing).toBe(true);
      expect(audioCapture.captureTabAudio).toHaveBeenCalled();
      expect(audioCapture.captureMicAudio).toHaveBeenCalled();
    });

    test('setupAudioProcessing creates separate processors for tab and mic', () => {
      const mockCreateScriptProcessor = jest.fn().mockReturnValue({
        connect: jest.fn(),
        onaudioprocess: null
      });
      audioCapture.audioContext = {
        createScriptProcessor: mockCreateScriptProcessor,
        destination: {}
      };
      audioCapture.tabSource = { connect: jest.fn() };
      audioCapture.micSource = { connect: jest.fn() };

      audioCapture.setupAudioProcessing();

      expect(mockCreateScriptProcessor).toHaveBeenCalledTimes(2);
      expect(audioCapture.tabProcessor).toBeDefined();
      expect(audioCapture.micProcessor).toBeDefined();
    });

    test('handleAudioProcess processes audio from both tab and mic', () => {
      audioCapture.isCapturing = true;
      audioCapture.isPaused = false;
      const mockEvent = { inputBuffer: { getChannelData: jest.fn().mockReturnValue(new Float32Array(4096)) } };
      
      audioCapture.handleAudioProcess(mockEvent, 'tab');
      audioCapture.handleAudioProcess(mockEvent, 'mic');

      expect(audioCapture.capturedChunks).toHaveLength(2);
      expect(audioCapture.capturedChunks[0].source).toBe('tab');
      expect(audioCapture.capturedChunks[1].source).toBe('mic');
    });
  });

  // Add more new tests as needed
});