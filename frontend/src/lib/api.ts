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
  gender?: number;
  chartNumber?: string;
  billingType?: number;
  billingTypeName?: string;
  txtMsgOk?: number;
  preferContactMethod?: number;
  apptModNote?: string;
  medUrgNote?: string;
  famFinUrgNote?: string;
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
  const res = await fetch(`/api/v1${path}`);
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

// ── Schedule & reference types ──────────────────────────────────

export interface Operatory {
  operatoryNum: number;
  opName: string;
  abbrev: string;
  itemOrder: number;
  isHygiene: boolean;
  provDentist?: number;
  provHygienist?: number;
  clinicNum?: number;
}

export interface Provider {
  provNum: number;
  abbr: string;
  lName: string;
  fName: string;
  isSecondary: boolean;
  isHidden: boolean;
  provColor: number;
  itemOrder: number;
}

export interface Definition {
  defNum: number;
  category: number;
  itemOrder: number;
  itemName: string;
  itemValue: string;
  itemColor: number;
}

export interface AppointmentType {
  appointmentTypeNum: number;
  appointmentTypeName: string;
  appointmentTypeColor: number;
  pattern: string;
  codeStr: string;
}

export interface Clinic {
  clinicNum: number;
  description: string;
  abbr: string;
}

export interface ScheduleAppointment {
  /** 0 Normal, 1 ASAP. */
  priority: number;
  aptNum: number;
  patNum: number;
  patientName: string;
  patientPhone?: string;
  aptDateTime: string;
  minutes: number;
  pattern: string;
  operatoryNum: number;
  provNum?: number;
  providerAbbr?: string;
  providerColor?: number;
  aptStatus: number;
  aptStatusDesc: string;
  confirmedDefNum: number;
  confirmedDesc?: string;
  confirmedColor?: number;
  isNewPatient: boolean;
  isHygiene: boolean;
  note?: string;
  procDescript?: string;
  appointmentTypeNum?: number;
  appointmentTypeName?: string;
  dateTimeArrived?: string;
  dateTimeSeated?: string;
  dateTimeDismissed?: string;
}

export interface AppointmentDetail extends ScheduleAppointment {
  clinicNum?: number;
  procedures: Procedure[];
}

export interface ScheduleBlock {
  scheduleNum: number;
  schedDate: string;
  startTime: string;
  stopTime: string;
  schedType: number;
  provNum?: number;
  provAbbr?: string;
  blockoutType?: number;
  blockoutDesc?: string;
  blockoutColor?: number;
  note?: string;
  ops: number[];
}

export interface ScheduleDay {
  date: string;
  operatories: Operatory[];
  appointments: ScheduleAppointment[];
  blocks: ScheduleBlock[];
}

export interface ConfirmationItem {
  priority: number;
  aptStatus: number;
  aptStatusDesc?: string;
  aptNum: number;
  patNum: number;
  patientName: string;
  hmPhone?: string;
  wirelessPhone?: string;
  email?: string;
  aptDateTime: string;
  minutes: number;
  providerAbbr?: string;
  operatoryAbbrev?: string;
  confirmedDefNum: number;
  confirmedDesc?: string;
  confirmedColor?: number;
  procDescript?: string;
  apptPhoneNote?: string;
}

// ── Account / family / commlog / recall types ───────────────────

export interface FamilyMember {
  patNum: number;
  name: string;
  birthdate?: string;
  age: number;
  patStatus: number;
  patStatusDesc: string;
  isGuarantor: boolean;
  wirelessPhone?: string;
  position: number;
}

export interface LedgerEntry {
  kind: string; // "procedure" | "payment" | "adjustment" | "insurance"
  id: number;
  date: string;
  patNum: number;
  patientName: string;
  description: string;
  providerAbbr?: string;
  amount: number;
  runningBalance: number;
}

export interface AccountSummary {
  guarantorPatNum: number;
  guarantorName: string;
  estimatedBalance: number;
  totalCharges: number;
  totalCredits: number;
  family: FamilyMember[];
  entries: LedgerEntry[];
}

export interface Commlog {
  commlogNum: number;
  patNum: number;
  commDateTime: string;
  commType: number;
  commTypeDesc: string;
  mode: number;
  modeDesc: string;
  sentOrReceived: number;
  note?: string;
}

