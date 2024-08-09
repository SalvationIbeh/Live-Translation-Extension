// tests/unit/src/lib/translationpipeline.test.js


import { jest } from '@jest/globals';
import TranslationPipeline from '../../../../src/lib/translationPipeline';
import AudioCapture from '../../../../src/lib/audioCapture';
import SpeechToText from '../../../../src/lib/speechToText';
import Translation from '../../../../src/lib/translation';

jest.mock('../../../../src/lib/audioCapture');
jest.mock('../../../../src/lib/speechToText');
jest.mock('../../../../src/lib/translation');

describe('TranslationPipeline', () => {
  let translationPipeline;
  let mockAudioCapture;
  let mockSpeechToText;
  let mockTranslation;

  beforeEach(() => {
    mockAudioCapture = {
      start: jest.fn(),
      stop: jest.fn(),
      setAudioLevelCallback: jest.fn(),
    };

    mockSpeechToText = {
      start: jest.fn(),
      stop: jest.fn(),
      setOnResultCallback: jest.fn(),
    };

    mockTranslation = {
      translate: jest.fn(),
      setSourceLanguage: jest.fn(),
      setTargetLanguage: jest.fn(),
    };

    AudioCapture.mockImplementation(() => mockAudioCapture);
    SpeechToText.mockImplementation(() => mockSpeechToText);
    Translation.mockImplementation(() => mockTranslation);

    translationPipeline = new TranslationPipeline();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('constructor initializes with default options', () => {
    expect(translationPipeline.isRunning).toBe(false);
    expect(translationPipeline.onTranslatedTextCallback).toBeNull();
  });

  test('start method initializes components and sets callbacks', () => {
    translationPipeline.start();

    expect(translationPipeline.isRunning).toBe(true);
    expect(mockAudioCapture.start).toHaveBeenCalled();
    expect(mockAudioCapture.setAudioLevelCallback).toHaveBeenCalled();
    expect(mockSpeechToText.setOnResultCallback).toHaveBeenCalled();
    expect(mockSpeechToText.start).toHaveBeenCalled();
  });

  test('start method does not reinitialize if already running', () => {
    translationPipeline.isRunning = true;
    translationPipeline.start();

    expect(mockAudioCapture.start).not.toHaveBeenCalled();
    expect(mockSpeechToText.start).not.toHaveBeenCalled();
  });

  test('stop method stops components and updates state', () => {
    translationPipeline.isRunning = true;
    translationPipeline.stop();

    expect(translationPipeline.isRunning).toBe(false);
    expect(mockAudioCapture.stop).toHaveBeenCalled();
    expect(mockSpeechToText.stop).toHaveBeenCalled();
  });

  test('stop method does nothing if not running', () => {
    translationPipeline.isRunning = false;
    translationPipeline.stop();

    expect(mockAudioCapture.stop).not.toHaveBeenCalled();
    expect(mockSpeechToText.stop).not.toHaveBeenCalled();
  });

  test('setOnTranslatedTextCallback sets callback correctly', () => {
    const mockCallback = jest.fn();
    translationPipeline.setOnTranslatedTextCallback(mockCallback);

    expect(translationPipeline.onTranslatedTextCallback).toBe(mockCallback);
  });

  test('setSourceLanguage calls translation.setSourceLanguage', () => {
    translationPipeline.setSourceLanguage('fr');

    expect(mockTranslation.setSourceLanguage).toHaveBeenCalledWith('fr');
  });

  test('setTargetLanguage calls translation.setTargetLanguage', () => {
    translationPipeline.setTargetLanguage('es');

    expect(mockTranslation.setTargetLanguage).toHaveBeenCalledWith('es');
  });

  test('speech-to-text callback triggers translation and onTranslatedTextCallback', async () => {
    const mockTranslatedText = 'Bonjour';
    mockTranslation.translate.mockResolvedValue(mockTranslatedText);

    const mockOnTranslatedTextCallback = jest.fn();
    translationPipeline.setOnTranslatedTextCallback(mockOnTranslatedTextCallback);

    translationPipeline.start();

    // Simulate speech-to-text result
    const speechToTextCallback = mockSpeechToText.setOnResultCallback.mock.calls[0][0];
    await speechToTextCallback('Hello', '123', true);

    expect(mockTranslation.translate).toHaveBeenCalledWith('Hello');
    expect(mockOnTranslatedTextCallback).toHaveBeenCalledWith(mockTranslatedText);
  });

  test('speech-to-text callback does not trigger translation for non-final results', async () => {
    translationPipeline.start();

    // Simulate non-final speech-to-text result
    const speechToTextCallback = mockSpeechToText.setOnResultCallback.mock.calls[0][0];
    await speechToTextCallback('Hel', '123', false);

    expect(mockTranslation.translate).not.toHaveBeenCalled();
  });

  test('audio level callback is set correctly', () => {
    translationPipeline.start();

    const audioLevelCallback = mockAudioCapture.setAudioLevelCallback.mock.calls[0][0];
    audioLevelCallback(0.5);

    // Since we don't have a specific assertion for audio level handling,
    // we're just ensuring the callback doesn't throw an error
    expect(audioLevelCallback).not.toThrow();
  });

  test('constructor with custom options', () => {
    const customOptions = {
      audioCapture: { sampleRate: 44100 },
      speechToText: { language: 'en-US' },
      translation: { apiKey: 'custom-api-key' }
    };

    const customPipeline = new TranslationPipeline(customOptions);

    expect(AudioCapture).toHaveBeenCalledWith(customOptions.audioCapture);
    expect(SpeechToText).toHaveBeenCalledWith(customOptions.speechToText);
    expect(Translation).toHaveBeenCalledWith(customOptions.translation);
  });
});