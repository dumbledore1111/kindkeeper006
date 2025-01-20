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

    switch (intent) {
      case 'transaction':
        return processor.processTransaction(data, context);
      case 'attendance':
        return processor.process(data, context);
      case 'reminder':
        return processor.processReminder(data, context);
      case 'query':
        return processor.processQuery(data, context);
      default:
        throw new Error(`Unsupported intent type: ${intent}`);
    }
  }
} 