/**
 * Frontend API client communicating with FastAPI backend.
 * Credentials 'include' ensures HTTP-only session cookies persist.
 */
import type {
  FarmerSnapshot,
  DiscrepanciesResponse,
  CaseItem,
  BankQueueItem,
  PolicyDashboardData,
  RulesData,
} from '../types/models';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const API_BASE = `${API_BASE_URL}/api`;

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorDetail = 'API request failed';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // Fallback
    }
    throw new Error(errorDetail);
  }

  return res.json() as Promise<T>;
}

// ── Auth APIs ────────────────────────────────────────────────────────

export async function sendOtp(mobile: string) {
  return apiFetch<{ status: string; mobile: string; demo_otp_hint: string }>('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  });
}

export async function verifyOtp(mobile: string, otp: string) {
  return apiFetch<{ message: string; farmer: any; session_token: string; role: string }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile, otp }),
  });
}

export async function loginWithKhasra(khasra_no: string, registry_no?: string) {
  return apiFetch<{ message: string; farmer: any; session_token: string; role: string }>('/auth/login-khasra', {
    method: 'POST',
    body: JSON.stringify({ khasra_no, registry_no }),
  });
}

export async function signupSendOtp(mobile: string) {
  return apiFetch<{ status: string; mobile: string; otp: string; message: string; expires_in_seconds: number }>('/auth/signup-send-otp', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  });
}

