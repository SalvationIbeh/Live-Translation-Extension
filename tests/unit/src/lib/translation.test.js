// tests/unit/src/lib/translation.test.js


import { jest } from '@jest/globals';
import Translation from '../../../../src/lib/translation';
import CacheService from '../../../../src/lib/cacheService';

jest.mock('../../../../src/lib/cacheService');

describe('Translation', () => {
  let translation;
  let mockCacheService;

  beforeEach(() => {
    mockCacheService = {
      init: jest.fn().mockResolvedValue(),
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
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

  
  test('translate method calls API when cache is empty', async () => {
    mockCacheService.get.mockResolvedValue(null);
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          data: {
            translations: [{ translatedText: 'Bonjour' }]
          }
        }
      }),
    });
  
    const result = await translation.translate('Hello');
  
    expect(result).toBe('Bonjour');
    expect(global.fetch).toHaveBeenCalled();
    expect(mockCacheService.set).toHaveBeenCalledWith('auto_en_Hello', 'Bonjour');
  });

  test('translate method handles API errors', async () => {
    mockCacheService.get.mockResolvedValue(null);
    global.fetch.mockRejectedValue(new Error('API Error'));

    await expect(translation.translate('Hello')).rejects.toThrow('API Error');
  });

  test('batchTranslate method handles large batches', async () => {
    const largeBatch = Array(150).fill('Hello');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: {
          translations: Array(100).fill({ translatedText: 'Bonjour' }),
        },
      }),
    }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: {
          translations: Array(50).fill({ translatedText: 'Bonjour' }),
        },
      }),
    });
  
    const result = await translation.batchTranslate(largeBatch);
  
    expect(result.length).toBe(150);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

   test('detectLanguage method', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        languages: [{ languageCode: 'fr' }],
      }),
    });

    const result = await translation.detectLanguage('Bonjour');

    expect(result).toBe('fr');
    expect(global.fetch).toHaveBeenCalled();
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

    translation.translate = jest.fn()
      .mockResolvedValueOnce('Bonjour')
      .mockResolvedValueOnce('Au revoir');

    const result = await translation.translateJson(jsonObj);

    expect(result).toEqual({
      greeting: 'Bonjour',
      nested: {
        farewell: 'Au revoir',
      },
      number: 42,
    });
    expect(translation.translate).toHaveBeenCalledTimes(2);
  });

  test('translateWithGlossary method', () => {
    translation.addToGlossary('hello', 'hola');
    translation.addToGlossary('world', 'mundo');

    const result = translation.translateWithGlossary('Hello, World!');

    expect(result).toBe('Hola, Mundo!');
  });


  test('rateLimiting', async () => {
    const testTranslation = new Translation({ testMode: true });

    jest.useFakeTimers();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: {
          data: {
            translations: [{ translatedText: 'Bonjour' }]
          }
        }
      }),
    });
  
    mockCacheService.get.mockResolvedValue(null);
  
    const promises = Array(15).fill().map(() => testTranslation.translate('Hello'));
  
    await Promise.all(promises);
  
    expect(global.fetch).toHaveBeenCalledTimes(15);
   }); 
});