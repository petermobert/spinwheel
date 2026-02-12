"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpinCreateResponse, WheelSnapshotEntry } from "@/lib/types";

type Props = {
  entries: WheelSnapshotEntry[];
  spinPayload: SpinCreateResponse | null;
  onSpinAnimationDone: () => void;
};

const POINTER_ANGLE = -Math.PI / 2;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function hashToRange(input: string, min: number, max: number) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const normalized = ((h >>> 0) % 10000) / 10000;
  return min + normalized * (max - min);
}

function getLabelFontSize(radius: number, segmentAngle: number) {
  // Approximate available text width on a slice at ~80% of the radius.
  const arcLength = radius * 0.8 * segmentAngle;
  return Math.max(14, Math.min(44, Math.floor(arcLength * 0.23)));
}

export default function Wheel({ entries, spinPayload, onSpinAnimationDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const activeEntries = spinPayload?.entriesSnapshot ?? entries;

  const colors = useMemo(
    () => ["#ffd166", "#ef476f", "#06d6a0", "#118ab2", "#f78c6b", "#7f95d1", "#9bdeac", "#edc4b3"],
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 12;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotation);

    if (activeEntries.length === 0) {
      ctx.fillStyle = "#ddd";
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const segment = (Math.PI * 2) / activeEntries.length;
    const fontSize = getLabelFontSize(radius, segment);

    activeEntries.forEach((entry, i) => {
      const start = i * segment;
      const end = start + segment;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();

      const mid = start + segment / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.fillStyle = "#1e1e1e";
      ctx.font = `700 ${fontSize}px Avenir Next`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(entry.display_name, radius - 12, 5);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }, [activeEntries, colors, rotation]);

  useEffect(() => {
    if (!spinPayload || spinPayload.entriesSnapshot.length === 0) return;

    const n = spinPayload.entriesSnapshot.length;
    const winnerIndex = spinPayload.winnerIndex;
    const segmentSize = (Math.PI * 2) / n;
    const winnerCenter = (winnerIndex + 0.5) * segmentSize;

    // Optional deterministic jitter inside segment; still deterministic and winner-safe.
    const jitter = hashToRange(spinPayload.spinId, -segmentSize * 0.16, segmentSize * 0.16);

    const deterministicTurns = Math.floor(hashToRange(spinPayload.spinId + "turns", 7, 11));
    const base = deterministicTurns * Math.PI * 2;
    let target = base + (POINTER_ANGLE - (winnerCenter + jitter));

    if (target <= rotation) {
      const delta = rotation - target;
      target += (Math.floor(delta / (Math.PI * 2)) + 1) * Math.PI * 2;
    }

    const from = rotation;
    const duration = Math.round(hashToRange(spinPayload.spinId + "dur", 4200, 6800));
    const start = performance.now();

    let raf = 0;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setRotation(from + (target - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(animate);
      } else {
        setRotation(target);
        onSpinAnimationDone();
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinPayload]);

  return (
    <div style={{ display: "grid", placeItems: "center", gap: 8 }}>
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "20px solid transparent",
          borderRight: "20px solid transparent",
          borderTop: "34px solid #bc4749",
          marginBottom: -8,
          zIndex: 2
        }}
      />
      <canvas
        ref={canvasRef}
        width={1400}
        height={1400}
        style={{ width: "min(100%, calc(100vh - 220px), 1350px)", maxWidth: "100%", height: "auto" }}
      />
    </div>
  );
}
