export default function HomePage() {
  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Sparkle Squad Giveaway</h1>
      <p style={{ color: "#6c6c6c" }}>This app now supports multiple wheels.</p>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Admin</h3>
        <p style={{ color: "#6c6c6c" }}>Create and manage wheels.</p>
        <a href="/admin/wheels">Go to Wheel Admin</a>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Public Entry</h3>
        <p style={{ color: "#6c6c6c" }}>Use a wheel-specific URL like:</p>
        <code>/form/your-wheel-slug</code>
      </div>
    </div>
  );
}
