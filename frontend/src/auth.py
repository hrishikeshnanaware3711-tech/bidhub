import hashlib
import hmac
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse, RegisterRequest, RegistrationResponse


router = APIRouter(prefix="/api/auth", tags=["Authentication"])


PBKDF2_ITERATIONS = 310_000
USERNAME_RE = re.compile(r"^[a-z0-9_.-]{3,50}$")


def _normalize_username(username: str) -> str:
    return username.strip().lower()


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def _verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False

    try:
        scheme, iterations, salt_hex, digest_hex = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _user_response(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "username": user.username,
        "role": user.role,
    }


@router.post("/register", response_model=RegistrationResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    username = _normalize_username(payload.username)

    if not USERNAME_RE.fullmatch(username):
        raise HTTPException(
            status_code=400,
            detail="Username may contain only letters, numbers, dot, dash, or underscore.",
        )

    existing = db.scalar(select(User).where(User.username == username))
    if existing:
        raise HTTPException(status_code=409, detail="That username is already registered.")

    user = User(
        name=payload.name.strip(),
        username=username,
        password_hash=_hash_password(payload.password),
        role=payload.role,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return _user_response(user)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    username = _normalize_username(payload.username)
    user = db.scalar(select(User).where(User.username == username))

    if not user or not _verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if user.role != payload.role:
        raise HTTPException(
            status_code=403,
            detail="The selected workspace does not match this account.",
        )

    return _user_response(user)
