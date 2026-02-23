"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { WheelRow } from "@/lib/types";

const initialForm = { name: "", slug: "" };

export default function AdminWheelsPage() {
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wheels, setWheels] = useState<WheelRow[]>([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshAuth = useCallback(async () => {
    const { data } = await supabaseBrowser.auth.getSession();
    const accessToken = data.session?.access_token || "";
    setToken(accessToken);

    if (!accessToken) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const me = await fetch("/api/admin/me", {
      headers: { authorization: `Bearer ${accessToken}` }
    });

    if (!me.ok) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setIsAdmin(true);
    setLoading(false);
  }, []);

  const fetchWheels = useCallback(async () => {
    if (!token || !isAdmin) return;

    const res = await fetch("/api/admin/wheels", {
      headers: { authorization: `Bearer ${token}` }
    });

    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to load wheels");
      return;
    }

    setWheels(payload.wheels || []);
  }, [isAdmin, token]);

  useEffect(() => {
    refreshAuth();
    const { data } = supabaseBrowser.auth.onAuthStateChange(() => {
      refreshAuth();
    });
    return () => data.subscription.unsubscribe();
  }, [refreshAuth]);

  useEffect(() => {
    fetchWheels();
  }, [fetchWheels]);

  const normalizedSlug = useMemo(() => {
    return form.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
  }, [form.slug]);

  const createWheel = async () => {
    if (!token) return;
    setBusy(true);
    setError("");

    const res = await fetch("/api/admin/wheels", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: form.name, slug: normalizedSlug })
    });

    const payload = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(payload.error || "Failed to create wheel");
      return;
    }

    setForm(initialForm);
    setWheels((prev) => [payload.wheel, ...prev]);
  };

  const login = async () => {
    await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/wheels`
      }
    });
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Wheel Admin</h1>
        <p style={{ color: "#6c6c6c" }}>Google login + admin role required.</p>
        <button className="primary" onClick={login}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Wheels</h1>
      <p style={{ color: "#6c6c6c", marginTop: -6 }}>
        Each wheel has its own admin page, public form, and entry pool.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="row" style={{ alignItems: "flex-end", marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <label>Wheel Name</label>
          <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Slug</label>
          <input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} />
          <p style={{ margin: 0, fontSize: 12, color: "#6c6c6c" }}>Normalized: {normalizedSlug || "-"}</p>
        </div>
        <button className="primary" onClick={createWheel} disabled={busy}>
          {busy ? "Creating..." : "Create Wheel"}
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Admin URL</th>
            <th>Public Form</th>
            <th>Entries</th>
          </tr>
        </thead>
        <tbody>
          {wheels.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ color: "#6c6c6c" }}>
                No wheels yet.
              </td>
            </tr>
          ) : (
            wheels.map((wheel) => (
              <tr key={wheel.id}>
                <td>{wheel.name}</td>
                <td>{wheel.slug}</td>
                <td>
                  <a href={`/w/${wheel.slug}`}>/w/{wheel.slug}</a>
                </td>
                <td>
                  <a href={`/form/${wheel.slug}`}>/form/{wheel.slug}</a>
                </td>
                <td>
                  <a href={`/admin/entries?wheel=${wheel.slug}`}>Entries</a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
