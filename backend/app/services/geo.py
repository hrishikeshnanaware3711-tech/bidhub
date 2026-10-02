from math import asin, cos, radians, sin, sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Issue


EARTH_RADIUS_METERS = 6_371_000
DUPLICATE_RADIUS_METERS = 100


def distance_meters(
    latitude1: float,
    longitude1: float,
    latitude2: float,
    longitude2: float,
) -> float:
    lat1 = radians(latitude1)
    lat2 = radians(latitude2)
    d_lat = radians(latitude2 - latitude1)
    d_lon = radians(longitude2 - longitude1)

    a = (
        sin(d_lat / 2) ** 2
        + cos(lat1)
        * cos(lat2)
        * sin(d_lon / 2) ** 2
    )

    central_angle = 2 * asin(min(1.0, sqrt(a)))
    return EARTH_RADIUS_METERS * central_angle


def find_possible_duplicate(
    db: Session,
    issue: Issue,
    radius_meters: float = DUPLICATE_RADIUS_METERS,
) -> tuple[Issue | None, float | None]:
    """Find the nearest unresolved issue of the same category inside the radius."""
    existing = db.scalars(
        select(Issue).where(
            Issue.id != issue.id,
            Issue.category == issue.category,
            Issue.status != "RESOLVED",
        )
    ).all()

    nearest = None
    nearest_distance = None

    for candidate in existing:
        distance = distance_meters(
            issue.latitude,
            issue.longitude,
            candidate.latitude,
            candidate.longitude,
        )

        if distance <= radius_meters and (
            nearest_distance is None or distance < nearest_distance
        ):
            nearest = candidate
            nearest_distance = distance

    return nearest, nearest_distance
