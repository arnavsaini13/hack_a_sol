@echo off
echo ============================================================
echo   AGRICULTURAL POLICY, LOAN ^& SUBSIDY TRANSPARENCY PLATFORM
echo   Chhattisgarh Paddy Farmer, Bank ^& Policy Platform (2026)
echo ============================================================
echo.

REM Verify Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.11+ is required but not found in PATH.
    pause
    exit /b 1
)

REM Verify pnpm
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pnpm is required but not found in PATH.
    pause
    exit /b 1
)

echo [1/3] Resetting ^& Seeding Database with 5 Golden Personas...
python -c "import sys; sys.path.insert(0, 'backend'); from app.database import SessionLocal; from app.seed.seed_data import seed_database; db = SessionLocal(); seed_database(db); db.close()"
if errorlevel 1 (
    echo [WARN] Could not seed database, continuing...
) else (
    echo [OK] Database seeded successfully.
)

echo.
echo [2/3] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "Agri-Transparency Backend (FastAPI)" cmd /k "cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo.
echo [3/3] Launching Vite Frontend on http://localhost:5173 ...
start "Agri-Transparency Frontend (React PWA)" cmd /k "cd frontend && pnpm run dev --port 5173"

echo.
echo ============================================================
echo   DEMO PLATFORM RUNNING
echo   - Web Application: http://localhost:5173
echo   - Backend Docs:    http://127.0.0.1:8000/docs
echo   - Demo Farmer OTP: 123456
echo ============================================================
echo.
pause
