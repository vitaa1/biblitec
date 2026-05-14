export class AppError extends Error {
  constructor(
    message: string,
    public readonly status_code: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isDuplicateConstraint(
  error: unknown,
  constraint: string,
): boolean {
  const cause = (error as { cause?: { constraint?: string } })?.cause;
  return cause?.constraint === constraint;
}
