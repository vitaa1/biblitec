export class AppError extends Error {
  constructor(
    message: string,
    public readonly status_code: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}