export async function signupVerifyOtp(params: { mobile: string; otp: string; khasra_no?: string; name?: string }) {
  return apiFetch<{ message: string; farmer: any; session_token: string; role: string }>('/auth/signup-verify', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getSession() {
  return apiFetch<{ authenticated: boolean; farmer: any }>('/auth/session');
}

export async function recordConsent(consent_given: boolean) {
  return apiFetch<{ status: string; consent_given: boolean }>('/auth/consent', {
    method: 'POST',
    body: JSON.stringify({ consent_given }),
  });
}

export async function logout() {
  return apiFetch<{ status: string }>('/auth/logout', {
    method: 'POST',
  });
}

// ── Farmer APIs ──────────────────────────────────────────────────────

export async function getFarmerSnapshot(): Promise<FarmerSnapshot> {
  return apiFetch<FarmerSnapshot>('/farmer/snapshot');
}

export async function getFarmerDiscrepancies(): Promise<DiscrepanciesResponse> {
  return apiFetch<DiscrepanciesResponse>('/farmer/discrepancies');
}

export async function explainRejection(params: {
  reason_chip: string;
  crop_name?: string;
  custom_reason?: string;
  paddy_acres?: string;
  quantity_offered_quintals?: string;
  moisture_pct?: string;
}) {
  return apiFetch<{
    verdict: string;
    explanation_hi: string;
    explanation_en: string;
    speech_text_hi: string;
    speech_text_en: string;
    suggested_action: string;
  }>('/farmer/explain-rejection', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function createCase(data: {
  parcel_id?: string | null;
  authority_name: string;
  authority_designation: string;
  scheme_id: string;
  entitled_paise: number;
  actual_paise: number;
  gap_paise: number;
  details: string;
}): Promise<CaseItem> {
  return apiFetch<CaseItem>('/farmer/cases', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getFarmerCases(): Promise<CaseItem[]> {
  return apiFetch<CaseItem[]>('/farmer/cases');
}

export async function evaluateSchemes(answers?: Record<string, any>) {
  return apiFetch<{
    eligible_schemes: any[];
    not_eligible_schemes: any[];
    total_evaluated: number;
    rules_last_reviewed: string;
    provenance: string;
  }>('/v1/farmer/schemes/evaluate', {
    method: 'POST',
    body: JSON.stringify({ answers: answers || {} }),
  });
}

export async function calculateKCC(params: {
  principal_paise: number;
  lender_type: string;
  is_repaid_timely: boolean;
  duration_months: number;
  actual_interest_charged_paise?: number;
}) {
  return apiFetch<any>('/farmer/calculate-kcc', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function calculatePaddy(params: {
  acres: number;
  grade: string;
  moisture_pct: number;
  quantity_offered_quintals: number;
  actual_received_paise?: number;
  crop_type?: string;
}) {
  return apiFetch<any>('/farmer/calculate-paddy', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function calculatePMFBY(params: {
  acres: number;
  season: string;
  sum_insured_per_acre_paise: number;
  threshold_yield_kg: number;
  actual_yield_kg: number;
  actual_claim_received_paise?: number;
}) {
  return apiFetch<any>('/farmer/calculate-pmfby', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}


// ── Bank APIs ────────────────────────────────────────────────────────

export interface BankOfficerProfile {
  id: string;
  full_name: string;
  email: string;
  employee_id: string;
  bank_name: string;
  branch_district: string;
  role: string;
}

export async function registerBankOfficer(data: {
  full_name: string;
  email: string;
  employee_id: string;
  bank_name: string;
  branch_district: string;
  password: string;
}) {
  return apiFetch<{ message: string; officer: BankOfficerProfile; session_token: string }>('/v1/auth/bank/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function loginBankOfficer(data: { identifier: string; password: string }) {
  return apiFetch<{ message: string; officer: BankOfficerProfile; session_token: string }>('/v1/auth/bank/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getBankOfficerMe() {
  return apiFetch<BankOfficerProfile>('/v1/auth/bank/me');
}

export async function logoutBankOfficer() {
  return apiFetch<{ status: string; message: string }>('/v1/auth/logout', {
    method: 'POST',
  });
}

// ── Policy Officer Auth APIs ──────────────────────────────────────────

export interface PolicyOfficerProfile {
  id: string;
  full_name: string;
  email: string;
  employee_id: string;
  department: string;
  designation: string;
  jurisdiction: string;
  role: string;
}

export async function registerPolicyOfficer(data: {
  full_name: string;
  email: string;
  employee_id: string;
  department: string;
  designation: string;
  jurisdiction: string;
  password: string;
}) {
  return apiFetch<{ message: string; officer: PolicyOfficerProfile; session_token: string }>('/v1/auth/policy/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function loginPolicyOfficer(data: { identifier: string; password: string }) {
  return apiFetch<{ message: string; officer: PolicyOfficerProfile; session_token: string }>('/v1/auth/policy/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getPolicyOfficerMe() {
  return apiFetch<PolicyOfficerProfile>('/v1/auth/policy/me');
}

export async function logoutPolicyOfficer() {
  return apiFetch<{ message: string }>('/v1/auth/policy/logout', {
    method: 'POST',
  });
}


export async function getBankLocations() {
  return apiFetch<{ districts: string[]; hierarchy: Record<string, Record<string, string[]>> }>('/v1/bank/locations');
}

export async function getBankRegistry(search?: string, district?: string) {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (district) query.set('district', district);
  const qStr = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<{ total: number; records: any[] }>(`/v1/bank/registry${qStr}`);
}

export async function verifyBankInteractive(params: {
  district: string;
  tehsil: string;
  village: string;
  khasra_no: string;
  applicant_name: string;
  applicant_father: string;
  requested_amount_rupees: number;
  loan_type?: string;
  application_id?: string;
}) {
  return apiFetch<any>('/v1/bank/interactive-verify', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function submitBankVerdict(params: {
  application_id: string;
  parcel_id?: string;
  khasra_no: string;
  applicant_name: string;
  decision: string;
  officer_notes?: string;
  flags?: any[];
}) {
  return apiFetch<{
    status: string;
    application_id: string;
    receipt_hash: string;
    short_hash: string;
    recorded_at: string;
    officer_id: string;
  }>('/v1/bank/verdict', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getBankKPIs() {
  return apiFetch<{
    verified_count: number;
    review_needed_count: number;
    blocked_count: number;
    audit_chain_length: number;
    total_applications: number;
  }>('/v1/bank/kpis');
}

export async function getBankAuditLog() {
  return apiFetch<{ total: number; events: any[] }>('/v1/bank/audit-log');
}

export async function verifyBankAuditChain() {
  return apiFetch<{
    is_valid: boolean;
    total_events: number;
    head_hash: string;
    verified_at: string;
    message: string;
  }>('/v1/bank/audit-log/verify');
}

export async function getBankQueue(): Promise<BankQueueItem[]> {
  return apiFetch<BankQueueItem[]>('/bank/queue');
}

export async function verifyBankApplication(application_id: string, decision: 'APPROVE' | 'REJECT', officer_notes?: string) {
  return apiFetch<{ application_id: string; status: string; receipt_hash: string; recorded_at: string }>('/bank/verify', {
    method: 'POST',
    body: JSON.stringify({ application_id, decision, officer_notes }),
  });
}

// ── Policy APIs ──────────────────────────────────────────────────────

export async function getPolicyBottlenecks(): Promise<PolicyDashboardData> {
  return apiFetch<PolicyDashboardData>('/policy/bottlenecks');
}

export async function getPolicyAuditLog() {
  return apiFetch<{
    chain_valid: boolean;
    tamper_detected: boolean;
    integrity_status: string;
    total_events: number;
    events: any[];
  }>('/policy/audit-log');
}

// ── Rules APIs ───────────────────────────────────────────────────────

export async function getRules(): Promise<RulesData> {
  return apiFetch<RulesData>('/rules');
}

// ── Farmer Loans & Banker Bridge ──────────────────────────────────────

export interface BankDecisionItem {
  application_id: string;
  bank_name: string;
  loan_type: string;
  requested_paise: number;
  requested_display: string;
  decision: string; // APPROVED, HOLD, REJECT, UNDER_REVIEW
  decided_at?: string | null;
  audit_hash?: string | null;
  short_hash?: string | null;
  message_hi?: string | null;
  message_en?: string | null;
  message_chh?: string | null;
  reason_hi?: string | null;
  reason_en?: string | null;
  reason_chh?: string | null;
  responsible_dept?: string | null;
  next_steps_hi?: string | null;
  next_steps_en?: string | null;
  next_steps_chh?: string | null;
  can_dispute?: boolean;
  flags?: any[];
  officer_notes?: string | null;
}

export interface FarmerLoanApplication extends BankDecisionItem {}

export interface FarmerLoansResponse {
  farmer_id: string;
  loans: any[];
  bank_decisions: BankDecisionItem[];
  applications: BankDecisionItem[];
}

export async function getFarmerLoans(): Promise<FarmerLoansResponse> {
  return apiFetch<FarmerLoansResponse>('/v1/farmer/loans-and-decisions');
}

export async function getFarmerLoansAndDecisions(): Promise<FarmerLoansResponse> {
  return apiFetch<FarmerLoansResponse>('/v1/farmer/loans-and-decisions');
}

// ── Applied Schemes & Live Payout Discrepancy (Loop 1) ─────────────────

export interface AppliedSchemeItem {
  id: string;
  farmer_id: string;
  scheme_code: string;
  scheme_name: string;
  entitled_paise: number;
  entitled_display: string;
  actual_received_paise: number;
  actual_received_display: string;
  expected_release_date?: string | null;
  official_portal_url?: string | null;
  applied_at: string;
  status: string;
  rule_id: string;
  provenance: string;
  discrepancy_verdict: 'NO_DISCREPANCY' | 'PENDING_RELEASE' | 'DISCREPANCY_DETECTED';
  verdict_badge: string;
  badge_color: 'GREEN' | 'BLUE' | 'RED';
  gap_paise: number;
  gap_display: string;
  rule_steps: { step: number; title: string; desc: string }[];
}

export interface AppliedSchemesResponse {
  farmer_id: string;
  applied_schemes: AppliedSchemeItem[];
}

export async function getAppliedSchemes(): Promise<AppliedSchemesResponse> {
  return apiFetch<AppliedSchemesResponse>('/v1/farmer/applied-schemes');
}

export async function applyFarmerScheme(data: {
  scheme_code: string;
  scheme_name: string;
  entitled_paise: number;
  official_portal_url?: string;
  expected_release_date?: string;
}): Promise<{ status: string; message: string; application: AppliedSchemeItem }> {
  return apiFetch('/v1/farmer/schemes/apply', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAppliedSchemeReceived(
  id: string,
  actual_received_paise: number
): Promise<AppliedSchemeItem> {
  return apiFetch<AppliedSchemeItem>(`/v1/farmer/applied-schemes/${id}/received`, {
    method: 'PATCH',
    body: JSON.stringify({ actual_received_paise }),
  });
}

export async function resolveAppliedScheme(id: string): Promise<any> {
  return apiFetch(`/v1/farmer/applied-schemes/${id}/resolve`, {
    method: 'POST',
  });
}

export async function moveSchemeToGrievance(id: string): Promise<any> {
  return apiFetch(`/v1/farmer/applied-schemes/${id}/move-to-grievance`, {
    method: 'POST',
  });
}

export async function updateCaseStatus(case_id: string, new_status: string): Promise<any> {
  return apiFetch(`/v1/farmer/cases/${case_id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ new_status }),
  });
}

