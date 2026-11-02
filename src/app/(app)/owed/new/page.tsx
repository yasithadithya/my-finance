import Link from "next/link";
import { ReceivableForm } from "@/components/Forms";

export default function NewOwedPage() {
  return (
    <div className="space-y-4">
      <Link href="/owed" className="inline-flex items-center gap-1 text-sm text-muted">‹ Owed to me</Link>
      <h1 className="font-serif text-[1.75rem] leading-tight font-medium">Someone owes me</h1>
      <ReceivableForm />
    </div>
  );
}
