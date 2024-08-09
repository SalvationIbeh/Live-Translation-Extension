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
  }

  async translate(text, options = {}) {
    const cacheKey = `${this.sourceLang}_${this.targetLang}_${text}`;
    const cachedTranslation = await this.cacheService.get(cacheKey);
  
    if (cachedTranslation) {
      return cachedTranslation;
    }
    
    if (this.cache.has(text)) {
      return this.cache.get(text);
    }
  
    await this.waitForToken();
  
    try {
      const { text: cleanedText, htmlTags, specialChars } = this.preProcess(text);
      const detectedLanguage = options.detectLanguage ? await this.detectLanguage(cleanedText) : this.sourceLang;
      
      const response = await this.makeApiCall('translate', {
        q: cleanedText,
        source: detectedLanguage,
        target: this.targetLang,
        format: options.mimeType || 'text/plain',
        key: this.apiKey,
      });
  
      // Check if the response has the expected structure
      if (response.data && response.data.data && response.data.data.translations && response.data.data.translations.length > 0) {
        const translatedText = this.postProcess(response.data.data.translations[0].translatedText, { htmlTags, specialChars });
        this.cache.set(text, translatedText);
        this.translationMemory.set(cleanedText, translatedText);
        await this.cacheService.set(cacheKey, translatedText);
        
        return translatedText;
      } else {
        throw new Error('Unexpected API response structure');
      }
    } catch (error) {
      console.error('Translation error:', error);
      throw error;
    }
  }

  clearCache() {
    return this.cacheService.clear();
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

  async makeApiCall(method, params) {
    const url = `${this.baseUrl}/${this.projectId}:${method}`;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(params),
    };

    const response = await this.retryWithBackoff(() => fetch(url, options));
    
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
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  async waitForToken() {
    if (this.testMode) return; // Skip rate limiting in test mode

    const now = Date.now();
    const timeSinceLastRefill = now - this.rateLimiter.lastRefill;
    this.rateLimiter.tokens = Math.min(10, this.rateLimiter.tokens + timeSinceLastRefill / this.rateLimiter.refillRate);
    this.rateLimiter.lastRefill = now;

    if (this.rateLimiter.tokens < 1) {
      const waitTime = (1 - this.rateLimiter.tokens) * this.rateLimiter.refillRate;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForToken();
    }

    this.rateLimiter.tokens -= 1;
  }

  preProcess(text) {
    // Implement text cleaning logic here
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Preserve HTML tags
    const htmlTags = [];
    text = text.replace(/<[^>]+>/g, match => {
      htmlTags.push(match);
      return `__HTML_TAG_${htmlTags.length - 1}__`;
    });
    
    // Preserve numbers and special characters
    const specialChars = [];
    text = text.replace(/[0-9]+|[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g, match => {
      specialChars.push(match);
      return `__SPECIAL_CHAR_${specialChars.length - 1}__`;
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
  }

  addToGlossary(term, translation) {
    this.glossary.set(term.toLowerCase(), translation);
  }

   translateWithGlossary(text) {
    let translatedText = text;
    for (const [term, translation] of this.glossary.entries()) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      translatedText = translatedText.replace(regex, (match) => {
        return match[0] === match[0].toUpperCase() 
          ? translation[0].toUpperCase() + translation.slice(1) 
          : translation;
      });
    }
    return translatedText;
  }

  async translateJson(jsonObj) {
    const translatedObj = {};
    for (const [key, value] of Object.entries(jsonObj)) {
      if (typeof value === 'string') {
        translatedObj[key] = await this.translate(value);
      } else if (typeof value === 'object') {
        translatedObj[key] = await this.translateJson(value);
      } else {
        translatedObj[key] = value;
      }
    }
    return translatedObj;
  }
}

export default Translation;