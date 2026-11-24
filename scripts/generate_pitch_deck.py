import os
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

# ── Color Palette ───────────────────────────────────────────────────────────
C_BG = RGBColor(250, 246, 238)          # Warm Parchment #FAF6EE
C_PADDY = RGBColor(20, 83, 45)           # Deep Paddy Green #14532D
C_EMERALD = RGBColor(16, 122, 68)        # Vibrant Green #107A44
C_DARK = RGBColor(15, 23, 42)            # Dark Slate #0F172A
C_MUTED = RGBColor(71, 85, 105)          # Slate Muted #475569
C_GOLD = RGBColor(217, 138, 22)          # Sunrise Gold #D98A16
C_GOLD_BG = RGBColor(254, 243, 199)      # Light Gold Amber #FEF3C7
C_WHITE = RGBColor(255, 255, 255)        # Crisp White
C_BORDER = RGBColor(226, 232, 240)       # Border slate-200
C_CARD_BG = RGBColor(255, 255, 255)      # White Card

SCREENSHOTS_DIR = Path("docs/deck_screenshots")
OUTPUT_PPTX = Path("JanAgriPortal_Pitch_Deck.pptx")

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank_layout = prs.slide_layouts[6]  # Blank slide

def set_slide_background(slide, color=C_BG):
    bg_shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height
    )
    bg_shape.fill.solid()
    bg_shape.fill.fore_color.rgb = color
    bg_shape.line.color.rgb = color
    return bg_shape

def add_header(slide, tag: str, title: str, subtitle: str):
    # Top Tag / Category Pill
    tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.35))
    tf_tag = tag_box.text_frame
    tf_tag.word_wrap = True
    p_tag = tf_tag.paragraphs[0]
    p_tag.text = tag.upper()
    p_tag.font.size = Pt(11)
    p_tag.font.bold = True
    p_tag.font.color.rgb = C_GOLD

    # Title
    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.7), Inches(11.7), Inches(0.65))
    tf_title = title_box.text_frame
    tf_title.word_wrap = True
    p_title = tf_title.paragraphs[0]
    p_title.text = title
    p_title.font.size = Pt(26)
    p_title.font.bold = True
    p_title.font.color.rgb = C_PADDY

    # Subtitle
    sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.7), Inches(0.45))
    tf_sub = sub_box.text_frame
    tf_sub.word_wrap = True
    p_sub = tf_sub.paragraphs[0]
    p_sub.text = subtitle
    p_sub.font.size = Pt(13)
    p_sub.font.color.rgb = C_MUTED

def add_footer(slide, current: int, total: int = 10):
    footer_box = slide.shapes.add_textbox(Inches(0.8), Inches(7.05), Inches(11.7), Inches(0.3))
    tf = footer_box.text_frame
    p = tf.paragraphs[0]
    p.text = f"JanAgriPortal • Chhattisgarh Agricultural Transparency Platform  |  Slide {current} of {total}  |  Zero AI Math • Live Demo"
    p.font.size = Pt(9)
    p.font.color.rgb = RGBColor(148, 163, 184)

def add_card(slide, left, top, width, height, fill_color=C_CARD_BG, border_color=C_BORDER):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = fill_color
    card.line.color.rgb = border_color
    card.line.width = Pt(1)
    return card

def add_framed_image(slide, img_path: Path, left, top, width, height, caption: str = ""):
    if not img_path.exists():
        print(f"[WARN] Image {img_path} not found!")
        return
    # Subtle card backer
    add_card(slide, left - Inches(0.08), top - Inches(0.08), width + Inches(0.16), height + Inches(0.16), C_WHITE, C_BORDER)
    slide.shapes.add_picture(str(img_path), left, top, width, height)
    if caption:
        cap_box = slide.shapes.add_textbox(left, top + height + Inches(0.06), width, Inches(0.3))
        p = cap_box.text_frame.paragraphs[0]
        p.text = caption
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = C_MUTED
        p.alignment = PP_ALIGN.CENTER

# ── SLIDE 1: TITLE SLIDE ───────────────────────────────────────────────────
s1 = prs.slides.add_slide(blank_layout)
set_slide_background(s1, C_PADDY)

