'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from 'next/navigation'
import { Phone, Plus, Settings, Save, X, Edit, Trash2, ArrowLeft } from 'lucide-react'
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { SettingsPopup, AppSettings } from './settings-popup'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Database } from '@/types/database'

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phoneNumber: string;
}

interface BankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  account_type: string;
  account_number: string;
  created_at?: string;
}

interface AccountPanelProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => Promise<void>;
}

interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  phone_number?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
  profile?: {
    phone_number?: string;
  };
}

export function AccountPanel({ open, onClose, onSignOut }: AccountPanelProps) {
  const router = useRouter()
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [savedPhone, setSavedPhone] = useState('')
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([])
  const [isAddingEmergencyContact, setIsAddingEmergencyContact] = useState(false)
  const [editingEmergencyContactId, setEditingEmergencyContactId] = useState<string | null>(null)
  const [newEmergencyContact, setNewEmergencyContact] = useState<Omit<EmergencyContact, 'id'>>({
    name: '',
    relationship: '',
    phoneNumber: ''
  })
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isAddingBankAccount, setIsAddingBankAccount] = useState(false)
  const [editingBankAccountId, setEditingBankAccountId] = useState<string | null>(null)
  const [newBankAccount, setNewBankAccount] = useState<Omit<BankAccount, 'id' | 'user_id' | 'created_at'>>({
    bank_name: '',
    account_type: '',
    account_number: ''
  })
  const [appSettings, setAppSettings] = useState<AppSettings>({
    textSize: "medium",
    volume: 50,
    currency: 'USD',
    language: 'en',
    voiceType: 'female',
    theme: 'light' as const,
  })
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--text-base-size', `${appSettings.textSize}px`)
  }, [appSettings.textSize])

  useEffect(() => {
    async function loadUserData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        // First try to get existing profile
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // Update or create profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .upsert({
            id: session.user.id,
            full_name: session.user.user_metadata.full_name || existingProfile?.full_name,
            phone_number: existingProfile?.phone_number || null,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (!error && profile) {
          setUser({
            ...session.user,
            profile: profile
          });
          setSavedPhone(profile.phone_number || '');
        }

        // Load emergency contacts
        const { data: contacts } = await supabase
          .from('emergency_contacts')
          .select('*')
          .eq('user_id', session.user.id)

        // Load bank accounts
        const { data: accounts } = await supabase
          .from('bank_accounts')
          .select('*')
          .eq('user_id', session.user.id)

        // Load settings
        const { data: settings } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single()
          .throwOnError();

        if (contacts) {
          setEmergencyContacts(contacts)
        }
        if (accounts) {
          setBankAccounts(accounts)
        }
        if (settings) {
          setAppSettings(settings)
        }
      }
    }

    loadUserData()
  }, [])

  const handleLogout = async () => {
    await onSignOut()
    onClose()
  }

  const handleSavePhone = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          id: session.user.id,
          phone_number: phoneNumber,
          updated_at: new Date().toISOString()
        })

      if (!error) {
    setSavedPhone(phoneNumber)
    setIsEditingPhone(false)
      }
    }
  }

  const handleAddEmergencyContact = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user && newEmergencyContact.name && newEmergencyContact.relationship && newEmergencyContact.phoneNumber) {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({
          user_id: session.user.id,
          name: newEmergencyContact.name,
          relationship: newEmergencyContact.relationship,
          phone_number: newEmergencyContact.phoneNumber
        })
        .select()
        .single()

      if (!error && data) {
        setEmergencyContacts([...emergencyContacts, data])
        setNewEmergencyContact({ name: '', relationship: '', phoneNumber: '' })
        setIsAddingEmergencyContact(false)
      }
    }
  }

  const handleEditEmergencyContact = (contact: EmergencyContact) => {
    setNewEmergencyContact(contact)
    setEditingEmergencyContactId(contact.id)
    setIsAddingEmergencyContact(true)
  }

  const handleUpdateEmergencyContact = async () => {
    if (editingEmergencyContactId) {
      const { error } = await supabase
        .from('emergency_contacts')
        .update({
          name: newEmergencyContact.name,
          relationship: newEmergencyContact.relationship,
          phone_number: newEmergencyContact.phoneNumber
        })
        .eq('id', editingEmergencyContactId)

      if (!error) {
      setEmergencyContacts(emergencyContacts.map(contact => 
        contact.id === editingEmergencyContactId 
          ? { ...newEmergencyContact, id: contact.id }
          : contact
      ))
      setNewEmergencyContact({ name: '', relationship: '', phoneNumber: '' })
      setIsAddingEmergencyContact(false)
      setEditingEmergencyContactId(null)
      }
    }
  }

  const handleDeleteEmergencyContact = async (id: string) => {
    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('id', id)

    if (!error) {
    setEmergencyContacts(emergencyContacts.filter(contact => contact.id !== id))
    }
  }

  const handleAddBankAccount = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (session?.user && newBankAccount.bank_name && newBankAccount.account_type && newBankAccount.account_number) {
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: session.user.id,
          bank_name: newBankAccount.bank_name,
          account_type: newBankAccount.account_type,
          account_number: newBankAccount.account_number
        })
        .select()
        .single()

      if (!error && data) {
        setBankAccounts([...bankAccounts, data])
        setNewBankAccount({ bank_name: '', account_type: '', account_number: '' })
        setIsAddingBankAccount(false)
      }
    }
  }

  const handleEditBankAccount = (account: BankAccount) => {
    setNewBankAccount(account)
    setEditingBankAccountId(account.id)
    setIsAddingBankAccount(true)
  }

  const handleUpdateBankAccount = async () => {
    if (editingBankAccountId) {
      const { error } = await supabase
        .from('bank_accounts')
        .update({
          bank_name: newBankAccount.bank_name,
          account_type: newBankAccount.account_type,
          account_number: newBankAccount.account_number
        })
        .eq('id', editingBankAccountId)

      if (!error) {
      setBankAccounts(bankAccounts.map(account => 
        account.id === editingBankAccountId 
            ? { ...account, ...newBankAccount }
          : account
      ))
        setNewBankAccount({ bank_name: '', account_type: '', account_number: '' })
      setIsAddingBankAccount(false)
      setEditingBankAccountId(null)
      }
    }
  }

  const handleDeleteBankAccount = async (id: string) => {
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id)

    if (!error) {
    setBankAccounts(bankAccounts.filter(account => account.id !== id))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[400px] h-[700px] rounded-3xl bg-white shadow-xl p-6 relative">
            {/* Header with Back and Sign Out */}
            <div className="flex justify-between items-center mb-4">
          <Button 
                variant="ghost" 
                size="icon" 
            onClick={onClose}
                className="rounded-full hover:bg-gray-100 p-2"
          >
                <ArrowLeft className="h-12 w-12 text-gray-700" />
          </Button>
          <Button 
            onClick={handleLogout}
                className="px-6 h-12 rounded-full bg-[#ff6b00] hover:bg-[#ff8533]
                  text-white font-medium transition-all duration-300"
          >
                Sign Out
          </Button>
        </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto h-[calc(100%-80px)]">
        {/* Profile Info */}
              <div className="p-6 bg-white mb-4 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {user?.profile?.full_name || user?.user_metadata?.full_name || 'Loading...'}
                </h2>
                <p className="text-gray-600">
                  {user?.profile?.email || user?.email || 'Loading...'}
                </p>
        </div>

        {/* Phone Number */}
        <div className="px-6 py-4">
          <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">Phone Number</h3>
            {!isEditingPhone && !savedPhone && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsEditingPhone(true)}
                className="text-orange-500 hover:text-orange-600 hover:bg-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            )}
          </div>
          
          {isEditingPhone ? (
            <div className="space-y-2">
              <Input
                type="tel"
                placeholder="Enter phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                      className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={handleSavePhone}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setIsEditingPhone(false)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center">
                    <p className="text-gray-600">
                {savedPhone || 'No phone number added'}
              </p>
              {savedPhone && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsEditingPhone(true)}
                  className="text-orange-500 hover:text-orange-600 hover:bg-gray-800"
                >
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Emergency Contacts */}
        <div className="px-6 py-4 border-t border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-4">Emergency Contacts</h3>
          {emergencyContacts.map((contact) => (
                  <div key={contact.id} className="mb-4 p-3 bg-gray-50 rounded-lg flex justify-between items-start">
              <div>
                      <p className="font-medium text-gray-900">{contact.name}</p>
                      <p className="text-sm text-gray-600">{contact.relationship}</p>
                      <p className="text-sm text-gray-600">{contact.phoneNumber}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditEmergencyContact(contact)}
                  className="text-orange-500 hover:text-orange-600 hover:bg-gray-700"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteEmergencyContact(contact.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-gray-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {isAddingEmergencyContact ? (
            <div className="space-y-2 mb-4">
              <Input
                placeholder="Name"
                value={newEmergencyContact.name}
                onChange={(e) => setNewEmergencyContact({...newEmergencyContact, name: e.target.value})}
                      className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <Input
                placeholder="Relationship"
                value={newEmergencyContact.relationship}
                onChange={(e) => setNewEmergencyContact({...newEmergencyContact, relationship: e.target.value})}
                      className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <Input
                placeholder="Phone Number"
                value={newEmergencyContact.phoneNumber}
                onChange={(e) => setNewEmergencyContact({...newEmergencyContact, phoneNumber: e.target.value})}
                      className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={editingEmergencyContactId ? handleUpdateEmergencyContact : handleAddEmergencyContact}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingEmergencyContactId ? 'Update' : 'Add'} Contact
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsAddingEmergencyContact(false)
                    setEditingEmergencyContactId(null)
                    setNewEmergencyContact({ name: '', relationship: '', phoneNumber: '' })
                  }}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              onClick={() => setIsAddingEmergencyContact(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              Add Emergency Contact
            </Button>
          )}
        </div>

        {/* Bank Accounts */}
        <div className="px-6 py-4 border-t border-gray-800">
                <h3 className="text-lg font-semibold text-white mb-4">Bank Accounts</h3>
          {bankAccounts.map((account) => (
                  <div key={account.id} className="mb-4 p-3 bg-gray-50 rounded-lg flex justify-between items-start">
              <div>
                      <p className="font-medium text-gray-900">
                        {account.bank_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {account.account_type}
                      </p>
                      <p className="text-sm text-gray-600">
                        ****{account.account_number?.slice(-4)}
                      </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditBankAccount(account)}
                  className="text-orange-500 hover:text-orange-600 hover:bg-gray-700"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteBankAccount(account.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-gray-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {isAddingBankAccount ? (
            <div className="space-y-2 mb-4">
              <Input
                placeholder="Bank Name"
                      value={newBankAccount.bank_name}
                      onChange={(e) => setNewBankAccount({...newBankAccount, bank_name: e.target.value})}
                      className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <Input
                placeholder="Account Type"
                      value={newBankAccount.account_type}
                      onChange={(e) => setNewBankAccount({...newBankAccount, account_type: e.target.value})}
                      className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <Input
                placeholder="Account Number"
                      value={newBankAccount.account_number}
                      onChange={(e) => setNewBankAccount({...newBankAccount, account_number: e.target.value})}
                      className="bg-gray-50 border-gray-200 text-gray-900"
              />
              <div className="flex gap-2">
                <Button 
                  onClick={editingBankAccountId ? handleUpdateBankAccount : handleAddBankAccount}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {editingBankAccountId ? 'Update' : 'Add'} Bank Account
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsAddingBankAccount(false)
                    setEditingBankAccountId(null)
                          setNewBankAccount({ bank_name: '', account_type: '', account_number: '' })
                  }}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button 
              onClick={() => setIsAddingBankAccount(true)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              Add Bank Account
            </Button>
          )}
        </div>

        {/* Settings */}
        <div className="px-6 py-4 border-t border-gray-300">
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </PopoverTrigger>
            <SettingsPopup
              initialSettings={appSettings}
              onSettingsChange={(newSettings) => {
                setAppSettings(newSettings)
                // Save to backend
                const saveSettings = async () => {
                  const { data: { session } } = await supabase.auth.getSession()
                  if (session?.user) {
                    await supabase
                      .from('user_settings')
                      .upsert({
                        user_id: session.user.id,
                        ...newSettings,
                        updated_at: new Date().toISOString()
                      })
                  }
                }
                saveSettings()
              }}
            />
          </Popover>
        </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

