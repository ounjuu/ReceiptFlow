import { NotFoundException } from "@nestjs/common";

/**
 * NotFoundException을 throw한다.
 * never 리턴 타입으로 호출 이후 코드의 타입 narrowing을 돕는다.
 */
export function throwNotFound(message: string): never {
  throw new NotFoundException(message);
}

/**
 * unknown 타입의 에러에서 사람이 읽을 수 있는 message 문자열을 추출한다.
 * Error 인스턴스면 .message, 아니면 String(err).
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
