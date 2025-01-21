'use client'

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { IndianRupee, ArrowDown, ArrowUp, ArrowLeft, Check } from 'lucide-react'
import { AppSettings } from './settings-popup'
import { useEffect, useState } from 'react'
import { ReminderPanel } from './reminder-panel'
import { CalendarView } from './calendar-view'

// Mock data interface
interface RecentItem {
  id: string
  type: 'transaction' | 'reminder'
  description: string
  amount?: number
  date: string
  status: 'completed' | 'pending'
}

const mockRecents: RecentItem[] = [
  {
    id: '1',
    type: 'transaction',
    description: 'Bought groceries',
    amount: 600,
    date: '2024-01-25',
    status: 'completed'
  },
  {
    id: '2',
    type: 'reminder',
    description: 'Pay phone bill',
    amount: 999,
    date: '2024-01-26',
    status: 'completed'
  },
  {
    id: '3',
    type: 'transaction',
    description: 'Paid driver',
    amount: 800,
    date: '2024-01-25',
    status: 'completed'
  },
  {
    id: '4',
    type: 'reminder',
    description: 'Buy medicine',
    date: '2025-01-28',
    status: 'pending'
  },
  {
    id: '5',
    type: 'transaction',
    description: 'Physiotherapy session',
    amount: 1500,
    date: '2024-01-24',
    status: 'completed'
  },
  {
    id: '6',
    type: 'reminder',
    description: 'Doctor appointment',
    date: '2024-02-01',
    status: 'pending'
  },
  {
    id: '7',
    type: 'transaction',
    description: 'Paid nurse',
    amount: 2000,
    date: '2024-01-23',
    status: 'completed'
  },
  {
    id: '8',
    type: 'reminder',
    description: 'Refill medications',
    date: '2024-01-30',
    status: 'pending'
  },
  {
    id: '9',
    type: 'transaction',
    description: 'Medical supplies',
    amount: 1200,
    date: '2024-01-22',
    status: 'completed'
  },
  {
    id: '10',
    type: 'reminder',
    description: 'Health insurance renewal',
    amount: 25000,
    date: '2024-02-15',
    status: 'pending'
  }
];

interface BookPanelProps {
  open: boolean
  onClose: () => void
  settings?: AppSettings
}

export function BookPanel({ open, onClose }: BookPanelProps) {
  const [showReminders, setShowReminders] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  // Calculate totals from mock data
  const totalIncome = 0; // Add income calculation if needed
  const totalExpenses = mockRecents
    .filter(item => item.type === 'transaction' && item.amount)
    .reduce((sum, item) => sum + (item.amount || 0), 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="p-0 border-none bg-transparent">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[400px] h-[700px] rounded-3xl bg-[#FFFBEB] shadow-xl p-6 relative animate-in slide-in-from-bottom-4">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onClose}
                  className="rounded-full hover:bg-[#FFEDD5] p-2"
                >
                  <ArrowLeft className="h-12 w-12 text-[#EA580C]" />
                </Button>
              </div>

              {/* Content Area */}
              <div className="flex-1 h-[calc(100%-80px)] overflow-hidden">
                <div className="h-full overflow-y-auto no-scrollbar">
                  {/* Navigation Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
                    <Button 
                      variant="outline"
                      className="h-12 bg-white border-[#EA580C] text-[#EA580C] hover:bg-[#FED7AA] hover:text-[#C2410C]"
                      onClick={() => setShowCalendar(true)}
                    >
                      Calendar
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-12 bg-white border-[#EA580C] text-[#EA580C] hover:bg-[#FED7AA] hover:text-[#C2410C]"
                    >
                      Categories
                    </Button>
                    <Button 
                      variant="outline"
                      className="h-12 bg-white border-[#EA580C] text-[#EA580C] hover:bg-[#FED7AA] hover:text-[#C2410C]"
                    >
                      Summary
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setShowReminders(true)}
                      className="h-12 bg-white border-[#EA580C] text-[#EA580C] hover:bg-[#FED7AA] hover:text-[#C2410C]"
                    >
                      Reminders
                    </Button>
                  </div>

                  {/* Financial Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                    <div className="bg-[#FFEDD5] rounded-xl p-4 border-2 border-[#F97316]">
                      <div className="flex items-center gap-2 mb-2">
                        <IndianRupee className="w-5 h-5 text-[#15803D]" />
                        <span className="text-sm text-[#9A3412]">Total Income</span>
                      </div>
                      <div className="text-xl font-bold text-[#EA580C]">{formatCurrency(totalIncome)}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowUp className="w-4 h-4 text-[#15803D]" />
                        <span className="text-xs text-[#15803D]">+12% from last month</span>
                      </div>
                    </div>

                    <div className="bg-[#FFEDD5] rounded-xl p-4 border-2 border-[#F97316]">
                      <div className="flex items-center gap-2 mb-2">
                        <IndianRupee className="w-5 h-5 text-[#DC2626]" />
                        <span className="text-sm text-[#9A3412]">Total Expenses</span>
                      </div>
                      <div className="text-xl font-bold text-[#EA580C]">{formatCurrency(totalExpenses)}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowDown className="w-4 h-4 text-[#DC2626]" />
                        <span className="text-xs text-[#DC2626]">-8% from last month</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <div className="p-4">
                    <h3 className="text-2xl font-bold text-[#EA580C] mb-4">Recent Transactions</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                      {mockRecents.map((item) => (
                        <div 
                          key={item.id}
                          className={`rounded-xl p-4 hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group ${
                            item.type === 'reminder' 
                              ? 'bg-[#FEF3C7] border-2 border-[#F59E0B] hover:bg-[#FDE68A]' 
                              : 'bg-[#FFEDD5] border-2 border-[#F97316] hover:bg-[#FED7AA]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {item.status === 'completed' && (
                                <Check className="w-5 h-5 text-[#15803D]" />
                              )}
                              <div>
                                <p className={`font-bold text-base text-[#9A3412] group-hover:text-[#C2410C] transition-colors`}>
                                  {item.description}
                                </p>
                                <div className="flex gap-2 items-center mt-1.5">
                                  <span className={`w-2 h-2 rounded-full ${
                                    item.type === 'reminder' ? 'bg-[#F59E0B]' : 'bg-[#F97316]'
                                  }`} />
                                  <p className="text-sm font-medium text-[#9A3412]">
                                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                                  </p>
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    item.status === 'completed'
                                      ? 'bg-[#DCFCE7] text-[#166534]'
                                      : 'bg-[#FEF3C7] text-[#B45309]'
                                  }`}>
                                    {item.status}
                                  </span>
                                </div>
                                <p className="text-sm text-[#9A3412] mt-1">{formatDate(item.date)}</p>
                              </div>
                            </div>
                            {item.amount && (
                              <div className="font-bold text-base text-[#9A3412] group-hover:text-[#C2410C] transition-colors">
                                {formatCurrency(item.amount)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar Dialog */}
      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="p-0 border-none bg-transparent">
          <div className="absolute inset-0 flex items-center justify-center">
            <CalendarView 
              transactions={mockRecents} 
              onClose={() => setShowCalendar(false)} 
            />
          </div>
        </DialogContent>
      </Dialog>

      <ReminderPanel 
        open={showReminders} 
        onClose={() => setShowReminders(false)} 
      />
    </>
  );
}

