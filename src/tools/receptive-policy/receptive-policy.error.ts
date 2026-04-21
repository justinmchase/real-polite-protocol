import { ApplicationError } from "@justinmchase/grove";

export class InvalidWindowScopeError extends ApplicationError {
  constructor(scope: string) {
    super(
      400,
      "E_INVALID_WINDOW_SCOPE",
      `Invalid window scope "${scope}". Must be "all" or "domain_filter"`,
    );
  }
}

export class InvalidReceptiveModeError extends ApplicationError {
  constructor(mode: string) {
    super(
      400,
      "E_INVALID_RECEPTIVE_MODE",
      `Invalid receptive mode "${mode}". Must be "all", "domain_filter", or "closed"`,
    );
  }
}
