import type { CSSProperties } from "react";

export function Skeleton({ width, height = 16, style, count = 1 }: {
  width?: number | string;
  height?: number;
  style?: CSSProperties;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{
          width: width ?? "100%",
          height,
          ...style,
        }} />
      ))}
    </>
  );
}
