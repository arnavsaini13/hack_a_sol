# Agricultural Policy, Loan & Subsidy Transparency Platform (2026)
### Chhattisgarh Paddy Farmer, Bank Officer & Policy Maker Transparency Portal

A demo-ready, production-grade prototype built for a government hackathon problem statement to empower Chhattisgarh paddy farmers, rural bank branch officers, and state policymakers.

---

## 🌾 Product Overview in One Paragraph

A farmer logs in with mobile + OTP, and the app fetches their land, crop loans, procurement, and insurance records from a synthetic registry through a decoupled `DataAdapter` interface. It computes entitlements from written government rules (**ZERO AI MATH**, pure Python engine), compares them with what the farmer actually received, explains in simple Hindi or English why any gap or rejection exists, suggests the next best step, generates a statutory grievance representation letter in Hindi/English, and tracks the case. Bank officers verify land records, owner and father's name with fuzzy transliteration matching and check duplicate loans, with every verdict written to a SHA-256 hash-chained audit log. Policymakers monitor an anonymised bottleneck dashboard with small-cell privacy suppression ($k$-anonymity) computed directly from the live event ledger.

---

## 🔒 Hard Rules Compliance Matrix

| Rule # | Requirement | Implementation Status | Evidence / File Reference |
| :--- | :--- | :---: | :--- |
| **Rule 1** | **ZERO AI MATH**: Pure Python, no LLMs at runtime, no web/db imports in rules engine | ✅ **Enforced** | `backend/app/rules/engine.py` imports only standard library `decimal`, `datetime`, `dataclasses`. AST purity tested in `tests/test_golden.py::test_zero_ai_math_ast_purity`. |
| **Rule 2** | **Integer Paise & Decimal Land**: Land stored in ha (4 dp), converted to acres via single helper ($1\text{ ha} = 2.47105\text{ acres}$), cap = acres × 21 qtl (round half-up 2 dp). Display rounding half-up only in `display_rupees`. | ✅ **Enforced** | `backend/app/rules/helpers.py`. Tested in `tests/test_golden.py::test_land_conversion_factor` and `test_paddy_cap_formula`. |
| **Rule 3** | **Locked Bilingual Templates & Number Words**: Number slots only, no free-generated text. Spoken Hindi text writes numbers in words using the Indian numbering system (*lakh/crore*). | ✅ **Enforced** | `backend/app/rules/number_words.py` & `backend/app/services/template_service.py`. Tested in `tests/test_golden.py::test_hindi_number_to_words`. |
| **Rule 4** | **Proven vs Possible**: Explanations strictly separate rule + data proof from suggestions. | ✅ **Enforced** | 4-part cards in `DiscrepancyCard.tsx` and `RejectionExplainerModal.tsx`. |
| **Rule 5** | **Provenance Chips & Persistent Trust Bar**: Chips on every figure (`Synthetic Demo Data`, `Verified government rule`, `Pending verification`). Trust bar shows verification date. | ✅ **Enforced** | `frontend/src/components/TrustBar.tsx` displays mode and rules verification timestamp (`2026-03-01`). |
| **Rule 6** | **All Rules Initialized with `verified=false`**: Every statutory parameter in `rules_2026.json` carries source URL, effective date, and verification status. | ✅ **Enforced** | `backend/app/rules/rules_2026.json` has 15 rules initialized with `verified: false`. |
| **Rule 7** | **Strict Authorization**: `farmer_id` is extracted strictly from the HTTP-only session cookie, never accepted from URLs, query parameters, or request bodies. | ✅ **Enforced** | `backend/app/routers/farmer_router.py` guarded by `get_current_farmer`. Tested in `tests/test_api.py::test_farmer_api_session_isolation`. |
| **Rule 8** | **Decoupled Data Adapters**: No real integration claims. Data flows through a typed `DataAdapter` interface with `SyntheticAdapter` and named stubs. | ✅ **Enforced** | `backend/app/adapters/` contains `SyntheticAdapter`, `AgriStackStub`, `BhuiyanStub`, and `CERSAIStub`. |
| **Privacy** | **Small-Cell Privacy Suppression**: Cell counts $< 5$ masked as `Under 5 (Suppressed for Privacy)` to protect individual identities. | ✅ **Enforced** | `backend/app/rules/engine.py` & `PolicyView.tsx`. Verified in `tests/test_e2e_demo.py`. |
| **Audit** | **Cryptographic Audit Chain**: SHA-256 hash chaining of every state mutation with immutable verification. | ✅ **Enforced** | `backend/app/services/audit_service.py` and `backend/app/routers/policy_router.py`. Verified unbroken across all events. |

