"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import type { WheelRow } from "@/lib/types";

type FormState = {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  zipCode: string;
  phoneNumber: string;
  emailAddress: string;
  followUpRequested: "yes" | "no";
};

const initial: FormState = {
  firstName: "",
  lastName: "",
  street: "",
  city: "",
  zipCode: "",
  phoneNumber: "",
  emailAddress: "",
  followUpRequested: "yes"
};

export default function PublicFormPage() {
  const params = useParams();
  const wheelSlug = String(params?.slug || "").trim();

  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [wheelMeta, setWheelMeta] = useState<WheelRow | null>(null);
  const [wheelChecked, setWheelChecked] = useState(false);

  const fetchWheel = useCallback(async () => {
    if (!wheelSlug) return;
    const res = await fetch(`/api/wheels/lookup?slug=${encodeURIComponent(wheelSlug)}`);
    const payload = await res.json();
    setWheelChecked(true);
    if (!res.ok) {
      setError(payload.error || "Wheel not found");
      setWheelMeta(null);
      return;
    }

    setWheelMeta(payload.wheel || null);
  }, [wheelSlug]);

  useEffect(() => {
    fetchWheel();
  }, [fetchWheel]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!wheelSlug) return;
    setSubmitting(true);
    setError("");

    const res = await fetch(`/api/submit?wheel=${encodeURIComponent(wheelSlug)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form)
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "Failed to submit");
      return;
    }

    setSubmitted(true);
    setForm(initial);
  };

  if (!wheelSlug) {
    return (
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Wheel Not Found</h1>
        <p style={{ color: "#6c6c6c" }}>Missing wheel slug.</p>
      </div>
    );
  }

  if (wheelChecked && !wheelMeta) {
    return (
      <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Wheel Not Found</h1>
        <p style={{ color: "#6c6c6c" }}>{error || "This wheel is not available."}</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ width: 240, paddingTop: 1, flexShrink: 0 }}>
        <Image src="/SparkleSquadHoriz.png" alt="Sparkle Squad" width={240} height={150} priority />
      </div>
      <h1 style={{ marginTop: 0 }}>
        {wheelMeta?.name || "Sparkle Squad Giveaway"} Entry
      </h1>
      <p style={{ color: "#6c6c6c", marginTop: -4 }}>No login required.</p>

      {submitted && <p className="success">Thank you! Your entry has been submitted.</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit}>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label>First Name*</label>
            <input
              value={form.firstName}
              required
              onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Last Name*</label>
            <input
              value={form.lastName}
              required
              onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
            />
          </div>
        </div>

        {/* <div style={{ marginTop: 10 }}>
          <label>Street</label>
          <input value={form.street} onChange={(e) => setForm((s) => ({ ...s, street: e.target.value }))} />
        </div> */}

        <div className="row" style={{ marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label>Company*</label>
            <input value={form.city} onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))} />
          </div>
          {/* <div style={{ flex: 1 }}>
            <label>Zip Code*</label>
            <input
              value={form.zipCode}
              required
              onChange={(e) => setForm((s) => ({ ...s, zipCode: e.target.value }))}
            />
          </div> */}
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label>Phone Number*</label>
            <input
              value={form.phoneNumber}
              required
              onChange={(e) => setForm((s) => ({ ...s, phoneNumber: e.target.value }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>Email Address*</label>
            <input
              type="email"
              value={form.emailAddress}
              required
              onChange={(e) => setForm((s) => ({ ...s, emailAddress: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label>Would you like a follow up call to discuss our commercial services?*</label>
          <select
            value={form.followUpRequested}
            onChange={(e) => setForm((s) => ({ ...s, followUpRequested: e.target.value as "yes" | "no" }))}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>

        <div style={{ marginTop: 14 }}>
          <button className="primary" disabled={submitting} type="submit">
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 12,
            border: "1px solid #d8ccb2",
            borderRadius: 10,
            background: "#fffaf0",
            fontSize: 12,
            lineHeight: 1.45,
            color: "#4b4b4b"
          }}
        >
          Disclaimer: No purchase necessary. Void where prohibited. Must be 18 years of age or older to enter. One
          entry per household. Odds of winning depend on the number of eligible entries received. By entering, you
          consent to Sparkle Squad contacting you regarding this giveaway and, if you opted in, regarding services and
          promotions. Your information will be used to administer the giveaway and for follow-up communications as
          requested; it will not be sold to third parties. Message/data rates may apply.
        </div>
      </form>
    </div>
  );
}
