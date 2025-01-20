import { supabase } from '@/lib/supabase';
import type { Reminder } from '@/types/database';
import { DateParser } from './date-parser';

export class CalendarSystem {
  constructor(private userId: string) {}

  // Parse date from text and get reminders
  async getRemindersByText(dateText: string): Promise<Reminder[]> {
    const date = DateParser.parseDate(dateText);
    return this.getDayView(date);
  }

  // Get reminders for a specific day
  async getDayView(date: Date): Promise<Reminder[]> {
    const { start, end } = DateParser.getDateRange(date, 'day');

    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', this.userId)
      .gte('due_date', start.toISOString())
      .lte('due_date', end.toISOString())
      .order('due_date', { ascending: true });

    if (error) throw error;
    return reminders;
  }

  // Get reminders for a week
  async getWeekView(date: Date): Promise<Record<string, Reminder[]>> {
    const { start, end } = DateParser.getDateRange(date, 'week');

    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', this.userId)
      .gte('due_date', start.toISOString())
      .lte('due_date', end.toISOString())
      .order('due_date', { ascending: true });

    if (error) throw error;

    // Group by day of week
    const weekView: Record<string, Reminder[]> = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    days.forEach(day => weekView[day] = []);
    
    reminders.forEach(reminder => {
      const reminderDate = new Date(reminder.due_date);
      const dayName = days[reminderDate.getDay()];
      weekView[dayName].push(reminder);
    });

    return weekView;
  }

  // Get reminders for a month
  async getMonthView(date: Date): Promise<Record<number, Reminder[]>> {
    const { start, end } = DateParser.getDateRange(date, 'month');

    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', this.userId)
      .gte('due_date', start.toISOString())
      .lte('due_date', end.toISOString())
      .order('due_date', { ascending: true });

    if (error) throw error;

    // Group by day of month
    const monthView: Record<number, Reminder[]> = {};
    const daysInMonth = end.getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      monthView[day] = [];
    }
    
    reminders.forEach(reminder => {
      const reminderDate = new Date(reminder.due_date);
      const dayOfMonth = reminderDate.getDate();
      monthView[dayOfMonth].push(reminder);
    });

    return monthView;
  }

  // Create a new reminder
  async createReminder(title: string, dateText: string, options: {
    type?: string;
    amount?: number;
    recurring?: boolean;
    frequency?: string;
  } = {}): Promise<Reminder> {
    const dueDate = DateParser.parseDate(dateText);
    
    const { data: reminder, error } = await supabase
      .from('reminders')
      .insert({
        user_id: this.userId,
        title,
        due_date: dueDate.toISOString(),
        type: options.type || 'other',
        amount: options.amount,
        recurring: options.recurring || false,
        frequency: options.frequency,
        status: 'PENDING',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return reminder;
  }

  // Get recurring reminders
  async getRecurringReminders(): Promise<Reminder[]> {
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', this.userId)
      .eq('recurring', true)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return reminders;
  }

  // Mark reminder as completed
  async completeReminder(reminderId: string): Promise<void> {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'COMPLETED' })
      .eq('id', reminderId)
      .eq('user_id', this.userId);

    if (error) throw error;
  }

  // Create next occurrence for recurring reminder
  async createNextOccurrence(reminder: Reminder): Promise<void> {
    const nextDate = new Date(reminder.due_date);
    
    switch (reminder.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }

    const { error } = await supabase
      .from('reminders')
      .insert({
        ...reminder,
        due_date: nextDate.toISOString(),
        status: 'PENDING',
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  }
} 