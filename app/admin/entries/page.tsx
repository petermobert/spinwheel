import { Suspense } from "react";
import AdminEntriesClient from "./AdminEntriesClient";

export default function AdminEntriesPage() {
  return (
    <Suspense fallback={<div className="card">Loading...</div>}>
      <AdminEntriesClient />
    </Suspense>
  );
}
