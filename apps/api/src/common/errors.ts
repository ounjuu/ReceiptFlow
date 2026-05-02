import { NotFoundException } from "@nestjs/common";

/**
 * NotFoundException을 throw한다.
 * never 리턴 타입으로 호출 이후 코드의 타입 narrowing을 돕는다.
 */
export function throwNotFound(message: string): never {
  throw new NotFoundException(message);
}
