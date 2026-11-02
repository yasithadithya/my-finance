const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Money set in the passbook serif: a small raised "Rs", the rupees, then smaller cents.
 * For amounts inside rows, keep using lkr() so the columns line up.
 */
export default function Amount({
  value,
  className = "",
  sign = false,
}: {
  value: number;
  className?: string;
  /** Show "+" for positive values. */
  sign?: boolean;
}) {
  const [whole, cents] = nf.format(Math.abs(value)).split(".");
  const prefix = value < 0 ? "−" : sign && value > 0 ? "+" : "";
  return (
    <span className={`money ${className}`}>
      <span className="rs">Rs</span>
      {prefix}
      {whole}
      <span className="cents">.{cents}</span>
    </span>
  );
}
