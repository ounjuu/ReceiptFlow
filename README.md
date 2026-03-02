# ReceiptFlow

영수증 기반 AI 자동 분개 처리 웹 ERP 시스템

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 14 (App Router), React Query, CSS Modules |
| Backend | NestJS, Prisma ORM |
| AI | FastAPI (Python), 키워드 기반 계정 분류 |
| DB | PostgreSQL |
| 구조 | npm workspaces 모노레포 |

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

### 영수증 관리
- 거래처명, 금액, 거래일 입력으로 영수증 등록
- AI가 거래처명을 분석하여 계정과목 자동 추천 (식대, 복리후생비 등)
- 추천 결과를 바탕으로 전표 자동 생성
- 영수증 수정 / 삭제

### 전표 관리
- 수기 전표 입력 (계정 선택, 차변/대변 금액)
- 차대변 균형 실시간 검증
- 전표 상태 관리 (임시 → 승인 → 확정)
- 확정된 전표만 재무제표에 반영
- 전표 수정 / 삭제

### 재무제표
- **시산표** — 계정별 차변/대변/잔액
- **손익계산서** — 수익/비용 집계, 당기순이익
- **재무상태표** — 유동/비유동 자산·부채, 자본, 대차균형 확인, CSV 다운로드

### AI 계정 분류
- 거래처명 키워드 기반 자동 분류
- 식당/배달 → 식대, 카페/커피 → 복리후생비, 택시/주유 → 복리후생비 등
- 분류 불가 시 지급수수료(51200)로 기본 처리

### 계정과목
- 더존 ERP 표준 계정과목 (5자리 코드)
- 자산(1xxxx), 부채(2xxxx), 자본(3xxxx), 수익(4xxxx), 비용(5xxxx)

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

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/documents` | 영수증 등록 (AI 분류 + 자동 전표) |
| GET | `/documents?tenantId=` | 영수증 목록 |
| PATCH | `/documents/:id` | 영수증 수정 |
| DELETE | `/documents/:id` | 영수증 삭제 |
| POST | `/journals` | 전표 생성 |
| GET | `/journals?tenantId=` | 전표 목록 |
| PATCH | `/journals/:id` | 전표 수정 (상태 변경 포함) |
| DELETE | `/journals/:id` | 전표 삭제 |
| GET | `/reports/trial-balance?tenantId=` | 시산표 |
| GET | `/reports/income-statement?tenantId=` | 손익계산서 |
| GET | `/reports/balance-sheet?tenantId=` | 재무상태표 |
| GET | `/accounts?tenantId=` | 계정과목 목록 |
| POST | `/classify` (AI, :8000) | 거래처명 → 계정 분류 |