# Title & Brand
t_box = s1.shapes.add_textbox(Inches(0.8), Inches(1.2), Inches(6.8), Inches(2.2))
tf1 = t_box.text_frame
tf1.word_wrap = True
p = tf1.paragraphs[0]
p.text = "JanAgriPortal"
p.font.size = Pt(44)
p.font.bold = True
p.font.color.rgb = C_WHITE

p2 = tf1.add_paragraph()
p2.text = "जन कृषि पोर्टल • Chhattisgarh Agricultural Policy, Loan & Subsidy Transparency Platform"
p2.font.size = Pt(18)
p2.font.bold = True
p2.font.color.rgb = RGBColor(244, 185, 66)

# Value Proposition Pills
pills_box = s1.shapes.add_textbox(Inches(0.8), Inches(3.4), Inches(6.8), Inches(1.8))
tf_pills = pills_box.text_frame
tf_pills.word_wrap = True

bullets = [
    "⚡  ZERO AI MATH CORE: 100% deterministic Decimal/paise rule execution",
    "🛡️  3-TIER ACCOUNTABILITY: Farmer Portal + Banker Console + Policy Dashboard",
    "📱  OMNICHANNEL DEPLOYMENT: Web (Vercel) + Android Native APK + Cloud API",
    "🗣️  TRILINGUAL INCLUSION: English, हिन्दी, and Chhattisgarhi (छत्तीसगढ़ी)"
]
for b in bullets:
    p = tf_pills.add_paragraph()
    p.text = b
    p.font.size = Pt(13)
    p.font.color.rgb = RGBColor(241, 245, 249)
    p.space_after = Pt(8)

# Footer credits
cr_box = s1.shapes.add_textbox(Inches(0.8), Inches(5.8), Inches(6.8), Inches(0.8))
p_cr = cr_box.text_frame.paragraphs[0]
p_cr.text = "Team Hack_a_Sol  |  Presented at National Hackathon 2026\nGitHub: https://github.com/arnavsaini13/hack_a_sol  |  Live: janagriportal.vercel.app"
p_cr.font.size = Pt(11)
p_cr.font.color.rgb = RGBColor(148, 163, 184)

# Cover Screenshot
img1 = SCREENSHOTS_DIR / "01_home_role_gate.png"
add_framed_image(s1, img1, Inches(7.8), Inches(1.3), Inches(4.7), Inches(5.2), "Live Role-Based Gate • Deep-Paddy Theme")


# ── SLIDE 2: THE PROBLEM ───────────────────────────────────────────────────
s2 = prs.slides.add_slide(blank_layout)
set_slide_background(s2)
add_header(s2, "Root Cause Analysis", "The 4 Opaque Chokepoints in Agricultural Schemes", "Why Chhattisgarh's 37+ Lakh Paddy Farmers Face Delayed Entitlements & Hidden Penalties")
add_footer(s2, 2)

cards_data = [
    ("1. Opaque KCC-MISS Subvention Math", "Cooperative PACS offer statutory 0% interest, while RRB/Commercial KCC is capped at 4% net (7% base minus 3% prompt repayment). In reality, banks frequently misclassify loan types or miss subvention credit, overcharging farmers ₹5,000–₹25,000 silently."),
    ("2. Delayed MSP & Krishak Unnati Payouts", "Paddy procurement guarantees ₹3,100/quintal (MSP ₹2,320 + KUY Bonus ₹780) capped at 21 quintals/acre. Payouts get split across bank accounts, causing unnotified payment shortfalls without transparent breakdown."),
    ("3. Transliteration & Name Mismatch Trap", "Land records (Bhuiyan) in Hindi vs Bank Passbooks in English vs Aadhaar lead to simple spelling differences ('Ramesh' vs 'Rameshkumar'). Over 18% of valid KCC/PM-Kisan cases are wrongly rejected at the bank desk."),
    ("4. The Language & Literacy Digital Divide", "Complex portals and dense circulars leave small & marginal farmers at the mercy of middlemen. Without native Chhattisgarhi voice guidance, automated calculation, and legal dispute generation, accountability is zero.")
]

x_offsets = [Inches(0.8), Inches(6.8), Inches(0.8), Inches(6.8)]
y_offsets = [Inches(2.0), Inches(2.0), Inches(4.4), Inches(4.4)]

