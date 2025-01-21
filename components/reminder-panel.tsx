import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Edit2, X, Check, Bell, Calendar, Clock, Plus, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useState } from 'react'

interface Reminder {
  id: string
  title: string
  date: string
  status: 'pending' | 'completed'
  amount?: number
  description?: string
  type?: 'medical' | 'bill' | 'household' | 'general'
}

// Mock reminders data for January 2025
const mockReminders: Reminder[] = [
  {
    id: '1',
    title: 'Pay Phone Bill',
    date: '2025-01-25',
    status: 'pending',
    amount: 999,
    type: 'bill',
    description: 'Airtel monthly bill'
  },
  {
    id: '2',
    title: 'Pay Electricity Bill',
    date: '2025-01-28',
    status: 'pending',
    amount: 3500,
    type: 'bill',
    description: 'Due by end of month'
  },
  {
    id: '3',
    title: 'Pay Maid',
    date: '2025-01-28',
    status: 'pending',
    amount: 6000,
    type: 'household',
    description: 'Monthly salary'
  },
  {
    id: '4',
    title: 'Buy Rice',
    date: '2025-01-30',
    status: 'pending',
    description: '2 kilos from local store',
    type: 'household'
  },
  {
    id: '5',
    title: 'Buy Medicine',
    date: '2025-01-28',
    status: 'pending',
    type: 'medical',
    description: 'Monthly prescription'
  },
  {
    id: '6',
    title: 'Dentist Appointment',
    date: '2025-02-02',
    status: 'pending',
    type: 'medical',
    description: 'Tooth cleaning and checkup'
  },
  {
    id: '7',
    title: 'Pay Water Bill',
    date: '2025-01-25',
    status: 'pending',
    amount: 800,
    type: 'bill'
  },
  {
    id: '8',
    title: 'Physiotherapy Session',
    date: '2025-01-27',
    status: 'pending',
    amount: 1500,
    type: 'medical',
    description: 'Weekly session with Dr. Kumar'
  },
  {
    id: '9',
    title: 'Buy Vegetables',
    date: '2025-01-29',
    status: 'pending',
    type: 'household',
    description: 'Fresh vegetables for the week'
  },
  {
    id: '10',
    title: 'Heart Checkup',
    date: '2025-01-31',
    status: 'pending',
    type: 'medical',
    description: 'Monthly checkup with cardiologist'
  }
]

interface GroupedReminders {
  [key: string]: Reminder[]
}

interface ReminderPanelProps {
  open: boolean
  onClose: () => void
}

export function ReminderPanel({ open, onClose }: ReminderPanelProps) {
  const [selectedReminder, setSelectedReminder] = useState<string | null>(null)

  // Group reminders by date
  const groupedReminders = mockReminders.reduce((acc: GroupedReminders, reminder) => {
    const date = format(new Date(reminder.date), 'yyyy-MM-dd')
    if (!acc[date]) {
      acc[date] = []
    }
    acc[date].push(reminder)
    return acc
  }, {})

  // Sort dates
  const sortedDates = Object.keys(groupedReminders).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  const handleEdit = (reminderId: string) => {
    console.log('Edit reminder:', reminderId)
  }

  const handleDelete = (reminderId: string) => {
    console.log('Delete reminder:', reminderId)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'd MMMM yyyy')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const getCategoryStyle = (type?: 'medical' | 'bill' | 'household' | 'general') => {
    switch (type) {
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[400px] h-[700px] rounded-3xl bg-[#FFFBEB] shadow-xl relative animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex justify-between items-center p-6 pb-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
                className="rounded-full hover:bg-[#FFEDD5] w-10 h-10"
              >
                <ArrowLeft className="h-6 w-6 text-[#EA580C]" />
              </Button>
              <h2 className="text-2xl font-bold text-[#EA580C]">Reminders</h2>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-[#FFEDD5] w-10 h-10"
              >
                <Plus className="h-6 w-6 text-[#EA580C]" />
              </Button>
            </div>

            {/* Month Display */}
            <div className="px-6 py-3">
              <div className="flex items-center gap-2 bg-[#FFEDD5] rounded-full px-4 py-2 w-fit">
                <Calendar className="h-5 w-5 text-[#EA580C]" />
                <span className="font-medium text-[#9A3412]">January 2025</span>
              </div>
            </div>

            {/* Reminders List */}
            <div className="overflow-y-auto no-scrollbar h-[calc(100%-160px)] px-6">
              {sortedDates.map((date) => (
                <div key={date} className="mb-6">
                  <h3 className="text-lg font-bold text-[#EA580C] flex items-center gap-2 mb-3">
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-3">
                    {groupedReminders[date].map((reminder: Reminder) => (
                      <div
                        key={reminder.id}
                        className={`${getCategoryStyle(reminder.type)} rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer group`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-base text-[#9A3412] group-hover:text-[#EA580C] transition-colors">
                              {reminder.title}
                            </p>
                            <div className="flex gap-2 items-center mt-1.5">
                              <span className={`w-2 h-2 rounded-full ${
                                reminder.type === 'medical' ? 'bg-[#F97316]' :
                                reminder.type === 'bill' ? 'bg-[#F59E0B]' :
                                reminder.type === 'household' ? 'bg-[#CA8A04]' :
                                'bg-[#EA580C]'
                              }`} />
                              <p className="text-sm font-medium text-[#9A3412]">
                                {reminder.type?.charAt(0).toUpperCase() + reminder.type?.slice(1) || 'General'}
                              </p>
                              <span className="text-xs font-semibold bg-[#FEF3C7] text-[#B45309] px-2 py-0.5 rounded-full">
                                {reminder.status}
                              </span>
                            </div>
                            {reminder.description && (
                              <p className="text-sm text-[#9A3412] mt-2">
                                {reminder.description}
                              </p>
                            )}
                          </div>
                          {reminder.amount && (
                            <p className="font-bold text-base text-[#9A3412] group-hover:text-[#EA580C] transition-colors">
                              {formatCurrency(reminder.amount)}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(reminder.id)
                            }}
                            className="rounded-full hover:bg-[#FFEDD5] hover:text-[#EA580C] h-8 px-3"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(reminder.id)
                            }}
                            className="rounded-full hover:bg-[#FFEDD5] hover:text-[#EA580C] h-8 px-3"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 