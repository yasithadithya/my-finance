import { getAccounts } from "@/lib/data";
import { RecurringForm } from "@/components/Forms";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const accounts = await getAccounts();
  return (
    <div className="page-in space-y-5">
      <PageHeader title="New fixed payment" back={{ href: "/pay/items", label: "Fixed payments" }} />
      <RecurringForm accounts={accounts.map(({ id, name }) => ({ id, name }))} />
    </div>
  );
}
