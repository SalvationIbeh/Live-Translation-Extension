// tests/unit/src/lib/translationPipeline.test.js

import { jest } from '@jest/globals';
import TranslationPipeline from '../../../../src/lib/translationPipeline';
import AudioCapture from '../../../../src/lib/audioCapture';
import SpeechToText from '../../../../src/lib/speechToText';
import Translation from '../../../../src/lib/translation';
import TextToSpeech from '../../../../src/lib/textToSpeech';

// Mock dependencies
jest.mock('../../../../src/lib/audioCapture');
jest.mock('../../../../src/lib/speechToText');
jest.mock('../../../../src/lib/translation');
jest.mock('../../../../src/lib/textToSpeech');

describe('TranslationPipeline', () => {
  let translationPipeline;
  let mockAudioCapture;
  let mockLocalSpeechToText;
  let mockRemoteSpeechToText;
  let mockLocalToRemoteTranslation;
  let mockRemoteToLocalTranslation;
  let mockLocalTextToSpeech;
  let mockRemoteTextToSpeech;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock instances
    mockAudioCapture = {
      start: jest.fn(),
      stop: jest.fn(),
      setAudioLevelCallback: jest.fn(),
      setAudioDataCallback: jest.fn(),
    };

    mockLocalSpeechToText = {
      start: jest.fn(),
      stop: jest.fn(),
      processAudio: jest.fn(),
      setLanguage: jest.fn(),
    };

    mockRemoteSpeechToText = {
      start: jest.fn(),
      stop: jest.fn(),
      processAudio: jest.fn(),
      setLanguage: jest.fn(),
    };

    mockLocalToRemoteTranslation = {
      setSourceLanguage: jest.fn(),
      setTargetLanguage: jest.fn(),
      getTargetLanguage: jest.fn(),
    };

    mockRemoteToLocalTranslation = {
      setSourceLanguage: jest.fn(),
      setTargetLanguage: jest.fn(),
      getTargetLanguage: jest.fn(),
    };

    mockLocalTextToSpeech = {
      init: jest.fn(),
      speak: jest.fn(),
      setVoice: jest.fn(),
      setRate: jest.fn(),
      setPitch: jest.fn(),
      setVolume: jest.fn(),
    };

    mockRemoteTextToSpeech = {
      init: jest.fn(),
      speak: jest.fn(),
      setVoice: jest.fn(),
      setRate: jest.fn(),
      setPitch: jest.fn(),
      setVolume: jest.fn(),
    };

    // Set up mock implementations
    AudioCapture.mockImplementation(() => mockAudioCapture);
    SpeechToText.mockImplementationOnce(() => mockLocalSpeechToText)
                 .mockImplementationOnce(() => mockRemoteSpeechToText);
    Translation.mockImplementationOnce(() => mockLocalToRemoteTranslation)
                .mockImplementationOnce(() => mockRemoteToLocalTranslation);
    TextToSpeech.mockImplementationOnce(() => mockLocalTextToSpeech)
                .mockImplementationOnce(() => mockRemoteTextToSpeech);

    // Create TranslationPipeline instance
    translationPipeline = new TranslationPipeline();
  });

  test('constructor initializes with default options', () => {
    expect(translationPipeline.isRunning).toBe(false);
    expect(translationPipeline.onLocalTranslatedTextCallback).toBeNull();
    expect(translationPipeline.onRemoteTranslatedTextCallback).toBeNull();
    expect(translationPipeline.onLocalSpokenTranslationCallback).toBeNull();
    expect(translationPipeline.onRemoteSpokenTranslationCallback).toBeNull();
  });

  test('start method initializes components and sets up callbacks', async () => {
    await translationPipeline.start();

    expect(translationPipeline.isRunning).toBe(true);
    expect(mockLocalTextToSpeech.init).toHaveBeenCalled();
    expect(mockRemoteTextToSpeech.init).toHaveBeenCalled();
    expect(mockAudioCapture.start).toHaveBeenCalled();
    expect(mockAudioCapture.setAudioLevelCallback).toHaveBeenCalled();
    expect(mockAudioCapture.setAudioDataCallback).toHaveBeenCalled();
    expect(mockLocalSpeechToText.start).toHaveBeenCalled();
    expect(mockRemoteSpeechToText.start).toHaveBeenCalled();
  });

  test('start method does not reinitialize if already running', async () => {
    translationPipeline.isRunning = true;
    await translationPipeline.start();

    expect(mockAudioCapture.start).not.toHaveBeenCalled();
    expect(mockLocalSpeechToText.start).not.toHaveBeenCalled();
    expect(mockRemoteSpeechToText.start).not.toHaveBeenCalled();
  });

  test('start method handles errors and sets isRunning to false', async () => {
    mockAudioCapture.start.mockRejectedValue(new Error('Test error'));

    await expect(translationPipeline.start()).rejects.toThrow('Failed to start translation pipeline: Test error');
    expect(translationPipeline.isRunning).toBe(false);
  });

  test('stop method stops components and updates state', () => {
    translationPipeline.isRunning = true;
    translationPipeline.stop();

    expect(translationPipeline.isRunning).toBe(false);
    expect(mockAudioCapture.stop).toHaveBeenCalled();
    expect(mockLocalSpeechToText.stop).toHaveBeenCalled();
    expect(mockRemoteSpeechToText.stop).toHaveBeenCalled();
  });

  test('stop method does nothing if not running', () => {
    translationPipeline.isRunning = false;
    translationPipeline.stop();

    expect(mockAudioCapture.stop).not.toHaveBeenCalled();
    expect(mockLocalSpeechToText.stop).not.toHaveBeenCalled();
    expect(mockRemoteSpeechToText.stop).not.toHaveBeenCalled();
  });

  test('setOnLocalTranslatedTextCallback sets callback correctly', () => {
    const mockCallback = jest.fn();
    translationPipeline.setOnLocalTranslatedTextCallback(mockCallback);
    expect(translationPipeline.onLocalTranslatedTextCallback).toBe(mockCallback);
  });

  test('setOnRemoteTranslatedTextCallback sets callback correctly', () => {
    const mockCallback = jest.fn();
    translationPipeline.setOnRemoteTranslatedTextCallback(mockCallback);
    expect(translationPipeline.onRemoteTranslatedTextCallback).toBe(mockCallback);
  });

  test('setOnLocalSpokenTranslationCallback sets callback correctly', () => {
    const mockCallback = jest.fn();
    translationPipeline.setOnLocalSpokenTranslationCallback(mockCallback);
    expect(translationPipeline.onLocalSpokenTranslationCallback).toBe(mockCallback);
  });

  test('setOnRemoteSpokenTranslationCallback sets callback correctly', () => {
    const mockCallback = jest.fn();
    translationPipeline.setOnRemoteSpokenTranslationCallback(mockCallback);
    expect(translationPipeline.onRemoteSpokenTranslationCallback).toBe(mockCallback);
  });

  test('setLocalLanguage updates language settings for local components', () => {
    translationPipeline.setLocalLanguage('en');
    expect(mockLocalToRemoteTranslation.setSourceLanguage).toHaveBeenCalledWith('en');
    expect(mockRemoteToLocalTranslation.setTargetLanguage).toHaveBeenCalledWith('en');
    expect(mockLocalSpeechToText.setLanguage).toHaveBeenCalledWith('en');
    expect(mockLocalTextToSpeech.setVoice).toHaveBeenCalledWith('en');
  });

  test('setRemoteLanguage updates language settings for remote components', () => {
    translationPipeline.setRemoteLanguage('fr');
    expect(mockLocalToRemoteTranslation.setTargetLanguage).toHaveBeenCalledWith('fr');
    expect(mockRemoteToLocalTranslation.setSourceLanguage).toHaveBeenCalledWith('fr');
    expect(mockRemoteSpeechToText.setLanguage).toHaveBeenCalledWith('fr');
    expect(mockRemoteTextToSpeech.setVoice).toHaveBeenCalledWith('fr');
  });

  test('speakTranslation calls local text-to-speech and callback for local target', async () => {
    const mockCallback = jest.fn();
    translationPipeline.setOnLocalSpokenTranslationCallback(mockCallback);
    mockRemoteToLocalTranslation.getTargetLanguage.mockReturnValue('en');

    await translationPipeline.speakTranslation('Hello', 'local');

    expect(mockLocalTextToSpeech.speak).toHaveBeenCalledWith('Hello', 'en');
    expect(mockCallback).toHaveBeenCalledWith('Hello');
  });

  test('speakTranslation calls remote text-to-speech and callback for remote target', async () => {
    const mockCallback = jest.fn();
    translationPipeline.setOnRemoteSpokenTranslationCallback(mockCallback);
    mockLocalToRemoteTranslation.getTargetLanguage.mockReturnValue('fr');

    await translationPipeline.speakTranslation('Bonjour', 'remote');

    expect(mockRemoteTextToSpeech.speak).toHaveBeenCalledWith('Bonjour', 'fr');
    expect(mockCallback).toHaveBeenCalledWith('Bonjour');
  });

  test('setLocalTTSRate updates local text-to-speech rate', () => {
    translationPipeline.setLocalTTSRate(1.5);
    expect(mockLocalTextToSpeech.setRate).toHaveBeenCalledWith(1.5);
  });

  test('setRemoteTTSRate updates remote text-to-speech rate', () => {
    translationPipeline.setRemoteTTSRate(0.8);
    expect(mockRemoteTextToSpeech.setRate).toHaveBeenCalledWith(0.8);
  });

  test('setLocalTTSPitch updates local text-to-speech pitch', () => {
    translationPipeline.setLocalTTSPitch(1.2);
    expect(mockLocalTextToSpeech.setPitch).toHaveBeenCalledWith(1.2);
  });

  test('setRemoteTTSPitch updates remote text-to-speech pitch', () => {
    translationPipeline.setRemoteTTSPitch(0.9);
    expect(mockRemoteTextToSpeech.setPitch).toHaveBeenCalledWith(0.9);
  });

  test('setLocalTTSVolume updates local text-to-speech volume', () => {
    translationPipeline.setLocalTTSVolume(0.7);
    expect(mockLocalTextToSpeech.setVolume).toHaveBeenCalledWith(0.7);
  });

  test('setRemoteTTSVolume updates remote text-to-speech volume', () => {
    translationPipeline.setRemoteTTSVolume(0.6);
    expect(mockRemoteTextToSpeech.setVolume).toHaveBeenCalledWith(0.6);
  });
});