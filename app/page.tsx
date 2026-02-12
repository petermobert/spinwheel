"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Wheel from "@/components/Wheel";
import WinnerModal from "@/components/WinnerModal";
import { supabaseBrowser } from "@/lib/supabaseClient";
import type { SpinCreateResponse, WheelSnapshotEntry } from "@/lib/types";

type MeResponse = { isAdmin: boolean; userId: string };

export default function AdminWheelPage() {
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WheelSnapshotEntry[]>([]);
  const [lockHeld, setLockHeld] = useState(false);
  const [activeSpin, setActiveSpin] = useState<SpinCreateResponse | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshSessionAndAdmin = useCallback(async () => {
    const { data } = await supabaseBrowser.auth.getSession();
    const accessToken = data.session?.access_token || "";
    setToken(accessToken);

    if (!accessToken) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/admin/me", {
      headers: { authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const payload = (await res.json()) as MeResponse;
    setIsAdmin(payload.isAdmin);
    setLoading(false);
  }, []);

  const fetchEligible = useCallback(async () => {
    if (!token) return;

    const res = await fetch("/api/wheel/eligible", {
      headers: { authorization: `Bearer ${token}` }
    });

    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || "Failed to load entries");
      return;
    }

    setEntries(payload.entries || []);
    setLockHeld(Boolean(payload.lockHeld));
  }, [token]);

  useEffect(() => {
    refreshSessionAndAdmin();

    const { data } = supabaseBrowser.auth.onAuthStateChange(() => {
      refreshSessionAndAdmin();
    });

    return () => data.subscription.unsubscribe();
  }, [refreshSessionAndAdmin]);

  useEffect(() => {
    if (!isAdmin || !token) return;

    fetchEligible();
    const interval = setInterval(() => {
      if (!spinning && !modalOpen) {
        fetchEligible();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchEligible, isAdmin, modalOpen, spinning, token]);

  const login = async () => {
    setError("");
    await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`
      }
    });
  };

  const logout = async () => {
    await supabaseBrowser.auth.signOut();
    setToken("");
    setIsAdmin(false);
    setEntries([]);
  };

  const spinDisabled = useMemo(() => {
    return !isAdmin || spinning || modalOpen || lockHeld || entries.length === 0 || busy;
  }, [isAdmin, spinning, modalOpen, lockHeld, entries.length, busy]);

  const startSpin = async () => {
    if (spinDisabled || !token) return;
    setBusy(true);
    setError("");

    const res = await fetch("/api/spin/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      }
    });

    const payload = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(payload.error || "Could not create spin");
      if (res.status === 409) {
        setLockHeld(true);
      }
      return;
    }

    setActiveSpin(payload as SpinCreateResponse);
    setSpinning(true);
    setLockHeld(true);
  };

  const onAnimationDone = () => {
    setSpinning(false);
    setModalOpen(true);
  };

  const finalize = async () => {
    if (!activeSpin || !token) return;
    setBusy(true);
    setError("");

    const res = await fetch("/api/spin/finalize", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ spinId: activeSpin.spinId, confirmed: true })
    });

    const payload = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(payload.error || "Finalize failed");
      return;
    }

    setModalOpen(false);
    setActiveSpin(null);
    await fetchEligible();
  };

  const cancelSpin = async () => {
    if (!activeSpin || !token) return;
    setBusy(true);
    setError("");

    const res = await fetch("/api/spin/cancel", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ spinId: activeSpin.spinId })
    });

    const payload = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(payload.error || "Cancel failed");
      return;
    }

    setModalOpen(false);
    setActiveSpin(null);
    setSpinning(false);
    await fetchEligible();
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      
      <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Admin Prize Wheel</h1>
        <p style={{ color: "#6c6c6c" }}>Google login + admin role required.</p>
        <button className="primary" onClick={login}>
          Sign in with Google
        </button>
      </div>
    );
  }

  const wheelEntries = activeSpin?.entriesSnapshot ?? entries;

  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 1 }}>


      <div className="card" style={{ padding: 10, minHeight: "calc(100vh - 84px)", flex: 1 }}>
              <div style={{ width: 240, paddingTop: 1, flexShrink: 0 }}>
        <Image src="/SparkleSquadHoriz.png" alt="Sparkle Squad" width={240} height={150} priority />
      </div>
        {/* <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>Sparkle Squad Prize Wheel</h1>
            <p style={{ marginTop: 6, marginBottom: 0, color: "#6c6c6c" }}>
              Entries: {entries.length}
            </p>
          </div>
          <div className="row">
            <button className="secondary" onClick={fetchEligible} disabled={busy || spinning}>
              Refresh
            </button>
          </div>
        </div> */}

        {error && <p className="error">{error}</p>}

        <Wheel entries={wheelEntries} spinPayload={activeSpin} onSpinAnimationDone={onAnimationDone} />

        <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
          <button className="primary" onClick={startSpin} disabled={spinDisabled}>
            {spinning ? "Spinning..." : "Start Spin"}
          </button>
              <p style={{ marginTop: 6, marginBottom: 0, color: "#6c6c6c" }}>
              Entries: {entries.length}
            </p>
                   <div className="row">
            <button className="secondary" onClick={fetchEligible} disabled={busy || spinning}>
              Refresh
            </button>
          </div>
        </div>

        <WinnerModal
          open={modalOpen}
          winnerName={activeSpin?.winnerDisplayName || ""}
          onConfirm={finalize}
          onCancel={cancelSpin}
          busy={busy}
        />
      </div>
    </div>
  );
}
