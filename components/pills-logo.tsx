import Image from "next/image";

type PillsLogoProps = {
  context?: string;
  inverse?: boolean;
  compact?: boolean;
  className?: string;
};

export function PillsLogo({ context, inverse = false, compact = false, className = "" }: PillsLogoProps) {
  return <span className={`pills-logo ${inverse ? "pills-logo-inverse" : ""} ${compact ? "pills-logo-compact" : ""} ${className}`.trim()}>
    <Image className="pills-logo-symbol" src="/brand/pills-symbol.png" alt="" width={700} height={286} priority />
    {!compact && <strong>Pills</strong>}
    {context && <em>{context}</em>}
  </span>;
}

