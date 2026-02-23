import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sparkle Squad Giveaway",
  description: "Lead capture + admin prize wheel"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          {/* <nav className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <div className="row">
              <Link href="/" style={{ fontWeight: 800, textDecoration: "none" }}>
                Sparkle Squad Giveaway
              </Link>
              <Link href="/form">Public Form</Link>
              <Link href="/admin/entries">Admin Entries</Link>
            </div>
          </nav> */}
          {children}
        </div>
      </body>
    </html>
  );
}
