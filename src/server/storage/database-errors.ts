const getErrorField = (error: unknown, field: "code" | "message"): string => {
  if (typeof error !== "object" || error === null) {
    return "";
  }

  const err = error as Record<string, unknown>;

  if (field in err && err[field] !== undefined && err[field] !== null) {
    return String(err[field]);
  }

  if ("cause" in err) {
    return getErrorField(err.cause, field);
  }

  return "";
};

const getDatabaseErrorCode = (error: unknown) => getErrorField(error, "code");

const getDatabaseErrorMessage = (error: unknown) =>
  getErrorField(error, "message");

export const isConstraintError = (error: unknown) => {
  const code = getDatabaseErrorCode(error);

  return code.startsWith("SQLITE_CONSTRAINT") || code.startsWith("23");
};

export const isUniqueConstraintError = (error: unknown) => {
  const code = getDatabaseErrorCode(error);
  const message = getDatabaseErrorMessage(error);

  return (
    code === "23505" ||
    code === "SQLITE_CONSTRAINT_UNIQUE" ||
    message.includes("UNIQUE constraint failed") ||
    message.includes("duplicate key value violates unique constraint")
  );
};

export const isForeignKeyConstraintError = (error: unknown) => {
  const code = getDatabaseErrorCode(error);
  const message = getDatabaseErrorMessage(error);

  return (
    code === "23503" ||
    code === "SQLITE_CONSTRAINT_FOREIGNKEY" ||
    message.includes("FOREIGN KEY constraint failed") ||
    message.includes("violates foreign key constraint")
  );
};
