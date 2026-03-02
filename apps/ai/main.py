import os
import re
import tempfile
from typing import Optional

import pytesseract
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from pydantic import BaseModel

app = FastAPI(title="LedgerFlow AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 키워드 → 계정과목 매핑 규칙
CLASSIFICATION_RULES = [
    {
        "keywords": ["식당", "배달", "치킨", "피자", "김밥", "떡볶이", "국밥", "냉면", "삼겹살", "초밥", "한식", "중식", "일식", "양식", "분식", "도시락", "맥도날드", "버거킹", "롯데리아", "배민", "요기요", "쿠팡이츠"],
        "account_code": "50400",
        "account_name": "식대",
    },
    {
        "keywords": ["스타벅스", "카페", "커피", "투썸", "이디야", "할리스", "메가커피", "컴포즈", "빽다방", "폴바셋"],
        "account_code": "50300",
        "account_name": "복리후생비",
    },
    {
        "keywords": ["택시", "카카오택시", "버스", "지하철", "주유", "주차", "톨게이트", "고속도로", "기차", "KTX", "SRT", "항공"],
        "account_code": "50300",
        "account_name": "복리후생비",
    },
    {
        "keywords": ["쿠팡", "마트", "이마트", "홈플러스", "편의점", "GS25", "CU", "세븐일레븐", "미니스톱", "다이소"],
        "account_code": "50300",
        "account_name": "복리후생비",
    },
    {
        "keywords": ["월세", "임대", "관리비", "부동산"],
        "account_code": "50800",
        "account_name": "임차료",
    },
    {
        "keywords": ["급여", "월급", "인건비", "상여"],
        "account_code": "50100",
        "account_name": "급여",
    },
]

DEFAULT_ACCOUNT = {
    "account_code": "51200",
    "account_name": "지급수수료",
}


# OCR 전체 텍스트에서 업종을 추정하는 키워드
RECEIPT_CONTEXT_RULES = [
    {
        "keywords": ["단가", "수량", "금액", "메뉴", "주문", "테이블", "식사", "반찬", "음료", "사이드", "세트", "인분"],
        "account_code": "50400",
        "account_name": "식대",
    },
    {
        "keywords": ["아메리카노", "라떼", "카푸치노", "에스프레소", "프라푸치노", "텀블러", "음료", "HOT", "ICE", "잔"],
        "account_code": "50300",
        "account_name": "복리후생비",
    },
    {
        "keywords": ["주유", "리터", "휘발유", "경유", "LPG", "주차", "톨게이트"],
        "account_code": "50300",
        "account_name": "복리후생비",
    },
]


class ClassifyRequest(BaseModel):
    vendor_name: str
    raw_text: Optional[str] = None


class ClassifyResponse(BaseModel):
    account_code: str
    account_name: str
    confidence: float


@app.get("/health")
def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "ok"}


@app.post("/classify", response_model=ClassifyResponse)
def classify_vendor(req: ClassifyRequest):
    """거래처명 + OCR 전체 텍스트 기반 계정과목 분류 추천"""
    vendor = req.vendor_name.lower().replace(" ", "")

    # 1차: 거래처명으로 매칭
    for rule in CLASSIFICATION_RULES:
        for keyword in rule["keywords"]:
            if keyword.lower() in vendor:
                return ClassifyResponse(
                    account_code=rule["account_code"],
                    account_name=rule["account_name"],
                    confidence=0.85,
                )

    # 2차: OCR 전체 텍스트로 업종 추정
    if req.raw_text:
        full_text = req.raw_text.lower().replace(" ", "")
        # 기존 규칙으로 전체 텍스트 검색
        for rule in CLASSIFICATION_RULES:
            for keyword in rule["keywords"]:
                if keyword.lower() in full_text:
                    return ClassifyResponse(
                        account_code=rule["account_code"],
                        account_name=rule["account_name"],
                        confidence=0.7,
                    )
        # 영수증 컨텍스트 규칙으로 검색
        for rule in RECEIPT_CONTEXT_RULES:
            for keyword in rule["keywords"]:
                if keyword.lower() in full_text:
                    return ClassifyResponse(
                        account_code=rule["account_code"],
                        account_name=rule["account_name"],
                        confidence=0.6,
                    )

    return ClassifyResponse(
        account_code=DEFAULT_ACCOUNT["account_code"],
        account_name=DEFAULT_ACCOUNT["account_name"],
        confidence=0.3,
    )


# ──────────────────────────────────
# OCR
# ──────────────────────────────────


class OcrResponse(BaseModel):
    raw_text: str
    vendor_name: Optional[str]
    total_amount: Optional[float]
    transaction_date: Optional[str]
    confidence: float


