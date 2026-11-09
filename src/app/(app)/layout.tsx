import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main
        className="mx-auto max-w-md px-4"
        style={{ paddingBottom: "calc(7.5rem + env(safe-area-inset-bottom))", paddingTop: "env(safe-area-inset-top)" }}
      >
        {children}
      </main>
      <BottomNav />
    </>
  );
}
