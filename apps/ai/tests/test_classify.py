"""계정과목 분류 API 테스트"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestHealthCheck:
    def test_health(self):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}


class TestClassify:
    def test_starbucks(self):
        res = client.post("/classify", json={"vendor_name": "스타벅스 강남점"})
        assert res.status_code == 200
        data = res.json()
        assert data["account_code"] == "50300"
        assert data["account_name"] == "복리후생비"
        assert data["confidence"] >= 0.8

    def test_restaurant(self):
        res = client.post("/classify", json={"vendor_name": "김밥천국"})
        data = res.json()
        assert data["account_code"] == "50400"
        assert data["account_name"] == "식대"

    def test_convenience_store(self):
        res = client.post("/classify", json={"vendor_name": "CU 편의점"})
        data = res.json()
        assert data["account_code"] == "50300"

    def test_rent(self):
        res = client.post("/classify", json={"vendor_name": "서울 부동산"})
        data = res.json()
        assert data["account_code"] == "50800"
        assert data["account_name"] == "임차료"

    def test_unknown_vendor_default(self):
        """알 수 없는 거래처 → 지급수수료"""
        res = client.post("/classify", json={"vendor_name": "ABC주식회사"})
        data = res.json()
        assert data["account_code"] == "51200"
        assert data["confidence"] <= 0.5

    def test_raw_text_fallback(self):
        """거래처명 매칭 실패 시 OCR 전체 텍스트로 2차 분류"""
        res = client.post("/classify", json={
            "vendor_name": "알수없는가게",
            "raw_text": "아메리카노 4,500원\n카페라떼 5,000원\n합계 9,500원"
        })
        data = res.json()
        assert data["account_code"] == "50300"  # 카페 키워드 → 복리후생비
        assert data["confidence"] >= 0.5

    def test_delivery_food(self):
        res = client.post("/classify", json={"vendor_name": "배달의민족"})
        data = res.json()
        assert data["account_name"] == "식대"

    def test_taxi(self):
        res = client.post("/classify", json={"vendor_name": "카카오택시"})
        data = res.json()
        assert data["account_code"] == "50300"

    def test_missing_vendor_name(self):
        """vendor_name 필수 필드 누락"""
        res = client.post("/classify", json={"text": "test"})
        assert res.status_code == 422
