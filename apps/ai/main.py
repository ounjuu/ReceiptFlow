from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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


class ClassifyRequest(BaseModel):
    vendor_name: str


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
    """거래처명 기반 계정과목 분류 추천"""
    vendor = req.vendor_name.lower().replace(" ", "")

    for rule in CLASSIFICATION_RULES:
        for keyword in rule["keywords"]:
            if keyword.lower() in vendor:
                return ClassifyResponse(
                    account_code=rule["account_code"],
                    account_name=rule["account_name"],
                    confidence=0.85,
                )

    return ClassifyResponse(
        account_code=DEFAULT_ACCOUNT["account_code"],
        account_name=DEFAULT_ACCOUNT["account_name"],
        confidence=0.3,
    )
