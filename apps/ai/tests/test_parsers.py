"""OCR 파싱 함수 단위 테스트"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import parse_amount, parse_date, parse_vendor


# ──────────────────────────────────
# parse_amount 테스트
# ──────────────────────────────────

class TestParseAmount:
    def test_korean_keyword_합계(self):
        text = "소계 3,000\n합계 4,300원"
        assert parse_amount(text) == 4300

    def test_korean_keyword_결제금액(self):
        text = "결제금액: 15,000원"
        assert parse_amount(text) == 15000

    def test_korean_keyword_총금액(self):
        text = "총금액 1,234,567원"
        assert parse_amount(text) == 1234567

    def test_english_total(self):
        text = "Item: Coffee 2,500\nTotal: 4,300"
        assert parse_amount(text) == 4300

    def test_english_total_uppercase(self):
        text = "TOTAL 25000"
        assert parse_amount(text) == 25000

    def test_ocr_typo_tolat(self):
        """OCR 오타: Total → Tolat"""
        text = "tem: Coffee 2600\nTolat 4300"
        assert parse_amount(text) == 4300

    def test_ocr_typo_tota1(self):
        """OCR 오타: Total → Tota1"""
        text = "Tota1: 8,500"
        assert parse_amount(text) == 8500

    def test_amount_with_won(self):
        text = "커피 2,500원\n빵 1,800원\n합계 4,300원"
        assert parse_amount(text) == 4300

    def test_amount_without_keyword_uses_max(self):
        """키워드 없을 때 원 붙은 최대값"""
        text = "커피 2,500원\n빵 1,800원"
        assert parse_amount(text) == 2500

    def test_comma_separated_numbers(self):
        text = "금액 1,000\n부가세 100\n합계 1,100"
        assert parse_amount(text) == 1100

    def test_large_amount(self):
        text = "합계: 12,345,678"
        assert parse_amount(text) == 12345678

    def test_no_amount(self):
        text = "영수증\n감사합니다"
        assert parse_amount(text) is None

    def test_last_line_number(self):
        """키워드 없어도 마지막 줄의 큰 숫자를 합계로 추정"""
        text = "아이템1 2500\n아이템2 1800\n4300"
        assert parse_amount(text) == 4300

    def test_카드결제(self):
        text = "카드결제 45,000원"
        assert parse_amount(text) == 45000

    def test_승인금액(self):
        text = "승인금액: 32,000"
        assert parse_amount(text) == 32000


# ──────────────────────────────────
# parse_date 테스트
# ──────────────────────────────────

class TestParseDate:
    def test_korean_format(self):
        text = "2026년 03월 22일"
        assert parse_date(text) == "2026-03-22"

    def test_dash_format(self):
        text = "날짜: 2026-03-22"
        assert parse_date(text) == "2026-03-22"

    def test_dot_format(self):
        text = "2026.03.22 15:30"
        assert parse_date(text) == "2026-03-22"

    def test_slash_format(self):
        text = "Date: 2026/3/5"
        assert parse_date(text) == "2026-03-05"

    def test_short_year(self):
        text = "26.03.22"
        assert parse_date(text) == "2026-03-22"

    def test_no_date(self):
        text = "영수증\n합계 4300"
        assert parse_date(text) is None

    def test_date_in_middle(self):
        text = "상호: CU편의점\n2026.01.15\n합계 3,500원"
        assert parse_date(text) == "2026-01-15"


# ──────────────────────────────────
# parse_vendor 테스트
# ──────────────────────────────────

class TestParseVendor:
    def test_korean_상호_keyword(self):
        text = "상호: 스타벅스 강남점\n사업자번호: 123-45-67890"
        assert parse_vendor(text) == "스타벅스 강남점"

    def test_korean_상호_with_spaces(self):
        text = "상 호 : CU 편의점\n대표: 홍길동"
        assert parse_vendor(text) == "CU 편의점"

    def test_english_store_keyword(self):
        text = "RECEIPT\nStore: CU Convenience\nDate: 2026-03-22"
        assert parse_vendor(text) == "CU Convenience"

    def test_english_shop_keyword(self):
        text = "Shop: Starbucks Gangnam\nTotal: 5,500"
        assert parse_vendor(text) == "Starbucks Gangnam"

    def test_above_biz_number(self):
        """사업자번호 윗줄이 상호명"""
        text = "메가커피 역삼점\n123-45-67890\n대표: 김커피"
        assert parse_vendor(text) == "메가커피 역삼점"

    def test_above_사업자_keyword(self):
        text = "이디야커피\n사업자등록번호 234-56-78901"
        assert parse_vendor(text) == "이디야커피"

    def test_above_tel_keyword(self):
        """전화번호 윗줄이 상호명"""
        text = "맘스터치 신촌점\nTel: 02-1234-5678\n합계 8,500원"
        assert parse_vendor(text) == "맘스터치 신촌점"

    def test_first_line_short_name(self):
        """짧은 첫 줄 = 상호명 추정"""
        text = "CU편의점\n2026.03.22 15:30\n커피 2,500원"
        assert parse_vendor(text) == "CU편의점"

    def test_skip_receipt_header(self):
        """영수증 같은 일반 단어 건너뜀"""
        text = "영수증\n스타벅스\n2026.03.22"
        assert parse_vendor(text) == "스타벅스"

    def test_no_vendor(self):
        text = "2026.03.22\n합계 4300원"
        # 날짜 형식이니까 상호명으로 안 잡혀야 함
        result = parse_vendor(text)
        # 날짜만 있는 줄은 숫자로 시작하므로 skip됨
        assert result is None or result != "2026.03.22"

    def test_전화_keyword(self):
        text = "할리스커피\n전화: 02-555-1234"
        assert parse_vendor(text) == "할리스커피"


# ──────────────────────────────────
# 통합 시나리오 테스트
# ──────────────────────────────────

class TestIntegration:
    def test_korean_receipt(self):
        """한국어 영수증"""
        text = """스타벅스 강남점
