import { createParamDecorator, ExecutionContext, BadRequestException } from "@nestjs/common";

/**
 * JWT의 memberships에서 tenantId를 자동 추출하는 파라미터 데코레이터.
 * Query/Body에 tenantId가 있으면 그걸 우선 사용하고,
 * 없으면 JWT의 첫 번째 membership에서 가져온다.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();

    // Query나 Body에 명시적으로 tenantId가 있으면 우선 사용
    const explicit = request.query?.tenantId || request.body?.tenantId;
    if (explicit) return explicit;

    // JWT에서 추출
    const memberships = request.user?.memberships;
    if (memberships?.length) {
      return memberships[0].tenantId;
    }

    throw new BadRequestException("tenantId를 확인할 수 없습니다");
  },
);
