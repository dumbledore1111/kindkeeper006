// File: lib/category-manager.ts

import { supabase } from './supabase';
import { openai } from './openai';
import type { CategoryType } from '@/types/database';  // Changed from ExtendedCategoryType

interface CategoryCreationDetails {
  name: string;
  description?: string;
  parentCategory?: CategoryType;  // Changed type
  keywords: string[];
  rules?: {
    includePatterns: string[];
    excludePatterns: string[];
    budget?: number;
    timeLimit?: {
      start?: Date;
      end?: Date;
    };
    relatedCategories?: string[];
    automaticTagging: boolean;
  };
  metadata?: {
    source: string;
    purpose: string;
    temporary: boolean;
  };
}

interface CreateCategoryParams {
  userId: string;
  name: string;
  description?: string;
  parentCategory?: CategoryType;
  rules?: {
    includeKeywords: string[];
    automaticTagging: boolean;
  };
}

export class CategoryManager {
  private async extractCategoryIntent(text: string): Promise<CategoryCreationDetails | null> {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Extract category creation details from user input.
            If input is about creating a category, return structured data.
            Examples:
            "Track renovation expenses" -> home improvement category
            "Create category for mom's medical bills" -> person-specific medical category
            "All expenses for my Europe trip next month" -> temporary travel category
            `
        },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }
    });

    if (!completion.choices[0].message?.content) {
      return null;
    }

    const result = JSON.parse(completion.choices[0].message.content);
    return result.isCategory ? result.details : null;
  }

  async createDynamicCategory(userId: string, input: string) {
    // Extract intent and details
    const details = await this.extractCategoryIntent(input);
    if (!details) return null;

    const { data: existingCategory, error: checkError } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('user_id', userId)
      .eq('name', details.name)
      .single();

    if (existingCategory) {
      throw new Error(`Category "${details.name}" already exists`);
    }

    const { data: category, error: categoryError } = await supabase
      .from('custom_categories')
      .insert({
        user_id: userId,
        name: details.name,
        description: details.description,
        parent_category: details.parentCategory,
        valid_from: details.rules?.timeLimit?.start,
        valid_until: details.rules?.timeLimit?.end,
        rules: {
          keywords: details.keywords,
          patterns: details.rules?.includePatterns,
          exclude_patterns: details.rules?.excludePatterns,
          budget: details.rules?.budget,
          auto_tag: details.rules?.automaticTagging
        }
      })
      .select()
      .single();

    if (categoryError) throw categoryError;

    // Create context for this category
    await this.createCategoryContext(userId, category.id, details);

    return category;
  }

  private async createCategoryContext(userId: string, categoryId: string, details: CategoryCreationDetails) {
    const { data: context, error: contextError } = await supabase
      .from('context_logs')
      .insert({
        user_id: userId,
        context_type: 'category_creation',
        context_data: {
          category_id: categoryId,
          purpose: details.metadata?.purpose,
          keywords: details.keywords,
          related_categories: details.rules?.relatedCategories,
          is_temporary: details.metadata?.temporary
        },
        valid_from: new Date(),
        valid_until: details.rules?.timeLimit?.end
      })
      .select()
      .single();

    if (contextError) throw contextError;
    return context;
  }

  async suggestCategorization(text: string, existingCategories: any[]) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Given the text and existing categories, suggest the best categorization.
            Consider:
            - Multiple category matches
            - Parent-child relationships
            - Temporary vs permanent categories
            Return confidence levels for each suggestion.`
        },
        {
          role: "user",
          content: JSON.stringify({ text, existingCategories })
        }
      ]
    });

    if (!completion.choices[0].message?.content) {
      return null;
    }

    return JSON.parse(completion.choices[0].message.content);
  }

  async handleVoiceCommand(userId: string, command: string) {
    const categoryDetails = await this.extractCategoryDetailsFromVoice(command);

    return this.createDynamicCategory(userId, command);  // Changed from createCategory
  }

  private async extractCategoryDetailsFromVoice(command: string) {
    // Use OpenAI to parse the voice command dynamically
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `Extract category details from the user's voice command.
            Return a JSON object with:
            - name: a simple, understandable category name
            - description: clear description of the category's purpose
            - keywords: relevant keywords for automatic categorization
            Do not make assumptions. Only extract what the user explicitly mentions.`
        },
        { role: "user", content: command }
      ],
      response_format: { type: "json_object" }
    });
  
    if (!completion.choices[0].message?.content) {
      throw new Error('Failed to extract category details');
    }
  
    const result = JSON.parse(completion.choices[0].message.content);
    return {
      name: result.name,
      description: result.description,
      keywords: result.keywords
    };
  }

  async updateCategoryRules(categoryId: string, newRules: any) {
    const { data, error } = await supabase
      .from('custom_categories')
      .update({ rules: newRules })
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addTransactionToCategory(categoryId: string, transactionId: string) {
    const { data, error } = await supabase
      .from('transactions')
      .update({ custom_category_id: categoryId })
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}