import { z } from 'zod'

const inputSchema = z.object({
  message: z.string().min(1).max(1000),
  userId: z.string().uuid(),
  type: z.enum(['transaction', 'query']).optional()
})

export async function validateInput(data: unknown) {
  try {
    return inputSchema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${error.errors[0].message}`)
    }
    throw error
  }
} 