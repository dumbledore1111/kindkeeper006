import { useState } from 'react'
import { processUserInput } from '@/lib/input-processor'
import { createTransaction, createVoiceEntry } from '@/lib/database'
import { useAssistant } from './useAssistant'
import type { TransactionData, VoiceEntryData } from '@/types/database'
import type { ProcessingResult } from '@/types/responses'

export function useInputProcessor() {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { processInput: getAIResponse } = useAssistant()

  const processInput = async (input: string, userId: string) => {
    setProcessing(true)
    setError(null)

    try {
      const processed = await processUserInput(input, userId)

      if (processed.needsMoreInfo) {
        const aiResponse = await getAIResponse(
          `I need more information: ${processed.needsMoreInfo.context}. Can you please provide ${processed.needsMoreInfo.type}?`
        )
        return { needsMoreInfo: true, message: aiResponse }
      }

      if (!processed.dbOperations) {
        return { success: false, message: 'Could not process the input' }
      }

      const transactionOperation = processed.dbOperations.find(
        op => op.table === 'transactions'
      )

      if (transactionOperation) {
        // Process database operations
        for (const operation of processed.dbOperations) {
          if (operation.table === 'transactions') {
            const transactionData: TransactionData = {
              amount: operation.data.amount,
              type: operation.data.type,
              is_recurring: operation.data.is_recurring || false,
              description: operation.data.description,
              source_destination: operation.data.source_destination,
              payment_method: operation.data.payment_method
            }
            await createTransaction(transactionData, { userId })
          }
        }

        // Save voice entry with user context
        const voiceData: VoiceEntryData = {
          transcript: input,
          amount: transactionOperation.data.amount,
          category: transactionOperation.data.category,
          description: transactionOperation.data.description,
          is_reminder: processed.dbOperations.some(op => op.table === 'reminders'),
          date: new Date()
        }
        await createVoiceEntry(voiceData, { userId })

        // Get AI confirmation
        const aiResponse = await getAIResponse(
          `I've recorded a ${transactionOperation.data.type} of Rs. ${transactionOperation.data.amount}. Is there anything else you need?`
        )
        return { success: true, message: aiResponse }
      }

      return { success: false, message: 'Could not process the input' }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      return { success: false, message: 'An error occurred while processing your request' }
    } finally {
      setProcessing(false)
    }
  }

  return { processInput, processing, error }
} 