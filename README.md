# LedgerFlow

AI 기반 영수증 자동 처리 및 전표 자동 생성 웹 ERP 시스템

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router), React Query, Recharts, CSS Modules, Pretendard |
| Backend | NestJS, Prisma ORM, PDFKit |
| AI | FastAPI (Python), Tesseract OCR, 키워드 기반 계정 분류 |
| DB | PostgreSQL |
| 알림 | 이메일 (Nodemailer), 슬랙 웹훅, 카카오 웹훅 |
| 구조 | npm workspaces 모노레포, 멀티 테넌트 |

## 프로젝트 구조

```
apps/
  web/    # Next.js 프론트엔드 (:3002)
  api/    # NestJS 백엔드 API (:3001)
  ai/     # FastAPI AI 서비스 (:8000)
prisma/
  schema.prisma   # DB 스키마
  seed.ts         # 초기 데이터
```

## 전표 → 결산 흐름

```
[결재선 없는 경우]
전표 입력 (DRAFT) → 확정 (POSTED, 1클릭) → 보고서 반영 → 월 마감 → 결산 이월

[결재선 있는 경우]
전표 입력 (DRAFT) → 결재 요청 (PENDING_APPROVAL)
    → 결재 승인 → 자동 POSTED → 보고서 반영 → 월 마감 → 결산 이월

[영수증 OCR]
영수증 업로드 → OCR 인식 → AI 계정 분류 → DRAFT 전표 자동 생성 → 이후 동일
```

- POSTED 전표만 시산표/손익계산서/재무상태표에 반영
- 월 마감 시 DRAFT/PENDING_APPROVAL 전표 있으면 차단
- 결산 이월 시 자산/부채/자본 이월 + 손익 마감 전표 자동 생성

## 주요 기능

### 회계관리

| 기능 | 설명 |
|------|------|
| 영수증 관리 | OCR 인식, AI 계정 분류, 자동 전표 생성, 일괄 업로드 |
| 전표 관리 | 유형별 분리(일반/매입/매출/자금), 자동채번, 키보드 네비게이션 |
| 전표 검색 | 계정과목/상태/적요/금액범위 복합 검색, 서버 페이지네이션 |
| 전표 일괄 처리 | 일괄 승인/확정/수정(적요·날짜), 복사/역분개 |
| 전표 PDF | 단건 PDF 출력 (한글 폰트, 부가세 포함, 서명란) |
| 부가세 처리 | 매입/매출 전표 공급가액 입력 시 부가세(10%) 자동 계산, 증빙 유형 관리 |
| 적요 코드 | 코드 사전 등록, 전표 입력 시 자동완성, 카테고리별 관리 |
| 계정과목 | 더존 표준 5자리 코드 체계 (55개 기본 계정) |
| 장부 | 총계정원장, 계정별원장, 분개장, 현금출납장, 일/월계표 |
| 거래처 (CRM) | 신용등급(A/B/C/D), 거래한도, 담당자/연락처, 메모 히스토리, 거래 타임라인 |
| 반복 전표 | 템플릿 등록, 일괄 생성 |
| 자동 전표 규칙 | 거래처/금액/키워드 조건 매칭, 규칙 우선 → AI fallback |
| 전자결재 | 다단계 승인, 최종 승인 시 자동 확정, 이메일/슬랙/카카오 알림 |
| 결산 | 월 마감/재오픈, 전기분 이월 (자산/부채/자본 이월 + 손익 마감) |

### 매입매출

| 기능 | 설명 |
|------|------|
| 거래명세서 | 매출/매입 등록, 확정 시 자동 전표, PDF 출력 |
| 입금/출금 | 거래처별 결제 관리, 채권/채무 추적 |
| 세금계산서 | 매입/매출 관리, 홈택스 XML import/export, PDF 출력 |
| 경비 정산 | 경비 신청/결재/정산, 자동 전표 |
| BOM 관리 | 조립품-부품 구성표, 자재소요량 계산, 부품별 원가 집계 |
| 재고 관리 | 입출고, 이동평균법 평가, 안전재고 알림 |
| 원가 관리 | 품목 마스터, 원가 분석, 표준원가 차이 분석 |
| 거래처별 현황 | 매출 TOP10 차트, 매출 vs 매입 비교 차트, 집계 보고서 |

### 자금관리

| 기능 | 설명 |
|------|------|
| 재무제표 | 시산표, 손익계산서, 재무상태표 |
| 비교 재무제표 | 전기/당기 비교 (증감률) |
| 자금 관리 | 자금일보, 현금흐름표 |
| 자금 예측 | 6개월 평균 기반 향후 3개월 예측 차트 |
| 예산 관리 | 계정별 월 예산, 실적 대비 분석, 소진율 |
| 은행/계좌 | 계좌별 입출금/이체, 잔액 추적, 자동 전표 |
| 고정자산 | 정액법/정률법 감가상각, 처분, 자동 전표, 감가상각 명세서 |
| 환율 관리 | 외화 환율, 다통화 전표 |

