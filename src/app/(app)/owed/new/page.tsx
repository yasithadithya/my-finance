import { ReceivableForm } from "@/components/Forms";
import PageHeader from "@/components/PageHeader";

export default function NewOwedPage() {
  return (
    <div className="page-in space-y-5">
      <PageHeader title="Someone owes me" back={{ href: "/owed", label: "Owed to me" }} />
      <ReceivableForm />
    </div>
  );
}