---

## 👥 The 5 Golden Personas & Demonstration Scenarios

| Persona ID | Name & Location | Scenario & Ground Truth | Expected Platform Result |
| :--- | :--- | :--- | :--- |
| **F-001** | **Ramesh Patel**<br>Vill. Silli, Arang, Raipur | Sold 63 quintals paddy at Mandi. Received MSP ($₹1,53,783$). KUY input assistance ($₹41,517$) scheduled for March 1, 2026 was not credited. | Discrepancy detector flags **Payment Overdue (18 days)**. Gap of **$₹41,517$** detected. Audio explains in Hindi (*"इकतालीस हज़ार पाँच सौ सत्रह रुपये"*). Grievance representation letter `CG-राय-2026-0002` drafted for District Procurement Officer. |
| **F-002** | **Smt. Sunita Bai**<br>Vill. Patan, Durg | Took $₹2,00,000$ crop loan from commercial bank, repaid in 11 months (timely). Bank charged $7\%$ ($₹14,000$) instead of applying $3\%$ prompt repayment subvention ($4\% = ₹8,000$). | Discrepancy detector flags **Interest Overcharged** with a net deficit of **$₹6,000$**. Next-best-action advises presenting repayment slip at branch. |
| **F-003** | **Maniram Sahu**<br>Vill. Masturi, Bilaspur | PMFBY insured 0.8 ha paddy. CCE yield was $1,800\text{ kg/ha}$ vs threshold yield $2,500\text{ kg/ha}$ ($28\%$ crop loss). Claim calculation = $₹14,000$. Exceeded statutory 60-day settlement window. | Flags **PMFBY Claim Underpaid / Overdue** with **$₹14,000$** pending. Escalation ladder recommends District Grievance Redressal Committee. |
| **F-004** | **Vikram Singh**<br>Vill. Dongargaon, Rajnandgaon | Land and entitlements clean. In Bank Console, application APP-502 submitted as *"Vikram Kumar Singh"* vs title *"Vikram Singh"*. | Bank console computes RapidFuzz token sort ratio of **$81.25\%$**, placing applicant in the **🟡 AMBER Band**. Confirms father's name match and allows conditional approval. |
| **F-005** | **Dilip Kumar / Devendra Verma**<br>Vill. Pithora, Mahasamund | Has existing active subsidized KCC loan on Parcel P-105 from Pithora DCCB. Submits application APP-503 for a second subsidized KCC on the same parcel. | Bank console flags **🔴 RED Duplicate Active KCC (MISS Violation)** and blocks multiple interest subventions on a single parcel. |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.11+**
- **Node.js 18+** & **pnpm 8+**

### One-Click Launch (Windows)
Double-click or run:
```cmd
start-demo.bat
```
or in PowerShell:
```powershell
.\start-demo.ps1
```

The script will:
1. Seed the SQLite database with the 5 Golden Personas and audit trail.
2. Start the FastAPI backend on `http://127.0.0.1:8000`.
3. Start the Vite React PWA on `http://localhost:5173`.

### Manual Startup
#### Backend:
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
# source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation (Swagger UI): `http://127.0.0.1:8000/docs`

#### Frontend:
```bash
cd frontend
pnpm install
pnpm run dev --port 5173
```
Frontend App: `http://localhost:5173`

---

## 🧪 Automated Test Suite

Run the full end-to-end integration and unit verification test suite:

```bash
# 1. Run All Golden Rules AST & Unit Tests (44 tests)
cd backend
pytest

# 2. Run End-to-End Persona & Workflow Integration Test
python tests/test_e2e_demo.py

# 3. Run i18n Key Parity Check (169 keys)
cd ../frontend
node scripts/test-i18n-parity.js

# 4. Run Frontend Production TypeScript & PWA Build
pnpm run build
```

