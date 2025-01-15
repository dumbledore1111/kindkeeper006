'use client'

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { IndianRupee, ArrowDown, ArrowUp } from 'lucide-react'
import { AppSettings } from './settings-popup'

interface BookPanelProps {
  open: boolean
  onClose: () => void
  settings?: AppSettings
}

export function BookPanel({ open, onClose }: BookPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[400px] p-0 bg-white text-gray-900 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-50 p-4 border-b border-gray-200">
          <Button 
            onClick={onClose}
            className="h-10 px-6 rounded-lg bg-orange-500 hover:bg-orange-600 text-white"
          >
            Back
          </Button>
        </div>

        {/* Navigation Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
          <Button 
            variant="outline"
            className="h-12 bg-white border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
          >
            Summary
          </Button>
          <Button 
            variant="outline"
            className="h-12 bg-white border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
          >
            Categories
          </Button>
          <Button 
            variant="outline"
            className="h-12 bg-white border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
          >
            Calendar
          </Button>
          <Button 
            variant="outline"
            className="h-12 bg-white border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
          >
            Reminders
          </Button>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="w-5 h-5 text-green-500" />
              <span className="text-sm text-gray-600">Total Income</span>
            </div>
            <div className="text-xl font-bold text-gray-900">₹0.00</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-500">+12% from last month</span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="w-5 h-5 text-red-500" />
              <span className="text-sm text-gray-600">Total Expenses</span>
            </div>
            <div className="text-xl font-bold text-gray-900">₹0.00</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowDown className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-500">-8% from last month</span>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Recent Transactions</h3>
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500 border border-gray-200">
            No transactions recorded yet
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

