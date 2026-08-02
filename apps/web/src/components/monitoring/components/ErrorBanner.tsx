/** Inline, dismissible-looking error banner used across pages. */
export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <div className="error-banner__content">
        <span className="error-banner__icon" aria-hidden="true">⚠️</span>
        <span className="error-banner__text">{message}</span>
      </div>
    </div>
  );
}