def parse_amount(text: str) -> Optional[float]:
    """영수증 텍스트에서 합계/총액 금액을 추출"""
    # 합계, 총액, 결제금액 등 키워드 근처 금액 우선
    for keyword in ["합계", "총액", "결제금액", "총금액", "청구금액", "합 계", "Total"]:
        pattern = rf"{keyword}\s*[:：]?\s*([\d,]+)\s*원?"
        m = re.search(pattern, text)
        if m:
            return float(m.group(1).replace(",", ""))

    # 키워드 없으면 가장 큰 금액 추출
    amounts = re.findall(r"([\d,]{3,})\s*원", text)
    if not amounts:
        amounts = re.findall(r"([\d]{1,3}(?:,\d{3})+)", text)
    if amounts:
        nums = [float(a.replace(",", "")) for a in amounts]
        return max(nums)

    return None


def parse_date(text: str) -> Optional[str]:
    """영수증 텍스트에서 날짜를 추출"""
    patterns = [
        r"(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})",
        r"(\d{2})[.\-/](\d{2})[.\-/](\d{2})",
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            groups = m.groups()
            year = groups[0]
            if len(year) == 2:
                year = "20" + year
            month = groups[1].zfill(2)
            day = groups[2].zfill(2)
            return f"{year}-{month}-{day}"
    return None


def parse_vendor(text: str) -> Optional[str]:
    """영수증 텍스트에서 거래처명(상호)을 추출"""
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # 1순위: "상호" 키워드가 있는 줄에서 추출
    for line in lines:
        m = re.search(r"상\s*호\s*[:：]?\s*(.+)", line)
        if m:
            name = m.group(1).strip().split("  ")[0].strip()
            if name:
                return name

    # 2순위: "사업자" 키워드 또는 사업자등록번호 패턴이 있는 줄의 바로 윗줄
    biz_num = re.compile(r"\d{3}[-\s]?\d{2}[-\s]?\d{5}")
    biz_keyword = re.compile(r"사\s*업\s*자")
    for i, line in enumerate(lines):
        if biz_num.search(line) or biz_keyword.search(line):
            if i > 0:
                prev = lines[i - 1].strip()
                # 윗줄이 사업자/번호 관련이 아니면 거래처명으로 간주
                if prev and not biz_num.search(prev) and not biz_keyword.search(prev):
                    return prev
            break

    return None


@app.post("/ocr", response_model=OcrResponse)
async def ocr_receipt(file: UploadFile = File(...)):
    """영수증 이미지 OCR → 텍스트 추출 + 파싱"""
    contents = await file.read()

    # 이미지 전처리: EXIF 회전 보정 + RGB 변환
    suffix = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # PIL로 열어서 EXIF 회전 보정
        image = Image.open(tmp_path)
        image = ImageOps.exif_transpose(image)
        gray = image.convert("L")

        # 여러 전처리 조합으로 OCR 시도 → 한글이 가장 많이 인식된 결과 선택
        candidates = []

        presets = [
            ("원본 대비강화", ImageEnhance.Contrast(gray).enhance(1.5)),
            ("이진화 120", gray.point(lambda x: 0 if x < 120 else 255)),
            ("이진화 160", gray.point(lambda x: 0 if x < 160 else 255)),
            ("샤프닝+대비", ImageEnhance.Contrast(gray.filter(ImageFilter.SHARPEN)).enhance(2.0)),
        ]

        for label, processed in presets:
            processed.save(tmp_path)
            text = pytesseract.image_to_string(tmp_path, lang="kor+eng", config="--psm 6")
            korean_count = len(re.findall(r"[가-힣]", text))
            candidates.append((korean_count, text, label))

        # 한글 인식이 가장 많은 결과 선택
        candidates.sort(key=lambda x: x[0], reverse=True)
        raw_text = candidates[0][1]

        # 텍스트가 너무 적으면 180도 회전해서 재시도
        cleaned = re.sub(r"\s+", "", raw_text)
        if len(cleaned) < 10:
            rotated = gray.rotate(180)
            rotated.save(tmp_path)
            raw_text = pytesseract.image_to_string(tmp_path, lang="kor+eng", config="--psm 6")
    finally:
        os.unlink(tmp_path)

    vendor_name = parse_vendor(raw_text)
    total_amount = parse_amount(raw_text)
    transaction_date = parse_date(raw_text)

    # 추출 성공 여부에 따른 신뢰도
    found = sum([vendor_name is not None, total_amount is not None, transaction_date is not None])
    confidence = found / 3

    return OcrResponse(
        raw_text=raw_text,
        vendor_name=vendor_name,
        total_amount=total_amount,
        transaction_date=transaction_date,
        confidence=round(confidence, 2),
    )
