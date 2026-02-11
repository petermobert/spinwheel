"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = params.get("code");
      const next = params.get("next") || "/";

      if (!code) {
        router.replace(next);
        return;
      }

      await supabaseBrowser.auth.exchangeCodeForSession(code);
      router.replace(next);
    };

    run();
  }, [params, router]);

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Signing you in...</h2>
    </div>
  );
}