---

## 🎨 UI/UX Design Token Mapping

The application adopts the design language extracted from the reference images:
- **AgriGov Green Primary**: `#1B5E20` / `#2E7D32` (Chhattisgarh Agriculture Identity)
- **Banking Navy Corporate**: `#1A365D` / `#2B6CB0` (FinCraft / Core Banking style)
- **Warning / Overdue Amber**: `#D97706` / `#F59E0B`
- **Discrepancy / Red Alert**: `#DC2626` / `#B91C1C`
- **Privacy Lavender**: `#7C3AED` / `#EDE9FE` ($k$-Anonymity small-cell badge)
- **Touch Targets**: Minimum $48\text{px} \times 48\text{px}$ touch regions for low-end mobile devices.
- **Typography**: Self-hosted Noto Sans Devanagari fallback with high contrast text.

---

## 📂 Project Repository Structure

```
hack_a_sol/
├── backend/
│   ├── app/
│   │   ├── adapters/          # DataAdapter, SyntheticAdapter, AgriStack/Bhuiyan/CERSAI Stubs
│   │   ├── models/            # SQLAlchemy 2 Models (Farmer, LandParcel, Loan, AuditEvent, etc.)
│   │   ├── routers/           # FastAPI Routers (auth, farmer, bank, policy, rules)
│   │   ├── rules/             # Pure Python Engine (engine.py, helpers.py, number_words.py, rules_2026.json)
│   │   ├── schemas/           # Pydantic v2 validation schemas
│   │   ├── seed/              # Seed data for 5 Golden Personas & Bank applications
│   │   ├── services/          # AuditService (SHA-256 chain), TemplateService (Jinja2), Transliteration
│   │   ├── auth.py            # Session management, OTP rate-limiting, HTTP-only cookies
│   │   ├── database.py        # SQLite WAL mode configuration
│   │   └── main.py            # FastAPI main application
│   ├── tests/
│   │   ├── test_golden.py     # Golden rules mathematical tests & AST purity check
│   │   ├── test_data_layer.py # SQLAlchemy models & data adapters
│   │   ├── test_api.py        # API endpoint integration & Hard Rule 7 session isolation
│   │   ├── test_pdf.py        # WeasyPrint PDF representation tests
│   │   └── test_e2e_demo.py   # Full 5 Persona end-to-end integration test
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── farmer/        # FarmerLogin, DiscrepancyCard, MyLands, MyCases, LetterModal, etc.
│   │   │   ├── Layout.tsx     # Role switcher ("Demo only"), bilingual toggle, header
│   │   │   ├── RoleSwitcher.tsx
│   │   │   └── TrustBar.tsx   # Persistent provenance & verification timestamp bar
│   │   ├── i18n/              # Bilingual locale store (en.json, hi.json with 100% parity)
│   │   ├── pages/             # FarmerView.tsx, BankView.tsx, PolicyView.tsx, RulesPage.tsx
│   │   ├── services/          # Typed API client with credentials
│   │   ├── types/             # OpenAPI generated types (api.ts) & models (models.ts)
│   │   └── utils/             # Web Speech API audio helper (audio.ts)
│   ├── scripts/
│   │   └── test-i18n-parity.js # Automated bilingual key parity verifier
│   └── vite.config.ts         # Vite + React + Workbox PWA configuration
├── start-demo.bat             # Turnkey Windows Batch launcher
├── start-demo.ps1             # Turnkey PowerShell launcher
└── README.md
```

---

## 🏆 Summary of Hackathon Evaluation Highlights

1. **Zero Black-Box AI Math**: Unlike fragile LLM hallucinated calculations, every rupee, acre, cap, and interest rate is evaluated through deterministic written rules.
2. **Citizen-First Accessibility**: Bilingual Hindi/English switchable in 1 tap, audio reading with spelled-out Hindi words, 4-part explanation cards, and 1-tap formal representation letter generation.
3. **Institutional Trust**: RapidFuzz transliteration identity matching, duplicate loan checks against MISS guidelines, immutable SHA-256 hash chaining, and differential privacy small-cell suppression.
