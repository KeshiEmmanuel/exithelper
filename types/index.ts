// ============================================================
// DOMAIN TYPES
// ============================================================

export type ApprovalStatus =
  | "pending_hod"
  | "pending_dean"
  | "approved"
  | "rejected"
  | "cancelled";

export type ApproverRole = "hod" | "dean";

export type AgentStage =
  | "greeting"
  | "collecting"
  | "verifying"
  | "submitting"
  | "submitted"
  | "rejected_ineligible"
  | "error";

// ============================================================
// DATABASE MODELS
// ============================================================

export interface Student {
  id: string;
  student_id: string;
  full_name: string;
  email: string;
  phone: string;
  department_id: string;
  level: string;
  cgpa: number;
  has_outstanding_fees: boolean;
  is_on_suspension: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  hod_name: string;
  hod_email: string;
  code: string;
}

export interface ExeatRequest {
  id: string;
  student_id: string;
  reason: string;
  destination: string;
  departure_date: string;
  return_date: string;
  emergency_contact: string;
  emergency_phone: string;
  status: ApprovalStatus;
  hod_comment: string | null;
  dean_comment: string | null;
  hod_reviewed_at: string | null;
  dean_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  student?: Student;
  department?: Department;
}

export interface ApprovalToken {
  id: string;
  request_id: string;
  token: string;
  role: ApproverRole;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

// ============================================================
// AGENT STATE
// ============================================================

export interface CollectedStudentInfo {
  studentId?: string;
  fullName?: string;
  reason?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

export interface VerificationResult {
  isValid: boolean;
  hasCleanRecord: boolean;
  student?: Student;
  department?: Department;
  issues: string[];
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
}

export interface ApprovalActionPayload {
  token: string;
  decision: "approve" | "reject";
  comment: string;
}

export interface ApprovalPageData {
  request: ExeatRequest;
  role: ApproverRole;
  token: string;
}

export interface VerifyStudentToolInput {
  studentId: string;
  fullName: string;
}

export interface CreateExeatToolInput {
  studentId: string;
  reason: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  emergencyContact: string;
  emergencyPhone: string;
}

// ============================================================
// EMAIL TYPES
// ============================================================

export interface HodEmailPayload {
  hodName: string;
  hodEmail: string;
  studentName: string;
  studentId: string;
  department: string;
  reason: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  emergencyContact: string;
  approvalToken: string;
  requestId: string;
}

export interface DeanEmailPayload {
  deanEmail: string;
  studentName: string;
  studentId: string;
  department: string;
  reason: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  hodComment: string;
  approvalToken: string;
  requestId: string;
}

export interface StudentNotificationPayload {
  studentEmail: string;
  studentName: string;
  decision: "approved" | "rejected";
  comment: string;
  requestId: string;
}
