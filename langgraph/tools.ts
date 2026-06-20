import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  verifyStudentIdentity,
  hasPendingExeat,
  createExeatRequest,
  createApprovalToken,
} from "@/supabase/queries";
import { sendHodApprovalEmail } from "@/resend";

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export const verifyStudentTool = tool(
  async ({ studentId, fullName }) => {
    try {
      const { student, nameMatch } = await verifyStudentIdentity(
        studentId,
        fullName,
      );

      if (!student) {
        return JSON.stringify({
          success: false,
          reason: "not_found",
          message: `No student found with matric number "${studentId}". Please check and try again.`,
        });
      }

      if (!nameMatch) {
        return JSON.stringify({
          success: false,
          reason: "name_mismatch",
          message:
            "The name provided does not match our records for this matric number. Please verify your details.",
        });
      }

      const issues: string[] = [];

      if (student.has_outstanding_fees) {
        issues.push(
          "You have outstanding fee payments. Please clear your fees before applying for an exeat.",
        );
      }

      if (student.is_on_suspension) {
        issues.push(
          "Your account is currently flagged due to an active suspension. Please contact the Dean's office.",
        );
      }

      const pendingExists = await hasPendingExeat(student.id);
      if (pendingExists) {
        issues.push(
          "You already have an exeat request currently under review. Please wait for it to be resolved before submitting a new one.",
        );
      }

      if (issues.length > 0) {
        return JSON.stringify({
          success: false,
          reason: "ineligible",
          studentName: student.full_name,
          department: student.department.name,
          issues,
        });
      }

      return JSON.stringify({
        success: true,
        studentDbId: student.id,
        studentName: student.full_name,
        studentEmail: student.email,
        department: student.department.name,
        hodName: student.department.hod_name,
        hodEmail: student.department.hod_email,
        level: student.level,
        message: `Student verified successfully. ${student.full_name} is eligible to apply for an exeat.`,
      });
    } catch (err) {
      console.error("[Tool] verifyStudentTool error:", err);
      return JSON.stringify({
        success: false,
        reason: "error",
        message:
          "A system error occurred while verifying your identity. Please try again.",
      });
    }
  },
  {
    name: "verify_student",
    description:
      "Verifies a student's identity using their matriculation number and full name. Also checks if they are eligible for an exeat (no outstanding fees, not on suspension, no pending request). Call this AFTER you have collected both the student ID and full name.",
    schema: z.object({
      studentId: z
        .string()
        .describe(
          "The student's matriculation number, e.g. CSC/2021/001. Normalize to uppercase.",
        ),
      fullName: z
        .string()
        .describe("The student's full name exactly as provided by them."),
    }),
  },
);

// ============================================================
// TOOL: Submit Exeat Request
// ============================================================

export const submitExeatTool = tool(
  async ({
    studentDbId,
    studentId,
    studentName,
    studentEmail,
    department,
    hodName,
    hodEmail,
    reason,
    destination,
    departureDate,
    returnDate,
    emergencyContact,
    emergencyPhone,
  }) => {
    try {
      const departure = parseLocalDate(departureDate);
      const returnD = parseLocalDate(returnDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (departure < today) {
        return JSON.stringify({
          success: false,
          message: "Departure date cannot be in the past.",
        });
      }

      if (returnD <= departure) {
        return JSON.stringify({
          success: false,
          message: "Return date must be after the departure date.",
        });
      }

      const maxDays = 14;
      const daysDiff =
        (returnD.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > maxDays) {
        return JSON.stringify({
          success: false,
          message: `Exeat duration cannot exceed ${maxDays} days. Please adjust your dates.`,
        });
      }

      const request = await createExeatRequest({
        studentId,
        dbStudentId: studentDbId,
        reason,
        destination,
        departureDate,
        returnDate,
        emergencyContact,
        emergencyPhone,
      });

      const hodToken = await createApprovalToken(request.id, "hod");

      await sendHodApprovalEmail({
        hodName,
        hodEmail,
        studentName,
        studentId,
        department,
        reason,
        destination,
        departureDate,
        returnDate,
        emergencyContact,
        approvalToken: hodToken,
        requestId: request.id,
      });

      return JSON.stringify({
        success: true,
        requestId: request.id,
        message: `Your exeat request has been successfully submitted!
Reference ID: ${request.id.slice(0, 8).toUpperCase()}

Your Head of Department (${hodName}) has been notified by email and will review your request. Once they approve it, it will be forwarded to the Dean of Student Affairs for final approval.

You will receive an email notification at ${studentEmail} once a decision is made. Please allow up to 72 hours for each stage of review.`,
      });
    } catch (err) {
      console.error("[Tool] submitExeatTool error:", err);
      return JSON.stringify({
        success: false,
        message:
          "A system error occurred while submitting your request. Please try again or contact the registrar's office.",
      });
    }
  },
  {
    name: "submit_exeat_request",
    description:
      "Submits the completed exeat request to the database, generates a secure approval token, and emails the HOD for review. Only call this AFTER you have confirmed all required information with the student and they have explicitly confirmed they want to proceed.",
    schema: z.object({
      studentDbId: z
        .string()
        .uuid()
        .describe(
          "The internal database UUID of the student (from verify_student result).",
        ),
      studentId: z.string().describe("The student's matric number."),
      studentName: z.string().describe("The student's full name."),
      studentEmail: z.string().email().describe("The student's email address."),
      department: z.string().describe("The student's department name."),
      hodName: z.string().describe("The Head of Department's name."),
      hodEmail: z
        .string()
        .email()
        .describe("The Head of Department's email address."),
      reason: z
        .string()
        .min(10)
        .describe("A clear and detailed reason for the exeat request."),
      destination: z.string().describe("Where the student is going."),
      departureDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Departure date in YYYY-MM-DD format."),
      returnDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Return date in YYYY-MM-DD format."),
      emergencyContact: z
        .string()
        .describe("Name of emergency contact person."),
      emergencyPhone: z.string().describe("Phone number of emergency contact."),
    }),
  },
);

// ============================================================
// EXPORTED TOOLS LIST
// ============================================================

export const agentTools = [verifyStudentTool, submitExeatTool];
