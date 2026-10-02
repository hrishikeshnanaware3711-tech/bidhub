from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Department, Issue, User
from ..schemas import AIQuestionRequest
from ..services.ai import answer_admin_question, cluster_incidents, generate_area_brief
from .issues import issue_to_response

router = APIRouter(prefix="/api/admin", tags=["Admin"])


def require_admin(admin_user_id: int, db: Session) -> User:
    user = db.get(User, admin_user_id)
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return user


def _live_context(issues: list[Issue]) -> str:
    lines = []
    for issue in issues[:80]:
        lines.append(
            f"#{issue.id} | {issue.category} | flag={issue.flag} | priority={issue.priority} | "
            f"status={issue.status} | department={issue.department.name if issue.department else 'Unassigned'} | "
            f"lat={issue.latitude:.5f} | lon={issue.longitude:.5f} | description={issue.description[:240]}"
        )
    return "\n".join(lines)


@router.get("/issues")
def get_active_admin_issues(
    admin_user_id: int,
    flag: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    require_admin(admin_user_id, db)

    query = select(Issue).where(Issue.status != "RESOLVED")

    if flag:
        query = query.where(Issue.flag == flag)
    if status:
        query = query.where(Issue.status == status)
    if priority:
        query = query.where(Issue.priority == priority)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Issue.description.ilike(pattern),
                Issue.category.ilike(pattern),
            )
        )

    issues = db.scalars(query.order_by(Issue.created_at.desc())).all()
    return [issue_to_response(issue) for issue in issues]


@router.get("/resolved")
def get_resolved_admin_issues(
    admin_user_id: int,
    db: Session = Depends(get_db),
):
    require_admin(admin_user_id, db)
    issues = db.scalars(
        select(Issue)
        .where(Issue.status == "RESOLVED")
        .order_by(Issue.resolved_at.desc(), Issue.created_at.desc())
    ).all()
    return [issue_to_response(issue) for issue in issues]


@router.get("/stats")
def get_admin_stats(admin_user_id: int, db: Session = Depends(get_db)):
    require_admin(admin_user_id, db)

    issues = db.scalars(select(Issue)).all()

    flag_counts = {"RED": 0, "GREEN": 0, "BLACK": 0, "BLUE": 0}
    status_counts = {"REPORTED": 0, "ASSIGNED": 0, "IN_PROGRESS": 0, "RESOLVED": 0}
    priority_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}

    emergency_count = 0
    duplicate_count = 0

    for issue in issues:
        flag_counts[issue.flag] = flag_counts.get(issue.flag, 0) + 1
        status_counts[issue.status] = status_counts.get(issue.status, 0) + 1
        priority_counts[issue.priority] = priority_counts.get(issue.priority, 0) + 1
        emergency_count += int(issue.ai_emergency_risk)
        duplicate_count += int(issue.duplicate_of_id is not None)

    return {
        "total": len(issues),
        "flags": flag_counts,
        "statuses": status_counts,
        "priorities": priority_counts,
        "emergency_risk": emergency_count,
        "duplicates": duplicate_count,
        "resolved_count": status_counts["RESOLVED"],
        "new_count": status_counts["REPORTED"],
        "active_count": len([issue for issue in issues if issue.status != "RESOLVED"]),
    }


@router.get("/departments/summary")
def get_department_summary(admin_user_id: int, db: Session = Depends(get_db)):
    require_admin(admin_user_id, db)

    departments = db.scalars(select(Department).order_by(Department.id)).all()
    issues = db.scalars(select(Issue)).all()

    result = []
    for department in departments:
        assigned = [issue for issue in issues if issue.department_id == department.id]
        active = [issue for issue in assigned if issue.status != "RESOLVED"]
        result.append({
            "id": department.id,
            "name": department.name,
            "active": len(active),
            "incidents": len(assigned),
        })

    return result


@router.post("/ai/ask")
async def ai_ask(
    admin_user_id: int,
    payload: AIQuestionRequest,
    db: Session = Depends(get_db),
):
    require_admin(admin_user_id, db)

    issues = db.scalars(select(Issue).order_by(Issue.created_at.desc())).all()
    context = _live_context(issues)

    totals = {
        "total": len(issues),
        "active": len([issue for issue in issues if issue.status != "RESOLVED"]),
        "resolved": len([issue for issue in issues if issue.status == "RESOLVED"]),
        "red": len([issue for issue in issues if issue.flag == "RED"]),
        "green": len([issue for issue in issues if issue.flag == "GREEN"]),
        "black": len([issue for issue in issues if issue.flag == "BLACK"]),
        "blue": len([issue for issue in issues if issue.flag == "BLUE"]),
    }

    context = f"SYSTEM TOTALS: {totals}\n\nINCIDENT RECORDS:\n{context}"
    return await answer_admin_question(payload.question, context)


@router.post("/ai/area-brief")
async def ai_area_brief(
    admin_user_id: int,
    db: Session = Depends(get_db),
):
    require_admin(admin_user_id, db)
    issues = db.scalars(
        select(Issue).where(Issue.status != "RESOLVED").order_by(Issue.created_at.desc())
    ).all()
    context = _live_context(issues)
    return await generate_area_brief("Active city incidents", context)


@router.post("/ai/clusters")
async def ai_clusters(
    admin_user_id: int,
    db: Session = Depends(get_db),
):
    require_admin(admin_user_id, db)
    issues = db.scalars(
        select(Issue).where(Issue.status != "RESOLVED").order_by(Issue.created_at.desc())
    ).all()
    context = _live_context(issues)
    return await cluster_incidents(context)
