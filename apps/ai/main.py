from fastapi import FastAPI

app = FastAPI(title="LedgerFlow AI Service")


@app.get("/health")
def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "ok"}
