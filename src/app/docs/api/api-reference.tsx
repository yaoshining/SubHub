"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

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