export interface RecallDue {
  recallNum: number;
  patNum: number;
  patientName: string;
  hmPhone?: string;
  wirelessPhone?: string;
  email?: string;
  dateDue?: string;
  datePrevious?: string;
  dateScheduled?: string;
  recallTypeDesc: string;
  note?: string;
  recallStatusDesc?: string;
  isDisabled: boolean;
}

// ── Write request types ─────────────────────────────────────────

export interface CreateAppointmentRequest {
  patNum: number;
  aptDateTime: string;
  minutes: number;
  operatoryNum: number;
  provNum?: number;
  provHyg?: number;
  isHygiene?: boolean;
  isNewPatient?: boolean;
  appointmentTypeNum?: number;
  clinicNum?: number;
  note?: string;
  procDescript?: string;
  procNums?: number[];
  recallNum?: number;
}

export interface UpdateAppointmentRequest {
  aptDateTime?: string;
  minutes?: number;
  operatoryNum?: number;
  provNum?: number;
  appointmentTypeNum?: number;
  note?: string;
  procDescript?: string;
  isNewPatient?: boolean;
  procNums?: number[];
}

export interface CreatePatientRequest {
  lName: string;
  fName: string;
  middleI?: string;
  preferred?: string;
  birthdate?: string;
  gender?: number;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  hmPhone?: string;
  wkPhone?: string;
  wirelessPhone?: string;
  email?: string;
  priProv?: number;
  clinicNum?: number;
  guarantor?: number;
  title?: string;
  salutation?: string;
  /** SIN / SSN, stored as entered. */
  ssn?: string;
  /** Position: 0 Single, 1 Married, 2 Child, 3 Widowed, 4 Divorced. */
  position?: number;
  chartNumber?: string;
  language?: string;
  county?: string;
  country?: string;
  addrNote?: string;
  medUrgNote?: string;
  apptModNote?: string;
  famFinUrgNote?: string;
  employmentNote?: string;
  /** 0 Unknown, 1 OK to text, 2 Do not text. */
  txtMsgOk?: number;
  /** ContactMethod: 0 None, 2 HmPhone, 3 WkPhone, 4 WirelessPh, 5 Email, 6 SeeNotes, 8 TextMessage. */
  preferContactMethod?: number;
  preferConfirmMethod?: number;
  preferRecallMethod?: number;
  secProv?: number;
  feeSched?: number;
  /** DefNum from definition category 4 (BillingTypes). */
  billingType?: number;
  dateFirstVisit?: string;
  askToArriveEarly?: number;
  /** Premedication required (0/1). */
  premed?: number;
  /** Any other patient column by exact name; validated against the live schema. */
  extraFields?: Record<string, unknown>;
}

export interface UpdatePatientRequest {
  lName?: string;
  fName?: string;
  middleI?: string;
  preferred?: string;
  birthdate?: string;
  gender?: number;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  hmPhone?: string;
  wkPhone?: string;
  wirelessPhone?: string;
  email?: string;
  priProv?: number;
  patStatus?: number;
  clinicNum?: number;
  guarantor?: number;
  title?: string;
  salutation?: string;
  /** SIN / SSN, stored as entered. */
  ssn?: string;
  /** Position: 0 Single, 1 Married, 2 Child, 3 Widowed, 4 Divorced. */
  position?: number;
  chartNumber?: string;
  language?: string;
  county?: string;
  country?: string;
  addrNote?: string;
  medUrgNote?: string;
  apptModNote?: string;
  famFinUrgNote?: string;
  employmentNote?: string;
  /** 0 Unknown, 1 OK to text, 2 Do not text. */
  txtMsgOk?: number;
  /** ContactMethod: 0 None, 2 HmPhone, 3 WkPhone, 4 WirelessPh, 5 Email, 6 SeeNotes, 8 TextMessage. */
  preferContactMethod?: number;
  preferConfirmMethod?: number;
  preferRecallMethod?: number;
  secProv?: number;
  feeSched?: number;
  /** DefNum from definition category 4 (BillingTypes). */
  billingType?: number;
  dateFirstVisit?: string;
  askToArriveEarly?: number;
  /** Premedication required (0/1). */
  premed?: number;
  /** Any other patient column by exact name; validated against the live schema. */
  extraFields?: Record<string, unknown>;
}

export interface CreatePaymentRequest {
  patNum: number;
  payAmt: number;
  payType: number;
  payDate?: string;
  checkNum?: string;
  payNote?: string;
  provNum?: number;
  clinicNum?: number;
}

export interface CreateCommlogRequest {
  patNum: number;
  note: string;
  commType?: number;
  mode?: number;
  sentOrReceived?: number;
}

