import { BrandLogo } from "@/components/brand-logo";

type BrandedLoaderProps = {
  message?: string;
  compact?: boolean;
};

export function BrandedLoader({ message = "Preparing your workspace", compact = false }: BrandedLoaderProps) {
  return (
    <div className={`ce-loader${compact ? " ce-loader--compact" : ""}`} role="status" aria-live="polite" aria-label={message}>
      <div className="ce-loader-stage" aria-hidden="true">
        <span className="ce-loader-orbit ce-loader-orbit--outer" />
        <span className="ce-loader-orbit ce-loader-orbit--inner" />
        <span className="ce-loader-beacon ce-loader-beacon--one" />
        <span className="ce-loader-beacon ce-loader-beacon--two" />
        <div className="ce-loader-logo"><BrandLogo /></div>
        <div className="ce-loader-skyline"><i /><i /><i /><i /><i /></div>
        <span className="ce-loader-scan" />
      </div>
      <div className="ce-loader-copy">
        <strong>{message}</strong>
        <span>Connecting properties, people and operations</span>
        <span className="ce-loader-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>
    </div>
  );
}
