from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from app.api.routes import router as api_router

app = FastAPI(title="Currency Forecast System")

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

# Подключение статики и шаблонов
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# Подключение API роутов
app.include_router(api_router)

# Главная страница
@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "title": "FX Прогноз — Валютный аналитик"
    })

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "Server is running"}