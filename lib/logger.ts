export type LogData = string | number | boolean | null | undefined | Record<string, unknown>;

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export const logger = {
  auth: (message: string, data?: LogData) => {
    console.log(`[Auth] ${message}`, data || '')
  },
  error: (message: string, error?: unknown) => {
    console.error(`[Error] ${message}`, error ? formatError(error) : '')
  }
} 