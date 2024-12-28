import { useState } from 'react'

interface UseAssistantProps {
  language?: string
}

export function useAssistant({ language = 'en' }: UseAssistantProps = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processInput = async (input: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          language,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to process input')
      }

      return data.response

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    processInput,
    isLoading,
    error,
  }
} 