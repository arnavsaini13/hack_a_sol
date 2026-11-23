"""
SMS & OTP delivery service with support for MSG91 Gateway and Firebase Auth.
Includes graceful local fallback for offline/development environments.
"""
import os
import json
import logging
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Environment variable keys
MSG91_AUTH_KEY = os.getenv("MSG91_AUTH_KEY", "")
MSG91_TEMPLATE_ID = os.getenv("MSG91_TEMPLATE_ID", "")
MSG91_SENDER_ID = os.getenv("MSG91_SENDER_ID", "AGRIIN")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "")


def send_otp_sms(mobile: str, otp: str) -> Dict[str, Any]:
    """
    Send OTP via MSG91 OTP API if MSG91_AUTH_KEY is configured.
    Falls back to mock/demo mode if unconfigured or network is unavailable.
    """
    clean_mobile = mobile.strip().replace("+", "").replace("-", "")
    # Add Indian country code if 10 digits
    if len(clean_mobile) == 10:
        recipient = f"91{clean_mobile}"
    else:
        recipient = clean_mobile

    # If MSG91 configured, dispatch HTTP request
    if MSG91_AUTH_KEY:
        try:
            # MSG91 v5 OTP endpoint
            url = f"https://control.msg91.com/api/v5/otp?template_id={MSG91_TEMPLATE_ID}&mobile={recipient}&authkey={MSG91_AUTH_KEY}&otp={otp}"
            req = urllib.request.Request(
                url,
                headers={
                    "Content-Type": "application/json",
                    "authkey": MSG91_AUTH_KEY
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                resp_data = json.loads(response.read().decode("utf-8"))
                logger.info(f"MSG91 OTP sent successfully to {recipient}: {resp_data}")
                return {
                    "provider": "MSG91",
                    "status": "SENT",
                    "mobile": mobile,
                    "response": resp_data
                }
        except Exception as e:
            logger.warning(f"MSG91 dispatch failed ({e}), falling back to local verification.")
            return {
                "provider": "MSG91_FALLBACK",
                "status": "FALLBACK_LOCAL",
                "mobile": mobile,
                "error": str(e)
            }

    # Firebase Auth or local simulated delivery
    return {
        "provider": "LOCAL_SIMULATED",
        "status": "SENT_SIMULATED",
        "mobile": mobile,
        "note": "MSG91_AUTH_KEY not set in env; OTP generated and verified locally."
    }


def verify_firebase_id_token(id_token: str) -> Optional[Dict[str, Any]]:
    """
    Verify Firebase Authentication ID token if Firebase Admin SDK is available.
    """
    try:
        import firebase_admin
        from firebase_admin import auth
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        logger.debug(f"Firebase token verification bypassed or failed: {e}")
        return None
