"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  GraduationCap,
  Clock,
  AlertTriangle,
} from "lucide-react";

// ---- Types ----

interface RequestData {
  id: string;
  student: {
    full_name: string;
    student_id: string;
    email: string;
    department: string;
    level: string;
  };
  reason: string;
  destination: string;
  departure_date: string;
  return_date: string;
  emergency_contact: string;
  emergency_phone: string;
  status: string;
  hod_comment: string | null;
  created_at: string;
}

type PageState =
  | { phase: "loading" }
  | { phase: "ready"; data: RequestData; role: "hod" | "dean" }
  | { phase: "done"; decision: "approve" | "reject"; message: string }
  | { phase: "error"; message: string };

// ---- Helpers ----

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ---- Component ----

export default function ApprovalPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [state, setState] = useState<PageState>({ phase: "loading" });
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load request data
  useEffect(() => {
    if (!token) {
      setState({ phase: "error", message: "No approval token found in URL." });
      return;
    }

    fetch(`/api/approve/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load request.");
        setState({ phase: "ready", data: json.request, role: json.role });
      })
      .catch((err) => {
        setState({ phase: "error", message: err.message });
      });
  }, [token]);

  const handleDecision = useCallback(
    async (decision: "approve" | "reject") => {
      if (state.phase !== "ready") return;
      if (decision === "reject" && !comment.trim()) {
        alert("Please provide a reason for rejection.");
        return;
      }

      setSubmitting(true);

      try {
        const res = await fetch(`/api/approve/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, comment: comment.trim() }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Action failed.");

        setState({ phase: "done", decision, message: json.message });
      } catch (err) {
        setState({
          phase: "error",
          message: err instanceof Error ? err.message : "An error occurred.",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [state, token, comment],
  );

  // ---- Render ----

  return (
    <div className="approval-page">
      <div className="approval-card">
        {/* Header */}
        <div className="approval-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div className="header-icon">
              <GraduationCap size={20} strokeWidth={1.8} />
            </div>
            <div>
              <h1>Exeat Request Review</h1>
              <p>University Exeat Management System</p>
            </div>
          </div>

          {state.phase === "ready" && (
            <div className={`role-badge role-badge--${state.role}`}>
              {state.role === "hod"
                ? "🏛 Head of Department"
                : "🎓 Dean of Student Affairs"}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="approval-body">
          {/* Loading */}
          {state.phase === "loading" && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "var(--text-secondary)",
              }}
            >
              <Clock
                size={32}
                style={{
                  margin: "0 auto 16px",
                  display: "block",
                  opacity: 0.5,
                }}
              />
              <p>Loading approval request…</p>
            </div>
          )}

          {/* Error */}
          {state.phase === "error" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <span className="result-icon">⚠️</span>
              <h2 style={{ color: "var(--danger)", marginBottom: 8 }}>
                Unable to Load Request
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                {state.message}
              </p>
            </div>
          )}

          {/* Done */}
          {state.phase === "done" && (
            <div className="result-card">
              <span className="result-icon">
                {state.decision === "approve" ? "✅" : "❌"}
              </span>
              <h2>
                {state.decision === "approve"
                  ? "Request Approved"
                  : "Request Rejected"}
              </h2>
              <p>{state.message}</p>
              {state.decision === "approve" && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  The next reviewer has been notified by email.
                </p>
              )}
            </div>
          )}

          {/* Ready — main review form */}
          {state.phase === "ready" && (
            <>
              <div className="info-grid">
                <div className="info-field">
                  <label>Student Name</label>
                  <span>{state.data.student.full_name}</span>
                </div>
                <div className="info-field">
                  <label>Matric Number</label>
                  <span>{state.data.student.student_id}</span>
                </div>
                <div className="info-field">
                  <label>Department</label>
                  <span>{state.data.student.department}</span>
                </div>
                <div className="info-field">
                  <label>Level</label>
                  <span>{state.data.student.level}L</span>
                </div>
                <div className="info-field info-field--full">
                  <label>Reason for Exeat</label>
                  <span>{state.data.reason}</span>
                </div>
                <div className="info-field">
                  <label>Destination</label>
                  <span>{state.data.destination}</span>
                </div>
                <div className="info-field">
                  <label>Emergency Contact</label>
                  <span>
                    {state.data.emergency_contact} —{" "}
                    {state.data.emergency_phone}
                  </span>
                </div>
                <div className="info-field">
                  <label>Departure Date</label>
                  <span>{formatDate(state.data.departure_date)}</span>
                </div>
                <div className="info-field">
                  <label>Return Date</label>
                  <span>{formatDate(state.data.return_date)}</span>
                </div>
                <div className="info-field">
                  <label>Submitted</label>
                  <span>{formatDate(state.data.created_at)}</span>
                </div>
              </div>

              {/* HOD comment shown to Dean */}
              {state.role === "dean" && state.data.hod_comment && (
                <div className="hod-note">
                  <strong>HOD Comment:</strong> {state.data.hod_comment}
                </div>
              )}

              {/* Comment field */}
              <label className="comment-label">
                {state.role === "hod"
                  ? "Your Comment (optional for approval, required for rejection)"
                  : "Final Comment (optional for approval, required for rejection)"}
              </label>
              <textarea
                className="comment-textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add your review comment here…"
                maxLength={500}
                disabled={submitting}
              />

              {/* Action buttons */}
              <div className="action-row">
                <button
                  className="btn-approve"
                  onClick={() => handleDecision("approve")}
                  disabled={submitting}
                >
                  <CheckCircle size={17} />
                  {submitting
                    ? "Processing…"
                    : state.role === "hod"
                      ? "Approve & Forward to Dean"
                      : "Grant Final Approval"}
                </button>
                <button
                  className="btn-reject"
                  onClick={() => handleDecision("reject")}
                  disabled={submitting}
                >
                  <XCircle size={17} />
                  Reject Request
                </button>
              </div>

              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 14,
                  textAlign: "center",
                }}
              >
                <AlertTriangle
                  size={11}
                  style={{ display: "inline", marginRight: 4 }}
                />
                This is a single-use link. Once you submit your decision it
                cannot be undone.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
