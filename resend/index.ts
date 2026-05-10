import { Resend } from "resend";
import type {
  HodEmailPayload,
  DeanEmailPayload,
  StudentNotificationPayload,
} from "@/types";

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "exeat@university.edu.ng";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ============================================================
// EMAIL TEMPLATES
// ============================================================

function baseLayout(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; background:#f4f7fb; color:#1a1a2e; }
    .wrapper { max-width:600px; margin:40px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%); padding:32px 40px; }
    .header h1 { color:#e8c547; margin:0; font-size:22px; letter-spacing:0.5px; }
    .header p { color:#a8b4c8; margin:6px 0 0; font-size:13px; }
    .body { padding:36px 40px; }
    .info-table { width:100%; border-collapse:collapse; margin:20px 0; }
    .info-table td { padding:10px 14px; border-bottom:1px solid #f0f0f0; font-size:14px; }
    .info-table td:first-child { color:#666; font-weight:600; width:160px; }
    .info-table td:last-child { color:#1a1a2e; }
    .btn { display:inline-block; padding:14px 32px; border-radius:8px; font-size:15px; font-weight:700; text-decoration:none; margin:8px 6px 8px 0; }
    .btn-approve { background:#22c55e; color:#fff; }
    .btn-reject  { background:#ef4444; color:#fff; }
    .btn-status  { background:#1a1a2e; color:#e8c547; }
    .notice { background:#fffbeb; border-left:4px solid #e8c547; padding:14px 18px; border-radius:0 8px 8px 0; font-size:13px; color:#78350f; margin:20px 0; }
    .footer { background:#f9fafb; padding:20px 40px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrapper">
    ${content}
    <div class="footer">
      This is an automated message from the University Exeat Management System.<br/>
      Do not reply to this email directly.
    </div>
  </div>
</body>
</html>
  `.trim();
}

function hodEmailTemplate(payload: HodEmailPayload): string {
  const approvalUrl = `${APP_URL}/approve/${payload.approvalToken}`;

  const content = `
    <div class="header">
      <h1>📋 Exeat Request — Action Required</h1>
      <p>A student from your department has submitted an exeat request</p>
    </div>
    <div class="body">
      <p>Dear <strong>${payload.hodName}</strong>,</p>
      <p>The following student has submitted an exeat request and requires your approval as Head of Department.</p>

      <table class="info-table">
        <tr><td>Student Name</td><td><strong>${payload.studentName}</strong></td></tr>
        <tr><td>Matric Number</td><td>${payload.studentId}</td></tr>
        <tr><td>Department</td><td>${payload.department}</td></tr>
        <tr><td>Reason</td><td>${payload.reason}</td></tr>
        <tr><td>Destination</td><td>${payload.destination}</td></tr>
        <tr><td>Departure Date</td><td>${formatDate(payload.departureDate)}</td></tr>
        <tr><td>Return Date</td><td>${formatDate(payload.returnDate)}</td></tr>
        <tr><td>Emergency Contact</td><td>${payload.emergencyContact}</td></tr>
        <tr><td>Request ID</td><td><code>${payload.requestId}</code></td></tr>
      </table>

      <div class="notice">
        ⏰ This link expires in <strong>72 hours</strong>. Please review promptly.
        Once approved, it will be forwarded to the Dean of Student Affairs.
      </div>

      <p>Please click your decision below:</p>
      <a href="${approvalUrl}?action=approve" class="btn btn-approve">✓ Approve Request</a>
      <a href="${approvalUrl}?action=reject" class="btn btn-reject">✗ Reject Request</a>
      <br/>
      <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
        Or visit the full review page: <a href="${approvalUrl}">${approvalUrl}</a>
      </p>
    </div>
  `;

  return baseLayout(content, "Exeat Request — HOD Approval");
}

function deanEmailTemplate(payload: DeanEmailPayload): string {
  const approvalUrl = `${APP_URL}/approve/${payload.approvalToken}`;

  const content = `
    <div class="header">
      <h1>📋 Exeat Request — Final Approval</h1>
      <p>HOD-approved request awaiting Dean's final decision</p>
    </div>
    <div class="body">
      <p>Dear Dean of Student Affairs,</p>
      <p>The following exeat request has been reviewed and approved by the Head of Department and now requires your final approval.</p>

      <table class="info-table">
        <tr><td>Student Name</td><td><strong>${payload.studentName}</strong></td></tr>
        <tr><td>Matric Number</td><td>${payload.studentId}</td></tr>
        <tr><td>Department</td><td>${payload.department}</td></tr>
        <tr><td>Reason</td><td>${payload.reason}</td></tr>
        <tr><td>Destination</td><td>${payload.destination}</td></tr>
        <tr><td>Departure Date</td><td>${formatDate(payload.departureDate)}</td></tr>
        <tr><td>Return Date</td><td>${formatDate(payload.returnDate)}</td></tr>
        <tr><td>HOD Comment</td><td><em>"${payload.hodComment}"</em></td></tr>
        <tr><td>Request ID</td><td><code>${payload.requestId}</code></td></tr>
      </table>

      <div class="notice">
        ⏰ This link expires in <strong>72 hours</strong>. This is the final step.
        Your decision will be communicated to the student immediately.
      </div>

      <p>Please click your decision below:</p>
      <a href="${approvalUrl}?action=approve" class="btn btn-approve">✓ Grant Final Approval</a>
      <a href="${approvalUrl}?action=reject" class="btn btn-reject">✗ Reject Request</a>
      <br/>
      <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
        Or visit the full review page: <a href="${approvalUrl}">${approvalUrl}</a>
      </p>
    </div>
  `;

  return baseLayout(content, "Exeat Request — Dean Final Approval");
}

function studentNotificationTemplate(
  payload: StudentNotificationPayload,
): string {
  const isApproved = payload.decision === "approved";

  const content = `
    <div class="header">
      <h1>${isApproved ? "✅ Exeat Approved" : "❌ Exeat Request Rejected"}</h1>
      <p>Update on your exeat request — Request #${payload.requestId.slice(0, 8)}</p>
    </div>
    <div class="body">
      <p>Dear <strong>${payload.studentName}</strong>,</p>

      ${
        isApproved
          ? `<p>We are pleased to inform you that your exeat request has been <strong style="color:#22c55e">approved</strong> by the Dean of Student Affairs. You may proceed with your plans.</p>`
          : `<p>We regret to inform you that your exeat request has been <strong style="color:#ef4444">rejected</strong>.</p>`
      }

      ${
        payload.comment
          ? `<div class="notice" style="${isApproved ? "" : "border-color:#ef4444;background:#fef2f2;color:#7f1d1d;"}">
              <strong>Comment:</strong> ${payload.comment}
             </div>`
          : ""
      }

      ${
        isApproved
          ? `<div class="notice">
              Please ensure you return to campus by the approved date.
              Failure to return on time may result in disciplinary action.
             </div>`
          : `<p>If you believe this decision is incorrect or wish to reapply, please visit the exeat portal or contact your department.</p>`
      }

      <a href="${APP_URL}" class="btn btn-status">View Exeat Portal</a>
    </div>
  `;

  return baseLayout(
    content,
    isApproved
      ? "Your Exeat Has Been Approved"
      : "Your Exeat Request Was Rejected",
  );
}

// ============================================================
// EMAIL SENDING FUNCTIONS
// ============================================================

export async function sendHodApprovalEmail(
  payload: HodEmailPayload,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: payload.hodEmail,
    subject: `[Exeat Request] ${payload.studentName} (${payload.studentId}) — Approval Needed`,
    html: hodEmailTemplate(payload),
  });

  if (error) {
    console.error("[Email] Failed to send HOD email:", error);
    throw new Error(`Failed to send HOD email: ${error.message}`);
  }
}

export async function sendDeanApprovalEmail(
  payload: DeanEmailPayload,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: payload.deanEmail,
    subject: `[Exeat Request] ${payload.studentName} — Dean Final Approval`,
    html: deanEmailTemplate(payload),
  });

  if (error) {
    console.error("[Email] Failed to send Dean email:", error);
    throw new Error(`Failed to send Dean email: ${error.message}`);
  }
}

export async function sendStudentNotificationEmail(
  payload: StudentNotificationPayload,
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: payload.studentEmail,
    subject:
      payload.decision === "approved"
        ? "✅ Your Exeat Request Has Been Approved"
        : "❌ Your Exeat Request Has Been Rejected",
    html: studentNotificationTemplate(payload),
  });

  if (error) {
    console.error("[Email] Failed to send student notification:", error);
    throw new Error(`Failed to send student notification: ${error.message}`);
  }
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
