type PostgresError = {
  code: string;
  detail?: string;
  table?: string;
  constraint?: string;
  message?: string;
};

export const isPostgresError = (err: unknown): err is PostgresError => {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as any).code === "string"
  );
};

export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  NOT_NULL_VIOLATION: "23502",
  CHECK_VIOLATION: "23514",
} as const;

export const handlePostgresError = (err: unknown, res: any): boolean => {
  if (!isPostgresError(err)) return false;

  switch (err.code) {
    case PG_ERROR_CODES.UNIQUE_VIOLATION:
      res.status(400).json({
        error: "Record with this value already exists",
        detail: err.detail,
      });
      return true;

    case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:
      res.status(400).json({
        error: "Referenced record does not exist",
        detail: err.detail,
      });
      return true;

    case PG_ERROR_CODES.NOT_NULL_VIOLATION:
      res.status(400).json({
        error: "Required field is missing",
      });
      return true;

    default:
      return false;
  }
};
