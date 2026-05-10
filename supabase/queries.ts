import type {
  Student,
  Department,
  ExeatRequest,
  ApprovalToken,
  ApproverRole,
  ApprovalStatus,
  CreateExeatToolInput,
} from "@/types";
import { randomUUID } from "crypto";
import { supabaseAdmin } from ".";

// ============================================================
// STUDENT QUERIES
// ============================================================

/**
 * Look up a student by their matriculation number.
 * Returns null if not found.
 */
export async function getStudentByMatricNumber(
  studentId: string,
): Promise<(Student & { department: Department }) | null> {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(
      `
      *,
      department:departments(*)
    `,
    )
    .eq("student_id", studentId.trim().toUpperCase())
    .maybeSingle();

  if (error) {
    console.error("[DB] getStudentByMatricNumber error:", error);
    throw new Error(`Database error verifying student: ${error.message}`);
  }

  return data as (Student & { department: Department }) | null;
}

/**
 * Verify a student's identity by matric number AND full name match.
 */
export async function verifyStudentIdentity(
  studentId: string,
  fullName: string,
): Promise<{
  student: (Student & { department: Department }) | null;
  nameMatch: boolean;
}> {
  const student = await getStudentByMatricNumber(studentId);

  if (!student) {
    return { student: null, nameMatch: false };
  }

  // Case-insensitive name comparison
  const nameMatch =
    student.full_name.toLowerCase().trim() === fullName.toLowerCase().trim();

  return { student, nameMatch };
}

// ============================================================
// EXEAT REQUEST QUERIES
// ============================================================

/**
 * Check if a student already has a pending exeat request.
 */
export async function hasPendingExeat(studentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("exeat_requests")
    .select("id")
    .eq("student_id", studentId)
    .in("status", ["pending_hod", "pending_dean"])
    .maybeSingle();

  if (error) {
    console.error("[DB] hasPendingExeat error:", error);
    return false;
  }

  return data !== null;
}

/**
 * Create a new exeat request record.
 */
export async function createExeatRequest(
  input: CreateExeatToolInput & { dbStudentId: string },
): Promise<ExeatRequest> {
  const { data, error } = await supabaseAdmin
    .from("exeat_requests")
    .insert({
      student_id: input.dbStudentId,
      reason: input.reason.trim(),
      destination: input.destination.trim(),
      departure_date: input.departureDate,
      return_date: input.returnDate,
      emergency_contact: input.emergencyContact.trim(),
      emergency_phone: input.emergencyPhone.trim(),
      status: "pending_hod",
    })
    .select("*")
    .single();

  if (error) {
    console.error("[DB] createExeatRequest error:", error);
    throw new Error(`Failed to create exeat request: ${error.message}`);
  }

  return data as ExeatRequest;
}

/**
 * Get an exeat request by ID with joined student and department data.
 */
export async function getExeatRequestById(
  requestId: string,
): Promise<
  (ExeatRequest & { student: Student & { department: Department } }) | null
> {
  const { data, error } = await supabaseAdmin
    .from("exeat_requests")
    .select(
      `
      *,
      student:students(
        *,
        department:departments(*)
      )
    `,
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    console.error("[DB] getExeatRequestById error:", error);
    throw new Error(`Database error fetching request: ${error.message}`);
  }

  return data as
    | (ExeatRequest & {
        student: Student & { department: Department };
      })
    | null;
}

/**
 * Update the status of an exeat request after an approval action.
 */
export async function updateExeatRequestStatus(
  requestId: string,
  role: ApproverRole,
  decision: "approve" | "reject",
  comment: string,
): Promise<ExeatRequest> {
  let newStatus: ApprovalStatus;

  if (decision === "reject") {
    newStatus = "rejected";
  } else if (role === "hod") {
    newStatus = "pending_dean";
  } else {
    newStatus = "approved";
  }

  const updatePayload: Record<string, unknown> = {
    status: newStatus,
  };

  if (role === "hod") {
    updatePayload.hod_comment = comment;
    updatePayload.hod_reviewed_at = new Date().toISOString();
  } else {
    updatePayload.dean_comment = comment;
    updatePayload.dean_reviewed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("exeat_requests")
    .update(updatePayload)
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) {
    console.error("[DB] updateExeatRequestStatus error:", error);
    throw new Error(`Failed to update request status: ${error.message}`);
  }

  return data as ExeatRequest;
}

// ============================================================
// APPROVAL TOKEN QUERIES
// ============================================================

const TOKEN_EXPIRY_HOURS = 72; // 3 days

/**
 * Generate and store a cryptographically-secure approval token.
 */
export async function createApprovalToken(
  requestId: string,
  role: ApproverRole,
): Promise<string> {
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const expiresAt = new Date(
    Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabaseAdmin.from("approval_tokens").insert({
    request_id: requestId,
    token,
    role,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[DB] createApprovalToken error:", error);
    throw new Error(`Failed to create approval token: ${error.message}`);
  }

  return token;
}

/**
 * Validate and retrieve an approval token.
 * Returns null if token is invalid, expired, or already used.
 */
export async function validateApprovalToken(
  token: string,
): Promise<ApprovalToken | null> {
  const { data, error } = await supabaseAdmin
    .from("approval_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  const tokenRecord = data as ApprovalToken;

  // Check expiry
  if (new Date(tokenRecord.expires_at) < new Date()) return null;

  // Check if already used
  if (tokenRecord.used_at !== null) return null;

  return tokenRecord;
}

/**
 * Mark a token as used (single-use enforcement).
 */
export async function consumeApprovalToken(tokenId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("approval_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", tokenId);

  if (error) {
    console.error("[DB] consumeApprovalToken error:", error);
    throw new Error(`Failed to consume token: ${error.message}`);
  }
}

// ============================================================
// DEAN CONFIG
// ============================================================

/**
 * Get the Dean of Student Affairs email from environment config.
 * In production, this could be stored in a settings table.
 */
export function getDeanEmail(): { name: string; email: string } {
  const email = process.env.DEAN_EMAIL;
  const name = process.env.DEAN_NAME ?? "Dean of Student Affairs";

  if (!email) {
    throw new Error("DEAN_EMAIL environment variable is not set.");
  }

  return { name, email };
}
