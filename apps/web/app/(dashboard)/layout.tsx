import { Nav } from "@/components/nav";
import { officerName } from "@/lib/server-api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav officer={officerName()} />
      <main className="mx-auto max-w-6xl px-4 pb-20">{children}</main>
    </>
  );
}