사업자번호: 123-45-67890
2026.03.22 14:30
아메리카노(T) 4,500원
카페라떼(T)   5,000원
합계: 9,500원
카드결제"""
        assert parse_vendor(text) == "스타벅스 강남점"
        assert parse_amount(text) == 9500
        assert parse_date(text) == "2026-03-22"

    def test_english_receipt(self):
        """영문 영수증"""
        text = """RECEIPT
Store: CU Convenience
Date: 2026-03-22
Item: Coffee 2,500
Item: Bread 1,800
Total: 4,300"""
        assert parse_vendor(text) == "CU Convenience"
        assert parse_amount(text) == 4300
        assert parse_date(text) == "2026-03-22"

    def test_ocr_noisy_receipt(self):
        """OCR 오타가 있는 영수증"""
        text = """RECEIPT
Store: CU Convenience
Date: 2026-03-22
tem: Coffee 2600
tem: Bread 1800
Tolat 4300"""
        assert parse_vendor(text) == "CU Convenience"
        assert parse_amount(text) == 4300
        assert parse_date(text) == "2026-03-22"

    def test_minimal_receipt(self):
        """최소 정보 영수증"""
        text = """CU편의점
2026/3/15
커피 2500"""
        assert parse_vendor(text) == "CU편의점"
        assert parse_date(text) == "2026-03-15"
        assert parse_amount(text) == 2500

    def test_상호_format(self):
        """상호: 형식"""
        text = """상호: (주)교보문고
대표: 홍길동
사업자번호: 201-81-12345
Tel: 1544-1900
2026년 01월 10일
도서 15,000원
합계 15,000원"""
        assert parse_vendor(text) == "(주)교보문고"
        assert parse_amount(text) == 15000
        assert parse_date(text) == "2026-01-10"