for i, (hd, desc) in enumerate(cards_data):
    add_card(s2, x_offsets[i], y_offsets[i], Inches(5.7), Inches(2.1), C_WHITE, C_BORDER)
    tb = s2.shapes.add_textbox(x_offsets[i] + Inches(0.2), y_offsets[i] + Inches(0.15), Inches(5.3), Inches(1.8))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = hd
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = C_PADDY
    p.space_after = Pt(4)
    
    p_body = tf.add_paragraph()
    p_body.text = desc
    p_body.font.size = Pt(11)
    p_body.font.color.rgb = C_MUTED


# ── SLIDE 3: OUR SOLUTION ──────────────────────────────────────────────────
s3 = prs.slides.add_slide(blank_layout)
set_slide_background(s3)
add_header(s3, "Comprehensive Architecture", "JanAgriPortal: The Unified 3-Portal Transparency Engine", "Bridging the Gap Between Land Records, Bank Verification, and State Policymakers")
add_footer(s3, 3)

sol_cards = [
    ("🌾 1. Farmer Portal & Mobile App", [
        "3-Tap Khasra lookup with DPDP Act 2023 digital consent",
        "Deterministic scheme eligibility & shortfall calculations",
        "Automated 1-click legal grievance letter generation (PDF)",
        "Trilingual UI + Voice readout (English, Hindi, Chhattisgarhi)"
    ]),
    ("🏦 2. Bank Officer Verification Queue", [
        "Transliteration-normalized fuzzy matching (Levenshtein + token)",
        "Traffic-light confidence bands: [95,100] Green, [75,95) Amber, <75 Red",
        "Dual-flagging: Separates identity mismatch from duplicate KCC",
        "Cryptographic SHA-256 audit entry logged on every approval"
    ]),
    ("📊 3. State Policy Bottleneck Console", [
        "Real-time district & block-level payout delay tracking",
        "Small-cell suppression (n < 5) enforcing strict statistical privacy",
        "Live tamper-evident SHA-256 event ledger verification",
        "Actionable intervention queue for administrative oversight"
    ])
]

w = Inches(3.75)
for i, (hdr, b_list) in enumerate(sol_cards):
    left = Inches(0.8) + i * Inches(4.0)
    add_card(s3, left, Inches(2.1), w, Inches(4.6), C_WHITE, C_BORDER)
    tb = s3.shapes.add_textbox(left + Inches(0.2), Inches(2.3), w - Inches(0.4), Inches(4.2))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = hdr
    p.font.size = Pt(15)
    p.font.bold = True
    p.font.color.rgb = C_PADDY
    p.space_after = Pt(12)
    for b in b_list:
        pb = tf.add_paragraph()
        pb.text = "• " + b
        pb.font.size = Pt(11)
        pb.font.color.rgb = C_MUTED
        pb.space_after = Pt(8)


# ── SLIDE 4: FARMER PORTAL DEEP-DIVE ───────────────────────────────────────
s4 = prs.slides.add_slide(blank_layout)
set_slide_background(s4)
add_header(s4, "Farmer-First Design", "Farmer Portal: Instant Transparency & Actionable Grievances", "Zero Jargon • Exact Rupee Entitlements • Legal Self-Advocacy in 3 Taps")
add_footer(s4, 4)

# Left Column (Content)
add_card(s4, Inches(0.8), Inches(2.0), Inches(5.8), Inches(4.8), C_WHITE, C_BORDER)
tb4 = s4.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.4), Inches(4.4))
tf4 = tb4.text_frame
tf4.word_wrap = True

farmer_pts = [
    ("3-Tap Fetch-First Flow", "Farmers enter land Khasra ('142/1') or Registry No. The system instantly resolves land parcels, crop history, and credit records with DPDP Act 2023 explicit consent."),
    ("Zero AI Math Entitlement Engine", "Computes KCC limits, 21 Qtl/acre paddy cap, MSP ₹2,320 + Bonus ₹780, and PMFBY crop indemnity via exact Decimal statutory formulas (rules_2026.json)."),
    ("Proactive Discrepancy Detection", "Surfaces bank interest overcharges (e.g., 7% billed instead of 0% PACS subvention) and delayed payment tranches with exact rupee shortfalls."),
    ("Statutory Grievance Generation", "With 1 tap, generates a locked, legally formatted representation letter in Hindi or English addressed to the District Collector and Lead District Manager.")
]

