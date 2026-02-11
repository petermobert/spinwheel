"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { supabaseBrowser } from "@/lib/supabaseClient";

export default function CallbackClient() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = params.get("code");
      const nextParam = params.get("next");
      const next: Route = nextParam === "/admin/entries" ? "/admin/entries" : "/";

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
