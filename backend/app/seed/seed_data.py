"""
Synthetic data seeder for Agricultural Transparency Platform.
Populates SQLite database with 50+ realistic Chhattisgarh farmers, land parcels,
loans, staff officers, audit events, and bottleneck records.
"""
import json
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.models.entities import (
    Farmer,
    LandParcel,
    Loan,
    Procurement,
    InsuranceUnit,
    BankApplication,
    Case,
    AuditEvent,
    StaffUser,
    Rejection,
)
from app.auth import hash_password
from app.services.audit_service import AuditChainService


def seed_database(db: Session) -> None:
    """Wipe and re-seed all synthetic demonstration data with 50+ records."""
    # Re-create tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    audit_service = AuditChainService()

    # ─────────────────────────────────────────────────────────────────
    # 0. Bank Staff Users
    # ─────────────────────────────────────────────────────────────────
    demo_pass_hash = hash_password("Password@123")
    staff_data = [
        StaffUser(
            id="STAFF-EMP-2041",
            email="anita.verma@cggb.in",
            employee_id="EMP-2041",
            full_name="Anita Verma",
            bank_name="Chhattisgarh Rajya Gramin Bank",
            branch_district="Raipur",
            password_hash=demo_pass_hash,
            role="BANK_OFFICER",
            is_active=True,
        ),
        StaffUser(
            id="STAFF-CGGB-4092",
            email="rajesh.agrawal@cggb.in",
            employee_id="CGGB-4092",
            full_name="Rajesh Agrawal",
            bank_name="Chhattisgarh Rajya Gramin Bank",
            branch_district="Dhamtari",
            password_hash=demo_pass_hash,
            role="BANK_OFFICER",
            is_active=True,
        ),
        StaffUser(
            id="STAFF-RDCB-1088",
            email="suresh.deshmukh@rdcb.in",
            employee_id="RDCB-1088",
            full_name="Suresh Deshmukh",
            bank_name="Raipur District Cooperative Bank",
            branch_district="Raipur",
            password_hash=demo_pass_hash,
            role="BANK_OFFICER",
            is_active=True,
        ),
        StaffUser(
            id="STAFF-SBI-5510",
            email="sunita.sharma@sbi.co.in",
            employee_id="SBI-5510",
            full_name="Sunita Sharma",
            bank_name="State Bank of India",
            branch_district="Durg",
            password_hash=demo_pass_hash,
            role="BANK_OFFICER",
            is_active=True,
        ),
    ]
    db.add_all(staff_data)
    db.flush()

    # ─────────────────────────────────────────────────────────────────
    # 1. 5 Golden Personas + 1 Red Case Owner + 50 Diverse Farmers
    # ─────────────────────────────────────────────────────────────────
    core_farmers = [
        # F-001: Golden Clean Case (Ramesh Patel)
        Farmer(
            id="F-001",
            mobile="9876543210",
            masked_mobile="XXXXXX3210",
            pin_hash="1234",
            name_hi="रामेश्वर पटेल",
            name_en="Ramesh Patel",
            father_name_hi="श्यामा चरण पटेल",
            father_name_en="Shyama Charan Patel",
            village="सिल्ली",
            tehsil="आरंग",
            district="रायपुर",
            consent_given=True,
            consent_timestamp=datetime(2026, 1, 10, 10, 0, tzinfo=timezone.utc),
        ),
        # F-002: Multi-Parcel Farmer (Shyam Verma)
        Farmer(
            id="F-002",
            mobile="9876543211",
            masked_mobile="XXXXXX3211",
            pin_hash="1234",
            name_hi="श्याम वर्मा",
            name_en="Shyam Verma",
            father_name_hi="मोहन वर्मा",
            father_name_en="Mohan Verma",
            village="पाटन",
            tehsil="पाटन",
            district="दुर्ग",
            consent_given=True,
            consent_timestamp=datetime(2026, 1, 12, 11, 30, tzinfo=timezone.utc),
        ),
        # F-003: Marginal Farmer (Anita Bai)
        Farmer(
            id="F-003",
            mobile="9876543212",
            masked_mobile="XXXXXX3212",
            pin_hash="1234",
            name_hi="अनिता बाई",
            name_en="Anita Bai",
            father_name_hi="सुखदेव",
            father_name_en="Sukhdev",
            village="मस्तूरी",
            tehsil="मस्तूरी",
            district="बिलासपुर",
            consent_given=True,
            consent_timestamp=datetime(2026, 1, 15, 9, 15, tzinfo=timezone.utc),
        ),
        # F-004: Golden Amber Case (Vikram Singh)
        Farmer(
            id="F-004",
            mobile="9876543213",
            masked_mobile="XXXXXX3213",
            pin_hash="1234",
            name_hi="विक्रम सिंह",
            name_en="Vikram Singh",
            father_name_hi="बलवंत सिंह",
            father_name_en="Balwant Singh",
            village="डोंगरगांव",
            tehsil="डोंगरगांव",
            district="राजनांदगांव",
            consent_given=True,
            consent_timestamp=datetime(2026, 1, 18, 14, 0, tzinfo=timezone.utc),
        ),
        # F-005: Dilip Kumar
        Farmer(
            id="F-005",
            mobile="9876543214",
            masked_mobile="XXXXXX3214",
            pin_hash="1234",
            name_hi="दिलीप कुमार",
            name_en="Dilip Kumar",
            father_name_hi="जगदीश कुमार",
            father_name_en="Jagdish Kumar",
            village="पिथौरा",
            tehsil="पिथौरा",
            district="महासमुंद",
            consent_given=True,
            consent_timestamp=datetime(2026, 1, 20, 16, 45, tzinfo=timezone.utc),
        ),
        # F-RED-01: Red Case Owner (Ramesh Sahu s/o Mohan Sahu, Raipur Khasra 1087/2)
        Farmer(
            id="F-RED-01",
            mobile="9876543299",
            masked_mobile="XXXXXX3299",
            pin_hash="1234",
            name_hi="रमेश साहू",
            name_en="Ramesh Sahu",
            father_name_hi="मोहन साहू",
            father_name_en="Mohan Sahu",
            village="मंदिर हसौद",
            tehsil="आरंग",
            district="रायपुर",
            consent_given=True,
            consent_timestamp=datetime(2026, 1, 22, 10, 0, tzinfo=timezone.utc),
        ),
    ]

    # 48 more diverse farmers across Chhattisgarh
    locations = [
        ("रायपुर", "आरंग", "सिल्ली"),
        ("रायपुर", "आरंग", "मंदिर हसौद"),
        ("रायपुर", "अभनपुर", "अभनपुर"),
        ("रायपुर", "अभनपुर", "केंद्री"),
        ("रायपुर", "धरसींवा", "धनेली"),
        ("धमतरी", "कुरूद", "कुरूद"),
        ("धमतरी", "कुरूद", "भखारा"),
        ("धमतरी", "धमतरी", "धमतरी"),
        ("धमतरी", "धमतरी", "रुद्री"),
        ("धमतरी", "नगरी", "नगरी"),
        ("बिलासपुर", "मस्तूरी", "मस्तूरी"),
        ("बिलासपुर", "मस्तूरी", "सीपत"),
        ("बिलासपुर", "कोटा", "कोटा"),
        ("बिलासपुर", "कोटा", "रतनपुर"),
        ("बिलासपुर", "बिल्हा", "बिल्हा"),
        ("दुर्ग", "पाटन", "पाटन"),
        ("दुर्ग", "पाटन", "रानीतराई"),
        ("दुर्ग", "धमधा", "धमधा"),
        ("दुर्ग", "दुर्ग", "उतई"),
        ("राजनांदगांव", "डोंगरगांव", "डोंगरगांव"),
        ("राजनांदगांव", "डोंगरगांव", "तुमड़ीबोड"),
        ("राजनांदगांव", "खैरागढ़", "खैरागढ़"),
        ("राजनांदगांव", "डोंगरगढ़", "डोंगरगढ़"),
        ("महासमुंद", "पिथौरा", "पिथौरा"),
        ("महासमुंद", "पिथौरा", "सांकरा"),
        ("महासमुंद", "सरायपाली", "सरायपाली"),
        ("महासमुंद", "बसना", "बसना"),
    ]

    names_pool = [
        ("राजेश कुमार चंद्राकर", "Rajesh Kumar Chandrakar", "संतोष चंद्राकर", "Santosh Chandrakar"),
        ("मनोज देवांगन", "Manoj Dewangan", "रामगोपाल देवांगन", "Ram Gopal Dewangan"),
        ("हेमंत साहू", "Hemant Sahu", "केदारनाथ साहू", "Kedarnath Sahu"),
        ("भूपेंद्र निषाद", "Bhupendra Nishad", "धनीराम निषाद", "Dhaniram Nishad"),
        ("कमलेश बघेल", "Kamlesh Baghel", "बंसीलाल बघेल", "Bansilal Baghel"),
        ("सुरेंद्र ध्रुव", "Surendra Dhruw", "मंगत राम ध्रुव", "Mangat Ram Dhruw"),
        ("दिनेश कुमार यादव", "Dinesh Kumar Yadav", "प्रभुनाथ यादव", "Prabhunath Yadav"),
        ("महेश टंडन", "Mahesh Tandan", "जोगीराम टंडन", "Jogiram Tandan"),
        ("अजय कश्यप", "Ajay Kashyap", "रामकिशुन कश्यप", "Ramkishun Kashyap"),
        ("संजय मरकाम", "Sanjay Markam", "शिवप्रसाद मरकाम", "Shivprasad Markam"),
        ("प्रदीप सोनवानी", "Pradeep Sonwani", "गोरेलाल सोनवानी", "Gorelal Sonwani"),
        ("प्रकाश पैकरा", "Prakash Paikra", "जयपाल पैकरा", "Jaipal Paikra"),
        ("योगेश सिदार", "Yogesh Sidar", "नरेश सिदार", "Naresh Sidar"),
        ("अशोक कंवर", "Ashok Kanwar", "तीरथ राम कंवर", "Teerath Ram Kanwar"),
        ("सुनील जांगड़े", "Sunil Jangde", "माखनलाल जांगड़े", "Makhanlal Jangde"),
        ("दीपक साहू", "Deepak Sahu", "दयाराम साहू", "Dayaram Sahu"),
        ("संदीप वर्मा", "Sandeep Verma", "लखनलाल वर्मा", "Lakhanlal Verma"),
        ("गजेंद्र पटेल", "Gajendra Patel", "बिहारीलाल पटेल", "Biharilal Patel"),
        ("नरेंद्र ठाकुर", "Narendra Thakur", "भागवत ठाकुर", "Bhagwat Thakur"),
        ("देवेंद्र प्रधान", "Devendra Pradhan", "रामअवतार प्रधान", "Ramavatar Pradhan"),
        ("जितेंद्र भोई", "Jitendra Bhoi", "चैतराम भोई", "Chaitram Bhoi"),
        ("हरिशंकर नायक", "Harishankar Nayak", "द्वारिका नायक", "Dwarika Nayak"),
        ("लोकेश चौहान", "Lokesh Chauhan", "भीखम चौहान", "Bhikham Chauhan"),
        ("ओमप्रकाश नेताम", "Omprakash Netam", "बोधन नेताम", "Bodhan Netam"),
        ("विष्णु बरिहा", "Vishnu Bariha", "पंचराम बरिहा", "Panchram Bariha"),
        ("चेतन नाग", "Chetan Nag", "दशरथ नाग", "Dashrath Nag"),
        ("ललित कोराम", "Lalit Koram", "फागुराम कोराम", "Faguram Koram"),
        ("गोपाल सलाम", "Gopal Salam", "सोनू सलाम", "Sonu Salam"),
        ("भुवनेश्वर उरांव", "Bhuvneshwar Oraon", "बिरसा उरांव", "Birsa Oraon"),
        ("रोशन चक्रधारी", "Roshan Chakradhari", "मंगत चक्रधारी", "Mangat Chakradhari"),
        ("सत्येंद्र मानिकपुरी", "Satyendra Manikpuri", "दौलत मानिकपुरी", "Daulat Manikpuri"),
        ("कल्याण मंडावी", "Kalyan Mandavi", "बुधराम मंडावी", "Budhram Mandavi"),
        ("किशन गोंड", "Kishan Gond", "गंगाराम गोंड", "Gangaram Gond"),
        ("तुलसीदास सोनकर", "Tulsidas Sonkar", "परसराम सोनकर", "Parasram Sonkar"),
        ("रवींद्र जायसवाल", "Ravindra Jaiswal", "द्वारका जायसवाल", "Dwarka Jaiswal"),
        ("अनिल गुप्ता", "Anil Gupta", "मुरलीधर गुप्ता", "Murlidhar Gupta"),
        ("विपिन सेन", "Vipin Sen", "राधेश्याम सेन", "Radheshyam Sen"),
        ("सतीश सोनी", "Satish Soni", "काशीराम सोनी", "Kashiram Soni"),
        ("धर्मेंद्र कौशिक", "Dharmendra Kaushik", "त्रिलोचन कौशिक", "Trilochan Kaushik"),
        ("आनंद ताम्रकार", "Anand Tamrakar", "बंशीधर ताम्रकार", "Banshidhar Tamrakar"),
        ("गौतम धीवर", "Gautam Dheevar", "सखाराम धीवर", "Sakharam Dheevar"),
        ("नीरज तिवारी", "Neeraj Tiwari", "रामप्रपन्न तिवारी", "Ram Prapanna Tiwari"),
        ("सौरभ बाजपेयी", "Saurabh Bajpai", "उमाशंकर बाजपेयी", "Umashankar Bajpai"),
        ("अमित दुबे", "Amit Dubey", "केदारनाथ दुबे", "Kedarnath Dubey"),
        ("पंकज शुक्ला", "Pankaj Shukla", "विश्वंभर शुक्ला", "Vishwambhar Shukla"),
        ("विकास मिश्रा", "Vikas Mishra", "रामगोपाल मिश्रा", "Ramgopal Mishra"),
        ("रविशंकर चतुर्वेदी", "Ravishankar Chaturvedi", "मदनमोहन चतुर्वेदी", "Madan Mohan Chaturvedi"),
        ("अरविंद पांडे", "Arvind Pandey", "सीताराम पांडे", "Sitaram Pandey"),
    ]

    all_farmers = list(core_farmers)
    for idx, (n_hi, n_en, f_hi, f_en) in enumerate(names_pool, start=6):
        loc = locations[(idx - 6) % len(locations)]
        mobile_num = f"98765{idx:05d}"
        all_farmers.append(
            Farmer(
                id=f"F-{idx:03d}",
                mobile=mobile_num,
                masked_mobile=f"XXXXX{mobile_num[-5:]}",
                pin_hash="1234",
                name_hi=n_hi,
                name_en=n_en,
                father_name_hi=f_hi,
                father_name_en=f_en,
                village=loc[2],
                tehsil=loc[1],
                district=loc[0],
                consent_given=True,
                consent_timestamp=datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc),
            )
        )

    db.add_all(all_farmers)
    db.flush()

    for f in all_farmers[:10]:
        audit_service.append_event(
            actor=f.id,
            action="CONSENT_RECORDED",
            payload={"mobile": f.masked_mobile, "district": f.district},
            subject=f.id,
        )

    # ─────────────────────────────────────────────────────────────────
    # 2. Land Parcels (50+ records with explicit Clean, Amber, Red cases)
    # ─────────────────────────────────────────────────────────────────
    parcels_data = [
        # Case 1 (CLEAN): Ramesh Patel, Raipur, Arang, Silli, Khasra 142/1, 1.2140 ha
        LandParcel(
            id="P-101",
            farmer_id="F-001",
            district="रायपुर",
            tehsil="आरंग",
            village="सिल्ली",
            village_code="V-01",
            khasra_no="142/1",
            area_ha=Decimal("1.2140"),
            girdawari_crop="Paddy",
            girdawari_ha=Decimal("1.2140"),
            co_owners_json=json.dumps([{"owner_name": "Ramesh Patel", "share_fraction": 1.0}]),
            mortgage_status="CLEAR",
            mortgage_bank=None,
            mortgage_amount_paise=0,
        ),
        # F-002: Shyam Verma, Durg, Patan, Khasra 88/2
        LandParcel(
            id="P-102",
            farmer_id="F-002",
            district="दुर्ग",
            tehsil="पाटन",
            village="पाटन",
            village_code="V-02",
            khasra_no="88/2",
            area_ha=Decimal("1.8000"),
            girdawari_crop="Paddy",
            girdawari_ha=Decimal("1.8000"),
            co_owners_json=json.dumps([{"owner_name": "Shyam Verma", "share_fraction": 1.0}]),
            mortgage_status="CLEAR",
            mortgage_bank=None,
            mortgage_amount_paise=0,
        ),
        # F-003: Anita Bai, Bilaspur, Masturi, Khasra 504
        LandParcel(
            id="P-103",
            farmer_id="F-003",
            district="बिलासपुर",
            tehsil="मस्तूरी",
            village="मस्तूरी",
            village_code="V-03",
            khasra_no="504",
            area_ha=Decimal("0.8000"),
            girdawari_crop="Paddy",
            girdawari_ha=Decimal("0.8000"),
            co_owners_json=json.dumps([{"owner_name": "Anita Bai", "share_fraction": 1.0}]),
            mortgage_status="CLEAR",
            mortgage_bank=None,
            mortgage_amount_paise=0,
        ),
        # Case 2 (AMBER): Vikram Singh, Rajnandgaon, Dongargaon, Khasra 45/2 (Applicant "Vikram Sinh")
        LandParcel(
            id="P-104",
            farmer_id="F-004",
            district="राजनांदगांव",
            tehsil="डोंगरगांव",
            village="डोंगरगांव",
            village_code="V-04",
            khasra_no="45/2",
            area_ha=Decimal("2.0000"),
            girdawari_crop="Paddy",
            girdawari_ha=Decimal("2.0000"),
            co_owners_json=json.dumps([{"owner_name": "Vikram Singh", "share_fraction": 1.0}]),
            mortgage_status="CLEAR",
            mortgage_bank=None,
            mortgage_amount_paise=0,
        ),
        # F-005: Dilip Kumar, Mahasamund, Pithora, Khasra 77/1
        LandParcel(
            id="P-105",
            farmer_id="F-005",
            district="महासमुंद",
            tehsil="पिथौरा",
            village="पिथौरा",
            village_code="V-05",
            khasra_no="77/1",
            area_ha=Decimal("1.5000"),
            girdawari_crop="Paddy",
            girdawari_ha=Decimal("1.5000"),
            co_owners_json=json.dumps([{"owner_name": "Dilip Kumar", "share_fraction": 1.0}]),
            mortgage_status="MORTGAGED",
            mortgage_bank="Durg District Cooperative Bank",
            mortgage_amount_paise=18000000,
        ),
        # Case 3 (RED): Ramesh Sahu s/o Mohan Sahu, Raipur, Arang, Mandir Hasaud, Khasra 1087/2
        # Has ACTIVE KCC ₹1,80,000 at Raipur District Cooperative Bank.
        # Testing applicant "Rakesh Sahu" s/o "Ganesh Sahu" triggers RED identity + RED duplicate KCC!
        LandParcel(
            id="P-RED-1087",
            farmer_id="F-RED-01",
            district="रायपुर",
            tehsil="आरंग",
            village="मंदिर हसौद",
            village_code="V-06",
            khasra_no="1087/2",
            area_ha=Decimal("1.8000"),
            girdawari_crop="Paddy",
            girdawari_ha=Decimal("1.8000"),
            co_owners_json=json.dumps([{"owner_name": "Ramesh Sahu", "share_fraction": 1.0}]),
            mortgage_status="ACTIVE",
            mortgage_bank="Raipur District Cooperative Bank",
            mortgage_amount_paise=18000000,
        ),
    ]

    # Generate parcels 107 through 155 for the remaining farmers
    khasra_numbers = [
        "12/1", "24/3", "36/2", "58/1", "72/4", "89/1", "104/2", "118", "135/1", "150/2",
        "165", "182/1", "199/3", "215/1", "230/2", "245", "262/1", "280/4", "305/1", "320/2",
        "335", "352/1", "370/3", "390/1", "410/2", "425", "440/1", "460/2", "480", "502/1",
        "520/3", "545/1", "565/2", "580", "602/1", "620/2", "640", "665/1", "685/3", "710/1",
        "730/2", "750", "775/1", "795/2", "820", "845/1", "870/3", "900/1", "925/2", "950"
    ]

    crops_pool = ["Paddy", "Paddy", "Paddy", "Wheat", "Soyabean", "Chana"]
    mortgage_pool = [
        ("CLEAR", None, 0),
        ("CLEAR", None, 0),
        ("CLEARED_HISTORICAL", "Chhattisgarh Rajya Gramin Bank", 0),
        ("CLEAR", None, 0),
        ("ACTIVE", "State Bank of India", 15000000),
    ]

    for idx, farmer in enumerate(all_farmers[6:], start=7):
        khasra = khasra_numbers[(idx - 7) % len(khasra_numbers)]
        area = Decimal(f"{1.0 + ((idx * 7) % 25) / 10.0:.4f}")  # 1.0000 to 3.4000 ha
        crop = crops_pool[(idx - 7) % len(crops_pool)]
        m_stat, m_bank, m_amt = mortgage_pool[(idx - 7) % len(mortgage_pool)]

        parcels_data.append(
            LandParcel(
                id=f"P-{100 + idx}",
                farmer_id=farmer.id,
                district=farmer.district,
                tehsil=farmer.tehsil,
                village=farmer.village,
                village_code=f"V-{idx:02d}",
                khasra_no=khasra,
                area_ha=area,
                girdawari_crop=crop,
                girdawari_ha=area,
                co_owners_json=json.dumps([{"owner_name": farmer.name_en, "share_fraction": 1.0}]),
                mortgage_status=m_stat,
                mortgage_bank=m_bank,
                mortgage_amount_paise=m_amt,
            )
        )

    db.add_all(parcels_data)
    db.flush()

    # ─────────────────────────────────────────────────────────────────
    # 3. Loans (Cooperative & Commercial / RRB)
    # ─────────────────────────────────────────────────────────────────
    loans_data = [
        # F-001 on P-101: Closed timely loan (Zero active duplicate KCC)
        Loan(
            id="L-201",
            farmer_id="F-001",
            parcel_id="P-101",
            lender_type="PACS_COOP",
            bank_name="आरंग प्राथमिक कृषि साख समिति (PACS)",
            loan_type="KCC",
            status="CLOSED",
            principal_paise=15000000,  # ₹1,50,000
            interest_charged_paise=0,   # 0%
            disbursement_date=date(2025, 4, 1),
            due_date=date(2026, 3, 31),
            actual_repayment_date=date(2026, 3, 10),
            is_repaid_timely=True,
            is_kcc=True,
            is_active=False,
            is_subsidised=True,
        ),
        # F-002 on P-102: Commercial loan
        Loan(
            id="L-202",
            farmer_id="F-002",
            parcel_id="P-102",
            lender_type="COMMERCIAL",
            bank_name="State Bank of India (पाटन शाखा)",
            loan_type="KCC",
            status="CLOSED",
            principal_paise=20000000,  # ₹2,00,000
            interest_charged_paise=1400000,
            disbursement_date=date(2025, 4, 1),
            due_date=date(2026, 3, 31),
            actual_repayment_date=date(2026, 3, 15),
            is_repaid_timely=True,
            is_kcc=True,
            is_active=False,
            is_subsidised=True,
        ),
        # F-004 on P-104: Amber Case parcel (Zero active duplicate KCC)
        Loan(
            id="L-204",
            farmer_id="F-004",
            parcel_id="P-104",
            lender_type="COMMERCIAL_RRB",
            bank_name="Chhattisgarh Rajya Gramin Bank (डोंगरगांव)",
            loan_type="KCC",
            status="CLOSED",
            principal_paise=16000000,
            interest_charged_paise=640000,
            disbursement_date=date(2025, 5, 1),
            due_date=date(2026, 4, 30),
            actual_repayment_date=date(2026, 4, 20),
            is_repaid_timely=True,
            is_kcc=True,
            is_active=False,
            is_subsidised=True,
        ),
        # F-005 on P-105: Active subsidized KCC
        Loan(
            id="L-205",
            farmer_id="F-005",
            parcel_id="P-105",
            lender_type="PACS_COOP",
            bank_name="पिथौरा जिला सहकारी बैंक",
            loan_type="KCC",
            status="ACTIVE",
            principal_paise=18000000,  # ₹1,80,000
            interest_charged_paise=0,
            disbursement_date=date(2025, 6, 1),
            due_date=date(2026, 5, 31),
            actual_repayment_date=None,
            is_repaid_timely=True,
            is_kcc=True,
            is_active=True,
            is_subsidised=True,
        ),
        # RED CASE LOAN: Active ₹1,80,000 KCC on Raipur Khasra 1087/2 at Raipur District Cooperative Bank
        Loan(
            id="L-RED-1087",
            farmer_id="F-RED-01",
            parcel_id="P-RED-1087",
            lender_type="PACS_COOP",
            bank_name="Raipur District Cooperative Bank",
            loan_type="KCC",
            status="ACTIVE",
            principal_paise=18000000,  # ₹1,80,000 active KCC
            interest_charged_paise=0,
            disbursement_date=date(2025, 7, 1),
            due_date=date(2026, 6, 30),
            actual_repayment_date=None,
            is_repaid_timely=True,
            is_kcc=True,
            is_active=True,
            is_subsidised=True,
        ),
    ]

    # Additional active/closed loans on other parcels
    banks_list = [
        ("Chhattisgarh Rajya Gramin Bank", "COMMERCIAL_RRB"),
        ("Raipur District Cooperative Bank", "PACS_COOP"),
        ("Dhamtari District Cooperative Bank", "PACS_COOP"),
        ("State Bank of India", "COMMERCIAL_RRB"),
        ("Punjab National Bank", "COMMERCIAL_RRB"),
        ("Bank of Baroda", "COMMERCIAL_RRB"),
    ]

    for idx, p in enumerate(parcels_data[6:], start=6):
        b_name, l_type = banks_list[idx % len(banks_list)]
        # Make roughly 30% active loans
        is_act = (idx % 3 == 0)
        p_amt = 12000000 + (idx % 10) * 1500000
        loans_data.append(
            Loan(
                id=f"L-{300 + idx}",
                farmer_id=p.farmer_id,
                parcel_id=p.id,
                lender_type=l_type,
                bank_name=b_name,
                loan_type="KCC",
                status="ACTIVE" if is_act else "CLOSED",
                principal_paise=p_amt,
                interest_charged_paise=int(p_amt * 0.04) if l_type == "COMMERCIAL_RRB" else 0,
                disbursement_date=date(2025, 5, 10),
                due_date=date(2026, 5, 9),
                actual_repayment_date=None if is_act else date(2026, 4, 1),
                is_repaid_timely=True,
                is_kcc=True,
                is_active=is_act,
                is_subsidised=True,
            )
        )

    db.add_all(loans_data)
    db.flush()

    # ─────────────────────────────────────────────────────────────────
    # 4. Procurement Records
    # ─────────────────────────────────────────────────────────────────
    procurements_data = [
        # F-001: 63 qtl paddy sold. MSP paid, KUY (₹41,517) overdue by 18 days!
        Procurement(
            id="PR-301",
            farmer_id="F-001",
            parcel_id="P-101",
            crop="Paddy",
            quantity_quintals=Decimal("63.00"),
            moisture_pct=Decimal("15.20"),
            grade="Common",
            msp_paid_paise=15378300,  # ₹1,53,783 credited
            kuy_paid_paise=0,         # ₹0 credited (Overdue!)
            kuy_expected_release_date=date(2026, 3, 1),  # Ref date is 2026-03-19 (18 days overdue)
            procurement_date=date(2026, 2, 15),
            mandi_receipt_no="MANDI-RAI-2026-8812",
        ),
        # F-004: 80 qtl paddy offered with high moisture 17.8% (Amber alert)
        Procurement(
            id="PR-304",
            farmer_id="F-004",
            parcel_id="P-104",
            crop="Paddy",
            quantity_quintals=Decimal("80.00"),
            moisture_pct=Decimal("17.80"),
            grade="Common",
            msp_paid_paise=0,
            kuy_paid_paise=0,
            kuy_expected_release_date=date(2026, 3, 25),
            procurement_date=date(2026, 3, 10),
            mandi_receipt_no="MANDI-RAJ-2026-4401",
        ),
    ]
    db.add_all(procurements_data)
    db.flush()

    # ─────────────────────────────────────────────────────────────────
    # 5. Insurance Units (PMFBY)
    # ─────────────────────────────────────────────────────────────────
    insurance_data = [
        InsuranceUnit(
            id="INS-403",
            village_code="मस्तूरी",
            parcel_id="P-103",
            crop="Paddy",
            season="Kharif",
            sum_insured_per_ha_paise=5000000,
            average_yield_kg=Decimal("2777.78"),
            indemnity_level=Decimal("0.90"),
            cce_yield_kg=Decimal("1800.00"),
            cutoff_date=date(2025, 12, 31),
            insured_ha=Decimal("0.8000"),
        ),
        InsuranceUnit(
            id="INS-401",
            village_code="सिल्ली",
            parcel_id="P-101",
            crop="Paddy",
            season="Kharif",
            sum_insured_per_ha_paise=5000000,
            average_yield_kg=Decimal("3000.00"),
            indemnity_level=Decimal("0.90"),
            cce_yield_kg=Decimal("3100.00"),
            cutoff_date=date(2025, 12, 31),
            insured_ha=Decimal("1.2140"),
        ),
    ]
    db.add_all(insurance_data)
    db.flush()

    # ─────────────────────────────────────────────────────────────────
    # 6. Bank Loan Applications
    # ─────────────────────────────────────────────────────────────────
    bank_apps_data = [
        BankApplication(
            id="APP-501",
            farmer_id="F-001",
            applicant_name="Ramesh Patel",
            applicant_father="Shyama Charan Patel",
            applicant_mobile="9876543210",
            parcel_id="P-101",
            lender_name="Chhattisgarh Rajya Gramin Bank",
            loan_type="KCC",
            requested_paise=15000000,
            status="APPROVED",
            match_score=100.0,
            match_band="GREEN",
            match_reasons_json="[]",
            audit_hash="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            officer_id="STAFF-EMP-2041",
            decided_at=datetime(2026, 11, 20, 11, 0, tzinfo=timezone.utc),
        ),
        BankApplication(
            id="APP-502",
            farmer_id="F-004",
            applicant_name="Vikram Sinh",
            applicant_father="Balwant Singh",
            applicant_mobile="9876543213",
            parcel_id="P-104",
            lender_name="Chhattisgarh Rajya Gramin Bank",
            loan_type="KCC",
            requested_paise=16000000,
            status="HELD",
            match_score=85.5,
            match_band="AMBER",
            match_reasons_json=json.dumps(["IDENTITY_SPELLING_REVIEW"]),
            audit_hash="1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            officer_id="STAFF-EMP-2041",
            decided_at=datetime(2026, 11, 21, 14, 30, tzinfo=timezone.utc),
        ),
        BankApplication(
            id="APP-503",
            farmer_id="F-RED-01",
            applicant_name="Rakesh Sahu",
            applicant_father="Ganesh Sahu",
            applicant_mobile="9876543299",
            parcel_id="P-RED-1087",
            lender_name="Raipur District Cooperative Bank",
            loan_type="KCC",
            requested_paise=25000000,
            status="REJECTED",
            match_score=62.0,
            match_band="RED",
            match_reasons_json=json.dumps(["IDENTITY_MISMATCH", "DUPLICATE_ACTIVE_KCC_MISS"]),
            audit_hash="2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            officer_id="STAFF-EMP-2041",
            decided_at=datetime(2026, 11, 22, 16, 0, tzinfo=timezone.utc),
        ),
    ]
    db.add_all(bank_apps_data)
    db.flush()

    # ─────────────────────────────────────────────────────────────────
    # 7. Grievance Cases
    # ─────────────────────────────────────────────────────────────────
    cases_data = [
        Case(
            id="CASE-2026-0042",
            case_ref_no="CG-RAI-2026-0042",
            farmer_id="F-001",
            parcel_id="P-101",
            authority_name="जिला विपणन अधिकारी (खाद्य विभाग)",
            authority_designation="District Procurement Officer",
            scheme_id="KUY_2026",
            status="LETTER_GENERATED",
            entitled_paise=4151700,
            actual_paise=0,
            gap_paise=4151700,
            details="कृषक उन्नति योजना बोनस अंतर राशि 18 दिनों से लंबित है।",
            verification_hash="7a4b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6789",
            created_at=datetime(2026, 3, 19, 10, 30, tzinfo=timezone.utc),
        ),
    ]
    db.add_all(cases_data)
    db.flush()

    # ─────────────────────────────────────────────────────────────────
    # 8. Rejections table
    # ─────────────────────────────────────────────────────────────────
    rejections_data = [
        Rejection(
            id="REJ-503",
            application_id="APP-503",
            farmer_id="F-RED-01",
            parcel_id="P-RED-1087",
            khasra_no="1087/2",
            applicant_name="Rakesh Sahu",
            decision="REJECTED",
            reason_hi="आवेदक नाम/पिता का नाम भू-अभिलेख से भिन्न है तथा खसरे पर पूर्व से ₹1,80,000 का सक्रिय केसीसी ऋण दर्ज है।",
            reason_en="Applicant and father name mismatch with land registry records and duplicate active KCC loan of ₹1,80,000 exists on this parcel.",
            flags_json=json.dumps(["IDENTITY_MISMATCH", "DUPLICATE_ACTIVE_KCC_MISS"]),
            officer_notes="Duplicate KCC violation detected via MISS cross-bank registry. Blocked.",
            officer_id="STAFF-EMP-2041",
            created_at=datetime(2026, 3, 18, 14, 20, tzinfo=timezone.utc),
        )
    ]
    db.add_all(rejections_data)
    db.flush()

    # ─────────────────────────────────────────────────────────────────
    # 9. Audit Events (Hash Chaining)
    # ─────────────────────────────────────────────────────────────────
    # Pre-populate audit events for the demo decisions
    audit_service.append_event(
        actor="STAFF-EMP-2041",
        action="BANK_VERDICT_APPROVED",
        payload={"application_id": "APP-501", "decision": "APPROVED", "khasra": "142/1"},
        subject="P-101",
    )
    audit_service.append_event(
        actor="STAFF-EMP-2041",
        action="BANK_VERDICT_HELD",
        payload={"application_id": "APP-502", "decision": "FLAGGED_REVIEW", "khasra": "45/2"},
        subject="P-104",
    )
    audit_service.append_event(
        actor="STAFF-EMP-2041",
        action="BANK_VERDICT_REJECTED",
        payload={"application_id": "APP-503", "decision": "REJECTED", "khasra": "1087/2"},
        subject="P-RED-1087",
    )

    for entry in audit_service.entries:
        audit_event = AuditEvent(
            prev_hash=entry.prev_hash,
            entry_hash=entry.entry_hash,
            actor=entry.actor,
            subject=entry.subject,
            action=entry.action,
            payload_json=json.dumps(entry.payload),
            timestamp=datetime.fromisoformat(entry.timestamp),
        )
        db.add(audit_event)

    db.commit()
    print(f"Database successfully seeded with {len(all_farmers)} Farmers, {len(parcels_data)} Parcels, {len(loans_data)} Loans, and {len(staff_data)} Staff Officers.")


if __name__ == "__main__":
    session = SessionLocal()
    try:
        seed_database(session)
    finally:
        session.close()