for title, desc in farmer_pts:
    p = tf4.add_paragraph()
    p.text = "✔ " + title
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_PADDY
    p.space_after = Pt(2)
    p_desc = tf4.add_paragraph()
    p_desc.text = desc
    p_desc.font.size = Pt(11)
    p_desc.font.color.rgb = C_MUTED
    p_desc.space_after = Pt(10)

# Right Column (Screenshot)
img2 = SCREENSHOTS_DIR / "02_farmer_portal.png"
add_framed_image(s4, img2, Inches(6.9), Inches(2.0), Inches(5.6), Inches(4.6), "Live Farmer Portal • Ramesh Patel (Khasra 142/1) • Scheme Calculations")


# ── SLIDE 5: GEMINI CO-PILOT ───────────────────────────────────────────────
s5 = prs.slides.add_slide(blank_layout)
set_slide_background(s5)
add_header(s5, "Multimodal Inclusion", "Bandu (बन्दु): Multimodal AI Co-Pilot for Rural Literacy", "Voice Input • Native Readout • Photo-to-Voice Document Scanner • Zero PII Leakage")
add_footer(s5, 5)

# Left Column
add_card(s5, Inches(0.8), Inches(2.0), Inches(5.8), Inches(4.8), C_WHITE, C_BORDER)
tb5 = s5.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.4), Inches(4.4))
tf5 = tb5.text_frame
tf5.word_wrap = True

ai_pts = [
    ("Voice-First Trilingual Interaction", "Rural farmers speak their queries naturally in Chhattisgarhi, Hindi, or English. Gemini processes audio and responds with clear, empathetic answers."),
    ("Per-Message Audio Read-Aloud", "Every response includes natural TTS speech with statutory numbers articulated phonetically (e.g. ₹28,496 -> 'अट्ठाइस हजार चार सौ छियानवे रुपये')."),
    ("Proactive Smart Nudges", "Without burning LLM tokens, live database audit rules detect pending claims and float actionable prompt pills directly on the farmer's screen."),
    ("Photo-to-Voice Scanner & Zero-PII Core", "Farmers snap rejection slips or bank passbooks. Gemini Vision extracts discrepancy reasons without ever storing or forwarding raw Aadhaar/Khasra PII.")
]

for title, desc in ai_pts:
    p = tf5.add_paragraph()
    p.text = "⚡ " + title
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_EMERALD
    p.space_after = Pt(2)
    p_desc = tf5.add_paragraph()
    p_desc.text = desc
    p_desc.font.size = Pt(11)
    p_desc.font.color.rgb = C_MUTED
    p_desc.space_after = Pt(10)

# Right Column
img3 = SCREENSHOTS_DIR / "03_farmer_chatbot.png"
add_framed_image(s5, img3, Inches(6.9), Inches(2.0), Inches(5.6), Inches(4.6), "Bandu Chat Drawer • Voice Mic & Speaker • Photo Scanner • Contextual Nudges")


# ── SLIDE 6: BANK OFFICER WORKBENCH ────────────────────────────────────────
s6 = prs.slides.add_slide(blank_layout)
set_slide_background(s6)
add_header(s6, "Desk-Level Precision", "Bank Officer Console: Transliteration-Aware Verification", "Eliminating Wrongful Rejections with RapidFuzz & Dual-Risk Detection")
add_footer(s6, 6)

add_card(s6, Inches(0.8), Inches(2.0), Inches(5.8), Inches(4.8), C_WHITE, C_BORDER)
tb6 = s6.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(5.4), Inches(4.4))
tf6 = tb6.text_frame
tf6.word_wrap = True

bank_pts = [
    ("Transliteration-Normalized Matching", "Applies indic-transliteration to normalize Devanagari and Latin scripts before running RapidFuzz token sorting. Prevents spelling-based rejections."),
    ("Traffic-Light Confidence Bands", "[95, 100]: High Confidence Green (Auto-match candidate)\n[75, 95): Review Needed Amber (Officer manual verification)\n[0, 75): Mismatch Flagged Red (Discrepancy audit)"),
    ("Separation of Mismatch vs Fraud", "Distinguishes between harmless spelling variance and genuine credit risk: separates Identity Mismatches from Duplicate KCC Applications across banks."),
    ("Instant Cryptographic Logging", "Every banker action—approval, conditional review, or rejection—is hashed into the append-only SHA-256 audit ledger with officer credentials.")
]

