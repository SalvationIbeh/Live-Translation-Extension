// tests/unit/src/lib/textToSpeech.test.js

import { jest } from '@jest/globals';
import TextToSpeech from '../../../../src/lib/textToSpeech';

jest.mock('../../../../src/lib/cacheService', () => {
  return jest.fn().mockImplementation(() => ({
    init: jest.fn().mockResolvedValue(),
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  }));
});

const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('TextToSpeech', () => {
  let textToSpeech;
  let mockSpeechSynthesis;
  let MockSpeechSynthesisUtterance;

  beforeAll(() => {
    mockSpeechSynthesis = {
      getVoices: jest.fn().mockReturnValue([
        { lang: 'en-US', name: 'English Voice' },
        { lang: 'fr-FR', name: 'French Voice' },
      ]),
      speak: jest.fn(),
    };

    MockSpeechSynthesisUtterance = jest.fn().mockImplementation(() => ({
      voice: null,
      rate: 1,
      pitch: 1,
      volume: 1,
    }));

    Object.defineProperty(global, 'window', {
      value: {
        speechSynthesis: mockSpeechSynthesis,
        SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
      },
      writable: true,
    });

    global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  beforeEach(async () => {
    textToSpeech = new TextToSpeech();
    await textToSpeech.init(); // Initialize the TextToSpeech instance
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('init method initializes voices', async () => {
    expect(textToSpeech.voices).toEqual([
      { lang: 'en-US', name: 'English Voice' },
      { lang: 'fr-FR', name: 'French Voice' },
    ]);
  });

  test('setVoice selects correct voice based on language code', () => {
    textToSpeech.setVoice('fr-FR');
    expect(textToSpeech.selectedVoice).toEqual({ lang: 'fr-FR', name: 'French Voice' });
  });

  test('setRate updates the rate value', () => {
    textToSpeech.setRate(1.5);
    expect(textToSpeech.rate).toBe(1.5);
  });

  test('setPitch updates the pitch value', () => {
    textToSpeech.setPitch(0.8);
    expect(textToSpeech.pitch).toBe(0.8);
  });

  test('setVolume updates the volume value', () => {
    textToSpeech.setVolume(0.6);
    expect(textToSpeech.volume).toBe(0.6);
  });

  test('speak method calls Google TTS API and caches result', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ audioContent: 'base64audio' }),
    });
    global.fetch = mockFetch;

    const mockAudio = {
      play: jest.fn(),
    };
    global.Audio = jest.fn(() => mockAudio);

    textToSpeech.cache.get.mockResolvedValue(null); // Simulate cache miss
    await textToSpeech.speak('Hello', 'en-US');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://texttospeech.googleapis.com/v1/text:synthesize',
      expect.any(Object)
    );
    expect(mockAudio.play).toHaveBeenCalled();
    expect(textToSpeech.cache.set).toHaveBeenCalledWith('en-US-Hello', 'base64audio');
  });

  test('speak method falls back to browser TTS on API failure', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('API Error'));
    global.fetch = mockFetch;

    textToSpeech.cache.get.mockResolvedValue(null); // Simulate cache miss
    await textToSpeech.speak('Hello', 'en-US');

    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    expect(MockSpeechSynthesisUtterance).toHaveBeenCalledWith('Hello');
  });
});