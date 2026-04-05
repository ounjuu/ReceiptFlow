# LedgerFlow

AI 기반 영수증 자동 처리 및 전표 자동 생성 웹 ERP 시스템

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React Query, CSS Modules |
| Backend | NestJS, Prisma ORM |
| AI | FastAPI (Python), Tesseract OCR, 키워드 기반 계정 분류 |
| DB | PostgreSQL, Redis |
| 구조 | npm workspaces 모노레포, 멀티 테넌트 |

## 프로젝트 구조

```
apps/
  web/    # Next.js 프론트엔드 (:3002)
  api/    # NestJS 백엔드 API (:3001)
  ai/     # FastAPI AI 서비스 (:8000)
prisma/
  schema.prisma   # DB 스키마
  seed.ts         # 초기 데이터 (유저, 계정과목, 거래처, 부서, 직원, 급여)
```

## 주요 기능

### 회계관리

| 기능 | 설명 |
|------|------|
| 영수증 관리 | OCR 인식, AI 계정 분류, 자동 전표 생성, 일괄 업로드 |
| 전표 관리 | 수기 입력, 차대변 균형 검증, 상태 관리, 복사/역분개 |
| 계정과목 | 더존 표준 5자리 코드 체계 (55개 기본 계정) |
| 총계정원장 | 계정별 거래 내역 + 전기이월 + 누적잔액 |
| 계정별원장 | 상대계정 표시, 거래처 연동, 전기이월 |
| 분개장 | 전표 일자순 분개 내역 조회 |
| 일/월계표 | 일별/월별 계정 합계 + 누적 집계 |
| 거래처 | 사업자번호 기반 자동완성, 거래처 원장, 채권/채무 연령 분석 |
| 반복 전표 | 템플릿 등록, 일괄 생성 |
| 자동 전표 규칙 | 거래처/금액/키워드 조건 매칭, 규칙 우선 → AI fallback |
| 전자결재 | 다단계 승인 워크플로우, 이메일 알림 |
| 결산 | 월 마감/재오픈, 전기분 이월 (자산/부채/자본 이월 + 손익 마감) |

### 매입매출

| 기능 | 설명 |
|------|------|
| 거래명세서 | 매출/매입 등록, 확정 시 자동 전표, PDF 출력 |
| 입금/출금 | 거래처별 결제 관리, 채권/채무 추적 |
| 세금계산서 | 매입/매출 관리, 홈택스 XML import/export, PDF 출력 |
| 경비 정산 | 경비 신청/결재/정산, 자동 전표 |
| 재고 관리 | 입출고, 이동평균법 평가, 안전재고 알림 |
| 원가 관리 | 품목 마스터, 원가 분석, 표준원가 차이 분석 |
| 거래처별 현황 | 거래처별 매출/매입/순액 집계 보고서 |

### 자금관리

| 기능 | 설명 |
|------|------|
| 재무제표 | 시산표, 손익계산서, 재무상태표 |
| 비교 재무제표 | 전기/당기 손익계산서, 대차대조표 비교 (증감률) |
| 자금 관리 | 자금일보, 현금흐름표 |
| 현금출납장 | 현금 계정 입출금 내역 장부 |
| 예산 관리 | 계정별 월 예산, 실적 대비 분석, 소진율 |
| 은행/계좌 | 계좌별 입출금/이체, 잔액 추적, 자동 전표 |
| 고정자산 | 정액법/정률법 감가상각, 처분, 자동 전표 |
| 감가상각 명세서 | 전기말/당기 상각 현황, 장부가액, 상각률 보고서 |
| 환율 관리 | 외화 환율, 다통화 전표 |

### 세무관리

| 기능 | 설명 |
|------|------|
| 부가세 신고 | 부가세 신고서 자동 생성 |
| 전자신고 | 부가세/원천세/법인세 신고 데이터 생성, CSV/XML 내보내기 |
| 연말정산 | 2025 소득세율 기반 세액 계산, 공제 입력, 일괄 생성 |

### 인사급여

| 기능 | 설명 |
|------|------|
| 급여 관리 | 4대보험/소득세 자동 계산, 급여명세서 PDF, 자동 전표 |
| 부서별 손익 | 부서별 비용 배분 및 비교 |
| 프로젝트 손익 | 프로젝트별 수익/비용 추적, 예산 대비 |

### 환경설정

| 기능 | 설명 |
|------|------|
| 멤버 관리 | 초대, 역할 변경 (ADMIN/ACCOUNTANT/VIEWER) |
| 권한 관리 | 역할별 메뉴 필터링, 모듈별 읽기/쓰기/삭제 권한 매트릭스 |
| 감사 로그 | 회계 처리 이력 추적 |
| 다국어 | 한국어/영어 전환 |
| 다크모드 | 라이트/다크/시스템 테마 |
| 모바일 반응형 | 햄버거 메뉴, 사이드바 토글, 테이블 스크롤 |

### AI / 자동화

