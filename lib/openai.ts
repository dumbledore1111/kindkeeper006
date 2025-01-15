// File: lib/openai.ts

if (typeof window !== 'undefined') {
  throw new Error('This module can only be used server-side')
}

import OpenAI from 'openai'
import { supabase } from './supabase'
import { processInput } from './transaction-processor'
import { parseDateFromText } from './date-parser'
import type { 
  Transaction, 
  EventRelationship,
  StructuredContext // if you have this defined in database types
} from '@/types/database'

// After your existing imports, add:
interface StructuredContext {
  recentTransactions: Transaction[];
  patterns: {
    recurring: any[];
    related: any[];
    sequential: any[];
  };
  relationships: EventRelationship[];
  userPreferences: any;
  historicalQueries: {
    query: string;
    response: string;
    timestamp: Date;
  }[];
}
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const TRANSACTION_PROMPT = `You are a friendly financial assistant for senior citizens in India. Keep responses short and direct.

RULES:
- Keep responses under 15 words unless clarifying something
- Ask only ONE question when something is unclear
- Use Indian Rupees (₹)
- Be patient and empathetic
- Speak respectfully as to an elder
- Use simple language
- If speech recognition might have errors, ask for confirmation
- Consider patterns in user's transaction history
- Reference related transactions when relevant
- Be aware of recurring payments and schedules

EXAMPLES:
User: "paid maid 2000 rupees"
Assistant: "Got it, you paid your maid ₹2,000. Was it today? (I notice this is your usual monthly amount)"

User: "gave to ram"
Assistant: "Could you tell me how much you gave to Ram? (if and only if there was a transaction  to ram prior to this, (I notice Last payment was ₹500 two weeks ago))"

User: "got pension"
Assistant: "How much pension did you receive? (Usually ₹25,000 on 1st of each month)"

User: "maid not coming today"
Assistant: "I'll mark your maid as absent for today. Is that correct? Should I adjust this month's payment of ₹2,000?"

User: "remind me electricity bill"
Assistant: "What amount should I remind you for the electricity bill?"

CRITICAL INFORMATION TO GET:
1. Amount (if missing)
2. Date (default to today)
3. Person's name (for service providers)
4. Purpose (if unclear)
5. Pattern relevance (check against history)
6. Related transactions (if any)

Return JSON in format:
{
  "response": "short reply to user",
  "understood": {
    "text": "clarified version of what user said",
    "amount": number or null,
    "date": "YYYY-MM-DD" or null,
    "type": "expense" or "income" or "reminder"
    "patterns": {
      "isRecurring": boolean,
      "relatedTransactions": string[],
      "suggestedCategory": string
  },
  "needs_clarification": {
    "type": "amount|date|name|purpose",
    "context": "question to ask"
     "suggestions": {
      "fromHistory": string[],
      "fromPatterns": string[]
    }
  } or null
}`

// Add category creation prompt
const CATEGORY_CREATION_PROMPT = `You are a financial assistant helping detect and process category creation requests. The user might want to create a custom category for tracking specific expenses.

CATEGORY CREATION EXAMPLES:
User: "Create a new category for house painting expenses"
Assistant: {
  "intent": "create_category",
  "category": {
    "name": "house_painting",
    "description": "Track expenses related to house painting project",
    "parent_category": "project_expenses",
    "keywords": ["paint", "labor", "contractor", "supplies", "cleaning"],
    "context": "home improvement project"
  },
  "response": "I'll create a new category for house painting expenses. Would you like to add any specific rules for this category?"
}

User: "I want to track all medical expenses for my mother separately"
Assistant: {
  "intent": "create_category",
  "category": {
    "name": "mother_medical",
    "description": "Track medical expenses for mother",
    "parent_category": "medical",
    "keywords": ["doctor", "medicine", "hospital", "treatment", "mother"],
    "context": "family healthcare"
  },
  "response": "I'll create a category to track your mother's medical expenses separately. Should I include any specific doctors or hospitals in the tracking rules?"
}

RULES:
1. Always confirm the category creation with the user
2. Suggest relevant keywords based on the category purpose
3. Determine the most appropriate parent category
4. Ask for additional rules if needed
5. Keep category names concise but descriptive
6. Never create duplicate categories
7. Ensure the category fits within the extended category types`;

