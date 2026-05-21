import { redirect } from "next/navigation";

export default function RootPage() {
  // Authenticated users land on the cockpit dashboard.
  // Unauthenticated requests are caught upstream by src/proxy.ts and bounced to /login.
  redirect("/cockpit");
}
