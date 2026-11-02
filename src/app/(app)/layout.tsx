import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main
        className="mx-auto max-w-md px-4 pt-5"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))", paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        {children}
      </main>
      <BottomNav />
    </>
  );
}