for title, desc in bank_pts:
    p = tf6.add_paragraph()
    p.text = "🏛️ " + title
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = C_PADDY
    p.space_after = Pt(2)
    p_desc = tf6.add_paragraph()
    p_desc.text = desc
    p_desc.font.size = Pt(11)
    p_desc.font.color.rgb = C_MUTED
    p_desc.space_after = Pt(8)

img4 = SCREENSHOTS_DIR / "04_bank_workbench.png"
add_framed_image(s6, img4, Inches(6.9), Inches(2.0), Inches(5.6), Inches(4.6), "Bank Officer Console • RapidFuzz 98% Match • KCC Duplicate Detection")


# ── SLIDE 7: POLICY DASHBOARD & AUDIT CHAIN ────────────────────────────────
s7 = prs.slides.add_slide(blank_layout)
set_slide_background(s7)
add_header(s7, "State Oversight & Cryptographic Integrity", "Policy Dashboard & Tamper-Evident SHA-256 Audit Chain", "Live District Delay Analytics • k-Anonymity (n < 5) • Verifiable Ledger")
add_footer(s7, 7)

# 2 Images side by side or Content + 2 cards
# Left content card
add_card(s7, Inches(0.8), Inches(2.0), Inches(4.5), Inches(4.8), C_WHITE, C_BORDER)
tb7 = s7.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(4.1), Inches(4.4))
tf7 = tb7.text_frame
tf7.word_wrap = True

policy_pts = [
    ("Real-Time Bottleneck Heatmaps", "Aggregates state-wide payment delays across Raipur, Dhamtari, Durg, and Bilaspur directly from the event ledger."),
    ("Small-Cell Suppression (n < 5)", "Complies with global privacy norms by masking cell counts below 5 to prevent targeted de-anonymization of farmers."),
    ("Tamper-Evident SHA-256 Chain", "Every entitlement calculation, application, and payout is cryptographically hashed with previous block hashes. 'VERIFIED_UNBROKEN' status ensures zero tampering."),
    ("Lead District Intervention Queue", "Flags lagging bank branches and subvention backlogs directly to State Joint Secretaries for administrative intervention.")
]

for title, desc in policy_pts:
    p = tf7.add_paragraph()
    p.text = "📈 " + title
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = C_PADDY
    p.space_after = Pt(2)
    p_desc = tf7.add_paragraph()
    p_desc.text = desc
    p_desc.font.size = Pt(10.5)
    p_desc.font.color.rgb = C_MUTED
    p_desc.space_after = Pt(8)

# 2 Screenshots stacked on right
img5 = SCREENSHOTS_DIR / "05_policy_dashboard.png"
img6 = SCREENSHOTS_DIR / "06_audit_chain.png"
add_framed_image(s7, img5, Inches(5.6), Inches(2.0), Inches(3.6), Inches(4.6), "Policy Analytics & n<5 KPIs")
add_framed_image(s7, img6, Inches(9.4), Inches(2.0), Inches(3.6), Inches(4.6), "SHA-256 Audit Ledger (Unbroken)")


# ── SLIDE 8: SYSTEM ARCHITECTURE ───────────────────────────────────────────
s8 = prs.slides.add_slide(blank_layout)
set_slide_background(s8)
add_header(s8, "Technical Foundation", "System Architecture & The 'Zero AI Math' Philosophy", "Hard Statutory Rules in Pure Python • LLM Used Solely for Natural Communication")
add_footer(s8, 8)

