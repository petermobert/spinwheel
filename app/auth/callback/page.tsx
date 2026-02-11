import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Signing you in...</h2>
        </div>
      }
    >
      <CallbackClient />
    </Suspense>
  );
}
