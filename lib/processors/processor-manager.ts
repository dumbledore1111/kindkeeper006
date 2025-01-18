import { TransactionProcessor } from './transaction-processor';
import { AttendanceProcessor } from './attendance-processor';
import { ReminderProcessor } from './reminder-processor';
import { QueryProcessor } from './query-processor';
import type { Context, ProcessingResult } from '@/types/responses';

export class ProcessorManager {
  private processors: Map<string, any>;

  constructor(userId: string) {
    this.processors = new Map<string, any>([
      ['transaction', new TransactionProcessor(userId)] as [string, TransactionProcessor],
      ['attendance', new AttendanceProcessor(userId)] as [string, AttendanceProcessor],
      ['reminder', new ReminderProcessor(userId)] as [string, ReminderProcessor],
      ['query', new QueryProcessor(userId)] as [string, QueryProcessor]
    ]);
  }

  async route(
    intent: string, 
    data: any, 
    context?: Context
  ): Promise<ProcessingResult> {
    const processor = this.processors.get(intent);
    if (!processor) {
      throw new Error(`No processor found for intent: ${intent}`);
    }
    return processor.process(data, context);
  }
} 