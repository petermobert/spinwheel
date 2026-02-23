"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { FilterMode, LeadRow, WheelRow } from "@/lib/types";

const FILTERS: FilterMode[] = ["ALL", "ELIGIBLE", "USED", "WINNERS"];

export default function AdminEntriesClient() {
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [wheels, setWheels] = useState<WheelRow[]>([]);
  const searchParams = useSearchParams();
  const initialWheel = useMemo(() => (searchParams.get("wheel") || "").trim(), [searchParams]);
  const [wheelSlug, setWheelSlug] = useState(initialWheel);

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

  const fetchRows = useCallback(async () => {
    if (!token || !isAdmin || !wheelSlug) return;

    const params = new URLSearchParams();
    params.set("filterMode", filterMode);
    params.set("search", search);
    params.set("wheel", wheelSlug);

    const res = await fetch(`/api/admin/entries?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` }
    });

    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to load leads");
      return;
    }

    setRows(payload.rows || []);
  }, [filterMode, isAdmin, search, token, wheelSlug]);

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
    fetchRows();
    const id = setInterval(fetchRows, 5000);
    return () => clearInterval(id);
  }, [fetchRows]);

  useEffect(() => {
    fetchWheels();
  }, [fetchWheels]);

  useEffect(() => {
    if (!wheelSlug && wheels.length > 0) {
      setWheelSlug(wheels[0].slug);
    }
  }, [wheelSlug, wheels]);

  const login = async () => {
    await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin/entries`
      }
    });
  };

  const exportFile = async (format: "csv" | "xlsx") => {
    if (!token || !wheelSlug) return;

    const params = new URLSearchParams();
    params.set("format", format);
    params.set("filterMode", filterMode);
    params.set("search", search);
    params.set("wheel", wheelSlug);

    const res = await fetch(`/api/export?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const payload = await res.json();
      setError(payload.error || "Export failed");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sparkle-leads-${wheelSlug}-${filterMode.toLowerCase()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Admin Entries</h1>
        <p style={{ color: "#6c6c6c" }}>Google login + admin role required.</p>
        <button className="primary" onClick={login}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 style={{ marginTop: 0 }}>Entries</h1>

      <div className="row" style={{ marginBottom: 10 }}>
        <div style={{ width: 220 }}>
          <select value={wheelSlug} onChange={(e) => setWheelSlug(e.target.value)}>
            {wheels.map((wheel) => (
              <option key={wheel.id} value={wheel.slug}>
                {wheel.name} ({wheel.slug})
              </option>
            ))}
          </select>
        </div>
        {FILTERS.map((mode) => (
          <button
            key={mode}
            className={mode === filterMode ? "primary" : "secondary"}
            onClick={() => setFilterMode(mode)}
          >
            {mode}
          </button>
        ))}
        <div style={{ width: 280 }}>
          <input
            placeholder="Search name, phone, email, zip, city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="secondary" onClick={() => exportFile("csv")} disabled={!wheelSlug}>
          Export CSV
        </button>
        <button className="secondary" onClick={() => exportFile("xlsx")} disabled={!wheelSlug}>
          Export XLSX
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Street</th>
              <th>City</th>
              <th>Zip</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Follow-up</th>
              <th>Status</th>
              <th>Used</th>
              <th>Winner</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.first_name} {r.last_name}</td>
                <td>{r.street || "-"}</td>
                <td>{r.city || "-"}</td>
                <td>{r.zip_code}</td>
                <td>{r.phone_number}</td>
                <td>{r.email_address}</td>
                <td>{r.follow_up_requested ? "Yes" : "No"}</td>
                <td>{r.status}</td>
                <td>{r.used ? <span className="pill">USED</span> : "No"}</td>
                <td>{r.winner ? <span className="pill">WINNER</span> : "No"}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