| 기능 | 설명 |
|------|------|
| OCR | 영수증 이미지 → 텍스트 추출 (거래처, 금액, 날짜) |
| AI 계정 분류 | 거래처명 + OCR 텍스트 기반 계정과목 자동 추천 |
| 자동 전표 규칙 | 거래처/금액/키워드 조건별 전표 자동 생성 |
| 이상거래 감지 | 금액 이상(±2σ), 신규 거래처, 주말 전표, 중복 의심 자동 감지 |
| 전표 승인 알림 | 결재 요청/승인/반려 시 이메일 자동 발송 |

## 실행 방법

### 사전 요구사항

- Node.js 18+, Python 3.9+, PostgreSQL, Tesseract OCR

### 설치 및 실행

```bash
# 의존성 설치
npm install
cd apps/ai && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# DB 설정
createdb ledgerflow
echo 'DATABASE_URL="postgresql://<user>@localhost:5432/ledgerflow"' > .env
npx prisma migrate dev
npx prisma db seed

# 실행 (각각 별도 터미널)
cd apps/ai && source venv/bin/activate && uvicorn main:app --reload --port 8000
cd apps/api && npm run start:dev        # :3001
cd apps/web && PORT=3002 npm run dev    # :3002
```

### 테스트 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@ledgerflow.dev | admin1234 |
| 회계담당자 | accountant@ledgerflow.dev | accountant1234 |
| 열람자 | viewer@ledgerflow.dev | viewer1234 |

### Seed 데이터

`npx prisma db seed` 실행 시 자동 생성:
- 유저 3명 (관리자, 회계담당, 열람자)
- 계정과목 55건 (더존 표준)
- 거래처 10건, 부서 5건, 프로젝트 3건
- 품목 5건, 직원 7명, 은행계좌 2건
- 급여 기록 21건 (7명 x 3개월, 4대보험/소득세 자동 계산)

## 테스트

```bash
# AI 서비스 테스트 (48개)
cd apps/ai && source venv/bin/activate && python -m pytest tests/ -v

# 백엔드 API 테스트 (32개)
cd apps/api && npx jest --config jest.config.ts --runInBand

# 프론트엔드 테스트 (27개)
cd apps/web && npx jest
```

## 주요 API

| Method | Path | 설명 |
|--------|------|------|
| POST | `/auth/login` | 로그인 |
| POST | `/auth/signup` | 회원가입 |
| POST | `/documents/upload` | 영수증 업로드 (OCR + 자동 전표) |
| POST | `/journals` | 전표 생성 |
| POST | `/journals/:id/copy` | 전표 복사 |
| POST | `/journals/:id/reverse` | 역분개 |
| GET | `/reports/trial-balance` | 시산표 |
| GET | `/reports/income-statement` | 손익계산서 |
| GET | `/reports/balance-sheet` | 재무상태표 |
| GET | `/reports/general-ledger` | 총계정원장 |
| GET | `/reports/account-ledger` | 계정별원장 |
| GET | `/reports/journal-book` | 분개장 |
| GET | `/reports/daily-summary` | 일계표 |
| GET | `/reports/monthly-summary` | 월계표 |
| GET | `/reports/cash-book` | 현금출납장 |
| GET | `/reports/vendor-summary` | 거래처별 현황 |
| GET | `/reports/comparative-income` | 비교 손익계산서 |
| GET | `/reports/comparative-balance` | 비교 대차대조표 |
| POST | `/trades` | 거래명세서 등록 |
| GET | `/trades/:id/export-pdf` | 거래명세서 PDF |
| GET | `/tax-invoices/:id/export-pdf` | 세금계산서 PDF |
| POST | `/tax-invoices/import/hometax-xml` | 홈택스 XML 가져오기 |
| GET | `/tax-invoices/:id/export-xml` | 홈택스 XML 내보내기 |
| POST | `/tax-filing/vat/generate` | 부가세 신고 데이터 생성 |
| POST | `/tax-filing/withholding/generate` | 원천세 신고 데이터 생성 |
| POST | `/tax-filing/corporate/generate` | 법인세 신고 데이터 생성 |
| POST | `/year-end-settlement/batch-create` | 연말정산 일괄 생성 |
| POST | `/closings/carry-forward` | 전기분 이월 |
| GET | `/payroll/records/:id/payslip-pdf` | 급여명세서 PDF |
| GET | `/reports/depreciation-schedule` | 감가상각 명세서 |
| GET | `/reports/anomalies` | AI 이상거래 감지 |
| POST | `/ocr` | AI OCR (AI 서비스) |
| POST | `/classify` | AI 계정 분류 (AI 서비스) |

## 더존 ERP 대비 차별점

| 항목 | 더존 Smart A | LedgerFlow |
|------|-------------|------------|
| AI OCR | 없음 | 영수증 자동 인식 + 계정 분류 |
| 이상거래 감지 | 없음 | 금액/거래처/시간/중복 자동 감지 |
| 다국어 | 한국어만 | 한국어/영어 |
| 다크모드 | 없음 | 라이트/다크/시스템 |
| 모바일 | 별도 앱 | 반응형 웹 (모바일 브라우저) |
| 설치 | 패키지 설치 | 웹 브라우저 접속 |
| 멀티 테넌트 | 없음 | SaaS 멀티 테넌트 |
| 비용 | 유료 | 오픈소스 무료 |
