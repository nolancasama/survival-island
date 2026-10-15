import { rt } from "./runtime";

/** Starts an authored route. The story can poll rt.kai.route.length for arrival. */
export function walkKaiRoute(points: ReadonlyArray<{ x: number; z: number }>): void {
  rt.kai.walkTo = null;
  rt.kai.route = points.map((point) => ({ ...point }));
}
