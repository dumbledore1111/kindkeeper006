'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from 'next/navigation'
import { Phone, Plus, Settings, Save, X, Edit, Trash2 } from 'lucide-react'
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { SettingsPopup, AppSettings } from './settings-popup'
import { supabase } from '@/lib/supabase'

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
    theme: 'dark' as const,
  })
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--text-base-size', `${appSettings.textSize}px`)
  }, [appSettings.textSize])

  useEffect(() => {
    async function loadUserData() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        console.log('User data:', {
          email: session.user.email,
          metadata: session.user.user_metadata,
          displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name
        });

        // First try to get existing profile
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        console.log('Existing profile:', existingProfile); // Debug log

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

        console.log('Profile update result:', { profile, error }); // Debug log

        if (!error && profile) {
          setUser({
            ...session.user,
            profile: profile
          });
          setSavedPhone(profile.phone_number || '');
        } else {
          console.error('Profile update error:', error);
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
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="left" 
        className={`w-[400px] ${appSettings.theme === 'light' ? 'bg-white text-black' : 'bg-gray-900 text-white'} p-0 border-r-gray-300 overflow-y-auto`}
      >
        {/* Header */}
        <div className={`flex justify-between items-center p-4 ${appSettings.theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'} sticky top-0 z-10`}>
          <Button 
            onClick={onClose}
            className="w-24 h-10 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 
                     text-black font-medium hover:from-orange-500 hover:to-orange-600 
                     transition-colors border-0"
          >
            Back
          </Button>
          <Button 
            onClick={handleLogout}
            className="w-24 h-10 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 
                     text-black font-medium hover:from-orange-500 hover:to-orange-600 
                     transition-colors border-0"
          >
            Log Out
          </Button>
        </div>

        {/* Profile Info */}
        <div className={`p-6 ${appSettings.theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'} mb-4`}>
          <h2 className={`text-2xl font-bold ${appSettings.theme === 'light' ? 'text-gray-900' : 'text-white'} mb-2`}>
            {user?.profile?.full_name || user?.user_metadata?.full_name || 'Loading...'}
          </h2>
          <p className={appSettings.theme === 'light' ? 'text-gray-600' : 'text-gray-300'}>
            {user?.profile?.email || user?.email || 'Loading...'}
          </p>
        </div>

        {/* Phone Number */}
        <div className="px-6 py-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className={`text-lg font-semibold ${appSettings.theme === 'light' ? 'text-gray-900' : 'text-white'}`}>Phone Number</h3>
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
                className={appSettings.theme === 'light' ? 'bg-white border-gray-300 text-black' : 'bg-gray-800 border-gray-700 text-white'}
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
              <p className={appSettings.theme === 'light' ? 'text-gray-600' : 'text-gray-300'}>
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
          <h3 className={`text-lg font-semibold ${appSettings.theme === 'light' ? 'text-gray-900' : 'text-white'} mb-4`}>Emergency Contacts</h3>
          {emergencyContacts.map((contact) => (
            <div key={contact.id} className={`mb-4 p-3 ${appSettings.theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'} rounded-lg flex justify-between items-start`}>
              <div>
                <p className={`font-medium ${appSettings.theme === 'light' ? 'text-gray-900' : 'text-white'}`}>{contact.name}</p>
                <p className={`text-sm ${appSettings.theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>{contact.relationship}</p>
                <p className={`text-sm ${appSettings.theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>{contact.phoneNumber}</p>
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
                className={appSettings.theme === 'light' ? 'bg-white border-gray-300 text-black' : 'bg-gray-800 border-gray-700 text-white'}
              />
              <Input
                placeholder="Relationship"
                value={newEmergencyContact.relationship}
                onChange={(e) => setNewEmergencyContact({...newEmergencyContact, relationship: e.target.value})}
                className={appSettings.theme === 'light' ? 'bg-white border-gray-300 text-black' : 'bg-gray-800 border-gray-700 text-white'}
              />
              <Input
                placeholder="Phone Number"
                value={newEmergencyContact.phoneNumber}
                onChange={(e) => setNewEmergencyContact({...newEmergencyContact, phoneNumber: e.target.value})}
                className={appSettings.theme === 'light' ? 'bg-white border-gray-300 text-black' : 'bg-gray-800 border-gray-700 text-white'}
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
          <h3 className={`text-lg font-semibold ${appSettings.theme === 'light' ? 'text-gray-900' : 'text-white'} mb-4`}>Bank Accounts</h3>
          {bankAccounts.map((account) => (
            <div key={account.id} className={`mb-4 p-3 ${appSettings.theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'} rounded-lg flex justify-between items-start`}>
              <div>
                <p className={`font-medium ${appSettings.theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                  {account.bank_name}
                </p>
                <p className={`text-sm ${appSettings.theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
                  {account.account_type}
                </p>
                <p className={`text-sm ${appSettings.theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}>
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
                className={appSettings.theme === 'light' ? 'bg-white border-gray-300 text-black' : 'bg-gray-800 border-gray-700 text-white'}
              />
              <Input
                placeholder="Account Type"
                value={newBankAccount.account_type}
                onChange={(e) => setNewBankAccount({...newBankAccount, account_type: e.target.value})}
                className={appSettings.theme === 'light' ? 'bg-white border-gray-300 text-black' : 'bg-gray-800 border-gray-700 text-white'}
              />
              <Input
                placeholder="Account Number"
                value={newBankAccount.account_number}
                onChange={(e) => setNewBankAccount({...newBankAccount, account_number: e.target.value})}
                className={appSettings.theme === 'light' ? 'bg-white border-gray-300 text-black' : 'bg-gray-800 border-gray-700 text-white'}
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
                Settings
              </Button>
            </PopoverTrigger>
            <SettingsPopup
              initialSettings={appSettings}
              onSettingsChange={(newSettings) => {
                setAppSettings(newSettings)
                // Here you would typically save to your backend
                console.log('New settings:', newSettings)
              }}
            />
          </Popover>
        </div>
      </SheetContent>
    </Sheet>
  )
}

