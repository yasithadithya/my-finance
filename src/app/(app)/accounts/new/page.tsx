import AccountForm from "@/components/AccountForm";
import PageHeader from "@/components/PageHeader";
import { todayColombo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function NewAccountPage() {
  return (
    <div className="page-in space-y-5">
      <PageHeader title="New account" back={{ href: "/accounts", label: "Accounts" }} />
      <AccountForm today={todayColombo()} />
    </div>
  );
}
