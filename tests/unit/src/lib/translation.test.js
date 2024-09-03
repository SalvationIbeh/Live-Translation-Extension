// tests/unit/src/lib/translation.test.js


import { jest } from '@jest/globals';
import Translation from '../../../../src/lib/translation';
import CacheService from '../../../../src/lib/cacheService';

jest.mock('../../../../src/lib/cacheService');

// Mock Worker
global.Worker = class {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = null;
  }
  postMessage(msg) {
    // Simulate the worker's response
    if (this.onmessage) {
      this.onmessage({ data: { id: msg.id, result: 'Mocked translation' } });
    }
  }
};

describe('Translation', () => {
  let translation;
  let mockCacheService;

  beforeEach(() => {
  mockCacheService = {
    init: jest.fn().mockResolvedValue(),
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn().mockResolvedValue(),
  };

    CacheService.mockImplementation(() => mockCacheService);

    translation = new Translation({
      apiKey: 'test-api-key',
      projectId: 'test-project-id',
    });

    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('constructor initializes with default values', () => {
    expect(translation.apiKey).toBe('test-api-key');
    expect(translation.projectId).toBe('test-project-id');
    expect(translation.sourceLang).toBe('auto');
    expect(translation.targetLang).toBe('en');
  });

  test('translate method uses cache when available', async () => {
    const cachedTranslation = 'Cached translation';
    mockCacheService.get.mockResolvedValue(cachedTranslation);

    const result = await translation.translate('Hello');

    expect(result).toBe(cachedTranslation);
    expect(mockCacheService.get).toHaveBeenCalledWith('auto_en_Hello');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('translate method calls worker when cache is empty', async () => {
    mockCacheService.get.mockResolvedValue(null);

    const translationPromise = translation.translate('Hello');
    
    // Manually trigger the worker's response
    translation.worker.postMessage({ id: expect.any(String), action: 'translate', text: 'Hello' });

    const result = await translationPromise;

    expect(result).toBe('Mocked translation');
    expect(mockCacheService.get).toHaveBeenCalledWith('auto_en_Hello');
  }, 10000);

  test('translate method handles API errors', async () => {
    mockCacheService.get.mockResolvedValue(null);

    const errorMessage = 'API Error';
    translation.worker.postMessage = jest.fn().mockImplementation(({ id }) => {
      translation.worker.onmessage({ data: { id, error: errorMessage } });
    });

    await expect(translation.translate('Hello')).rejects.toThrow(errorMessage);
  }, 10000);

  test('batchTranslate method handles large batches', async () => {
    const largeBatch = Array(150).fill('Hello');
    translation.makeApiCall = jest.fn().mockResolvedValue({
      data: {
        translations: Array(100).fill({ translatedText: 'Bonjour' }),
      },
    });

    const result = await translation.batchTranslate(largeBatch);

    expect(result.length).toBe(150);
    expect(translation.makeApiCall).toHaveBeenCalledTimes(2);
  });

  test('detectLanguage method', async () => {
    translation.makeApiCall = jest.fn().mockResolvedValue({
      languages: [{ languageCode: 'fr' }],
    });

    const result = await translation.detectLanguage('Bonjour');

    expect(result).toBe('fr');
    expect(translation.makeApiCall).toHaveBeenCalled();
  });

  test('setSourceLanguage and setTargetLanguage methods', () => {
    translation.setSourceLanguage('fr');
    translation.setTargetLanguage('es');

    expect(translation.sourceLang).toBe('fr');
    expect(translation.targetLang).toBe('es');
  });

  test('translateJson method', async () => {
    const jsonObj = {
      greeting: 'Hello',
      nested: {
        farewell: 'Goodbye',
      },
      number: 42,
    };

    // Mock the translate method
    translation.translate = jest.fn().mockImplementation(text => Promise.resolve(`Translated: ${text}`));

    const result = await translation.translateJson(jsonObj);

    expect(result).toEqual({
      greeting: 'Translated: Hello',
      nested: {
        farewell: 'Translated: Goodbye',
      },
      number: 42,
    });
  }, 10000);

  test('translateWithGlossary method', () => {
    translation.addToGlossary('hello', 'hola');
    translation.addToGlossary('world', 'mundo');
    translation.addToGlossary('test', 'prueba');

    const result = translation.translateWithGlossary('Hello, World! This is a test.');

    expect(result).toBe('Hola, Mundo! This is a prueba.');
    expect(translation.translateWithGlossary('HELLO WORLD')).toBe('HOLA MUNDO');
  });

  test('rate limiting', async () => {
    const testTranslation = new Translation({ testMode: false });
    testTranslation.makeApiCall = jest.fn().mockResolvedValue({ data: { translations: [{ translatedText: 'Test' }] } });

    // Use up all tokens
    for (let i = 0; i < 10; i++) {
      await testTranslation.batchTranslate(['Test']);
    }

    // The next call should throw an error
    await expect(testTranslation.batchTranslate(['Test'])).rejects.toThrow('Rate limit exceeded');

    // Refill tokens and try again
    testTranslation._testRefillTokens(5);
    await expect(testTranslation.batchTranslate(['Test'])).resolves.not.toThrow();

    expect(testTranslation.makeApiCall).toHaveBeenCalledTimes(11);
  });

  test('preProcess and postProcess methods', () => {
    const original = '<p>Hello 123!</p>';
    const { text, htmlTags, specialChars } = translation.preProcess(original);
    expect(text).toBe('__HTML_TAG_0__Hello __SPECIAL_CHAR_0____SPECIAL_CHAR_1____HTML_TAG_1__');
    const processed = translation.postProcess(text, { htmlTags, specialChars });
    expect(processed).toBe(original);
  });

  test('clearCache method', async () => {
    await translation.clearCache();
    expect(mockCacheService.clear).toHaveBeenCalled();
  });

  test('batchTranslate method with different batch sizes', async () => {
    const texts = Array(150).fill('Hello');
    translation.makeApiCall = jest.fn().mockResolvedValue({
      data: {
        translations: Array(100).fill({ translatedText: 'Bonjour' }),
      },
    });

    const result = await translation.batchTranslate(texts);

    expect(result.length).toBe(150);
    expect(translation.makeApiCall).toHaveBeenCalledTimes(2);
  });

  test('makeApiCall and retryWithBackoff error handling', async () => {
    const mockFetch = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ result: 'success' }) });

    global.fetch = mockFetch;

    const result = await translation.makeApiCall('test', {}, 0); // Use 0 delay for instant retries

    expect(result).toEqual({ result: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('translateJson with nested objects', async () => {
    const nestedJson = {
      greeting: 'Hello',
      nested: {
        farewell: 'Goodbye',
        deeplyNested: {
          message: 'See you later',
        },
      },
      array: ['One', 'Two', 'Three'],
    };

    translation.translate = jest.fn(text => Promise.resolve(`Translated: ${text}`));

    const result = await translation.translateJson(nestedJson);

    expect(result).toEqual({
      greeting: 'Translated: Hello',
      nested: {
        farewell: 'Translated: Goodbye',
        deeplyNested: {
          message: 'Translated: See you later',
        },
      },
      array: ['Translated: One', 'Translated: Two', 'Translated: Three'],
    });
  });
});