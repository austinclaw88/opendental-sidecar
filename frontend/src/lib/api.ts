// Uses relative URLs — Next.js rewrites proxy /api/* to the backend.
// In dev (no Docker): set API_PROXY_TARGET=http://localhost:5000 in .env.local
// In Docker: the compose file sets it to http://backend:8080

export interface PatientSummary {
  patNum: number;
  lName: string;
  fName: string;
  middleI?: string;
  preferred?: string;
  birthdate?: string;
  hmPhone?: string;
  wkPhone?: string;
  wirelessPhone?: string;
  email?: string;
  patStatus: number;
  patStatusDesc: string;
}

export interface InsuranceSummary {
  planNum: number;
  carrierName: string;
  groupName?: string;
  groupId?: string;
  ordinal: number;
  subscriberName?: string;
  subscriberId?: string;
}

export interface PatientDetail {
  patNum: number;
  lName: string;
  fName: string;
  middleI?: string;
  preferred?: string;
  birthdate?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  hmPhone?: string;
  wkPhone?: string;
  wirelessPhone?: string;
  email?: string;
  patStatus: number;
  patStatusDesc: string;
  guarantor?: number;
  guarantorName: string;
  preferredProvider?: number;
  preferredProviderName: string;
  insurancePlans: InsuranceSummary[];
}

export interface Appointment {
  aptNum: number;
  patNum: number;
  provNum?: number;
  providerName?: string;
  operatoryNum?: number;
  operatoryName?: string;
  aptDateTime: string;
  aptStatus: number;
  aptStatusDesc: string;
  note?: string;
  procDescript?: string;
  clinicNum?: number;
}

export interface Procedure {
  procNum: number;
  patNum: number;
  provNum?: number;
  providerName?: string;
  aptNum?: number;
  codeNum: number;
  procCode: string;
  descript: string;
  procDate: string;
  procFee: number;
  procStatus: number;
  procStatusDesc: string;
  toothNum?: string;
  toothRange?: string;
  surf?: string;
  procNotes?: string;
}

export interface ClaimDto {
  claimNum: number;
  patNum: number;
  provNum?: number;
  providerName?: string;
  planNum?: number;
  carrierName?: string;
  insSubNum?: number;
  claimStatus: number;
  claimStatusDesc: string;
  dateService?: string;
  dateSent?: string;
  claimFee: number;
  insPayAmt: number;
  writeOff: number;
  dedApplied: number;
  carrierNum?: number;
  claimForm?: number;
}

export interface ClaimProc {
  claimProcNum: number;
  claimNum: number;
  procNum: number;
  procCode: string;
  descript: string;
  procFee: number;
  insPayAmt: number;
  dedApplied: number;
  writeOff: number;
  status: number;
  statusDesc: string;
  toothNum?: string;
  surf?: string;
}

export interface ClaimPayment {
  claimPaymentNum: number;
  claimNum: number;
  payAmt: number;
  datePay?: string;
  checkNum?: string;
}

export interface ClaimDetail {
  claimNum: number;
  patNum: number;
  claimStatus: number;
  claimStatusDesc: string;
  carrierName?: string;
  dateService?: string;
  dateSent?: string;
  dateReceived?: string;
  claimFee: number;
  insPayAmt: number;
  writeOff: number;
  dedApplied: number;
  balanceRemaining: number;
  insEstimate: number;
  claimForm?: number;
  providerName?: string;
  procedures: ClaimProc[];
  payments: ClaimPayment[];
}

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  searchPatients: (q: string, limit = 50) =>
    fetchApi<PatientSummary[]>(`/patients/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  getPatient: (patNum: number) =>
    fetchApi<PatientDetail>(`/patients/${patNum}`),

  getAppointments: (patNum: number) =>
    fetchApi<Appointment[]>(`/patients/${patNum}/appointments`),

  getProcedures: (patNum: number) =>
    fetchApi<Procedure[]>(`/patients/${patNum}/procedures`),

  getClaims: (patNum: number) =>
    fetchApi<ClaimDto[]>(`/patients/${patNum}/claims`),

  getClaimDetail: (claimNum: number) =>
    fetchApi<ClaimDetail>(`/claims/${claimNum}`),
};
