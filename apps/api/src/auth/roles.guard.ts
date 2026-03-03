import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // @Roles() 없으면 인증만 통과하면 허용
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.memberships) {
      throw new ForbiddenException("접근 권한이 없습니다");
    }

    // 요청에서 tenantId 추출 (쿼리 → 바디 → FormData)
    const tenantId =
      request.query?.tenantId ||
      request.body?.tenantId;

    if (!tenantId) {
      // tenantId 없는 요청 (개별 리소스 접근 등) → 어떤 테넌트든 해당 역할 있으면 허용
      const hasRole = user.memberships.some(
        (m: { role: string }) => requiredRoles.includes(m.role),
      );
      if (!hasRole) {
        throw new ForbiddenException("접근 권한이 없습니다");
      }
      return true;
    }

    // 해당 테넌트에서의 역할 확인
    const membership = user.memberships.find(
      (m: { tenantId: string }) => m.tenantId === tenantId,
    );

    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException("접근 권한이 없습니다");
    }

    return true;
  }
}
