import { Response } from "express";
import { SuccessResponse, ErrorResponse } from "../types";

// ========================================
// Get first row from query result
// ========================================
export const getFirstRow = <T>(rows: T[]): T | null => {
  const [row] = rows;
  return row ?? null;
};

// ========================================
// Send 404 if row not found
// ========================================
export const getRowOrNotFound = <T>(
  rows: T[],
  res: Response<SuccessResponse<T> | ErrorResponse>,
  errorMessage: string = "Not found",
): T | null => {
  const [row] = rows;

  if (!row) {
    res.status(404).json({ error: errorMessage });
    return null;
  }

  return row;
};

// ========================================
// Send 500 if creation failed
// ========================================
export const getRowOrFailed = <T>(
  rows: T[],
  res: Response<SuccessResponse<T> | ErrorResponse>,
  errorMessage: string = "Operation failed",
): T | null => {
  const [row] = rows;

  if (!row) {
    res.status(500).json({ error: errorMessage });
    return null;
  }

  return row;
};
