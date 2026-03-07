import { Filter } from 'bad-words';
import { storage } from '../storage';
import { ContentFilterSettings, BannedWord } from '@shared/schema';

export interface ContentValidationResult {
  isValid: boolean;
  filteredContent?: string;
  errors: string[];
  detectedWords?: string[];
}

export interface ContentFilterConfig {
  fieldName: string;
  maxLength?: number;
  isEnabled?: boolean;
  allowProfanity?: boolean;
  cleanAutomatically?: boolean;
}

export class ContentFilterService {
  private filter: Filter;
  private customWords: Set<string> = new Set();
  private filterSettings: Map<string, ContentFilterSettings> = new Map();
  private lastUpdated: Date = new Date(0);

  constructor() {
    this.filter = new Filter();
    // Initialize asynchronously
    this.initializeFilter().catch(error => {
      console.error('Content Filter: Failed to initialize:', error);
    });
  }

  private async initializeFilter(): Promise<void> {
    try {
      // Load custom banned words from database
      const bannedWords = await storage.getActiveBannedWords();
      console.log('Content Filter: Loaded banned words from database:', bannedWords.map(w => w.word));
      
      this.customWords = new Set(bannedWords.map(w => w.word.toLowerCase()));
      
      // Add custom words to the filter
      if (this.customWords.size > 0) {
        this.filter.addWords(...Array.from(this.customWords));
        console.log('Content Filter: Added custom words to filter:', Array.from(this.customWords));
      }

      // Load filter settings
      const settings = await storage.getContentFilterSettings();
      this.filterSettings = new Map(settings.map(s => [s.fieldName, s]));
      
      // Initialize default settings if none exist or ensure critical fields exist
      await this.ensureDefaultSettings();
      
      this.lastUpdated = new Date();
      console.log('Content Filter: Initialization complete');
    } catch (error) {
      console.error('Failed to initialize content filter:', error);
      // Initialize with default settings if database is unavailable
      this.initializeDefaultSettings();
    }
  }

