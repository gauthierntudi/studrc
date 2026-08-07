"use client";

import { AdminAuthGate } from "@/components/admin/admin-auth-gate";

export default function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminAuthGate>{children}</AdminAuthGate>;
}