export interface WriteResult {
  id: number;
  message: string;
}


// ── Insurance ───────────────────────────────────────────────────

export interface InsuranceCoverage {
  patPlanNum: number;
  patNum: number;
  ordinal: number;
  relationship: number;
  relationshipDesc: string;
  insSubNum: number;
  subscriberPatNum: number;
  subscriberName: string;
  subscriberId?: string;
  dateEffective?: string;
  dateTerm?: string;
  subscNote?: string;
  planNum: number;
  groupName?: string;
  groupNum?: string;
  feeSchedDesc?: string;
  carrierNum: number;
  carrierName: string;
  carrierPhone?: string;
  electId?: string;
}

export interface Carrier {
  carrierNum: number;
  carrierName: string;
  phone?: string;
  electId?: string;
}

export interface CreateInsuranceRequest {
  carrierNum?: number;
  carrierName?: string;
  carrierPhone?: string;
  electId?: string;
  groupName?: string;
  groupNum?: string;
  subscriberPatNum?: number;
  subscriberId?: string;
  dateEffective?: string;
  subscNote?: string;
  relationship: number;
  ordinal?: number;
}

export interface UpdatePatPlanRequest {
  ordinal?: number;
  relationship?: number;
  subscriberId?: string;
  dateTerm?: string;
  subscNote?: string;
}

export interface ClaimQueueItem {
  claimNum: number;
  patNum: number;
  patientName: string;
  carrierName?: string;
  providerAbbr?: string;
  claimStatus: string;
  claimStatusDesc: string;
  dateService?: string;
  dateSent?: string;
  daysSinceSent?: number;
  claimFee: number;
  insPayAmt: number;
  claimType: string;
}

export interface CreateAdjustmentRequest {
  patNum: number;
  /** Signed: negative reduces the balance, positive adds a charge. */
  adjAmt: number;
  /** DefNum from definition category 1 (AdjTypes). */
  adjType: number;
  adjDate?: string;
  provNum?: number;
  clinicNum?: number;
  note?: string;
}

// ── Write helpers ───────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function sendApi<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // keep status text
    }
    throw new ApiError(res.status, message);
  }
  return res.json();
}

// ── Extended API surface ────────────────────────────────────────

export const scheduleApi = {
  getDay: (date: string, clinicNum?: number) =>
    fetchApi<ScheduleDay>(`/schedule/day?date=${date}${clinicNum ? `&clinicNum=${clinicNum}` : ""}`),

  getRange: (from: string, to: string, clinicNum?: number) =>
    fetchApi<ScheduleDay[]>(`/schedule/range?from=${from}&to=${to}${clinicNum ? `&clinicNum=${clinicNum}` : ""}`),

  getConfirmations: (from: string, to: string) =>
    fetchApi<ConfirmationItem[]>(`/schedule/confirmations?from=${from}&to=${to}`),
};

export const referenceApi = {
  getOperatories: () => fetchApi<Operatory[]>(`/reference/operatories`),
  getProviders: () => fetchApi<Provider[]>(`/reference/providers`),
  getAppointmentTypes: () => fetchApi<AppointmentType[]>(`/reference/appointment-types`),
  getClinics: () => fetchApi<Clinic[]>(`/reference/clinics`),
  getConfirmationStatuses: () => fetchApi<Definition[]>(`/reference/confirmation-statuses`),
  getPaymentTypes: () => fetchApi<Definition[]>(`/reference/payment-types`),
  getAdjustmentTypes: () => fetchApi<Definition[]>(`/reference/adjustment-types`),
  getBillingTypes: () => fetchApi<Definition[]>(`/reference/billing-types`),
  getCommlogTypes: () => fetchApi<Definition[]>(`/reference/commlog-types`),
};

