type Variant = "dashboard" | "list" | "detail" | "form";

export default function PageLoader({
  label,
  variant = "list",
  chips = false,
}: {
  label: string;
  variant?: Variant;
  chips?: boolean;
}) {
  return (
    <div className="loader space-y-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 pt-6 pb-2">
        <div className="coins" aria-hidden>
          <span className="coin-shadow" />
          <span className="coin coin-1" />
          <span className="coin coin-2" />
          <span className="coin coin-3" />
        </div>
        <p className="text-sm text-muted">
          {label}
          <span className="dots" aria-hidden>
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      </div>

      <div className="skel-wrap space-y-5" aria-hidden>
        {variant === "dashboard" && <Dashboard />}
        {variant === "list" && <List chips={chips} />}
        {variant === "detail" && <Detail />}
        {variant === "form" && <Form />}
      </div>
    </div>
  );
}

// `w` is a width in rem, for bars that vary row to row.
function Bar({ className = "", w }: { className?: string; w?: number }) {
  return <div className={`skel ${className}`} style={w ? { width: `${w}rem` } : undefined} />;
}

const ROW_WIDTHS = [9, 6.5, 8, 5.5, 7.5];

function Rows({ n }: { n: number }) {
  return (
    <div className="ledger">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3.5">
          <Bar className="h-3.5" w={ROW_WIDTHS[i % ROW_WIDTHS.length]} />
          <Bar className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <div className="panel space-y-3">
        <Bar className="h-3 w-24" />
        <Bar className="h-10 w-52" />
        <Bar className="h-3 w-40" />
        <Bar className="mt-6 h-4 w-full" />
        <div className="grid grid-cols-2 gap-3 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-2.5 w-16" />
              <Bar className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="card space-y-3 p-4">
        <div className="flex justify-between">
          <Bar className="h-4 w-28" />
          <Bar className="h-4 w-20" />
        </div>
        <Bar className="h-1.5 w-full rounded-full" />
      </div>
      <Rows n={3} />
    </>
  );
}

function List({ chips }: { chips: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Bar className="h-6 w-36" />
        <Bar className="h-9 w-16 rounded-xl" />
      </div>
      {chips && (
        <div className="flex gap-2">
          {[3, 5.5, 4.5, 5].map((w, i) => (
            <Bar key={i} className="h-7 rounded-full" w={w} />
          ))}
        </div>
      )}
      <Rows n={5} />
      <Rows n={2} />
    </>
  );
}

function Detail() {
  return (
    <>
      <div className="space-y-2">
        <Bar className="h-3 w-16" />
        <Bar className="h-6 w-40" />
        <Bar className="h-8 w-32" />
      </div>
      <div className="card space-y-4 p-4">
        <Bar className="h-4 w-32" />
        <Bar className="h-11 w-full rounded-xl" />
        <Bar className="h-11 w-full rounded-xl" />
      </div>
      <Rows n={3} />
    </>
  );
}

function Form() {
  return (
    <>
      <Bar className="h-6 w-44" />
      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Bar className="h-3 w-20" />
            <Bar className="h-11 w-full rounded-xl" />
          </div>
        ))}
        <Bar className="h-12 w-full rounded-2xl" />
      </div>
    </>
  );
}
