import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import MAX_UPLOAD_MB, UPLOAD_DIR
from ..database import get_db
from ..models import Department, Issue, User
from ..schemas import (
    AIClosureOut,
    AIResponseBriefOut,
    AITranslateOut,
    AITranslateRequest,
    AssignmentRequest,
    IssueOut,
    StatusRequest,
)
from ..services.ai import (
    CATEGORIES,
    DEPARTMENTS,
    analyze_report,
    generate_closure_message,
    generate_response_brief,
    translate_text,
)
from ..services.geo import find_possible_duplicate


router = APIRouter(prefix="/api/issues", tags=["Issues"])

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

ALLOWED_CATEGORIES = {"Auto Detect", *CATEGORIES}
ALLOWED_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
ALLOWED_STATUSES = {"REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"}


def _require_admin(user_id: int, db: Session) -> User:
    user = db.get(User, user_id)
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return user


def _require_user(user_id: int, db: Session) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Requester account not found.")
    return user


def issue_to_response(issue: Issue) -> IssueOut:
    return IssueOut(
        id=issue.id,
        user_id=issue.user_id,
        reporter_name=issue.reporter.name if issue.reporter else None,
        category=issue.category,
        description=issue.description,
        photo_url=issue.photo_url,
        latitude=issue.latitude,
        longitude=issue.longitude,
        flag=issue.flag,
        priority=issue.priority,
        department_id=issue.department_id,
        department_name=issue.department.name if issue.department else None,
        status=issue.status,
        ai_category=issue.ai_category,
        ai_priority=issue.ai_priority,
        ai_summary=issue.ai_summary,
        ai_reason=issue.ai_reason,
        ai_emergency_risk=issue.ai_emergency_risk,
        ai_status=issue.ai_status,
        duplicate_of_id=issue.duplicate_of_id,
        created_at=issue.created_at,
        updated_at=issue.updated_at,
        resolved_at=issue.resolved_at,
    )


async def save_photo(photo: UploadFile) -> tuple[str, str]:
    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WEBP images are allowed.",
        )

    data = await photo.read()
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024

    if len(data) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Image must be {MAX_UPLOAD_MB} MB or smaller.",
        )

    extension = ALLOWED_IMAGE_TYPES[photo.content_type]
    filename = f"{uuid.uuid4().hex}{extension}"
    target = UPLOAD_DIR / filename
    target.write_bytes(data)

    return f"/uploads/{filename}", str(target)


