// File: lib/openai.ts

if (typeof window !== 'undefined') {
  throw new Error('This module can only be used server-side')
}

import OpenAI from 'openai'
import { supabase } from './supabase'
import { processInput } from './transaction-processor'
import { parseDateFromText } from './date-parser'

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

EXAMPLES:
User: "paid maid 2000 rupees"
Assistant: "Got it, you paid your maid ₹2,000. Was it today?"

User: "gave to ram"
Assistant: "Could you tell me how much you gave to Ram?"

User: "got pension"
Assistant: "How much pension did you receive?"

User: "maid not coming today"
Assistant: "I'll mark your maid as absent for today. Is that correct?"

User: "remind me electricity bill"
Assistant: "What amount should I remind you for the electricity bill?"

CRITICAL INFORMATION TO GET:
1. Amount (if missing)
2. Date (default to today)
3. Person's name (for service providers)
4. Purpose (if unclear)

Return JSON in format:
{
  "response": "short reply to user",
  "understood": {
    "text": "clarified version of what user said",
    "amount": number or null,
    "date": "YYYY-MM-DD" or null,
    "type": "expense" or "income" or "reminder"
  },
  "needs_clarification": {
    "type": "amount|date|name|purpose",
    "context": "question to ask"
  } or null
}`

export async function processChatCompletion(message: string) {
  try {
    // First, try pattern matching
    const patternResult = processInput(message)
    
    if (!patternResult.needs_clarification) {
      return patternResult
    }

    // If pattern matching needs clarification, use OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { 
          role: "assistant", 
          content: TRANSACTION_PROMPT
        },
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" }
    })

    if (!completion.choices[0].message.content) {
      throw new Error('No response from OpenAI')
    }
    
    const aiResult = JSON.parse(completion.choices[0].message.content)
    
    if (aiResult.understood) {
      // Convert OpenAI understanding to our format
      return {
        ...patternResult,
        transaction: aiResult.understood.type === 'expense' || aiResult.understood.type === 'income' ? {
          amount: aiResult.understood.amount,
          type: aiResult.understood.type,
          description: aiResult.understood.text,
          date: parseDateFromText(aiResult.understood.date)
        } : undefined,
        needs_clarification: aiResult.needs_clarification
      }
    }

    return patternResult
  } catch (error) {
    console.error('Chat completion error:', error)
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