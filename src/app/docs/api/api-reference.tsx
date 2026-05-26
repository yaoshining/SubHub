"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";

export function ApiReference() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "/api/openapi.yaml",
        theme: "moon",
        layout: "modern",
        hideDownloadButton: false,
      }}
    />
  );
}
