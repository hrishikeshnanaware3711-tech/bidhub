from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Department, User
from ..services.ai import CATEGORIES, DEPARTMENTS


router = APIRouter(prefix="/api", tags=["Meta"])


@router.get("/categories")
def get_categories():
    return ["Auto Detect", *CATEGORIES]


@router.get("/flags")
def get_flags():
    return [
        {"id": "RED", "label": "Fire", "description": "Fire-related incidents"},
        {"id": "GREEN", "label": "Tree / Other", "description": "Tree, environment, or civic incidents"},
        {"id": "BLACK", "label": "Vehicle", "description": "Vehicle accidents and collisions"},
        {"id": "BLUE", "label": "Medical", "description": "Medical or person-in-danger incidents"},
    ]


@router.get("/departments")
def get_departments(db: Session = Depends(get_db)):
    departments = db.scalars(select(Department).order_by(Department.id)).all()
    return [{"id": d.id, "name": d.name} for d in departments]


@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.id)).all()
    return [{"id": u.id, "name": u.name, "username": u.username, "role": u.role} for u in users]


@router.get("/system-info")
def get_system_info():
    return {
        "name": "CivicWatch",
        "departments": DEPARTMENTS,
        "ollama": "local AI",
        "map": "OpenStreetMap + Leaflet",
    }