@router.post("", response_model=IssueOut)
async def create_issue(
    user_id: int = Form(...),
    category: str = Form(...),
    description: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    photo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category.")

    if not description.strip():
        raise HTTPException(status_code=400, detail="Description is required.")

    if not -90 <= latitude <= 90:
        raise HTTPException(status_code=400, detail="Invalid latitude.")

    if not -180 <= longitude <= 180:
        raise HTTPException(status_code=400, detail="Invalid longitude.")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    photo_url = None
    image_path = None

    if photo:
        photo_url, image_path = await save_photo(photo)

    issue = Issue(
        user_id=user_id,
        category="Other" if category == "Auto Detect" else category,
        description=description.strip(),
        photo_url=photo_url,
        latitude=latitude,
        longitude=longitude,
        flag="GREEN",
        priority="MEDIUM",
        status="REPORTED",
    )

    db.add(issue)
    db.commit()
    db.refresh(issue)

    analysis = await analyze_report(
        description=description.strip(),
        category=category,
        image_path=image_path,
    )

    issue.ai_category = analysis["suggested_category"]
    issue.flag = analysis["flag"]
    issue.ai_priority = analysis["suggested_priority"]
    issue.ai_summary = analysis["summary"]
    issue.ai_reason = analysis["reason"]
    issue.ai_emergency_risk = analysis["emergency_risk"]
    issue.ai_status = analysis["ai_status"]

    if category == "Auto Detect":
        issue.category = analysis["suggested_category"]

    db.commit()
    db.refresh(issue)

    duplicate, distance = find_possible_duplicate(db, issue)

    if duplicate:
        issue.duplicate_of_id = duplicate.id
        db.commit()
        db.refresh(issue)

    return issue_to_response(issue)


@router.get("", response_model=list[IssueOut])
def get_issues(
    category: str | None = None,
    flag: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    query = select(Issue)

    if category:
        query = query.where(Issue.category == category)

    if flag:
        query = query.where(Issue.flag == flag)

    if status:
        query = query.where(Issue.status == status)

    if priority:
        query = query.where(Issue.priority == priority)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(Issue.description.ilike(pattern))

    query = query.order_by(Issue.created_at.desc())
    issues = db.scalars(query).all()

    return [issue_to_response(issue) for issue in issues]


@router.get("/user/{user_id}", response_model=list[IssueOut])
def get_user_issues(user_id: int, db: Session = Depends(get_db)):
    issues = db.scalars(
        select(Issue)
        .where(Issue.user_id == user_id)
        .order_by(Issue.created_at.desc())
    ).all()

    return [issue_to_response(issue) for issue in issues]


@router.get("/{issue_id}", response_model=IssueOut)
def get_issue(issue_id: int, db: Session = Depends(get_db)):
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    return issue_to_response(issue)


@router.get("/{issue_id}/duplicates")
def get_duplicates(issue_id: int, db: Session = Depends(get_db)):
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    duplicate, distance = find_possible_duplicate(db, issue)

    if not duplicate:
        return {"possible_duplicate": False}

    return {
        "possible_duplicate": True,
        "issue_id": duplicate.id,
        "distance_meters": round(distance or 0, 1),
        "category": duplicate.category,
        "latitude": duplicate.latitude,
        "longitude": duplicate.longitude,
    }


@router.get("/{issue_id}/ai-brief", response_model=AIResponseBriefOut)
async def get_ai_response_brief(
    issue_id: int,
    requester_id: int,
    db: Session = Depends(get_db),
):
    _require_admin(requester_id, db)
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    image_path = None
    if issue.photo_url:
        image_path = str(UPLOAD_DIR / Path(issue.photo_url).name)

    result = await generate_response_brief(
        category=issue.category,
        description=issue.description,
        flag=issue.flag,
        priority=issue.priority,
        status=issue.status,
        ai_summary=issue.ai_summary or "",
        image_path=image_path,
    )

    return result


@router.post("/{issue_id}/ai-reanalyze", response_model=IssueOut)
async def reanalyze_issue(
    issue_id: int,
    admin_user_id: int,
    db: Session = Depends(get_db),
):
    _require_admin(admin_user_id, db)
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    image_path = None
    if issue.photo_url:
        image_path = str(UPLOAD_DIR / Path(issue.photo_url).name)

    analysis = await analyze_report(
        description=issue.description,
        category=issue.category,
        image_path=image_path,
    )

    issue.ai_category = analysis["suggested_category"]
    issue.flag = analysis["flag"]
    issue.ai_priority = analysis["suggested_priority"]
    issue.ai_summary = analysis["summary"]
    issue.ai_reason = analysis["reason"]
    issue.ai_emergency_risk = analysis["emergency_risk"]
    issue.ai_status = analysis["ai_status"]

    if issue.category == "Other":
        issue.category = analysis["suggested_category"]

    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)


@router.get("/{issue_id}/ai-closure", response_model=AIClosureOut)
async def get_ai_closure_message(
    issue_id: int,
    requester_id: int,
    db: Session = Depends(get_db),
):
    requester = _require_user(requester_id, db)
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    if issue.status != "RESOLVED":
        raise HTTPException(status_code=400, detail="Closure messages are available only for resolved incidents.")

    if requester.role == "citizen" and issue.user_id != requester.id:
        raise HTTPException(status_code=403, detail="Citizens can only access closure messages for their own incidents.")

    return await generate_closure_message(
        category=issue.category,
        description=issue.description,
        priority=issue.priority,
        flag=issue.flag,
        resolved_at=issue.resolved_at,
    )


@router.post("/{issue_id}/ai-translate", response_model=AITranslateOut)
async def translate_issue_text(
    issue_id: int,
    payload: AITranslateRequest,
    requester_id: int,
    db: Session = Depends(get_db),
):
    requester = _require_user(requester_id, db)
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    if requester.role == "citizen" and issue.user_id != requester.id:
        raise HTTPException(status_code=403, detail="Citizens can translate only their own incident text.")

    return await translate_text(payload.text, payload.target_language)


@router.delete("/{issue_id}")
def delete_issue(
    issue_id: int,
    requester_id: int,
    db: Session = Depends(get_db),
):
    requester = _require_user(requester_id, db)

    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    if issue.status != "RESOLVED":
        raise HTTPException(
            status_code=400,
            detail="Only resolved incidents can be deleted.",
        )

    if requester.role == "citizen" and issue.user_id != requester.id:
        raise HTTPException(
            status_code=403,
            detail="Citizens can delete only their own resolved incidents.",
        )

    # Clear duplicate references before deleting the resolved issue.
    children = db.scalars(
        select(Issue).where(Issue.duplicate_of_id == issue.id)
    ).all()
    for child in children:
        child.duplicate_of_id = None

    if issue.photo_url:
        photo_path = UPLOAD_DIR / Path(issue.photo_url).name
        try:
            if photo_path.exists():
                photo_path.unlink()
        except OSError:
            pass

    db.delete(issue)
    db.commit()

    return {
        "deleted": True,
        "issue_id": issue_id,
        "message": "Resolved incident deleted successfully.",
    }


@router.put("/{issue_id}/assign", response_model=IssueOut)
def assign_issue(
    issue_id: int,
    payload: AssignmentRequest,
    admin_user_id: int,
    db: Session = Depends(get_db),
):
    _require_admin(admin_user_id, db)

    if payload.priority not in ALLOWED_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid priority.")

    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    department = db.get(Department, payload.department_id)
    if not department:
        raise HTTPException(status_code=404, detail="Department not found.")

    issue.department_id = payload.department_id
    issue.priority = payload.priority

    if issue.status == "REPORTED":
        issue.status = "ASSIGNED"

    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)


@router.put("/{issue_id}/status", response_model=IssueOut)
def update_status(
    issue_id: int,
    payload: StatusRequest,
    admin_user_id: int,
    db: Session = Depends(get_db),
):
    _require_admin(admin_user_id, db)

    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status.")

    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")

    allowed_transitions = {
        "REPORTED": {"ASSIGNED"},
        "ASSIGNED": {"IN_PROGRESS"},
        "IN_PROGRESS": {"RESOLVED"},
        "RESOLVED": set(),
    }

    if payload.status != issue.status and payload.status not in allowed_transitions[issue.status]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition: {issue.status} -> {payload.status}",
        )

    issue.status = payload.status

    if issue.status == "RESOLVED" and issue.resolved_at is None:
        issue.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(issue)
    return issue_to_response(issue)
