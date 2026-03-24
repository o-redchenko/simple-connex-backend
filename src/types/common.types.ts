export type SuccessResponse<T = any> = {
  success: true;
  data: T;
  message?: string;
};

export type ErrorResponse = {
  success?: false;
  error: string;
};

export type APIResponse<T = any> = SuccessResponse<T> | ErrorResponse;

export type ValidationSuccess = {
  valid: true;
};

export type ValidationError = {
  valid: false;
  message: string;
};

export type ValidationResult = ValidationSuccess | ValidationError;

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type ID = number;
export type Optionalize<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;
