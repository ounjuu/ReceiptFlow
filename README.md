# LedgerFlow

AI 기반 영수증 자동 처리 및 전표 자동 생성 웹 ERP 시스템

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React Query, CSS Modules |
| Backend | NestJS, Prisma ORM |
| AI | FastAPI (Python), OCR, 키워드 기반 계정 분류 |
| DB | PostgreSQL, Redis |
| 구조 | npm workspaces 모노레포, 멀티 테넌트 |

## 프로젝트 구조

```
apps/
  web/    # Next.js 프론트엔드
  api/    # NestJS 백엔드 API
  ai/     # FastAPI AI 서비스 (OCR, 계정 분류)
prisma/
  schema.prisma
  seed.ts
```

## 주요 기능

| 분류 | 기능 | 설명 |
|------|------|------|
| **회계** | 영수증 관리 | OCR 인식, AI 계정 분류, 자동 전표 생성 |
| | 전표 관리 | 수기 입력, 차대변 균형 검증, 상태 관리 |
| | 재무제표 | 시산표, 손익계산서, 재무상태표 |
| | 계정과목 | 더존 ERP 표준 5자리 코드 체계 |
| | 결산 | 회계 기간 마감/재오픈 |
| **매출/매입** | 거래명세서 | 매출/매입 등록, 자동 전표 생성 |
| | 입금/출금 | 거래처별 결제 관리, 채권/채무 추적 |
| | 거래처 원장 | 채권/채무 연령 분석 |
| **자산/원가** | 고정자산 | 정액법/정률법 감가상각, 자동 전표 |
| | 원가 관리 | 품목 마스터, 원가 분석, 표준원가 차이 분석 |
| | 재고 관리 | 입출고, 이동평균법 평가, 안전재고 알림 |
| | 은행/계좌 | 계좌별 입출금/이체, 잔액 추적, 자동 전표 |
| **인사/경비** | 급여 관리 | 4대보험/소득세 자동 계산, 자동 전표 |
| | 경비 정산 | 경비 신청, 결재 요청, 정산 처리 |
| **세무** | 세금계산서 | 매입/매출 세금계산서 관리 |
| | 부가세 신고 | 부가세 신고서 자동 생성 |
| **관리** | 예산 관리 | 계정별 월 예산, 실적 대비 분석 |
| | 프로젝트 손익 | 프로젝트별 수익/비용 추적 |
| | 부서별 손익 | 부서별 비용 배분 및 비교 |
| | 전자결재 | 다단계 승인 워크플로우 |
| | 환율 관리 | 외화 환율, 다통화 전표 |
| | 반복 전표 | 템플릿 등록, 일괄 생성 |
| | 자금 관리 | 현금흐름 분석 |
| | 감사 로그 | 회계 처리 이력 추적 |

## 실행 방법

### 사전 요구사항

- Node.js 18+, Python 3.10+, PostgreSQL

### 설치 및 실행

```bash
# 의존성 설치
npm install
cd apps/ai && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt

# DB 설정
createdb ledgerflow
echo 'DATABASE_URL="postgresql://<user>@localhost:5432/ledgerflow"' > .env
npx prisma migrate dev
npx prisma db seed

# 실행 (각각 별도 터미널)
cd apps/ai && source .venv/bin/activate && uvicorn main:app --port 8001
cd apps/api && npm run start:dev    # :3101
cd apps/web && npm run dev          # :3100
```

## 주요 API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/documents/upload` | 영수증 업로드 (OCR + 자동 전표) |
| GET | `/documents` | 영수증 목록 |
| POST | `/journals` | 전표 생성 |
| GET | `/reports/trial-balance` | 시산표 |
| GET | `/reports/income-statement` | 손익계산서 |
| GET | `/reports/balance-sheet` | 재무상태표 |
| GET | `/accounts` | 계정과목 목록 |
| POST | `/trades` | 거래명세서 등록 |
| POST | `/inventory/transactions` | 입출고 등록 |
| GET | `/bank-accounts` | 은행 계좌 목록 |
| POST | `/bank-accounts/:id/transactions` | 입출금/이체 |
| GET | `/expense-claims` | 경비 정산 목록 |
| POST | `/classify` | AI 계정 분류 (AI 서비스) |
