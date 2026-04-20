import { ApplicationError } from "@justinmchase/grove";

export interface PaginationInput {
  page_size?: number;
  resume_token?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  next_resume_token?: string;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export class InvalidPageSizeError extends ApplicationError {
  constructor(pageSize: number) {
    super(
      400,
      "E_INVALID_PAGE_SIZE",
      "Invalid page_size. Expected an integer between 1 and 200.",
      `Received page_size=${pageSize}`,
    );
  }
}

export class InvalidResumeTokenError extends ApplicationError {
  constructor() {
    super(
      400,
      "E_INVALID_RESUME_TOKEN",
      "Invalid resume_token.",
    );
  }
}

export function normalizePageSize(pageSize?: number): number {
  if (pageSize === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new InvalidPageSizeError(pageSize);
  }
  return pageSize;
}

export function normalizeResumeToken(resumeToken?: string): string | undefined {
  if (resumeToken === undefined) {
    return undefined;
  }
  if (!resumeToken.trim()) {
    throw new InvalidResumeTokenError();
  }
  return resumeToken;
}

export function nextResumeToken(cursor: string): string | undefined {
  return cursor.length > 0 ? cursor : undefined;
}
