'use client'

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { IndianRupee, ArrowDown, ArrowUp, ArrowLeft } from 'lucide-react'
import { AppSettings } from './settings-popup'

interface BookPanelProps {
  open: boolean
  onClose: () => void
  settings?: AppSettings
}

export function BookPanel({ open, onClose }: BookPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[400px] h-[700px] rounded-3xl bg-white shadow-xl p-6 relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-full hover:bg-gray-100 p-2"
              >
                <ArrowLeft className="h-12 w-12 text-gray-700" />
              </Button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto h-[calc(100%-80px)]">
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

