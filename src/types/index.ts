export type UserRole = 'admin' | 'contractor' | 'customer'
export type AvailabilityStatus = 'available' | 'partial' | 'busy'
export type EnquiryStatus = 'new' | 'read' | 'responded' | 'closed'
export type InviteStatus = 'pending' | 'active' | 'revoked'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  company: string | null
  created_at: string
}

export interface Contractor {
  id: string
  profile_id: string
  alias: string
  specialty: string
  cv_summary: string | null
  skills: string[]
  active: boolean
  capability_file_url: string | null
  created_at: string
  updated_at: string
  experience?: ContractorExperience[]
  availability?: Availability[]
}

export interface ContractorExperience {
  id: string
  contractor_id: string
  year_range: string
  description: string
  sort_order: number
  created_at: string
}

export interface Availability {
  id: string
  contractor_id: string
  date: string
  status: AvailabilityStatus
  note: string | null
  created_at: string
  updated_at: string
}

export interface CustomerInvite {
  id: string
  email: string
  company: string
  status: InviteStatus
  invited_by: string | null
  profile_id: string | null
  created_at: string
  claimed_at: string | null
}

export interface Enquiry {
  id: string
  customer_id: string
  contractor_id: string
  preferred_dates: string | null
  message: string
  contact_name: string | null
  status: EnquiryStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
  customer?: Profile
  contractor?: Contractor
}

export interface UpsertAvailabilityInput {
  contractor_id: string
  date: string
  status: AvailabilityStatus
  note?: string
}

export interface CreateEnquiryInput {
  contractor_id: string
  preferred_dates?: string
  message: string
  contact_name?: string
}

export interface CreateInviteInput {
  email: string
  company: string
}
