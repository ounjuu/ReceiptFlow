# LedgerFlow

AI 기반 영수증 자동 처리 및 전표 자동 생성 웹 ERP 시스템

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React Query, CSS Modules |
| Backend | NestJS, Prisma ORM |
| AI | FastAPI (Python), 키워드 기반 계정 분류 |
| DB | PostgreSQL |
| 구조 | npm workspaces 모노레포, 멀티 테넌트 |

## 프로젝트 구조

```
apps/
  web/          # Next.js 프론트엔드 (:3000)
  api/          # NestJS 백엔드 API (:3001)
  ai/           # FastAPI AI 분류 서비스 (:8000)
prisma/
  schema.prisma # DB 스키마
  seed.ts       # 초기 데이터 (계정과목, 테넌트)
```

## 주요 기능

### 회계 핵심
- **영수증 관리** — 등록, AI 계정 분류, 자동 전표 생성
- **전표 관리** — 수기 입력, 차대변 균형 검증, 상태 관리 (임시→승인→확정)
- **재무제표** — 시산표, 손익계산서, 재무상태표
- **계정과목** — 더존 ERP 표준 5자리 코드 체계
- **결산** — 회계 기간 마감/재오픈

### 매출/매입 관리
- **거래명세서** — 매출/매입 등록, 자동 전표 생성
- **입금/출금** — 거래처별 결제 관리, 채권/채무 추적
- **거래처 원장** — 거래처별 채권/채무 연령 분석

### 자산/원가 관리
- **고정자산** — 자산 등록, 정액법/정률법 감가상각, 자동 전표
- **원가 관리** — 품목 마스터, 품목별/거래처별/프로젝트별 원가 분석, 표준원가 차이 분석
- **재고 관리** — 입고/출고/재고실사, 이동평균법 재고 평가, 안전재고 알림, 입출고 시 전표 자동 생성

### 인사/경비
- **급여 관리** — 직원 등록, 급여 계산 (4대보험/소득세), 자동 전표
- **경비 정산** — 경비 신청, 결재 요청, 정산 처리

### 관리 기능
- **예산 관리** — 계정별 월 예산 설정, 실적 대비 분석
- **프로젝트 손익** — 프로젝트별 수익/비용 추적
- **부서별 손익** — 부서별 비용 배분 및 비교
- **세금계산서** — 매입/매출 세금계산서, 부가세 신고서 자동 생성
- **전자결재** — 전표/세금계산서 결재선 설정, 다단계 승인
- **환율 관리** — 외화 환율 등록, 다통화 전표
- **반복 전표** — 전표 템플릿 등록, 일괄 생성
- **자금 관리** — 현금흐름 분석
- **감사 로그** — 모든 회계 처리 이력 추적

### AI 계정 분류
- 거래처명 키워드 기반 자동 분류
- 식당/배달 → 식대, 카페/커피 → 복리후생비, 택시/주유 → 복리후생비 등
- 분류 불가 시 지급수수료(51200)로 기본 처리

## 실행 방법

### 사전 요구사항

- Node.js 18+
- Python 3.10+
- PostgreSQL

### 1. 의존성 설치

```bash
# Node.js 패키지
npm install

# Python AI 서비스
cd apps/ai
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
```

### 2. 데이터베이스 설정

```bash
# PostgreSQL에 DB 생성
createdb ledgerflow

# .env 파일 생성 (프로젝트 루트)
echo 'DATABASE_URL="postgresql://<사용자명>@localhost:5432/ledgerflow"' > .env

# 마이그레이션 및 시드 데이터
npx prisma migrate dev
npx prisma db seed
```

### 3. 서비스 실행

```bash
# 터미널 1 — AI 서비스
cd apps/ai && source .venv/bin/activate
uvicorn main:app --port 8000

# 터미널 2 — 백엔드
npm run dev:api

# 터미널 3 — 프론트엔드
npm run dev:web
```

### 접속

- 프론트엔드: http://localhost:3000
- 백엔드 API: http://localhost:3001
- AI 서비스: http://localhost:8000

## 주요 API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/documents` | 영수증 등록 (AI 분류 + 자동 전표) |
| GET | `/documents?tenantId=` | 영수증 목록 |
| POST | `/journals` | 전표 생성 |
| GET | `/journals?tenantId=` | 전표 목록 |
| GET | `/reports/trial-balance?tenantId=` | 시산표 |
| GET | `/reports/income-statement?tenantId=` | 손익계산서 |
| GET | `/reports/balance-sheet?tenantId=` | 재무상태표 |
| GET | `/accounts?tenantId=` | 계정과목 목록 |
| GET | `/trades?tenantId=` | 매출/매입 목록 |
| POST | `/trades` | 거래명세서 등록 |
| GET | `/inventory/stock?tenantId=` | 현재 재고 목록 |
| POST | `/inventory/transactions` | 입고/출고/조정 등록 |
| GET | `/inventory/valuation?tenantId=` | 재고 평가 |
| GET | `/expense-claims?tenantId=` | 경비 정산 목록 |
| GET | `/cost-management/products?tenantId=` | 품목 목록 |
| GET | `/cost-management/analysis/variance?tenantId=` | 원가 차이 분석 |
| POST | `/classify` (AI, :8000) | 거래처명 → 계정 분류 |
