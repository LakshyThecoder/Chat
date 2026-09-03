"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#050d18", color: "#f4efe4", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 480, border: "1px solid #e8b84a66", padding: 32, background: "#0b1f3a" }}>
            <p style={{ letterSpacing: "0.28em", color: "#e8b84a", fontSize: 12 }}>AEGIS OS</p>
            <h1 style={{ fontSize: 28, marginTop: 12 }}>Boot failed</h1>
            <p style={{ marginTop: 16, color: "#ffffffb3" }} role="alert">
              {error.message || "A client-side exception stopped the runtime."}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 24,
                background: "#e8b84a",
                color: "#0b1f3a",
                border: 0,
                padding: "12px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reboot
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
