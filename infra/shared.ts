import { AppError } from "infra/errors";

export function validatePaginationNumber(
  value: string | undefined,
  fieldName: string,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(
      `${fieldName} deve ser um número inteiro positivo.`,
      400,
    );
  }
  return parsed;
}
