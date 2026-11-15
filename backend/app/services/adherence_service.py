from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models import MedicationLog, DoseStatus
from app.schemas import AdherenceStats


def calculate_adherence_stats(db: Session, elder_id: int, days_back: int = 14) -> AdherenceStats:
    """
    Calculates precise medication adherence:
    Formula: (Taken Scheduled Doses / Total Scheduled Past/Due Doses) * 100
    Strictly excludes future doses from adherence calculation.
    """
    today = date.today()
    start_date = today - timedelta(days=days_back)
    current_time_str = datetime.now(timezone.utc).strftime("%H:%M")

    # Fetch logs in range
    logs = db.query(MedicationLog).filter(
        MedicationLog.elder_id == elder_id,
        MedicationLog.scheduled_date >= start_date,
        MedicationLog.scheduled_date <= today
    ).order_by(MedicationLog.scheduled_date.asc(), MedicationLog.scheduled_time.asc()).all()

    total_past_scheduled = 0
    taken_count = 0
    skipped_count = 0
    missed_count = 0
    pending_future_count = 0

    daily_map: Dict[str, Dict[str, int]] = {}
    for i in range(days_back + 1):
        d = (start_date + timedelta(days=i)).isoformat()
        daily_map[d] = {"taken": 0, "skipped": 0, "missed": 0, "total_due": 0}

    for log in logs:
        d_str = log.scheduled_date.isoformat()
        is_today = log.scheduled_date == today
        is_future_today = is_today and (log.scheduled_time > current_time_str)

        if is_future_today and log.status == DoseStatus.PENDING:
            # Future dose today that has not yet arrived
            pending_future_count += 1
            continue

        # Past or due dose
        total_past_scheduled += 1
        if d_str in daily_map:
            daily_map[d_str]["total_due"] += 1

        if log.status == DoseStatus.TAKEN:
            taken_count += 1
            if d_str in daily_map:
                daily_map[d_str]["taken"] += 1
        elif log.status == DoseStatus.SKIPPED:
            skipped_count += 1
            if d_str in daily_map:
                daily_map[d_str]["skipped"] += 1
        elif log.status == DoseStatus.MISSED:
            missed_count += 1
            if d_str in daily_map:
                daily_map[d_str]["missed"] += 1
        elif log.status == DoseStatus.PENDING:
            # Overdue pending dose counts as missed / overdue
            missed_count += 1
            if d_str in daily_map:
                daily_map[d_str]["missed"] += 1

    adherence_pct = 100.0
    if total_past_scheduled > 0:
        adherence_pct = round((taken_count / total_past_scheduled) * 100, 1)

    # Format daily history for Recharts
    daily_history: List[Dict[str, Any]] = []
    for d_str, counts in sorted(daily_map.items()):
        due = counts["total_due"]
        t = counts["taken"]
        pct = round((t / due * 100), 1) if due > 0 else 100.0
        # Parse friendly label e.g. "Mon 11/15"
        dt = date.fromisoformat(d_str)
        day_label = dt.strftime("%a %b %d")

        daily_history.append({
            "date": d_str,
            "label": day_label,
            "adherence_rate": pct,
            "taken": t,
            "skipped": counts["skipped"],
            "missed": counts["missed"],
            "total_due": due
        })

    # Weekly history (aggregate into past 4 weeks)
    weekly_history: List[Dict[str, Any]] = []
    chunk_size = 7
    for i in range(0, len(daily_history), chunk_size):
        chunk = daily_history[i:i + chunk_size]
        if not chunk:
            continue
        c_taken = sum(c["taken"] for c in chunk)
        c_due = sum(c["total_due"] for c in chunk)
        w_pct = round((c_taken / c_due * 100), 1) if c_due > 0 else 100.0
        weekly_history.append({
            "week_label": f"Week {len(weekly_history) + 1} ({chunk[0]['label']})",
            "adherence_rate": w_pct,
            "taken": c_taken,
            "total_due": c_due
        })

    # Trend detection
    trend = "stable"
    if len(daily_history) >= 6:
        first_half = daily_history[:len(daily_history)//2]
        second_half = daily_history[len(daily_history)//2:]
        avg1 = sum(x["adherence_rate"] for x in first_half) / max(len(first_half), 1)
        avg2 = sum(x["adherence_rate"] for x in second_half) / max(len(second_half), 1)
        if avg2 - avg1 > 5:
            trend = "improving"
        elif avg1 - avg2 > 5:
            trend = "declining"

    return AdherenceStats(
        adherence_percentage=adherence_pct,
        total_scheduled=total_past_scheduled,
        taken_count=taken_count,
        skipped_count=skipped_count,
        missed_count=missed_count,
        pending_count=pending_future_count,
        daily_history=daily_history,
        weekly_history=weekly_history,
        trend=trend
    )

