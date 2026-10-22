import { redirect } from "next/navigation";

export default function HomePage() {
  // Make the primary daily workflow the landing screen, not the admin overview.
  redirect("/checkout");
}
