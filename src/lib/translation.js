// src/lib/translation.js

import CONFIG from '../../config';
import CacheService from './cacheService.js';

class Translation {
  constructor(options = {}) {
    this.apiKey = options.apiKey || CONFIG.TRANSLATION_API_KEY;
    this.baseUrl = 'https://translation.googleapis.com/v3/projects';
    this.projectId = options.projectId || 'your-project-id'; // Replace with your Google Cloud project ID
    this.sourceLang = options.sourceLang || 'auto';
    this.targetLang = options.targetLang || 'en';
    this.cache = new Map();
    this.translationMemory = new Map();
    this.glossary = new Map();
    this.rateLimiter = {
      tokens: 10,
      lastRefill: Date.now(),
      refillRate: 1000, // 1 token per second
    };
    this.cacheService = new CacheService();
    this.cacheService.init().catch(console.error);
    this.testMode = options.testMode || false;
    this.worker = new Worker('translationWorker.js');
    this.workerPromises = new Map();
  }

  async translate(text, options = {}) {
    const cacheKey = `${this.sourceLang}_${this.targetLang}_${text}`;
    const cachedTranslation = await this.cacheService.get(cacheKey);

    if (cachedTranslation) {
      return cachedTranslation;
    }

    return new Promise((resolve, reject) => {
      const id = Date.now().toString();
      this.workerPromises.set(id, { resolve, reject });

      this.worker.onmessage = (event) => {
        const { id, result, error } = event.data;
        const promise = this.workerPromises.get(id);
        if (promise) {
          if (error) {
            promise.reject(new Error(error));
          } else {
            promise.resolve(result);
          }
          this.workerPromises.delete(id);
        }
      };

      this.worker.postMessage({ id, action: 'translate', text, options });
    });
  }

  
  async batchTranslate(texts, options = {}) {
    const batchSize = 100; // Google Translate API limit
    const batches = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
  
    const results = [];
    for (const batch of batches) {
      await this.waitForToken();
      try {
        const response = await this.makeApiCall('translate', {
          q: batch,
          source: this.sourceLang,
          target: this.targetLang,
          format: options.mimeType || 'text/plain',
          key: this.apiKey,
        });
        if (response.data && response.data.translations) {
          results.push(...response.data.translations.map(t => t.translatedText));
        } else {
          throw new Error('Unexpected API response structure');
        }
      } catch (error) {
        console.error('Batch translation error:', error);
        throw error;
      }
    }
  
    return results.slice(0, texts.length); // Ensure we return exactly the number of inputs
  }

   async detectLanguage(text) {
    try {
      const response = await this.makeApiCall('detectLanguage', {
        content: text,
      });
      return response.languages[0].languageCode;
    } catch (error) {
      console.error('Language detection error:', error);
      throw error;
    }
  }

  async makeApiCall(method, params, testDelay = 1000) {
    const url = `${this.baseUrl}/${this.projectId}:${method}`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(params),
    };

    const response = await this.retryWithBackoff(() => fetch(url, options), 3, testDelay);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }
  }

  async waitForToken() {
    if (this.testMode) return; // Skip rate limiting in test mode

    if (this.rateLimiter.tokens < 1) {
      throw new Error('Rate limit exceeded');
    }

    this.rateLimiter.tokens -= 1;
  }

  // Add this method for testing
  _testRefillTokens(amount) {
    this.rateLimiter.tokens = Math.min(10, this.rateLimiter.tokens + amount);
  }

  preProcess(text) {
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    const htmlTags = [];
    const specialChars = [];
    
    // Preserve HTML tags and special characters
    text = text.replace(/<[^>]+>|[0-9]+|[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, match => {
      if (match.startsWith('<')) {
        htmlTags.push(match);
        return `__HTML_TAG_${htmlTags.length - 1}__`;
      } else {
        specialChars.push(match);
        return `__SPECIAL_CHAR_${specialChars.length - 1}__`;
      }
    });
    
    return { text, htmlTags, specialChars };
  }

  postProcess(translatedText, { htmlTags, specialChars }) {
    // Restore HTML tags
    translatedText = translatedText.replace(/__HTML_TAG_(\d+)__/g, (_, index) => htmlTags[parseInt(index)]);
    
    // Restore numbers and special characters
    translatedText = translatedText.replace(/__SPECIAL_CHAR_(\d+)__/g, (_, index) => specialChars[parseInt(index)]);
    
    // Ensure proper capitalization
    translatedText = translatedText.replace(/\.\s+([a-z])/g, (match, letter) => match.toUpperCase());
    
    return translatedText;
  }

  setSourceLanguage(lang) {
    this.sourceLang = lang;
  }

  setTargetLanguage(lang) {
    this.targetLang = lang;
  }

  clearCache() {
    this.cache.clear();
    return this.cacheService.clear();
  }

  addToGlossary(term, translation) {
    this.glossary.set(term.toLowerCase(), translation);
  }

   translateWithGlossary(text) {
    let translatedText = text;
    for (const [term, translation] of this.glossary.entries()) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      translatedText = translatedText.replace(regex, (match) => {
        return match === match.toUpperCase() 
          ? translation.toUpperCase()
          : match[0] === match[0].toUpperCase() 
            ? translation[0].toUpperCase() + translation.slice(1) 
            : translation;
      });
    }
    return translatedText;
  }

  async translateJson(jsonObj) {
    const translatedObj = Array.isArray(jsonObj) ? [] : {};
    for (const [key, value] of Object.entries(jsonObj)) {
      if (typeof value === 'string') {
        translatedObj[key] = await this.translate(value);
      } else if (Array.isArray(value)) {
        translatedObj[key] = await Promise.all(value.map(item => 
          typeof item === 'string' ? this.translate(item) : this.translateJson(item)
        ));
      } else if (typeof value === 'object' && value !== null) {
        translatedObj[key] = await this.translateJson(value);
      } else {
        translatedObj[key] = value;
      }
    }
    return translatedObj;
  }
}

export default Translation;