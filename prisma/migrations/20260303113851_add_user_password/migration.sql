-- AlterTable: password 컬럼 추가 (기존 유저는 임시 해시값 설정)
ALTER TABLE "User" ADD COLUMN "password" TEXT NOT NULL DEFAULT 'temp';
-- 기본값 제거 (이후 신규 유저는 반드시 password 필요)
ALTER TABLE "User" ALTER COLUMN "password" DROP DEFAULT;
