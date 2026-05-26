import * as React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { vi } from "vitest";

type RouterMock = {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
};

let pathname = "/";
let routerMock: RouterMock = createRouterMock();

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return <div className="dark bg-background text-foreground">{children}</div>;
}

export function createRouterMock(): RouterMock {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  };
}

export function setMockPathname(nextPathname: string) {
  pathname = nextPathname;
}

export function setMockRouter(nextRouter: Partial<RouterMock> = {}) {
  routerMock = { ...createRouterMock(), ...nextRouter };
  return routerMock;
}

export function renderWithTheme(
  ui: React.ReactElement,
  options?: RenderOptions,
) {
  return render(ui, { wrapper: ThemeWrapper, ...options });
}

export function mockViewport(width: number, height = 900) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event("resize"));
}
