import SpeechToText from '../../src/lib/speechToText';

// Mock the global SpeechRecognition object
global.SpeechRecognition = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mocked-uuid'),
  }));

describe('SpeechToText', () => {
  let speechToText;

  beforeEach(() => {
    speechToText = new SpeechToText();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      expect(speechToText.recognition.continuous).toBe(true);
      expect(speechToText.recognition.interimResults).toBe(true);
      expect(speechToText.recognition.lang).toBe('en-US');
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        continuous: false,
        interimResults: false,
        lang: 'es-ES'
      };
      speechToText = new SpeechToText(customOptions);
      expect(speechToText.recognition.continuous).toBe(false);
      expect(speechToText.recognition.interimResults).toBe(false);
      expect(speechToText.recognition.lang).toBe('es-ES');
    });
  });

  describe('start method', () => {
    test('should start recognition if not already listening', () => {
      speechToText.start();
      expect(speechToText.recognition.start).toHaveBeenCalled();
      expect(speechToText.isListening).toBe(true);
      expect(speechToText.currentSessionId).toBeTruthy();
    });

    test('should not start recognition if already listening', () => {
      speechToText.isListening = true;
      speechToText.start();
      expect(speechToText.recognition.start).not.toHaveBeenCalled();
    });
  });

  describe('stop method', () => {
    test('should stop recognition if listening', () => {
      speechToText.isListening = true;
      speechToText.stop();
      expect(speechToText.recognition.stop).toHaveBeenCalled();
      expect(speechToText.isListening).toBe(false);
    });

    test('should not stop recognition if not listening', () => {
      speechToText.isListening = false;
      speechToText.stop();
      expect(speechToText.recognition.stop).not.toHaveBeenCalled();
    });
  });

  describe('setLanguage method', () => {
    test('should set language if supported', () => {
      speechToText.setLanguage('fr-FR');
      expect(speechToText.recognition.lang).toBe('fr-FR');
    });

    test('should throw error if language is not supported', () => {
      expect(() => speechToText.setLanguage('invalid-lang')).toThrow('Unsupported language: invalid-lang');
    });
  });

  describe('handleResult method', () => {
    test('should handle final result', () => {
      const mockCallback = jest.fn();
      speechToText.setOnResultCallback(mockCallback);
      speechToText.start(); // This will set the currentSessionId

      
      const mockEvent = {
        results: [
          [{ transcript: 'hello world' }]
        ]
      };
      mockEvent.results[0].isFinal = true;

      speechToText.handleResult(mockEvent);
      expect(mockCallback).toHaveBeenCalledWith('Hello world.', 'mocked-uuid', true);
    });

    test('should handle interim result', () => {
      const mockCallback = jest.fn();
      speechToText.setOnResultCallback(mockCallback);
      speechToText.start(); // This will set the currentSessionId
      
      const mockEvent = {
        results: [
          [{ transcript: 'hello' }]
        ]
      };
      mockEvent.results[0].isFinal = false;

      speechToText.handleResult(mockEvent);
      expect(mockCallback).toHaveBeenCalledWith('hello', 'mocked-uuid', false);
    });
  });

  describe('formatTranscript method', () => {
    test('should capitalize first letter', () => {
      expect(speechToText.formatTranscript('hello world')).toBe('Hello world.');
    });

    test('should add period if missing', () => {
      expect(speechToText.formatTranscript('hello world')).toBe('Hello world.');
    });

    test('should not add period if already present', () => {
      expect(speechToText.formatTranscript('Hello world.')).toBe('Hello world.');
    });

    test('should not add period if ending with exclamation mark', () => {
      expect(speechToText.formatTranscript('Hello world!')).toBe('Hello world!');
    });

    test('should not add period if ending with question mark', () => {
      expect(speechToText.formatTranscript('How are you?')).toBe('How are you?');
    });
  });

  describe('handleError method', () => {
    test('should call error callback if set', () => {
      const mockErrorCallback = jest.fn();
      speechToText.setOnErrorCallback(mockErrorCallback);
      
      speechToText.handleError('test error');
      expect(mockErrorCallback).toHaveBeenCalledWith('test error');
    });

    test('should retry recognition on network error', () => {
      jest.useFakeTimers();
      speechToText.isListening = true;
      speechToText.handleError('network');
      
      jest.advanceTimersByTime(1000);
      expect(speechToText.recognition.stop).toHaveBeenCalled();
      expect(speechToText.recognition.start).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('handleStateChange method', () => {
    test('should call state change callback if set', () => {
      const mockStateChangeCallback = jest.fn();
      speechToText.setOnStateChangeCallback(mockStateChangeCallback);
      
      speechToText.handleStateChange('listening');
      expect(mockStateChangeCallback).toHaveBeenCalledWith('listening');
    });
  });

  describe('Event handlers', () => {
    test('should call handleStateChange on recognition start', () => {
      const handleStateChangeSpy = jest.spyOn(speechToText, 'handleStateChange');
      speechToText.recognition.onstart();
      expect(handleStateChangeSpy).toHaveBeenCalledWith('listening');
    });

    test('should call handleStateChange on recognition end', () => {
      const handleStateChangeSpy = jest.spyOn(speechToText, 'handleStateChange');
      speechToText.recognition.onend();
      expect(handleStateChangeSpy).toHaveBeenCalledWith('stopped');
    });

    test('should call handleError on recognition error', () => {
      const handleErrorSpy = jest.spyOn(speechToText, 'handleError');
      speechToText.recognition.onerror({ error: 'test error' });
      expect(handleErrorSpy).toHaveBeenCalledWith('test error');
    });

    test('should call handleResult on recognition result', () => {
      const handleResultSpy = jest.spyOn(speechToText, 'handleResult');
      const mockEvent = { results: [[{ transcript: 'test' }]] };
      speechToText.recognition.onresult(mockEvent);
      expect(handleResultSpy).toHaveBeenCalledWith(mockEvent);
    });
  });
});