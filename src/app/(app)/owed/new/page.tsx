import Link from "next/link";
import { ReceivableForm } from "@/components/Forms";

export default function NewOwedPage() {
  return (
    <div className="space-y-4">
      <Link href="/owed" className="text-sm text-muted">‹ Owed to me</Link>
      <h1 className="text-xl font-semibold">Someone owes me</h1>
      <ReceivableForm />
    </div>
  );
}
