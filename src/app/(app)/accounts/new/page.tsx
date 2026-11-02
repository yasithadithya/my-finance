import AccountForm from "@/components/AccountForm";
import { todayColombo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function NewAccountPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">New account</h1>
      <AccountForm today={todayColombo()} />
    </div>
  );
}
