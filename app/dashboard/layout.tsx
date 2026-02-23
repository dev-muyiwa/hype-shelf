import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Dashboard layout — server-side auth guard.
 *
 * This is a defence-in-depth measure. The middleware already redirects
 * unauthenticated users away from /dashboard, but we also verify the
 * session here at the layout level. Middleware alone is not sufficient
 * as a security boundary (ref: CVE-2025-29927).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return <>{children}</>;
}