export const appointmentApi = {
  getDetail: (aptNum: number) =>
    fetchApi<AppointmentDetail>(`/appointments/${aptNum}`),

  getUnscheduled: () =>
    fetchApi<ConfirmationItem[]>(`/appointments/unscheduled`),

  getAsap: () =>
    fetchApi<ConfirmationItem[]>(`/appointments/asap`),

  setPriority: (aptNum: number, priority: 0 | 1) =>
    sendApi<WriteResult>("PUT", `/appointments/${aptNum}/priority`, { priority }),

  create: (req: CreateAppointmentRequest) =>
    sendApi<WriteResult>("POST", `/appointments`, req),

  update: (aptNum: number, req: UpdateAppointmentRequest) =>
    sendApi<WriteResult>("PUT", `/appointments/${aptNum}`, req),

  setStatus: (aptNum: number, aptStatus: number, reason?: string) =>
    sendApi<WriteResult>("PUT", `/appointments/${aptNum}/status`, { aptStatus, reason }),

  setConfirmation: (aptNum: number, confirmedDefNum: number) =>
    sendApi<WriteResult>("PUT", `/appointments/${aptNum}/confirmation`, { confirmedDefNum }),

  setFlowTime: (aptNum: number, milestone: "arrived" | "seated" | "dismissed", clear = false) =>
    sendApi<WriteResult>("PUT", `/appointments/${aptNum}/flow`, { milestone, clear }),
};

export const patientApi = {
  create: (req: CreatePatientRequest) =>
    sendApi<WriteResult>("POST", `/patients`, req),

  update: (patNum: number, req: UpdatePatientRequest) =>
    sendApi<WriteResult>("PUT", `/patients/${patNum}`, req),

  getFamily: (patNum: number) =>
    fetchApi<FamilyMember[]>(`/patients/${patNum}/family`),

  getAccount: (patNum: number) =>
    fetchApi<AccountSummary>(`/patients/${patNum}/account`),

  getCommlogs: (patNum: number) =>
    fetchApi<Commlog[]>(`/patients/${patNum}/commlogs`),

  getRecalls: (patNum: number) =>
    fetchApi<RecallDue[]>(`/patients/${patNum}/recalls`),
};

export const paymentApi = {
  create: (req: CreatePaymentRequest) =>
    sendApi<WriteResult>("POST", `/payments`, req),
};

export const commlogApi = {
  create: (req: CreateCommlogRequest) =>
    sendApi<WriteResult>("POST", `/commlogs`, req),
};

export const recallApi = {
  getDue: (from: string, to: string, includeScheduled = false) =>
    fetchApi<RecallDue[]>(`/recalls/due?from=${from}&to=${to}&includeScheduled=${includeScheduled}`),
};

export const insuranceApi = {
  getByPatient: (patNum: number) =>
    fetchApi<InsuranceCoverage[]>(`/patients/${patNum}/insurance`),

  searchCarriers: (q: string) =>
    fetchApi<Carrier[]>(`/reference/carriers?q=${encodeURIComponent(q)}`),

  addCoverage: (patNum: number, req: CreateInsuranceRequest) =>
    sendApi<WriteResult>("POST", `/patients/${patNum}/insurance`, req),

  updateCoverage: (patPlanNum: number, req: UpdatePatPlanRequest) =>
    sendApi<WriteResult>("PUT", `/insurance/${patPlanNum}`, req),

  dropCoverage: (patPlanNum: number) =>
    sendApi<WriteResult>("DELETE", `/insurance/${patPlanNum}`),
};

export const adjustmentApi = {
  create: (req: CreateAdjustmentRequest) =>
    sendApi<WriteResult>("POST", `/adjustments`, req),
};

export const claimQueueApi = {
  /** status: U, H, W, S, R, or "open" for everything not yet received. */
  getQueue: (status?: string, days = 365) =>
    fetchApi<ClaimQueueItem[]>(`/claims?days=${days}${status ? `&status=${status}` : ""}`),
};

// -- Family management -----------------------------------------
export const familyApi = {
  setGuarantor: (patNum: number) =>
    sendApi<{ updated: number }>("POST", `/patients/${patNum}/set-guarantor`),
  moveToFamily: (patNum: number, targetPatNum: number) =>
    sendApi<{ moved: boolean }>("POST", `/patients/${patNum}/move-to-family`, { targetPatNum }),
  }
// -- Benefits --------------------------------------------------
export interface CategoryBenefit { category: string; percent: number; }
export interface BenefitItem {
  type: string; category?: string; percent?: number; amount?: number;
  period: string; level: string;
}
export interface PlanBenefits {
  patPlanNum: number; planNum: number; ordinal: number; carrierName: string;
  annualMax?: number; annualMaxLevel?: string; annualMaxPeriod?: string;
  deductible?: number; deductibleLevel?: string; deductiblePeriod?: string;
  categories: CategoryBenefit[]; items: BenefitItem[];
}
export const benefitApi = {
  getByPatient: (patNum: number) => fetchApi<PlanBenefits[]>(`/patients/${patNum}/benefits`),
};
