import { useState, useCallback, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import React from 'react'

interface Transaction {
  id: string
  type: 'transaction' | 'reminder'
  description: string
  amount?: number
  date: string
  status: 'completed' | 'pending'
  category?: 'medical' | 'bill' | 'household' | 'general'
}

// Combine all mock data
const mockData: Transaction[] = [
  // January 2025 Reminders
  { id: 'r1', type: 'reminder', description: 'Pay Phone Bill', amount: 999, date: '2025-01-25', status: 'pending', category: 'bill' },
  { id: 'r2', type: 'reminder', description: 'Pay Electricity Bill', amount: 3500, date: '2025-01-28', status: 'pending', category: 'bill' },
  { id: 'r3', type: 'reminder', description: 'Pay Maid', amount: 6000, date: '2025-01-28', status: 'pending', category: 'household' },
  { id: 'r4', type: 'reminder', description: 'Buy Rice', date: '2025-01-30', status: 'pending', category: 'household' },
  { id: 'r5', type: 'reminder', description: 'Buy Medicine', date: '2025-01-28', status: 'pending', category: 'medical' },
  
  // January 2025 Transactions
  { id: 't1', type: 'transaction', description: 'Bought groceries', amount: 600, date: '2025-01-15', status: 'completed', category: 'household' },
  { id: 't2', type: 'transaction', description: 'Paid driver', amount: 800, date: '2025-01-20', status: 'completed', category: 'household' },
  { id: 't3', type: 'transaction', description: 'Physiotherapy session', amount: 1500, date: '2025-01-22', status: 'completed', category: 'medical' },
  { id: 't4', type: 'transaction', description: 'Paid nurse', amount: 2000, date: '2025-01-23', status: 'completed', category: 'medical' },
  { id: 't5', type: 'transaction', description: 'Medical supplies', amount: 1200, date: '2025-01-24', status: 'completed', category: 'medical' }
];

interface CalendarViewProps {
  transactions: Transaction[]
  onClose: () => void
}

export function CalendarView({ onClose }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  // Add ref for scrolling
  const daysContainerRef = React.useRef<HTMLDivElement>(null)

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  // Navigation
  const handlePrevMonth = () => {
    const newDate = subMonths(currentDate, 1)
    setCurrentDate(newDate)
    // If in daily view, also update selected date to stay in the same month
    if (viewMode === 'daily') {
      setSelectedDate(newDate)
    }
  }

  const handleNextMonth = () => {
    const newDate = addMonths(currentDate, 1)
    setCurrentDate(newDate)
    // If in daily view, also update selected date to stay in the same month
    if (viewMode === 'daily') {
      setSelectedDate(newDate)
    }
  }

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1))
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1))

  // When month changes, update currentDate to match selectedDate's month
  useEffect(() => {
    if (format(currentDate, 'yyyy-MM') !== format(selectedDate, 'yyyy-MM')) {
      setCurrentDate(selectedDate)
    }
  }, [selectedDate, currentDate])

  // Scroll to selected date
  const scrollToSelectedDate = useCallback(() => {
    if (daysContainerRef.current) {
      const selectedButton = daysContainerRef.current.querySelector('[data-selected="true"]')
      if (selectedButton) {
        selectedButton.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        })
      }
    }
  }, [])

  // Auto-scroll when selected date changes
  useEffect(() => {
    scrollToSelectedDate()
  }, [selectedDate, scrollToSelectedDate])

  // Get transactions for a specific date
  const getTransactionsForDate = (date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd')
    return mockData.filter(t => t.date === formattedDate)
  }

  // Get days for the current month
  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate)
    const end = endOfMonth(currentDate)
    return eachDayOfInterval({ start, end })
  }

  // Check if a date is selected
  const isSelectedDate = (date: Date) => {
    return format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  }

  // Get background color based on category
  const getCategoryStyle = (category?: string) => {
    switch (category) {
      case 'medical':
        return 'bg-[#FFEDD5] border-[#F97316] border-2'
      case 'bill':
        return 'bg-[#FEF3C7] border-[#F59E0B] border-2'
      case 'household':
        return 'bg-[#FEF9C3] border-[#CA8A04] border-2'
      default:
        return 'bg-[#FFF7ED] border-[#EA580C] border-2'
    }
  }

  return (
    <div className="w-[400px] h-[700px] rounded-3xl bg-[#FFFBEB] shadow-xl relative animate-in slide-in-from-bottom-4">
      {/* Header with Close Button */}
      <div className="absolute top-4 right-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onClose}
          className="rounded-full hover:bg-[#FFEDD5]"
        >
          <X className="h-7 w-7 text-[#EA580C]" />
        </Button>
      </div>

      <div className="p-6">
        {/* View Toggle with Icons */}
        <div className="flex gap-2 p-1 bg-[#FFEDD5] rounded-full w-fit mx-auto mb-6">
          <Button
            variant={viewMode === 'daily' ? 'default' : 'ghost'}
            className={`rounded-full px-6 flex items-center gap-2 ${
              viewMode === 'daily' 
                ? 'bg-white shadow-md text-[#EA580C] text-lg' 
                : 'hover:bg-white/50 text-[#9A3412] text-lg'
            }`}
            onClick={() => setViewMode('daily')}
          >
            <div className="w-5 h-5 flex-shrink-0 flex flex-col justify-center">
              <div className="h-0.5 w-full bg-current mb-1" />
              <div className="h-0.5 w-3/4 bg-current" />
            </div>
            Daily
          </Button>
          <Button
            variant={viewMode === 'monthly' ? 'default' : 'ghost'}
            className={`rounded-full px-6 flex items-center gap-2 ${
              viewMode === 'monthly' 
                ? 'bg-white shadow-md text-[#EA580C] text-lg' 
                : 'hover:bg-white/50 text-[#9A3412] text-lg'
            }`}
            onClick={() => setViewMode('monthly')}
          >
            <div className="w-5 h-5 flex-shrink-0 grid grid-cols-2 gap-0.5">
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
              <div className="bg-current rounded-sm" />
            </div>
            Monthly
          </Button>
        </div>

        {/* Month Navigation with Animated Hover */}
        <div className="flex justify-between items-center mb-6 relative">
          <Button 
            variant="ghost" 
            onClick={handlePrevMonth}
            className="rounded-full hover:bg-[#FFEDD5] hover:text-[#EA580C] transition-colors group"
          >
            <ChevronLeft className="h-8 w-8" />
            <span className="absolute left-12 opacity-0 group-hover:opacity-100 transition-opacity text-base font-medium text-[#9A3412]">
              {format(subMonths(currentDate, 1), 'MMMM')}
            </span>
          </Button>
          <h2 className="text-2xl font-bold text-[#EA580C]">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <Button 
            variant="ghost" 
            onClick={handleNextMonth}
            className="rounded-full hover:bg-[#FFEDD5] hover:text-[#EA580C] transition-colors group"
          >
            <ChevronRight className="h-8 w-8" />
            <span className="absolute right-12 opacity-0 group-hover:opacity-100 transition-opacity text-base font-medium text-[#9A3412]">
              {format(addMonths(currentDate, 1), 'MMMM')}
            </span>
          </Button>
        </div>

        {viewMode === 'daily' ? (
          <>
            {/* Days List with Navigation Arrows */}
            <div className="relative mb-4">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevDay}
                  className="rounded-full hover:bg-[#FFEDD5] hover:text-[#EA580C] w-8 h-8"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              </div>

              <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextDay}
                  className="rounded-full hover:bg-[#FFEDD5] hover:text-[#EA580C] w-8 h-8"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div 
                ref={daysContainerRef}
                className="overflow-x-auto no-scrollbar px-8 -mx-2"
              >
                <div className="flex gap-2 min-w-max py-2 px-2">
                  {getDaysInMonth().map((date) => {
                    const hasEntries = getTransactionsForDate(date).length > 0
                    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                    const isSelected = isSelectedDate(date)
                    return (
                      <Button
                        key={date.toString()}
                        variant="ghost"
                        data-selected={isSelected}
                        className={`w-[60px] h-[68px] p-1 rounded-xl flex-shrink-0 transition-all duration-200 relative ${
                          isSelected
                            ? 'bg-[#EA580C] text-white scale-105 shadow-sm'
                            : hasEntries
                            ? 'bg-[#FFEDD5] hover:bg-[#FFDDC9] text-[#9A3412] hover:text-[#EA580C]'
                            : 'hover:bg-[#FFEDD5] text-[#9A3412]'
                        } ${isToday ? 'ring-2 ring-[#EA580C] ring-offset-1' : ''}`}
                        onClick={() => setSelectedDate(date)}
                      >
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="font-bold text-xl">
                            {format(date, 'd')}
                          </div>
                          <div className="text-xs font-medium mt-0.5">
                            {format(date, 'EEE')}
                          </div>
                          {hasEntries && (
                            <div className="absolute -bottom-0.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
                            </div>
                          )}
                        </div>
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Selected Day's Header */}
            <div className="bg-white sticky top-0 z-10 mb-3 -mx-6 px-6 py-2">
              <h3 className="text-lg font-bold text-[#EA580C] flex items-center gap-2">
                {format(selectedDate, 'EEEE')}
                <span className="text-base font-semibold text-[#9A3412]">
                  {format(selectedDate, 'dd/MM/yyyy')}
                </span>
              </h3>
            </div>

            {/* Selected Day's Entries with Enhanced Cards */}
            <div className="overflow-y-auto no-scrollbar h-[calc(100%-240px)]">
              <div className="space-y-3 px-2">
                {getTransactionsForDate(selectedDate).map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`p-4 rounded-xl ${getCategoryStyle(transaction.category)} hover:shadow-md transition-shadow cursor-pointer group`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-base text-[#9A3412] group-hover:text-[#EA580C] transition-colors">
                          {transaction.description}
                        </p>
                        <div className="flex gap-2 items-center mt-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            transaction.category === 'medical' ? 'bg-[#F97316]' :
                            transaction.category === 'bill' ? 'bg-[#F59E0B]' :
                            transaction.category === 'household' ? 'bg-[#CA8A04]' :
                            'bg-[#EA580C]'
                          }`} />
                          <p className="text-sm font-medium text-[#9A3412]">
                            {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                          </p>
                          {transaction.status === 'completed' && (
                            <span className="text-xs font-semibold bg-[#DCFCE7] text-[#166534] px-2 py-0.5 rounded-full">
                              Completed
                            </span>
                          )}
                          {transaction.status === 'pending' && (
                            <span className="text-xs font-semibold bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                      {transaction.amount && (
                        <p className="font-bold text-base text-[#9A3412] group-hover:text-[#EA580C] transition-colors">
                          {formatCurrency(transaction.amount)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {getTransactionsForDate(selectedDate).length === 0 && (
                  <div className="text-center text-[#9A3412] py-6">
                    <div className="text-xl mb-1">📅</div>
                    <p className="text-base font-medium">No entries for this date</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Monthly View Calendar with Enhanced Interaction */}
            <div className="overflow-y-auto no-scrollbar h-[calc(100%-180px)]">
              <div className="grid grid-cols-7 gap-2">
                {/* Day headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center font-bold text-[#EA580C] p-2 text-base">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {getDaysInMonth().map((date) => {
                  const dayTransactions = getTransactionsForDate(date)
                  const hasTransactions = dayTransactions.length > 0
                  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

                  return (
                    <Button
                      key={date.toString()}
                      variant="ghost"
                      className={`p-2 h-[80px] flex flex-col items-center justify-start gap-1 rounded-xl transition-all duration-200 group ${
                        isSelectedDate(date)
                          ? 'bg-[#EA580C] text-white scale-105 shadow-md'
                          : hasTransactions 
                          ? 'bg-[#FFEDD5] hover:bg-[#FFDDC9] text-[#9A3412] hover:text-[#EA580C]' 
                          : 'hover:bg-[#FFEDD5] text-[#9A3412]'
                      } ${isToday ? 'ring-2 ring-[#EA580C] ring-offset-2' : ''}`}
                      onClick={() => {
                        setSelectedDate(date)
                        setViewMode('daily')
                        setTimeout(scrollToSelectedDate, 100)
                      }}
                    >
                      <span className="font-bold text-lg group-hover:text-[#EA580C] transition-colors">
                        {format(date, 'd')}
                      </span>
                      {hasTransactions && (
                        <div className="flex gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {dayTransactions.some(t => t.category === 'medical') && (
                            <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                          )}
                          {dayTransactions.some(t => t.category === 'bill') && (
                            <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                          )}
                          {dayTransactions.some(t => t.category === 'household') && (
                            <div className="w-2 h-2 rounded-full bg-[#CA8A04]" />
                          )}
                        </div>
                      )}
                      {hasTransactions && (
                        <span className="text-sm font-medium text-[#9A3412] group-hover:text-[#EA580C] transition-colors">
                          {dayTransactions.length} {dayTransactions.length === 1 ? 'entry' : 'entries'}
                        </span>
                      )}
                    </Button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Add this to your global CSS file
const globalStyles = `
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
`; 