arch_tiers = [
    ("Client Tier (Omnichannel)", "React 18 + Vite SPA • Capacitor Android Native Wrapper • TailwindCSS Design System • PWA offline-ready • Trilingual i18n switcher (EN/HI/CHH)."),
    ("Backend & Security Tier", "FastAPI (Python 3.11) • Dynamic CORS with credentials support • Argon2id password hashing • Rate limiting (SlowAPI) • Stateless Bearer tokens + HTTPS cookies."),
    ("Statutory Rules Engine ('Zero AI Math')", "Pure-Python Decimal & integer-paise math. Reads rules_2026.json (KCC Interest Subvention, Paddy MSP+Bonus, PMFBY, PM-Kisan, Saur Sujala). 100% deterministic & verifiable."),
    ("Synthetic Adapter & Data Tier", "Database layer (Supabase PostgreSQL + SQLite local fallback). Synthetic adapter modeled on actual AgriStack, Bhuiyan, RBI ULI, and PFMS schemas.")
]

y_pos = [Inches(2.0), Inches(3.2), Inches(4.4), Inches(5.6)]
colors = [C_PADDY, C_DARK, C_EMERALD, C_GOLD]

for i, (layer_title, layer_desc) in enumerate(arch_tiers):
    add_card(s8, Inches(0.8), y_pos[i], Inches(11.7), Inches(1.05), C_WHITE, C_BORDER)
    tb = s8.shapes.add_textbox(Inches(1.0), y_pos[i] + Inches(0.1), Inches(11.3), Inches(0.85))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = f"Layer {i+1}: {layer_title}"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = colors[i]
    p.space_after = Pt(2)
    p_b = tf.add_paragraph()
    p_b.text = layer_desc
    p_b.font.size = Pt(11)
    p_b.font.color.rgb = C_MUTED


# ── SLIDE 9: ENGINEERING RIGOR ─────────────────────────────────────────────
s9 = prs.slides.add_slide(blank_layout)
set_slide_background(s9)
add_header(s9, "Production Quality", "Engineering Rigor, Automated Testing & Cloud Readiness", "Built for Real-World Reliability • Golden Test Suites • Transparent Provenance")
add_footer(s9, 9)

rigor_cards = [
    ("🧪 Golden Pytest Suite (66+ Tests)", [
        "100% test pass rate across API, Rules, and Auth",
        "Deterministic property-based test loops",
        "Strict edge-case validation for partial hectares & rounding",
        "Zero-regression verification on every commit"
    ]),
    ("🌐 Trilingual i18n Key Parity", [
        "Automated npm run test:i18n validation script",
        "Zero missing keys across en.json, hi.json, and chh.json",
        "Native Chhattisgarhi vocabulary reviewed for cultural clarity",
        "Seamless dynamic language switcher"
    ]),
    ("🛡️ Rigorous Data Provenance", [
        "Primary Gov Source vs Prototype Assumption badges",
        "Zero mock data without explicit provenance tracking",
        "Strict DPDP Act 2023 compliance with revocation support",
        "OpenAPI 3.1 contract-typed client across frontend"
    ]),
    ("🚀 Live Cloud Deployment", [
        "Backend: Live on Render (FastAPI + Python 3.11)",
        "Frontend: Live on Vercel Edge with zero-downtime updates",
        "Database: Production Supabase PostgreSQL with pool pre-ping",
        "Mobile: Standalone debug APK packaged with Capacitor"
    ])
]

for i, (title, b_list) in enumerate(rigor_cards):
    col = i % 2
    row = i // 2
    x = Inches(0.8) + col * Inches(6.0)
    y = Inches(2.1) + row * Inches(2.4)
    add_card(s9, x, y, Inches(5.7), Inches(2.2), C_WHITE, C_BORDER)
    tb = s9.shapes.add_textbox(x + Inches(0.2), y + Inches(0.15), Inches(5.3), Inches(1.9))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(14)
    p.font.bold = True
    p.font.color.rgb = C_PADDY
    p.space_after = Pt(6)
    for b in b_list:
        pb = tf.add_paragraph()
        pb.text = "• " + b
        pb.font.size = Pt(10.5)
        pb.font.color.rgb = C_MUTED
        pb.space_after = Pt(2)


# ── SLIDE 10: IMPACT, ROADMAP & DEMO ───────────────────────────────────────
s10 = prs.slides.add_slide(blank_layout)
set_slide_background(s10, C_PADDY)

# Title
t_box = s10.shapes.add_textbox(Inches(0.8), Inches(0.8), Inches(11.7), Inches(0.8))
tf10 = t_box.text_frame
p = tf10.paragraphs[0]
p.text = "Measurable Impact & Next Steps"
p.font.size = Pt(32)
p.font.bold = True
p.font.color.rgb = C_WHITE

