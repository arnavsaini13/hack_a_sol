# Startup script for Agri-Transparency Platform Demo
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  AGRICULTURAL POLICY, LOAN & SUBSIDY TRANSPARENCY PLATFORM" -ForegroundColor Green
Write-Host "  Chhattisgarh Paddy Farmer, Bank & Policy Platform (2026)" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

# 1. Seed Database
Write-Host "`n[1/3] Seeding Database with 5 Golden Personas..." -ForegroundColor Cyan
python -c "import sys; sys.path.insert(0, 'backend'); from app.database import SessionLocal; from app.seed.seed_data import seed_database; db = SessionLocal(); seed_database(db); db.close()"

# 2. Launch Backend
Write-Host "`n[2/3] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# 3. Launch Frontend
Write-Host "`n[3/3] Starting Vite React PWA on http://localhost:5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; pnpm run dev --port 5173"

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  DEMO PLATFORM RUNNING" -ForegroundColor Green
Write-Host "  - Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  - Swagger:  http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "  - Demo OTP: 123456" -ForegroundColor Yellow
Write-Host "============================================================`n" -ForegroundColor Green
