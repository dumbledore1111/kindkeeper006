import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export async function testLogging() {
  try {
    // Test 1: Direct logging
    logger.info('Testing logger', { test: 'direct log' })

    // Test 2: Store a pattern
    const { data, error } = await supabase
      .from('learning_patterns')
      .insert({
        user_id: 'test-user',  // Replace with actual user ID
        input_text: 'paid maid 2000 rupees',
        pattern_type: 'TRANSACTION',
        parsed_result: {
          transaction: {
            amount: 2000,
            type: 'expense',
            description: 'maid payment'
          }
        },
        success_count: 1
      })
      .select()

    if (error) {
      logger.error('Pattern storage failed', { error })
      return false
    }

    logger.info('Pattern stored successfully', { data })
    return true

  } catch (error) {
    logger.error('Test failed', { error })
    return false
  }
} 