const getDatabaseErrorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

const getDatabaseErrorMessage = (error: unknown) =>
  typeof error === "object" && error !== null && "message" in error
    ? String(error.message)
    : "";

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
