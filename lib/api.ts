export async function processMessage(message: string, userId: string) {
  const response = await fetch('/api/assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, userId })
  })

  if (!response.ok) {
    throw new Error('Failed to process message')
  }

  return response.json()
} 