import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "@/proxy";

describe("Validator canonical route proxy", () => {
  it("redirects an anonymous canonical request to login with its return path", () => {
    const response = proxy(
      new NextRequest(
        "http://localhost/admin/subtitle-api-validator?provider=opensubtitles",
      ),
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fadmin%2Fsubtitle-api-validator%3Fprovider%3Dopensubtitles",
    );
  });

  it("rewrites an authenticated canonical request to the existing route", () => {
    const response = proxy(
      new NextRequest(
        "http://localhost/admin/subtitle-api-validator?provider=opensubtitles",
        {
          headers: { cookie: "subhub_admin_session=stale-session-token" },
        },
      ),
    );

    expect(response?.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost/subtitle-api-validator?provider=opensubtitles",
    );
    expect(
      response?.headers.get("x-middleware-request-x-subhub-admin-pathname"),
    ).toBe("/admin/subtitle-api-validator?provider=opensubtitles");
  });

  it("protects and rewrites canonical child paths", () => {
    const anonymousResponse = proxy(
      new NextRequest(
        "http://localhost/admin/subtitle-api-validator/?provider=opensubtitles",
      ),
    );

    expect(anonymousResponse?.status).toBe(307);
    expect(anonymousResponse?.headers.get("location")).toBe(
      "http://localhost/login?next=%2Fadmin%2Fsubtitle-api-validator%2F%3Fprovider%3Dopensubtitles",
    );

    const authenticatedResponse = proxy(
      new NextRequest(
        "http://localhost/admin/subtitle-api-validator/future?provider=opensubtitles",
        {
          headers: { cookie: "subhub_admin_session=stale-session-token" },
        },
      ),
    );

    expect(authenticatedResponse?.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost/subtitle-api-validator/future?provider=opensubtitles",
    );
  });

  it("matches the canonical validator route and its descendants", () => {
    expect(config.matcher).toContain("/admin/subtitle-api-validator/:path*");
  });
});
