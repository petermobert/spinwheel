"use client";

type Props = {
  open: boolean;
  winnerName: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function WinnerModal({ open, winnerName, busy, onConfirm, onCancel }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "grid",
        placeItems: "center",
        zIndex: 50
      }}
    >
      <div className="card" style={{ width: "min(460px, 92vw)" }}>
        <h2 style={{ marginTop: 0 }}>Confirm Winner</h2>
        <p>
          Selected winner: <strong>{winnerName}</strong>
        </p>
        <p style={{ marginTop: 0, color: "#6c6c6c", fontSize: 13 }}>
          Confirm will finalize this spin and mark all snapshot entries as used. Cancel will discard this spin.
        </p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="secondary" disabled={busy} onClick={onCancel}>
            Cancel Spin
          </button>
          <button className="primary" disabled={busy} onClick={onConfirm}>
            Confirm Winner
          </button>
        </div>
      </div>
    </div>
  );
}
