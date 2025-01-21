'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from 'next/navigation'
import { Plus, Settings, Save, Edit, Trash2, ArrowLeft } from 'lucide-react'
import { Popover, PopoverTrigger } from "@/components/ui/popover"
import { SettingsPopup, AppSettings } from './settings-popup'
import { supabase } from '@/lib/supabase'
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Phone } from 'lucide-react'

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
    textSize: 'medium',
    volume: 50,
    currency: 'INR',
    language: 'en',
    voiceType: 'default',
    theme: 'light'
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (appSettings?.textSize) {
      document.documentElement.style.setProperty('--text-base-size', `${appSettings.textSize}px`)
    }
  }, [appSettings?.textSize])

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
          <div className="w-[400px] h-[700px] rounded-3xl bg-[#FFFBEB] shadow-xl relative animate-in slide-in-from-bottom-4">
            {/* Header */}
            <div className="flex justify-between items-center p-6">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onClose}
                className="rounded-full hover:bg-[#FFEDD5]"
              >
                <ArrowLeft className="h-6 w-6 text-[#EA580C]" />
              </Button>
              <Button
                variant="ghost"
                onClick={onSignOut}
                className="rounded-full bg-orange-500 text-white hover:bg-orange-600 px-6"
              >
                Sign Out
              </Button>
            </div>

            {/* Profile Info */}
            <div className="p-6 bg-[#FFEDD5] border-b-2 border-[#F97316]">
              <h2 className="text-2xl font-bold text-[#9A3412] mb-2">
                {user?.profile?.full_name || user?.user_metadata?.full_name || 'Loading...'}
              </h2>
              <p className="text-[#9A3412]">
                {user?.profile?.email || user?.email || 'Loading...'}
              </p>
            </div>

            {/* Content Area with Scrolling */}
            <div className="flex-1 h-[calc(100%-200px)] overflow-y-auto no-scrollbar">
              {/* Phone Number */}
              <div className="px-6 py-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-[#EA580C]">Phone Number</h3>
                  {!isEditingPhone && !savedPhone && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsEditingPhone(true)}
                      className="text-orange-500 hover:bg-orange-100"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  )}
                </div>
                {isEditingPhone ? (
                  <div className="space-y-2">
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter phone number"
                      className="bg-white border-2 border-[#F97316] text-[#9A3412] placeholder:text-[#9A3412]/50"
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
                        onClick={() => {
                          setIsEditingPhone(false)
                          setPhoneNumber(savedPhone)
                        }}
                        className="border-[#EA580C] text-[#EA580C] hover:bg-[#FFEDD5]"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  savedPhone && (
                    <div className="flex justify-between items-center">
                      <p className="text-[#9A3412]">{savedPhone}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingPhone(true)}
                        className="text-[#EA580C] hover:bg-[#FFEDD5]"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                )}
              </div>

              {/* Action Buttons and Forms */}
              <div className="px-6 py-4 space-y-4">
                <div>
                  <Button 
                    onClick={() => setIsAddingEmergencyContact(!isAddingEmergencyContact)}
                    className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white text-lg font-semibold rounded-xl"
                  >
                    Add Emergency Contact
                  </Button>
                  
                  {/* Emergency Contact Form */}
                  {isAddingEmergencyContact && (
                    <div className="mt-4 p-4 bg-[#FFEDD5] rounded-xl border-2 border-[#F97316]">
                      <div className="space-y-3">
                        <Input
                          placeholder="Name"
                          value={newEmergencyContact.name}
                          onChange={(e) => setNewEmergencyContact({...newEmergencyContact, name: e.target.value})}
                          className="bg-white border-2 border-[#F97316] text-[#9A3412] placeholder:text-[#9A3412]/50"
                        />
                        <Input
                          placeholder="Relationship"
                          value={newEmergencyContact.relationship}
                          onChange={(e) => setNewEmergencyContact({...newEmergencyContact, relationship: e.target.value})}
                          className="bg-white border-2 border-[#F97316] text-[#9A3412] placeholder:text-[#9A3412]/50"
                        />
                        <Input
                          placeholder="Phone Number"
                          value={newEmergencyContact.phoneNumber}
                          onChange={(e) => setNewEmergencyContact({...newEmergencyContact, phoneNumber: e.target.value})}
                          className="bg-white border-2 border-[#F97316] text-[#9A3412] placeholder:text-[#9A3412]/50"
                        />
                        <div className="flex gap-2">
                          <Button 
                            onClick={editingEmergencyContactId ? handleUpdateEmergencyContact : handleAddEmergencyContact}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
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
                            className="border-[#EA580C] text-[#EA580C] hover:bg-[#FFEDD5]"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Button 
                    onClick={() => setIsAddingBankAccount(!isAddingBankAccount)}
                    className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white text-lg font-semibold rounded-xl"
                  >
                    Add Bank Account
                  </Button>

                  {/* Bank Account Form */}
                  {isAddingBankAccount && (
                    <div className="mt-4 p-4 bg-[#FFEDD5] rounded-xl border-2 border-[#F97316]">
                      <div className="space-y-3">
                        <Input
                          placeholder="Bank Name"
                          value={newBankAccount.bank_name}
                          onChange={(e) => setNewBankAccount({...newBankAccount, bank_name: e.target.value})}
                          className="bg-white border-2 border-[#F97316] text-[#9A3412] placeholder:text-[#9A3412]/50"
                        />
                        <Input
                          placeholder="Account Type"
                          value={newBankAccount.account_type}
                          onChange={(e) => setNewBankAccount({...newBankAccount, account_type: e.target.value})}
                          className="bg-white border-2 border-[#F97316] text-[#9A3412] placeholder:text-[#9A3412]/50"
                        />
                        <Input
                          placeholder="Account Number"
                          value={newBankAccount.account_number}
                          onChange={(e) => setNewBankAccount({...newBankAccount, account_number: e.target.value})}
                          className="bg-white border-2 border-[#F97316] text-[#9A3412] placeholder:text-[#9A3412]/50"
                        />
                        <div className="flex gap-2">
                          <Button 
                            onClick={editingBankAccountId ? handleUpdateBankAccount : handleAddBankAccount}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {editingBankAccountId ? 'Update' : 'Add'} Account
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              setIsAddingBankAccount(false)
                              setEditingBankAccountId(null)
                              setNewBankAccount({ bank_name: '', account_type: '', account_number: '' })
                            }}
                            className="border-[#EA580C] text-[#EA580C] hover:bg-[#FFEDD5]"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-full h-14 bg-orange-500 hover:bg-orange-600 text-white text-lg font-semibold rounded-xl"
                >
                  <Settings className="h-5 w-5 mr-2" />
                  Settings
                </Button>

                {/* Settings Dialog */}
                <SettingsPopup
                  initialSettings={appSettings}
                  open={isSettingsOpen}
                  onOpenChange={setIsSettingsOpen}
                  onSettingsChange={(newSettings) => {
                    setAppSettings(newSettings)
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
              </div>

              {/* Emergency Contacts List */}
              {emergencyContacts.length > 0 && (
                <div className="px-6 py-4">
                  <h3 className="text-lg font-bold text-[#EA580C] mb-4">Emergency Contacts</h3>
                  <div className="space-y-3">
                    {emergencyContacts.map((contact) => (
                      <div 
                        key={contact.id} 
                        className="p-4 bg-[#FFEDD5] rounded-xl border-2 border-[#F97316] group hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-[#9A3412] group-hover:text-[#EA580C] transition-colors">
                              {contact.name}
                            </p>
                            <p className="text-sm text-[#9A3412]">{contact.relationship}</p>
                            <p className="text-sm text-[#9A3412]">{contact.phoneNumber}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEmergencyContact(contact)}
                              className="rounded-full hover:bg-[#FEF3C7] text-[#EA580C]"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEmergencyContact(contact.id)}
                              className="rounded-full hover:bg-[#FEF3C7] text-[#DC2626]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank Accounts List */}
              {bankAccounts.length > 0 && (
                <div className="px-6 py-4">
                  <h3 className="text-lg font-bold text-[#EA580C] mb-4">Bank Accounts</h3>
                  <div className="space-y-3">
                    {bankAccounts.map((account) => (
                      <div 
                        key={account.id} 
                        className="p-4 bg-[#FFEDD5] rounded-xl border-2 border-[#F97316] group hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-[#9A3412] group-hover:text-[#EA580C] transition-colors">
                              {account.bank_name}
                            </p>
                            <p className="text-sm text-[#9A3412]">{account.account_type}</p>
                            <p className="text-sm text-[#9A3412]">****{account.account_number?.slice(-4)}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditBankAccount(account)}
                              className="rounded-full hover:bg-[#FEF3C7] text-[#EA580C]"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBankAccount(account.id)}
                              className="rounded-full hover:bg-[#FEF3C7] text-[#DC2626]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

