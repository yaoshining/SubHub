import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";

export const viewportBreakpoints = {
  mobile: 375,
  tablet: 768,
  desktop: 1280
} as const;

export function setViewport(width: number, height = 900) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height
  });
  window.dispatchEvent(new Event("resize"));
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, options);
}
