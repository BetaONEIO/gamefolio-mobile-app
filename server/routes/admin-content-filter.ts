import { Router } from 'express';
import { contentFilterService } from '../services/content-filter';
import { insertBannedWordSchema, insertContentFilterSettingsSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Middleware to check admin role
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Get all banned words
router.get('/banned-words', requireAdmin, async (req, res) => {
  try {
    const bannedWords = await contentFilterService.getAllBannedWords();
    res.json(bannedWords);
  } catch (error) {
    console.error('Error fetching banned words:', error);
    res.status(500).json({ error: 'Failed to fetch banned words' });
  }
});

// Add a banned word
router.post('/banned-words', requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      word: z.string().min(1).max(100),
      reason: z.string().optional()
    });
    
    const { word, reason } = schema.parse(req.body);
    
    const bannedWord = await contentFilterService.addBannedWord(
      word,
      req.user!.id,
      reason
    );
    
    res.status(201).json(bannedWord);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error adding banned word:', error);
    res.status(500).json({ error: 'Failed to add banned word' });
  }
});

// Remove a banned word
router.delete('/banned-words/:word', requireAdmin, async (req, res) => {
  try {
    const { word } = req.params;
    const success = await contentFilterService.removeBannedWord(word);
    
    if (success) {
      res.json({ message: 'Banned word removed successfully' });
    } else {
      res.status(404).json({ error: 'Banned word not found' });
    }
  } catch (error) {
    console.error('Error removing banned word:', error);
    res.status(500).json({ error: 'Failed to remove banned word' });
  }
});

// Deactivate a banned word
router.patch('/banned-words/:word/deactivate', requireAdmin, async (req, res) => {
  try {
    const { word } = req.params;
    const success = await contentFilterService.deactivateBannedWord(word);
    
    if (success) {
      res.json({ message: 'Banned word deactivated successfully' });
    } else {
      res.status(404).json({ error: 'Banned word not found' });
    }
  } catch (error) {
    console.error('Error deactivating banned word:', error);
    res.status(500).json({ error: 'Failed to deactivate banned word' });
  }
});

// Reactivate a banned word
router.patch('/banned-words/:word/reactivate', requireAdmin, async (req, res) => {
  try {
    const { word } = req.params;
    const success = await contentFilterService.reactivateBannedWord(word);
    
    if (success) {
      res.json({ message: 'Banned word reactivated successfully' });
    } else {
      res.status(404).json({ error: 'Banned word not found' });
    }
  } catch (error) {
    console.error('Error reactivating banned word:', error);
    res.status(500).json({ error: 'Failed to reactivate banned word' });
  }
});

// Get filter settings
router.get('/filter-settings', requireAdmin, async (req, res) => {
  try {
    const { fieldName } = req.query;
    const settings = await contentFilterService.getFilterSettings(
      fieldName as string | undefined
    );
    res.json(settings);
  } catch (error) {
    console.error('Error fetching filter settings:', error);
    res.status(500).json({ error: 'Failed to fetch filter settings' });
  }
});

// Update filter settings
router.patch('/filter-settings/:fieldName', requireAdmin, async (req, res) => {
  try {
    const { fieldName } = req.params;
    const schema = z.object({
      isEnabled: z.boolean().optional(),
      maxLength: z.number().int().positive().optional(),
      allowProfanity: z.boolean().optional(),
      cleanAutomatically: z.boolean().optional()
    });
    
    const updates = schema.parse(req.body);
    
    const updated = await contentFilterService.updateFilterSettings(
      fieldName,
      updates,
      req.user!.id
    );
    
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Filter settings not found' });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error updating filter settings:', error);
    res.status(500).json({ error: 'Failed to update filter settings' });
  }
});

// Create new filter settings
router.post('/filter-settings', requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      fieldName: z.string().min(1).max(50),
      isEnabled: z.boolean().optional(),
      maxLength: z.number().int().positive().optional(),
      allowProfanity: z.boolean().optional(),
      cleanAutomatically: z.boolean().optional()
    });
    
    const data = schema.parse(req.body);
    
    const created = await contentFilterService.createFilterSettings(
      data.fieldName,
      data,
      req.user!.id
    );
    
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating filter settings:', error);
    res.status(500).json({ error: 'Failed to create filter settings' });
  }
});

// Test content filtering
router.post('/test-filter', requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      content: z.string(),
      fieldName: z.string()
    });
    
    const { content, fieldName } = schema.parse(req.body);
    
    const result = await contentFilterService.validateContent(content, fieldName);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error testing content filter:', error);
    res.status(500).json({ error: 'Failed to test content filter' });
  }
});

// Get content filtering statistics
router.get('/statistics', requireAdmin, async (req, res) => {
  try {
    const [allBannedWords, activeBannedWords, filterSettings] = await Promise.all([
      contentFilterService.getAllBannedWords(),
      contentFilterService.getActiveBannedWords(),
      contentFilterService.getFilterSettings()
    ]);
    
    const stats = {
      totalBannedWords: allBannedWords.length,
      activeBannedWords: activeBannedWords.length,
      inactiveBannedWords: allBannedWords.length - activeBannedWords.length,
      filterSettings: filterSettings.length,
      enabledFilters: filterSettings.filter(s => s.isEnabled).length,
      disabledFilters: filterSettings.filter(s => !s.isEnabled).length
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching content filter statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Validate content against filters
router.post('/validate', requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      content: z.string(),
      fieldType: z.string().optional().default('general')
    });
    
    const { content, fieldType } = schema.parse(req.body);
    
    const result = await contentFilterService.validateContent(content, fieldType);
    
    res.json({
      isValid: result.isValid,
      errors: result.errors,
      cleanedContent: result.filteredContent,
      originalContent: content
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error validating content:', error);
    res.status(500).json({ error: 'Failed to validate content' });
  }
});

export default router;