  private initializeDefaultSettings(): void {
    const defaultSettings: ContentFilterConfig[] = [
      { fieldName: 'displayName', maxLength: 50, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'username', maxLength: 30, isEnabled: true, allowProfanity: false, cleanAutomatically: false },
      { fieldName: 'bio', maxLength: 500, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'title', maxLength: 100, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'description', maxLength: 1000, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'comment', maxLength: 1000, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'message', maxLength: 2000, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'gameTitle', maxLength: 200, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
    ];

    for (const config of defaultSettings) {
      this.filterSettings.set(config.fieldName, {
        id: 0,
        fieldName: config.fieldName,
        isEnabled: config.isEnabled ?? true,
        maxLength: config.maxLength ?? null,
        allowProfanity: config.allowProfanity ?? false,
        cleanAutomatically: config.cleanAutomatically ?? false,
        updatedBy: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      });
    }
  }

  private async ensureDefaultSettings(): Promise<void> {
    const defaultSettings: ContentFilterConfig[] = [
      { fieldName: 'displayName', maxLength: 50, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'username', maxLength: 30, isEnabled: true, allowProfanity: false, cleanAutomatically: false },
      { fieldName: 'bio', maxLength: 500, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'title', maxLength: 100, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'description', maxLength: 1000, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'comment', maxLength: 1000, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'message', maxLength: 2000, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
      { fieldName: 'gameTitle', maxLength: 200, isEnabled: true, allowProfanity: false, cleanAutomatically: true },
    ];

    try {
      for (const config of defaultSettings) {
        if (!this.filterSettings.has(config.fieldName)) {
          console.log(`Content Filter: Creating missing settings for field "${config.fieldName}"`);
          
          // Create the setting in the database
          const created = await storage.createContentFilterSettings({
            fieldName: config.fieldName,
            isEnabled: config.isEnabled ?? true,
            maxLength: config.maxLength,
            allowProfanity: config.allowProfanity ?? false,
            cleanAutomatically: config.cleanAutomatically ?? false,
            updatedBy: null
          });

          // Update local cache
          this.filterSettings.set(config.fieldName, created);
          console.log(`Content Filter: Created settings for "${config.fieldName}":`, created);
        }
      }
    } catch (error) {
      console.error('Content Filter: Failed to create default settings in database:', error);
      // Fallback to in-memory settings
      this.initializeDefaultSettings();
    }
  }

  private async refreshCache(): Promise<void> {
    const now = new Date();
    // Refresh cache every 5 minutes
    if (now.getTime() - this.lastUpdated.getTime() > 5 * 60 * 1000) {
      await this.initializeFilter();
    }
  }

  async validateContent(content: string, fieldName: string): Promise<ContentValidationResult> {
    try {
      // Ensure we have fresh data
      await this.refreshCache();
      
      console.log(`Content Filter: Validating content for field "${fieldName}": "${content}"`);
      
      const settings = this.filterSettings.get(fieldName);
      console.log(`Content Filter: Settings for field "${fieldName}":`, settings);
      
      const result: ContentValidationResult = {
        isValid: true,
        errors: [],
        detectedWords: []
      };

      if (!content || typeof content !== 'string') {
        result.isValid = false;
        result.errors.push('Content cannot be empty');
        return result;
      }

      // Check if filtering is enabled for this field
      if (!settings?.isEnabled) {
        console.log(`Content Filter: Filtering disabled for field "${fieldName}"`);
        return result;
      }

      // Check length limit
      if (settings.maxLength && content.length > settings.maxLength) {
        result.isValid = false;
        result.errors.push(`Content exceeds maximum length of ${settings.maxLength} characters`);
      }

      // Check for profanity if not allowed
      if (!settings.allowProfanity) {
        const detectedProfanity = this.detectProfanity(content);
        
        if (detectedProfanity.length > 0) {
          result.detectedWords = detectedProfanity;
          
          if (settings.cleanAutomatically) {
            // Clean the content automatically
            result.filteredContent = this.filter.clean(content);
            console.log(`Content Filter: Cleaned content: "${result.filteredContent}"`);
          } else {
            // Reject the content
            result.isValid = false;
            result.errors.push('Content contains inappropriate language');
            console.log(`Content Filter: Rejected content due to profanity`);
          }
        }
      }

      console.log(`Content Filter: Validation result:`, result);
      return result;
    } catch (error) {
      console.error('Content Filter: Error during validation:', error);
      throw error;
    }
  }

  private detectProfanity(content: string): string[] {
    const contentLower = content.toLowerCase();
    const words = contentLower.split(/\s+/);
    const detectedWords: string[] = [];
    
    console.log('Content Filter: Checking content:', content);
    console.log('Content Filter: Available custom words:', Array.from(this.customWords));
    console.log('Content Filter: Content words:', words);

    // Check each word for exact matches and embedded banned words
    for (const word of words) {
      // Clean the word of punctuation
      const cleanWord = word.replace(/[^\w]/g, '');
      
      // Check against bad-words library (exact word match)
      if (this.filter.isProfane(word) || this.filter.isProfane(cleanWord)) {
        detectedWords.push(word);
        console.log('Content Filter: Detected bad-words library profanity:', word);
      }
      
      // Check against custom banned words (exact word match)
      if (this.customWords.has(word) || this.customWords.has(cleanWord)) {
        detectedWords.push(word);
        console.log('Content Filter: Detected custom banned word (exact):', word);
      }
      
      // Check if any banned words are embedded within this word
      for (const bannedWord of this.customWords) {
        if (bannedWord.length >= 3 && (word.includes(bannedWord) || cleanWord.includes(bannedWord))) {
          detectedWords.push(word);
          console.log('Content Filter: Detected embedded banned word:', bannedWord, 'in word:', word);
        }
      }
    }

    // Also check the entire content string for embedded banned words across word boundaries
    for (const bannedWord of this.customWords) {
      if (bannedWord.length >= 3 && contentLower.includes(bannedWord)) {
        // Only add if not already detected
        if (!detectedWords.some(detected => detected.includes(bannedWord))) {
          detectedWords.push(bannedWord);
          console.log('Content Filter: Detected banned word in full content:', bannedWord);
        }
      }
    }

    // Check with bad-words library for the entire content
    if (this.filter.isProfane(contentLower)) {
      // Extract the specific profane words detected by bad-words
      const badWordsDetected = this.extractBadWords(contentLower);
      for (const badWord of badWordsDetected) {
        if (!detectedWords.includes(badWord)) {
          detectedWords.push(badWord);
          console.log('Content Filter: Detected bad-words library profanity in content:', badWord);
        }
      }
    }

    console.log('Content Filter: Total detected words:', detectedWords);
    return detectedWords;
  }

  private extractBadWords(content: string): string[] {
    const detected: string[] = [];
    const words = content.split(/\s+/);
    
    // Check each word and common variations
    for (const word of words) {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (this.filter.isProfane(word)) {
        detected.push(word);
      } else if (this.filter.isProfane(cleanWord)) {
        detected.push(cleanWord);
      }
    }
    
    // Also check for embedded profanity within words
    const commonProfanity = ['fuck', 'shit', 'damn', 'cunt', 'dick', 'cock', 'pussy', 'bitch', 'ass', 'hell'];
    for (const profanity of commonProfanity) {
      if (content.includes(profanity) && this.filter.isProfane(profanity)) {
        detected.push(profanity);
      }
    }
    
    return detected;
  }

  async cleanContent(content: string): Promise<string> {
    await this.refreshCache();
    return this.filter.clean(content);
  }

  async isProfane(content: string): Promise<boolean> {
    await this.refreshCache();
    return this.filter.isProfane(content) || this.hasCustomProfanity(content);
  }

  private hasCustomProfanity(content: string): boolean {
    const words = content.toLowerCase().split(/\s+/);
    return words.some(word => this.customWords.has(word));
  }

  // Admin methods for managing banned words
  async addBannedWord(word: string, addedBy: number, reason?: string): Promise<BannedWord> {
    const bannedWord = await storage.addBannedWord({
      word: word.toLowerCase(),
      isActive: true,
      addedBy,
      reason
    });

    // Update local cache
    this.customWords.add(word.toLowerCase());
    this.filter.addWords(word.toLowerCase());

    return bannedWord;
  }

  async removeBannedWord(word: string): Promise<boolean> {
    const success = await storage.removeBannedWord(word.toLowerCase());
    
    if (success) {
      // Update local cache
      this.customWords.delete(word.toLowerCase());
      this.filter.removeWords(word.toLowerCase());
    }

    return success;
  }

  async deactivateBannedWord(word: string): Promise<boolean> {
    const success = await storage.deactivateBannedWord(word.toLowerCase());
    
    if (success) {
      // Update local cache
      this.customWords.delete(word.toLowerCase());
      this.filter.removeWords(word.toLowerCase());
    }

    return success;
  }

  async reactivateBannedWord(word: string): Promise<boolean> {
    const success = await storage.reactivateBannedWord(word.toLowerCase());
    
    if (success) {
      // Update local cache
      this.customWords.add(word.toLowerCase());
      this.filter.addWords(word.toLowerCase());
    }

    return success;
  }

  async getAllBannedWords(): Promise<BannedWord[]> {
    return await storage.getAllBannedWords();
  }

  async getActiveBannedWords(): Promise<BannedWord[]> {
    return await storage.getActiveBannedWords();
  }

  // Admin methods for managing filter settings
  async updateFilterSettings(fieldName: string, settings: Partial<ContentFilterSettings>, updatedBy: number): Promise<ContentFilterSettings | undefined> {
    const updated = await storage.updateContentFilterSettings(fieldName, {
      ...settings,
      updatedBy
    });

    if (updated) {
      // Update local cache
      this.filterSettings.set(fieldName, updated);
    }

    return updated;
  }

  async getFilterSettings(fieldName?: string): Promise<ContentFilterSettings[]> {
    return await storage.getContentFilterSettings(fieldName);
  }

  async createFilterSettings(fieldName: string, settings: Partial<ContentFilterSettings>, createdBy: number): Promise<ContentFilterSettings> {
    const created = await storage.createContentFilterSettings({
      fieldName,
      isEnabled: settings.isEnabled ?? true,
      maxLength: settings.maxLength,
      allowProfanity: settings.allowProfanity ?? false,
      cleanAutomatically: settings.cleanAutomatically ?? false,
      updatedBy: createdBy
    });

    // Update local cache
    this.filterSettings.set(fieldName, created);

    return created;
  }

  // Validation helper for common fields
  async validateDisplayName(displayName: string): Promise<ContentValidationResult> {
    return this.validateContent(displayName, 'displayName');
  }

  async validateUsername(username: string): Promise<ContentValidationResult> {
    return this.validateContent(username, 'username');
  }

  async validateBio(bio: string): Promise<ContentValidationResult> {
    return this.validateContent(bio, 'bio');
  }

  async validateTitle(title: string): Promise<ContentValidationResult> {
    return this.validateContent(title, 'title');
  }

  async validateDescription(description: string): Promise<ContentValidationResult> {
    return this.validateContent(description, 'description');
  }

  async validateComment(comment: string): Promise<ContentValidationResult> {
    return this.validateContent(comment, 'comment');
  }

  async validateMessage(message: string): Promise<ContentValidationResult> {
    return this.validateContent(message, 'message');
  }
}

// Export singleton instance
export const contentFilterService = new ContentFilterService();