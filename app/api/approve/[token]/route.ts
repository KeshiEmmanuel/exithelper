import { NextRequest, NextResponse } from "next/server";
import {
  validateApprovalToken,
  consumeApprovalToken,
  getExeatRequestById,
  updateExeatRequestStatus,
  createApprovalToken,
  getDeanEmail,
} from "@/supabase/queries";
import { sendDeanApprovalEmail, sendStudentNotificationEmail } from "@/resend";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;

    if (!token || typeof token !== "string" || token.length < 32) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    const tokenRecord = await validateApprovalToken(token);

    if (!tokenRecord) {
      return NextResponse.json(
        {
          error:
            "This approval link is invalid, expired, or has already been used.",
        },
        { status: 410 },
      );
    }

    const request = await getExeatRequestById(tokenRecord.request_id);

    if (!request) {
      return NextResponse.json(
        { error: "Exeat request not found." },
        { status: 404 },
      );
    }

    // Validate that this token's role matches the current expected action
    const expectedRole =
      request.status === "pending_hod"
        ? "hod"
        : request.status === "pending_dean"
          ? "dean"
          : null;

    if (!expectedRole || tokenRecord.role !== expectedRole) {
      return NextResponse.json(
        { error: "This request is no longer awaiting your approval." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      request: {
        id: request.id,
        student: {
          full_name: request.student.full_name,
          student_id: request.student.student_id,
          email: request.student.email,
          department: request.student.department.name,
          level: request.student.level,
        },
        reason: request.reason,
        destination: request.destination,
        departure_date: request.departure_date,
        return_date: request.return_date,
        emergency_contact: request.emergency_contact,
        emergency_phone: request.emergency_phone,
        status: request.status,
        hod_comment: request.hod_comment,
        created_at: request.created_at,
      },
      role: tokenRecord.role,
      token,
    });
  } catch (err) {
    console.error("[API /approve GET]", err);
    return NextResponse.json(
      { error: "An error occurred loading this approval request." },
      { status: 500 },
    );
  }
}

// ============================================================
// POST — Process the approval/rejection decision
// ============================================================

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;

    if (!token || typeof token !== "string" || token.length < 32) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    const body = await req.json();
    const { decision, comment } = body as {
      decision: "approve" | "reject";
      comment: string;
    };

    if (!decision || !["approve", "reject"].includes(decision)) {
      return NextResponse.json(
        { error: "Decision must be 'approve' or 'reject'." },
        { status: 400 },
      );
    }

    const cleanComment = (comment ?? "").trim().slice(0, 500);

    // Validate token (checks expiry & not-used)
    const tokenRecord = await validateApprovalToken(token);

    if (!tokenRecord) {
      return NextResponse.json(
        {
          error:
            "This approval link is invalid, expired, or has already been used.",
        },
        { status: 410 },
      );
    }

    // Get full request
    const request = await getExeatRequestById(tokenRecord.request_id);

    if (!request) {
      return NextResponse.json(
        { error: "Exeat request not found." },
        { status: 404 },
      );
    }

    // Verify the request is still in the expected state
    const expectedRole =
      request.status === "pending_hod"
        ? "hod"
        : request.status === "pending_dean"
          ? "dean"
          : null;

    if (!expectedRole || tokenRecord.role !== expectedRole) {
      return NextResponse.json(
        {
          error:
            "This request has already been processed and is no longer awaiting your action.",
        },
        { status: 409 },
      );
    }

    // Mark token as used BEFORE updating status (prevent double submissions)
    await consumeApprovalToken(tokenRecord.id);

    // Update request status
    const updatedRequest = await updateExeatRequestStatus(
      request.id,
      tokenRecord.role,
      decision,
      cleanComment,
    );

    // ---- SIDE EFFECTS ----

    if (decision === "approve" && tokenRecord.role === "hod") {
      // Forward to Dean
      const dean = getDeanEmail();
      const deanToken = await createApprovalToken(request.id, "dean");

      await sendDeanApprovalEmail({
        deanEmail: dean.email,
        studentName: request.student.full_name,
        studentId: request.student.student_id,
        department: request.student.department.name,
        reason: request.reason,
        destination: request.destination,
        departureDate: request.departure_date,
        returnDate: request.return_date,
        hodComment: cleanComment || "No comment provided.",
        approvalToken: deanToken,
        requestId: request.id,
      });
    } else if (tokenRecord.role === "dean" || decision === "reject") {
      // Final decision — notify student
      await sendStudentNotificationEmail({
        studentEmail: request.student.email,
        studentName: request.student.full_name,
        decision: decision === "approve" ? "approved" : "rejected",
        comment: cleanComment,
        requestId: request.id,
      });
    }

    return NextResponse.json({
      success: true,
      decision,
      newStatus: updatedRequest.status,
      message:
        decision === "approve"
          ? tokenRecord.role === "hod"
            ? "Request approved and forwarded to the Dean of Student Affairs."
            : "Request has been finally approved. The student has been notified."
          : "Request has been rejected. The student has been notified.",
    });
  } catch (err) {
    console.error("[API /approve POST]", err);
    return NextResponse.json(
      { error: "An error occurred processing this approval." },
      { status: 500 },
    );
  }
}
