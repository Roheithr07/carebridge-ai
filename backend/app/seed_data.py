from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models import (
    User, ElderlyProfile, Medication, MedicationSchedule, MedicationLog,
    Appointment, PatientAccess, Notification, ActivityLog,
    UserRole, MedicationStatus, DoseStatus, AppointmentStatus, AccessStatus,
    NotificationType, ActionType
)
from app.core.security import get_password_hash


def seed_demo_database():
    """Seeds rich, realistic demo data for the Catalyst Hackathon 2026."""
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # Check if already seeded
        existing_elder = db.query(User).filter(User.email == "eleanor@carebridge.com").first()
        if existing_elder:
            print("Database already contains demo seed data.")
            return

        print("Seeding CareBridge AI with realistic hackathon demo data...")

        now = datetime.now(timezone.utc)
        today = date.today()

        # 1. Elderly User: Eleanor Vance
        pw_hash = get_password_hash("Password123!")
        elder_user = User(
            email="eleanor@carebridge.com",
            hashed_password=pw_hash,
            full_name="Eleanor Vance",
            phone_number="+1 (555) 782-9901",
            role=UserRole.ELDERLY,
            is_active=True,
            created_at=now - timedelta(days=30)
        )
        db.add(elder_user)
        db.flush()

        # Elderly Profile
        elder_profile = ElderlyProfile(
            user_id=elder_user.id,
            share_code="CB-849201",
            date_of_birth=date(1948, 6, 15),
            blood_group="O+",
            emergency_contact_name="Sarah Vance (Daughter)",
            emergency_contact_phone="+1 (555) 234-5678",
            medical_conditions="Hypertension, Type 2 Diabetes, Mild Osteoarthritis",
            allergies="Penicillin, Sulfa antibiotics",
            preferred_hospital="Mercy Memorial Health Center",
            notes="Prefers taking morning medication with fresh oatmeal. Keep hydration tracker active.",
            created_at=now - timedelta(days=30)
        )
        db.add(elder_profile)
        db.flush()

        # 2. Family User: Sarah Vance
        family_user = User(
            email="sarah@carebridge.com",
            hashed_password=pw_hash,
            full_name="Sarah Vance",
            phone_number="+1 (555) 234-5678",
            role=UserRole.FAMILY,
            is_active=True,
            created_at=now - timedelta(days=25)
        )
        db.add(family_user)
        db.flush()

        # 3. Caregiver User: David Miller
        caregiver_user = User(
            email="david@carebridge.com",
            hashed_password=pw_hash,
            full_name="Nurse David Miller, RN",
            phone_number="+1 (555) 890-1234",
            role=UserRole.CAREGIVER,
            is_active=True,
            created_at=now - timedelta(days=20)
        )
        db.add(caregiver_user)
        db.flush()

        # 4. Patient Access Connections
        access_family = PatientAccess(
            elder_id=elder_profile.id,
            user_id=family_user.id,
            relationship_label="Daughter",
            role=UserRole.FAMILY,
            status=AccessStatus.ACTIVE,
            permissions="view_and_manage",
            access_code_used="CB-849201",
            granted_at=now - timedelta(days=25)
        )
        access_caregiver = PatientAccess(
            elder_id=elder_profile.id,
            user_id=caregiver_user.id,
            relationship_label="Visiting Home Nurse",
            role=UserRole.CAREGIVER,
            status=AccessStatus.ACTIVE,
            permissions="view_and_manage",
            access_code_used="CB-849201",
            granted_at=now - timedelta(days=20)
        )
        db.add_all([access_family, access_caregiver])

        # 5. Medications & Schedules
        meds_data = [
            {
                "name": "Lisinopril",
                "dosage": "10mg",
                "frequency": "Once daily",
                "instructions": "Take in the morning with a full glass of water. Monitor blood pressure.",
                "prescribing_doctor": "Dr. Robert Hayes",
                "schedules": [("08:00", "Morning", "1 tablet")]
            },
            {
                "name": "Metformin",
                "dosage": "500mg",
                "frequency": "Twice daily",
                "instructions": "Take immediately after meals to reduce stomach sensitivity.",
                "prescribing_doctor": "Dr. Evelyn Reed",
                "schedules": [("08:30", "Morning", "1 tablet"), ("19:00", "Evening", "1 tablet")]
            },
            {
                "name": "Atorvastatin",
                "dosage": "20mg",
                "frequency": "Once daily",
                "instructions": "Take before bedtime. Avoid grapefruit products.",
                "prescribing_doctor": "Dr. Robert Hayes",
                "schedules": [("21:00", "Bedtime", "1 tablet")]
            },
            {
                "name": "Glucosamine Chondroitin",
                "dosage": "1500mg",
                "frequency": "Once daily",
                "instructions": "Joint support supplement with lunch.",
                "prescribing_doctor": "Dr. Evelyn Reed",
                "schedules": [("13:00", "Afternoon", "2 capsules")]
            }
        ]

        created_meds = []
        for m_data in meds_data:
            med = Medication(
                elder_id=elder_profile.id,
                name=m_data["name"],
                dosage=m_data["dosage"],
                frequency=m_data["frequency"],
                instructions=m_data["instructions"],
                prescribing_doctor=m_data["prescribing_doctor"],
                status=MedicationStatus.ACTIVE,
                start_date=today - timedelta(days=28)
            )
            db.add(med)
            db.flush()

            for s_time, s_label, s_qty in m_data["schedules"]:
                sched = MedicationSchedule(
                    medication_id=med.id,
                    elder_id=elder_profile.id,
                    time_of_day=s_time,
                    label=s_label,
                    days_of_week="all",
                    dose_quantity=s_qty,
                    is_active=True
                )
                db.add(sched)
            created_meds.append(med)

        db.flush()

        # 6. Past 14 Days Medication Logs
        print("Generating historical medication logs for adherence analytics...")
        for day_offset in range(14, 0, -1):
            log_date = today - timedelta(days=day_offset)
            for med in created_meds:
                for sched in med.schedules:
                    # Realistic adherence: ~88% taken, some skipped or missed on day 3 & day 8
                    status_choice = DoseStatus.TAKEN
                    note = None
                    if day_offset == 3 and sched.time_of_day == "19:00":
                        status_choice = DoseStatus.MISSED
                        note = "Fell asleep early after family dinner."
                    elif day_offset == 7 and sched.time_of_day == "13:00":
                        status_choice = DoseStatus.SKIPPED
                        note = "Mild stomach upset, doctor advised skipping midday supplement."
                    elif day_offset == 11 and sched.time_of_day == "21:00":
                        status_choice = DoseStatus.MISSED
                        note = "Forgot evening dose before bed."

                    action_dt = datetime.combine(log_date, datetime.strptime(sched.time_of_day, "%H:%M").time()).replace(tzinfo=timezone.utc)
                    mlog = MedicationLog(
                        medication_id=med.id,
                        schedule_id=sched.id,
                        elder_id=elder_profile.id,
                        scheduled_date=log_date,
                        scheduled_time=sched.time_of_day,
                        status=status_choice,
                        action_time=action_dt if status_choice == DoseStatus.TAKEN else None,
                        action_by_user_id=elder_user.id if status_choice == DoseStatus.TAKEN else None,
                        notes=note
                    )
                    db.add(mlog)

        # Today's Logs: morning taken, midday/evening pending
        for med in created_meds:
            for sched in med.schedules:
                if sched.time_of_day in ["08:00", "08:30"]:
                    today_status = DoseStatus.TAKEN
                    a_time = now - timedelta(hours=2)
                else:
                    today_status = DoseStatus.PENDING
                    a_time = None

                mlog_today = MedicationLog(
                    medication_id=med.id,
                    schedule_id=sched.id,
                    elder_id=elder_profile.id,
                    scheduled_date=today,
                    scheduled_time=sched.time_of_day,
                    status=today_status,
                    action_time=a_time,
                    action_by_user_id=elder_user.id if today_status == DoseStatus.TAKEN else None
                )
                db.add(mlog_today)

        # 7. Appointments
        appt1 = Appointment(
            elder_id=elder_profile.id,
            created_by_user_id=family_user.id,
            doctor_name="Dr. Robert Hayes",
            clinic_hospital="Mercy Heart & Vascular Institute, Room 304",
            specialty="Cardiology",
            appointment_date=today + timedelta(days=2),
            appointment_time="10:30",
            appointment_type="Cardiovascular Health & BP Review",
            notes="Bring recorded 14-day blood pressure log and current pill organizer.",
            status=AppointmentStatus.SCHEDULED,
            reminder_sent=True
        )
        appt2 = Appointment(
            elder_id=elder_profile.id,
            created_by_user_id=caregiver_user.id,
            doctor_name="Dr. Evelyn Reed",
            clinic_hospital="St. Jude Endocrinology Specialists",
            specialty="Endocrinology",
            appointment_date=today + timedelta(days=9),
            appointment_time="14:00",
            appointment_type="Diabetes HbA1c Quarterly Evaluation",
            notes="Fasting blood draw scheduled 2 hours prior to consultation.",
            status=AppointmentStatus.SCHEDULED,
            reminder_sent=False
        )
        appt3 = Appointment(
            elder_id=elder_profile.id,
            created_by_user_id=elder_user.id,
            doctor_name="Dr. Patricia Vance",
            clinic_hospital="Westside Optometry Clinic",
            specialty="Ophthalmology",
            appointment_date=today - timedelta(days=12),
            appointment_time="11:00",
            appointment_type="Annual Diabetic Retinal Screening",
            notes="Completed. Retina clear, vision stable.",
            status=AppointmentStatus.COMPLETED,
            reminder_sent=True
        )
        db.add_all([appt1, appt2, appt3])

        # 8. Notifications
        notif1 = Notification(
            user_id=elder_user.id,
            elder_id=elder_profile.id,
            title="Medication Reminder",
            description="Morning dose of Lisinopril (10mg) is confirmed taken.",
            notification_type=NotificationType.MEDICATION_REMINDER,
            is_read=True,
            created_at=now - timedelta(hours=2)
        )
        notif2 = Notification(
            user_id=family_user.id,
            elder_id=elder_profile.id,
            title="Upcoming Appointment Reminder",
            description="Eleanor has a Cardiology appointment with Dr. Robert Hayes in 2 days (10:30 AM).",
            notification_type=NotificationType.APPOINTMENT_REMINDER,
            is_read=False,
            created_at=now - timedelta(hours=5)
        )
        notif3 = Notification(
            user_id=caregiver_user.id,
            elder_id=elder_profile.id,
            title="Care Update: Vitals Stable",
            description="Eleanor Vance's morning adherence logged successfully at 100%.",
            notification_type=NotificationType.CARE_UPDATE,
            is_read=False,
            created_at=now - timedelta(hours=2)
        )
        db.add_all([notif1, notif2, notif3])

        # 9. Activity Logs
        activities = [
            ActivityLog(
                elder_id=elder_profile.id,
                user_id=elder_user.id,
                action_type=ActionType.DOSE_TAKEN,
                description="Dose of Lisinopril (10mg) at 08:00 marked as TAKEN by Eleanor Vance.",
                created_at=now - timedelta(hours=2)
            ),
            ActivityLog(
                elder_id=elder_profile.id,
                user_id=elder_user.id,
                action_type=ActionType.DOSE_TAKEN,
                description="Dose of Metformin (500mg) at 08:30 marked as TAKEN by Eleanor Vance.",
                created_at=now - timedelta(hours=1, minutes=30)
            ),
            ActivityLog(
                elder_id=elder_profile.id,
                user_id=family_user.id,
                action_type=ActionType.APPOINTMENT_CREATED,
                description="Sarah Vance scheduled an appointment with Dr. Robert Hayes (Cardiology) for Eleanor.",
                created_at=now - timedelta(days=1)
            ),
            ActivityLog(
                elder_id=elder_profile.id,
                user_id=caregiver_user.id,
                action_type=ActionType.CARE_NOTE_ADDED,
                description="Nurse David Miller reviewed morning blood sugar records (112 mg/dL - Normal).",
                created_at=now - timedelta(days=2)
            ),
            ActivityLog(
                elder_id=elder_profile.id,
                user_id=family_user.id,
                action_type=ActionType.ACCESS_GRANTED,
                description="Sarah Vance (Daughter) connected using passcode CB-849201.",
                created_at=now - timedelta(days=25)
            )
        ]
        db.add_all(activities)

        db.commit()
        print("Demo seed data created successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding demo database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_database()

