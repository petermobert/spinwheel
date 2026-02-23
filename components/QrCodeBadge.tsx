"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

type Props = {
  targetUrl: string;
};

export default function QrCodeBadge({ targetUrl }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [href, setHref] = useState<string>("");

  useEffect(() => {
    if (!targetUrl) return;
    setHref(targetUrl);

    QRCode.toDataURL(targetUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: "#111111",
        light: "#ffffff"
      }
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [targetUrl]);

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 20,
        background: "#ffffff",
        borderRadius: 12,
        padding: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        display: "grid",
        gap: 6,
        placeItems: "center"
      }}
    >
      {dataUrl ? (
        <Image src={dataUrl} alt="QR code for this page" width={180} height={180} unoptimized />
      ) : (
        <div style={{ width: 180, height: 180, background: "#f1f1f1" }} />
      )}
      <div style={{ fontSize: 12, color: "#4b4b4b" }}>Scan to open this page</div>
      {href ? (
        <div style={{ fontSize: 10, color: "#7a7a7a", maxWidth: 200, textAlign: "center", wordBreak: "break-all" }}>
          {href}
        </div>
      ) : null}
    </div>
  );
}
