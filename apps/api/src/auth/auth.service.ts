import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

// 회원가입 시 기본 계정과목
const DEFAULT_COA = [
  { code: "10100", name: "현금", type: "ASSET", normalBalance: "DEBIT" },
  { code: "10300", name: "보통예금", type: "ASSET", normalBalance: "DEBIT" },
  { code: "10500", name: "외상매출금", type: "ASSET", normalBalance: "DEBIT" },
  { code: "10800", name: "미수금", type: "ASSET", normalBalance: "DEBIT" },
  { code: "11300", name: "상품", type: "ASSET", normalBalance: "DEBIT" },
  { code: "13100", name: "토지", type: "ASSET", normalBalance: "DEBIT" },
  { code: "13200", name: "건물", type: "ASSET", normalBalance: "DEBIT" },
  { code: "13500", name: "비품", type: "ASSET", normalBalance: "DEBIT" },
  { code: "13600", name: "감가상각누계액", type: "ASSET", normalBalance: "CREDIT" },
  { code: "20100", name: "외상매입금", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "20300", name: "미지급금", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "20500", name: "예수금", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "20600", name: "부가세예수금", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "20700", name: "단기차입금", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "23100", name: "장기차입금", type: "LIABILITY", normalBalance: "CREDIT" },
  { code: "30100", name: "자본금", type: "EQUITY", normalBalance: "CREDIT" },
  { code: "30300", name: "이익잉여금", type: "EQUITY", normalBalance: "CREDIT" },
  { code: "30500", name: "당기순이익", type: "EQUITY", normalBalance: "CREDIT" },
  { code: "40100", name: "상품매출", type: "REVENUE", normalBalance: "CREDIT" },
  { code: "40300", name: "용역수익", type: "REVENUE", normalBalance: "CREDIT" },
  { code: "40400", name: "이자수익", type: "REVENUE", normalBalance: "CREDIT" },
  { code: "40800", name: "잡이익", type: "REVENUE", normalBalance: "CREDIT" },
  { code: "50100", name: "급여", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "50300", name: "복리후생비", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "50400", name: "식대", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "50800", name: "임차료", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "50900", name: "감가상각비", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "51200", name: "지급수수료", type: "EXPENSE", normalBalance: "DEBIT" },
  { code: "51800", name: "법인세비용", type: "EXPENSE", normalBalance: "DEBIT" },
];

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signup(email: string, password: string, name: string) {
    // 이메일 중복 확인
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("이미 사용 중인 이메일입니다");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 유저 + 테넌트 + Membership + COA 한 번에 생성
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        memberships: {
          create: {
            role: "ADMIN",
            tenant: {
              create: {
                name: `${name}의 회사`,
                accounts: {
                  create: DEFAULT_COA,
                },
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: { tenant: true },
        },
      },
    });

    return this.generateToken(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { tenant: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다");
    }

    return this.generateToken(user);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
      })),
    };
  }

  // --- 멤버 관리 ---

  async getMembers(tenantId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
    }));
  }

  async invite(email: string, role: string, tenantId: string) {
    if (!["ADMIN", "ACCOUNTANT", "VIEWER"].includes(role)) {
      throw new BadRequestException("유효하지 않은 역할입니다");
    }

    // 이미 해당 테넌트 멤버인지 확인
    const existing = await this.prisma.membership.findFirst({
      where: { tenantId, user: { email } },
    });
    if (existing) {
      throw new ConflictException("이미 등록된 멤버입니다");
    }

    // 유저가 있으면 Membership만 추가, 없으면 임시 비밀번호로 생성
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const tempPassword = await bcrypt.hash("temp1234", 10);
      user = await this.prisma.user.create({
        data: { email, password: tempPassword, name: email.split("@")[0] },
      });
    }

    const membership = await this.prisma.membership.create({
      data: { userId: user.id, tenantId, role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return {
      id: membership.id,
      role: membership.role,
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
    };
  }

  async updateMemberRole(membershipId: string, role: string) {
    if (!["ADMIN", "ACCOUNTANT", "VIEWER"].includes(role)) {
      throw new BadRequestException("유효하지 않은 역할입니다");
    }

    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) {
      throw new NotFoundException("멤버를 찾을 수 없습니다");
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return {
      id: updated.id,
      role: updated.role,
      userId: updated.user.id,
      email: updated.user.email,
      name: updated.user.name,
    };
  }

  async removeMember(membershipId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) {
      throw new NotFoundException("멤버를 찾을 수 없습니다");
    }

    await this.prisma.membership.delete({ where: { id: membershipId } });
    return { success: true };
  }

  // 프로필 수정
  async updateProfile(userId: string, name: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name },
      include: { memberships: { include: { tenant: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        tenantId: m.tenantId,
        tenantName: m.tenant.name,
      })),
    };
  }

  // 비밀번호 변경
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다");

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new UnauthorizedException("현재 비밀번호가 올바르지 않습니다");

    if (newPassword.length < 6) throw new BadRequestException("새 비밀번호는 6자 이상이어야 합니다");

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { success: true };
  }

  private generateToken(user: { id: string; email: string; name: string; memberships: { tenantId: string; role: string; tenant: { name: string } }[] }) {
    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        memberships: user.memberships.map((m) => ({
          tenantId: m.tenantId,
          tenantName: m.tenant.name,
          role: m.role,
        })),
      },
    };
  }
}
