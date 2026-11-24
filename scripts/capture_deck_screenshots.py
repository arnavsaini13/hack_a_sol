import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT_DIR = Path("docs/deck_screenshots")
OUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "http://localhost:5173"

def capture_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.5  # High-DPI crisp screenshots
        )
        page = context.new_page()

        # 1. LANDING / ROLE SELECTION
        print("1. Capturing 01_home_role_gate.png...")
        page.goto(f"{BASE_URL}/", wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "01_home_role_gate.png"))

        # 2. FARMER PORTAL
        print("2. Capturing 02_farmer_portal.png...")
        page.goto(f"{BASE_URL}/farmer", wait_until="networkidle")
        time.sleep(1)
        try:
            k_input = page.locator("input[placeholder*='142/1'], input[type='text']").first
            if k_input.is_visible():
                k_input.fill("142/1")
                time.sleep(0.5)
                sub_btn = page.locator("button[type='submit'], button:has-text('सत्यापित')").first
                sub_btn.click()
                time.sleep(3)
        except Exception as e:
            print("Farmer login error:", e)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "02_farmer_portal.png"))

        # 3. FARMER CHATBOT DRAWER
        print("3. Capturing 03_farmer_chatbot.png...")
        try:
            chat_fab = page.locator("button[aria-label='Open Bandu AI Assistant']").first
            if not chat_fab.is_visible():
                chat_fab = page.locator("button:has-text('Bandu'), button:has-text('बन्दु')").first
            if chat_fab.is_visible():
                chat_fab.click()
                time.sleep(2)
        except Exception as e:
            print("Chat FAB error:", e)
        page.screenshot(path=str(OUT_DIR / "03_farmer_chatbot.png"))

        # Close chatbot drawer
        try:
            close_btn = page.locator("button[aria-label='Close chat drawer'], button:has-text('✕')").first
            if close_btn.is_visible():
                close_btn.click()
                time.sleep(0.5)
        except:
            pass

        # 4. BANK WORKBENCH
        print("4. Capturing 04_bank_workbench.png...")
        page.goto(f"{BASE_URL}/bank", wait_until="networkidle")
        time.sleep(1)
        try:
            # Login if auth gate present
            ident = page.locator("input[placeholder*='Email'], input[placeholder*='कर्मचारी'], input[type='text']").first
            if ident.is_visible():
                ident.fill("EMP-2041")
                pwd = page.locator("input[type='password']").first
                pwd.fill("password123")
                time.sleep(0.5)
                # Click submit
                sub = page.locator("button[type='submit']").first
                sub.click()
                time.sleep(3)
        except Exception as e:
            print("Bank login error:", e)

        # Trigger verification to get green/amber match cards
        try:
            v_btn = page.locator("button:has-text('सत्यापन करें'), button:has-text('Verify Application'), button:has-text('सत्यापित करें')").first
            if v_btn.is_visible():
                v_btn.click()
                time.sleep(2)
        except Exception as e:
            print("Bank verify form error:", e)
        page.screenshot(path=str(OUT_DIR / "04_bank_workbench.png"))

        # 5. POLICY DASHBOARD
        print("5. Capturing 05_policy_dashboard.png...")
        page.goto(f"{BASE_URL}/policy", wait_until="networkidle")
        time.sleep(1)
        try:
            p_ident = page.locator("input[placeholder*='Email'], input[placeholder*='कोड'], input[type='text']").first
            if p_ident.is_visible():
                p_ident.fill("CG-POL-8492")
                p_pwd = page.locator("input[type='password']").first
                p_pwd.fill("admin123")
                time.sleep(0.5)
                p_sub = page.locator("button[type='submit']").first
                p_sub.click()
                time.sleep(3)
        except Exception as e:
            print("Policy login error:", e)
        time.sleep(2)
        page.screenshot(path=str(OUT_DIR / "05_policy_dashboard.png"))

        # 6. AUDIT CHAIN TAB
        print("6. Capturing 06_audit_chain.png...")
        try:
            audit_tab = page.locator("button:has-text('Audit Chain'), button:has-text('ऑडिट लेजर'), button:has-text('लेजर')").first
            if audit_tab.is_visible():
                audit_tab.click()
                time.sleep(2)
        except Exception as e:
            print("Audit chain tab error:", e)
        page.screenshot(path=str(OUT_DIR / "06_audit_chain.png"))

        browser.close()
        print("All 6 screenshots captured successfully in docs/deck_screenshots/!")

if __name__ == "__main__":
    capture_all()