### 세무관리

| 기능 | 설명 |
|------|------|
| 부가세 신고 | 부가세 신고서 자동 생성 |
| 전자신고 | 부가세/원천세/법인세 신고 데이터, CSV/XML 내보내기 |
| 연말정산 | 소득세율 기반 세액 계산, 공제 입력, 일괄 생성 |

### 인사급여

| 기능 | 설명 |
|------|------|
| 급여 관리 | 4대보험/소득세 자동 계산, 급여명세서 PDF, 자동 전표 |
| 부서별 손익 | 부서별 비용 배분 및 비교 |
| 프로젝트 손익 | 프로젝트별 수익/비용 추적, 예산 대비 |

### AI / 자동화

| 기능 | 설명 |
|------|------|
| OCR | 영수증 이미지 → 텍스트 추출 (거래처, 금액, 날짜) |
| AI 계정 분류 | 거래처명 + OCR 텍스트 기반 계정과목 자동 추천 |
| 자동 전표 규칙 | 거래처/금액/키워드 조건별 전표 자동 생성 |
| 이상거래 감지 | 금액 이상(±2σ), 신규 거래처, 주말 전표, 중복 의심 자동 감지 |
| 승인 알림 | 결재 요청/승인/반려 시 이메일 + 슬랙 + 카카오 자동 발송 |

### 환경설정

| 기능 | 설명 |
|------|------|
| 대시보드 | 위젯 커스터마이징 (표시/숨김, 순서 변경) |
| 멤버 관리 | 초대, 역할 변경 (ADMIN/ACCOUNTANT/VIEWER) |
| 권한 관리 | 역할별 메뉴 필터링, 모듈별 읽기/쓰기/삭제 |
| 데이터 백업/복원 | 전체 데이터 JSON export/import, 관리자 전용 |
| 감사 로그 | 회계 처리 이력 추적 |
| 접근성 | WAI-ARIA 표준 (aria-label, role, scope 등) |
| 다국어 | 한국어/영어 |
| 다크모드 | 라이트/다크/시스템 |
| 모바일 반응형 | 햄버거 메뉴, 사이드바 토글, 테이블 스크롤 |

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

### 환경변수 (.env)

```bash
DATABASE_URL="postgresql://user@localhost:5432/ledgerflow"

# 선택사항
AI_SERVICE_URL="http://localhost:8000"          # AI 서비스 주소
SMTP_HOST="smtp.gmail.com"                      # 이메일 SMTP
SMTP_USER="your@gmail.com"
SMTP_PASS="app-password"
SLACK_WEBHOOK_URL="https://hooks.slack.com/..." # 슬랙 알림
KAKAO_WEBHOOK_URL="https://..."                 # 카카오 알림
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
# 전체 테스트 (77개)
npm run test

# 개별 실행
npm run test:web    # 프론트엔드 33개
npm run test:api    # 백엔드 API 44개

# AI 서비스 (별도)
cd apps/ai && source venv/bin/activate && python -m pytest tests/ -v  # 48개
```

## 주요 API

### 인증
| Method | Path | 설명 |
|--------|------|------|
| POST | `/auth/login` | 로그인 |
| POST | `/auth/signup` | 회원가입 |

### 전표
| Method | Path | 설명 |
|--------|------|------|
| POST | `/journals` | 전표 생성 (유형별 자동채번) |
| GET | `/journals` | 전표 목록 (복합 검색 + 페이지네이션) |
| GET | `/journals/:id/export-pdf` | 전표 PDF |
| PATCH | `/journals/batch/update` | 일괄 수정 (적요/날짜) |
| PATCH | `/journals/batch/status` | 일괄 상태 변경 |
| POST | `/journals/:id/copy` | 복사 |
| POST | `/journals/:id/reverse` | 역분개 |

### 적요 코드
| Method | Path | 설명 |
|--------|------|------|
| GET | `/summary-codes` | 목록 |
| GET | `/summary-codes/search` | 검색 (자동완성) |

### 거래처 (CRM)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/vendors/:id/detail` | CRM 상세 (메모/거래/계산서) |
| POST | `/vendors/:id/memos` | 메모 추가 |
| GET | `/vendors/:id/credit-check` | 신용한도 체크 |

