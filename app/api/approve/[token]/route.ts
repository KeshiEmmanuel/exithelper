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

// Next.js 16: params is now Promise<{token: string}> — must be awaited

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

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

    const expectedRole =
      request.status === "pending_hod"
        ? "hod"
        : request.status === "pending_dean"
          ? "dean"
          : null;

    if (!expectedRole || tokenRecord.role !== expectedRole) {
      return NextResponse.json(
        { error: "This request has already been processed." },
        { status: 409 },
      );
    }

    // Consume token BEFORE status update — prevents race-condition double submissions
    await consumeApprovalToken(tokenRecord.id);

    const updatedRequest = await updateExeatRequestStatus(
      request.id,
      tokenRecord.role,
      decision,
      cleanComment,
    );

    if (decision === "approve" && tokenRecord.role === "hod") {
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
            : "Request finally approved. The student has been notified."
          : "Request rejected. The student has been notified.",
    });
  } catch (err) {
    console.error("[API /approve POST]", err);
    return NextResponse.json(
      { error: "An error occurred processing this approval." },
      { status: 500 },
    );
  }
}
