import { redirect } from "next/navigation";

// The old dashboard duplicated the summary that now lives on /reports.
export default function DashboardPage() {
  redirect("/reports");
}
