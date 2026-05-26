import * as React from "react";
import { render, type RenderOptions } from "@testing-library/react";

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return <div className="dark bg-background text-foreground">{children}</div>;
}

export function renderWithTheme(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: ThemeWrapper, ...options });
}

export function mockViewport(width: number, height = 900) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: height });
  window.dispatchEvent(new Event("resize"));
}