// Add getCurrentUserId function
async function getCurrentUserId(): Promise<string> {
  // First try to get from supabase auth
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    return session.user.id;
  }

  // Fallback to context if available
  if (typeof window !== 'undefined') {
    // Check local storage or context for userId
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) return storedUserId;
  }

  throw new Error('No user ID available');
}

// Update processChatCompletion to use async/await
export async function processChatCompletion(message: string) {
  try {
    const userId = await getCurrentUserId();
    
    // First, try pattern matching
    const patternResult = processInput(message)
    
    if (!patternResult.needs_clarification) {
      return patternResult
    }

    export async function processChatCompletion(message: string, context?: StructuredContext) {
      try {
        const userId = await getCurrentUserId();
        
        // First, try pattern matching
        const patternResult = processInput(message)
        
        if (!patternResult.needs_clarification) {
          return patternResult
        }
    
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { 
              role: "system", 
              content: message.toLowerCase().includes('category') ? 
                CATEGORY_CREATION_PROMPT : 
                TRANSACTION_PROMPT
            },
            { 
              role: "user", 
              content: JSON.stringify({
                message,
                context: context ? {
                  recentTransactions: context.recentTransactions,
                  patterns: context.patterns,
                  relationships: context.relationships
                } : {}
              })
            }
          ],
          response_format: { type: "json_object" }
        });
    
        // Rest of your existing code...
      } catch (error) {
        console.error('Error in processChatCompletion:', error)
        throw error
      }
    }

    if (!completion.choices[0].message.content) {
      throw new Error('No response from OpenAI')
    }
    
    const result = JSON.parse(completion.choices[0].message.content)
    
    if (result.intent === 'create_category') {
      const response = await fetch('/api/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          command: message,
          categoryDetails: result.category
        })
      });
      
      return response.json();
    }

    if (result.understood) {
      // Convert OpenAI understanding to our format
      return {
        ...patternResult,
        transaction: result.understood.type === 'expense' || result.understood.type === 'income' ? {
          amount: result.understood.amount,
          type: result.understood.type,
          description: result.understood.text,
          date: parseDateFromText(result.understood.date)
        } : undefined,
        needs_clarification: result.needs_clarification
      }
    }

    return patternResult
  } catch (error) {
    console.error('Error in processChatCompletion:', error)
    throw error
  }
}

export async function processAssistantMessage(userId: string, message: string) {
  const threadId = await getOrCreateThread(userId)
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message
  })

  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: await getAssistant(userId)
  })

  return waitForResponse(threadId, run.id)
}

async function getOrCreateThread(userId: string) {
  const { data: threadData } = await supabase
    .from('conversation_threads')
    .select('thread_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (threadData?.thread_id) {
    return threadData.thread_id
  }

  const thread = await openai.beta.threads.create()
  
  await supabase.from('conversation_threads').insert({
    user_id: userId,
    thread_id: thread.id,
    status: 'active',
    created_at: new Date()
  })

  return thread.id
}

async function waitForResponse(threadId: string, runId: string) {
  let response = await openai.beta.threads.runs.retrieve(threadId, runId)
  
  while (response.status === 'in_progress' || response.status === 'queued') {
    await new Promise(resolve => setTimeout(resolve, 1000))
    response = await openai.beta.threads.runs.retrieve(threadId, runId)
  }

  const messages = await openai.beta.threads.messages.list(threadId)
  const content = messages.data[0].content[0]
  
  return content.type === 'text' ? content.text.value : 'Sorry, I can only process text responses.'
}

export async function getAssistant(userId: string) {
  const { data: existingAssistant } = await supabase
    .from('user_assistants')
    .select('assistant_id')
    .eq('user_id', userId)
    .single()

  if (existingAssistant?.assistant_id) {
    return existingAssistant.assistant_id
  }

  const assistant = await openai.beta.assistants.create({
    name: `Financial Assistant for ${userId}`,
    instructions: `You are a personal financial assistant helping a senior citizen in India.
      - Learn their speech patterns and preferences
      - Help explain transactions in simple terms
      - Provide gentle reminders
      - Answer questions about their spending
      - Suggest better financial habits
      - Always be patient and respectful
      - Use simple language
      - Confirm understanding when unclear`,
    model: "gpt-4-turbo-preview"
  })

  await supabase.from('user_assistants').insert({
    user_id: userId,
    assistant_id: assistant.id,
    created_at: new Date()
  })

  return assistant.id
}