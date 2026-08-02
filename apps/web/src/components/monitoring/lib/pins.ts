/**
 * Drawing-pin maths (Fieldwire-style plan-anchored tickets). Pins are stored
 * as fractions of the drawing's width/height so they're zoom-independent.
 * Pure + unit-tested; the page just renders the result.
 */

export interface PinPoint {
  x: number; // 0..1, left -> right
  y: number; // 0..1, top -> bottom
}

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Convert a click inside the rendered drawing into fractional coordinates. */
export function relativePin(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): PinPoint {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

/** CSS percentage position for a stored pin. */
export const pinStyle = (x: number, y: number) => ({
  left: `${clamp01(x) * 100}%`,
  top: `${clamp01(y) * 100}%`,
});