# 3 Columns for Impact, Roadmap, Demo links
col_w = Inches(3.7)
# Col 1: Stakeholder Impact
add_card(s10, Inches(0.8), Inches(1.8), col_w, Inches(4.8), C_WHITE, C_BORDER)
tb_i = s10.shapes.add_textbox(Inches(1.0), Inches(2.0), col_w - Inches(0.4), Inches(4.4))
tf_i = tb_i.text_frame
tf_i.word_wrap = True
p = tf_i.paragraphs[0]
p.text = "🎯 Concrete Impact"
p.font.size = Pt(16)
p.font.bold = True
p.font.color.rgb = C_PADDY
p.space_after = Pt(10)

impacts = [
    "Farmers: Save ₹5,000–₹25,000 in unbilled interest; receive prompt dispute redressal.",
    "Bank Officers: Cut processing time by 70% with transliteration-aware auto matching.",
    "Policymakers: Eliminate systemic delay bottlenecks with tamper-evident audit trails.",
    "Financial Inclusion: Full voice & vernacular access for illiterate and rural farmers."
]
for item in impacts:
    p = tf_i.add_paragraph()
    p.text = "• " + item
    p.font.size = Pt(11)
    p.font.color.rgb = C_MUTED
    p.space_after = Pt(8)

# Col 2: Future Roadmap
add_card(s10, Inches(4.8), Inches(1.8), col_w, Inches(4.8), C_WHITE, C_BORDER)
tb_r = s10.shapes.add_textbox(Inches(5.0), Inches(2.0), col_w - Inches(0.4), Inches(4.4))
tf_r = tb_r.text_frame
tf_r.word_wrap = True
p = tf_r.paragraphs[0]
p.text = "🚀 Future Roadmap"
p.font.size = Pt(16)
p.font.bold = True
p.font.color.rgb = C_EMERALD
p.space_after = Pt(10)

roadmap = [
    "AgriStack Live Sandbox: Direct integration with Bhuiyan & AgriStack Farmer ID APIs.",
    "RBI ULI Production Rails: Seamless KCC credit subvention consent protocol.",
    "Edge Voice Engine: Offline speech synthesis & recognition for remote panchayats.",
    "WhatsApp & CSC Integration: Enable access via common service centers & WhatsApp bot."
]
for item in roadmap:
    p = tf_r.add_paragraph()
    p.text = "• " + item
    p.font.size = Pt(11)
    p.font.color.rgb = C_MUTED
    p.space_after = Pt(8)

# Col 3: Live Access & Demo
add_card(s10, Inches(8.8), Inches(1.8), col_w, Inches(4.8), RGBColor(254, 243, 199), C_GOLD)
tb_d = s10.shapes.add_textbox(Inches(9.0), Inches(2.0), col_w - Inches(0.4), Inches(4.4))
tf_d = tb_d.text_frame
tf_d.word_wrap = True
p = tf_d.paragraphs[0]
p.text = "✨ Experience Live Now"
p.font.size = Pt(16)
p.font.bold = True
p.font.color.rgb = C_GOLD
p.space_after = Pt(10)

links = [
    ("🌐 Web Portal (Live)", "https://janagriportal.vercel.app"),
    ("⚙️ API Backend (Live)", "https://hack-a-sol-523b.onrender.com"),
    ("📱 Android APK", "JanAgriPortal.apk (Standalone)"),
    ("💻 GitHub Repository", "github.com/arnavsaini13/hack_a_sol"),
    ("🔑 Demo Khasra", "142/1 (Ramesh Patel)"),
    ("🏛️ Bank / Policy Staff", "EMP-2041 / CG-POL-8492")
]
for title, link in links:
    p = tf_d.add_paragraph()
    p.text = f"{title}:"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = C_DARK
    p_sub = tf_d.add_paragraph()
    p_sub.text = link
    p_sub.font.size = Pt(10)
    p_sub.font.color.rgb = C_PADDY
    p_sub.space_after = Pt(6)

prs.save(str(OUTPUT_PPTX))
print(f"JanAgriPortal Pitch Deck generated successfully at: {OUTPUT_PPTX.resolve()}")
