import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

// 필수 환경변수. 누락 시 부팅 시점에 명확한 에러로 실패한다.
// 기존엔 fallback 문자열이 있어 prod에 JWT_SECRET 누락 시 약한 비밀키로 동작하는 위험이 있었음.
if (!process.env.JWT_SECRET) {
  throw new Error("환경변수 JWT_SECRET이 설정되지 않았습니다. .env 또는 환경에 추가해 주세요.");
}
export const JWT_SECRET = process.env.JWT_SECRET;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          include: { tenant: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      memberships: user.memberships,
    };
  }
}
