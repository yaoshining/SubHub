import { describe, expect, it } from "vitest";

import {
  isConstraintError,
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "@/server/storage/database-errors";

describe("database error helpers", () => {
  it("recognizes nested postgres constraint metadata from DrizzleQueryError-like causes", () => {
    const error = {
      message: "Failed query: insert into providers ...",
      cause: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "providers_type_name_unique"',
      },
    };

    expect(isConstraintError(error)).toBe(true);
    expect(isUniqueConstraintError(error)).toBe(true);
    expect(isForeignKeyConstraintError(error)).toBe(false);
  });
});
