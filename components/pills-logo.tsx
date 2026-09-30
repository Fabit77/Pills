import Image from "next/image";

type PillsLogoProps = {
  context?: string;
  inverse?: boolean;
  compact?: boolean;
  className?: string;
};

export function PillsLogo({ context, inverse = false, compact = false, className = "" }: PillsLogoProps) {
  return <span className={`pills-logo ${inverse ? "pills-logo-inverse" : ""} ${compact ? "pills-logo-compact" : ""} ${className}`.trim()}>
    <Image className="pills-logo-image" src="/brand/pills-logo-official.png" alt="Pills" width={1400} height={287} priority />
    {!compact && context && <em>{context}</em>}
  </span>;
}
