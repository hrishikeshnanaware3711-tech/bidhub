from datetime import datetime, timedelta

from sqlalchemy import inspect, text

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_ORIGIN, UPLOAD_DIR
from .database import Base, SessionLocal, engine
from .models import Department, Issue, User
from .routers import admin, auth, issues, meta


Base.metadata.create_all(bind=engine)


def migrate_user_auth_columns():
    """Add auth columns to an older SQLite users table when necessary."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as connection:
        if "username" not in existing_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(50)"))
        if "password_hash" not in existing_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)"))


migrate_user_auth_columns()


DEPARTMENT_SEED = [
    (1, "Municipal Corporation"),
    (2, "Police Department"),
    (3, "Fire Department"),
    (4, "PWD (Roads)"),
    (5, "Tree Authority"),
    (6, "Medical Emergency"),
]


def seed_database():
    db = SessionLocal()
    try:
        demo_accounts = [
            (1, "Demo Citizen", "demo.citizen", "citizen", "Citizen@123"),
            (2, "Alex Citizen", "alex.citizen", "citizen", "Citizen@123"),
            (3, "Sam Citizen", "sam.citizen", "citizen", "Citizen@123"),
            (4, "Demo Administrator", "admin.demo", "admin", "Admin@123"),
        ]

        # Local import prevents a circular dependency during module loading.
        from .routers.auth import _hash_password

        for user_id, name, username, role, password in demo_accounts:
            user = db.get(User, user_id)
            if not user:
                db.add(
                    User(
                        id=user_id,
                        name=name,
                        username=username,
                        password_hash=_hash_password(password),
                        role=role,
                    )
                )
            else:
                changed = False
                if not user.username:
                    user.username = username
                    changed = True
                if not user.password_hash:
                    user.password_hash = _hash_password(password)
                    changed = True
                if changed:
                    db.add(user)

        for department_id, name in DEPARTMENT_SEED:
            if not db.get(Department, department_id):
                db.add(Department(id=department_id, name=name))

        db.commit()

        if db.query(Issue).count() == 0:
            roads = 4
            police = 2
            fire = 3
            tree = 5
            medical = 6

            now = datetime.utcnow()

            seed_issues = [
                Issue(
                    user_id=1,
                    category="Fire",
                    description="Smoke and flames reported from a small building near the main road.",
                    latitude=28.6200,
                    longitude=77.2150,
                    flag="RED",
                    priority="CRITICAL",
                    department_id=fire,
                    status="REPORTED",
                    ai_category="Fire",
                    ai_priority="CRITICAL",
                    ai_summary="Possible building fire requiring urgent response.",
                    ai_reason="Fire incident; human verification required.",
                    ai_emergency_risk=True,
                    ai_status="demo",
                    created_at=now - timedelta(hours=2),
                ),
                Issue(
                    user_id=1,
                    category="Fallen Tree",
                    description="Large fallen tree blocking part of the road after heavy wind.",
                    latitude=28.6130,
                    longitude=77.2200,
                    flag="GREEN",
                    priority="MEDIUM",
                    department_id=tree,
                    status="ASSIGNED",
                    ai_category="Fallen Tree",
                    ai_priority="MEDIUM",
                    ai_summary="Fallen tree obstructing a road segment.",
                    ai_reason="Tree obstruction detected from report description.",
                    ai_emergency_risk=False,
                    ai_status="demo",
                    created_at=now - timedelta(hours=4),
                ),
                Issue(
                    user_id=1,
                    category="Vehicle Accident",
                    description="Two vehicles collided near an intersection; traffic is slowing.",
                    latitude=28.6080,
                    longitude=77.2130,
                    flag="BLACK",
                    priority="HIGH",
                    department_id=police,
                    status="IN_PROGRESS",
                    ai_category="Vehicle Accident",
                    ai_priority="HIGH",
                    ai_summary="Vehicle collision affecting an intersection.",
                    ai_reason="Collision report requires traffic response.",
                    ai_emergency_risk=True,
                    ai_status="demo",
                    created_at=now - timedelta(hours=6),
                ),
                Issue(
                    user_id=1,
                    category="Pothole",
                    description="Deep pothole near the bus stop; two-wheelers are swerving around it.",
                    latitude=28.6165,
                    longitude=77.2050,
                    flag="GREEN",
                    priority="HIGH",
                    department_id=roads,
                    status="REPORTED",
                    ai_category="Pothole",
                    ai_priority="HIGH",
                    ai_summary="Deep pothole creating a road safety hazard.",
                    ai_reason="Road hazard reported near public transport area.",
                    ai_emergency_risk=False,
                    ai_status="demo",
                    created_at=now - timedelta(hours=8),
                ),
                Issue(
                    user_id=1,
                    category="Street Light",
                    description="Street light has been off for several nights near the residential lane.",
                    latitude=28.6250,
                    longitude=77.2080,
                    flag="GREEN",
                    priority="LOW",
                    department_id=1,
                    status="RESOLVED",
                    ai_category="Street Light",
                    ai_priority="LOW",
                    ai_summary="Street lighting outage near a residential lane.",
                    ai_reason="No immediate emergency indicators in description.",
                    ai_emergency_risk=False,
                    ai_status="demo",
                    created_at=now - timedelta(days=1),
                    resolved_at=now - timedelta(hours=12),
                ),
                Issue(
                    user_id=1,
                    category="Medical Emergency",
                    description="Person appears injured after a fall and may need immediate assistance.",
                    latitude=28.6040,
                    longitude=77.2190,
                    flag="BLUE",
                    priority="CRITICAL",
                    department_id=medical,
                    status="ASSIGNED",
                    ai_category="Medical Emergency",
                    ai_priority="CRITICAL",
                    ai_summary="Potential medical emergency following an injury.",
                    ai_reason="Injury is mentioned; emergency risk should be verified.",
                    ai_emergency_risk=True,
                    ai_status="demo",
                    created_at=now - timedelta(minutes=45),
                ),
                Issue(
                    user_id=1,
                    category="Damaged Road",
                    description="Road surface is cracked and uneven around the junction.",
                    latitude=28.6175,
                    longitude=77.2260,
                    flag="GREEN",
                    priority="MEDIUM",
                    department_id=roads,
                    status="IN_PROGRESS",
                    ai_category="Damaged Road",
                    ai_priority="MEDIUM",
                    ai_summary="Damaged road surface reported near a junction.",
                    ai_reason="Road damage requires maintenance review.",
                    ai_emergency_risk=False,
                    ai_status="demo",
                    created_at=now - timedelta(days=1, hours=2),
                ),
                Issue(
                    user_id=1,
                    category="Vehicle Accident",
                    description="Bike and car collision reported close to the crossing.",
                    latitude=28.6110,
                    longitude=77.2100,
                    flag="BLACK",
                    priority="HIGH",
                    department_id=police,
                    status="RESOLVED",
                    ai_category="Vehicle Accident",
                    ai_priority="HIGH",
                    ai_summary="Road collision reported near crossing.",
                    ai_reason="Vehicle collision reported; response marked resolved in demo data.",
                    ai_emergency_risk=True,
                    ai_status="demo",
                    created_at=now - timedelta(days=2),
                    resolved_at=now - timedelta(days=1, hours=20),
                ),
            ]

            db.add_all(seed_issues)
            db.commit()

    finally:
        db.close()


seed_database()


app = FastAPI(
    title="CivicWatch API",
    version="1.0.0",
)


origins = {
    FRONTEND_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
)

app.include_router(auth.router)
app.include_router(issues.router)
app.include_router(admin.router)
app.include_router(meta.router)


@app.get("/")
def root():
    return {
        "message": "CivicWatch API is running.",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "CivicWatch API",
        "time": datetime.utcnow().isoformat(),
    }