### BOM
| Method | Path | 설명 |
|--------|------|------|
| GET | `/bom/assemblies` | 조립품 목록 |
| GET | `/bom/:parentId` | BOM 조회 |
| POST | `/bom/:parentId/items` | 부품 추가 |
| GET | `/bom/:parentId/requirement?qty=N` | 자재소요량 계산 |

### 보고서
| Method | Path | 설명 |
|--------|------|------|
| GET | `/reports/trial-balance` | 시산표 |
| GET | `/reports/income-statement` | 손익계산서 |
| GET | `/reports/balance-sheet` | 재무상태표 |
| GET | `/reports/general-ledger` | 총계정원장 |
| GET | `/reports/account-ledger` | 계정별원장 |
| GET | `/reports/journal-book` | 분개장 |
| GET | `/reports/cash-book` | 현금출납장 |
| GET | `/reports/daily-summary` | 일계표 |
| GET | `/reports/monthly-summary` | 월계표 |
| GET | `/reports/cash-forecast` | 자금 예측 |
| GET | `/reports/vendor-summary` | 거래처별 현황 |
| GET | `/reports/comparative-income` | 비교 손익계산서 |
| GET | `/reports/comparative-balance` | 비교 대차대조표 |
| GET | `/reports/depreciation-schedule` | 감가상각 명세서 |
| GET | `/reports/anomalies` | AI 이상거래 감지 |

### 매입매출 / 세무
| Method | Path | 설명 |
|--------|------|------|
| POST | `/documents/upload` | 영수증 업로드 (OCR + 자동 전표) |
| POST | `/trades` | 거래명세서 등록 |
| GET | `/trades/:id/export-pdf` | 거래명세서 PDF |
| GET | `/tax-invoices/:id/export-pdf` | 세금계산서 PDF |
| POST | `/tax-invoices/import/hometax-xml` | 홈택스 XML 가져오기 |
| GET | `/tax-invoices/:id/export-xml` | 홈택스 XML 내보내기 |
| POST | `/tax-filing/vat/generate` | 부가세 신고 |
| POST | `/tax-filing/withholding/generate` | 원천세 신고 |
| POST | `/tax-filing/corporate/generate` | 법인세 신고 |

### 기타
| Method | Path | 설명 |
|--------|------|------|
| POST | `/year-end-settlement/batch-create` | 연말정산 일괄 생성 |
| POST | `/closings/carry-forward` | 전기분 이월 |
| GET | `/payroll/records/:id/payslip-pdf` | 급여명세서 PDF |
| GET | `/backup/export` | 데이터 백업 |
| POST | `/backup/import` | 데이터 복원 |
| POST | `/ocr` | AI OCR (AI 서비스) |
| POST | `/classify` | AI 계정 분류 (AI 서비스) |

## 더존 ERP 대비 차별점

| 항목 | 더존 Smart A | LedgerFlow |
|------|-------------|------------|
| AI OCR | 없음 | 영수증 자동 인식 + 계정 분류 |
| 이상거래 감지 | 없음 | 금액/거래처/시간/중복 자동 감지 |
| 전표 유형 | 일반전표만 | 일반/매입/매출/자금 분리 + 자동채번 |
| 전표 입력 | 마우스 중심 | 키보드 네비게이션 (Enter/방향키/F2/F3) |
| 전표 검색 | 기간/유형만 | 계정/거래처/금액/적요 복합 검색 |
| 전표 PDF | 별도 출력 프로그램 | 브라우저에서 PDF 다운로드 |
| 부가세 | 수동 입력 | 공급가액 입력 시 자동 계산 |
| 적요 관리 | 직접 입력 | 코드 사전 등록 + 자동완성 |
| 거래처 CRM | 별도 관리 | 신용등급/한도 + 담당자/메모/거래 타임라인 |
| BOM 관리 | 별도 모듈 (고가) | 간이 BOM (부품 구성표, 자재소요량, 원가 집계) |
| 자금 예측 | 없음 | 6개월 평균 기반 3개월 예측 차트 |
| 대시보드 | 고정 레이아웃 | 위젯 표시/순서 커스터마이징 |
| 승인 알림 | 이메일만 | 이메일 + 슬랙 + 카카오 웹훅 |
| 데이터 백업 | 별도 관리 | JSON export/import |
| 접근성 | 미흡 | WAI-ARIA 표준 준수 |
| 다국어 | 한국어만 | 한국어/영어 |
| 다크모드 | 없음 | 라이트/다크/시스템 |
| 모바일 | 별도 앱 | 반응형 웹 |
| 설치 | PC 설치형 | 웹 브라우저 접속 |
| 멀티 테넌트 | 없음 | SaaS 멀티 테넌트 |
| 비용 | 유료 (연 50~200만원) | 오픈소스 무료 |
