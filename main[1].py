from typing import Optional
import math
import requests

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import create_engine, Column, Integer, String, Boolean, Float, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = "sqlite:///./pg.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PG(Base):
    __tablename__ = "pgs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, default="")
    property_type = Column(String, nullable=False, default="PG")
    pg_type = Column(String, nullable=False, default="Unisex")
    location = Column(String, nullable=False, default="")
    rent = Column(Integer, nullable=False, default=0)

    owner_name = Column(String, nullable=False, default="Owner")
    owner_phone = Column(String, nullable=False, default="")

    food_available = Column(Boolean, default=True)
    food_type = Column(String, nullable=True)
    food_rating = Column(Float, default=0)
    cleaning_rating = Column(Float, default=0)
    water_available = Column(Boolean, default=True)
    wifi_available = Column(Boolean, default=True)
    cctv_available = Column(Boolean, default=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    ac_available = Column(Boolean, default=False)
    geyser_available = Column(Boolean, default=False)
    parking_available = Column(Boolean, default=False)
    power_backup = Column(Boolean, default=False)
    laundry_available = Column(Boolean, default=False)
    security_available = Column(Boolean, default=False)
    hygiene_rating = Column(Float, default=0)

    room_type = Column(String, default="Single")
    room_available = Column(Boolean, default=True)
    attached_washroom = Column(Boolean, default=False)
    common_washroom = Column(Boolean, default=True)
    washroom_cleaning_rating = Column(Float, default=0)


Base.metadata.create_all(bind=engine)


# Existing pg.db may have an older table. Add missing columns safely.
def migrate_sqlite():
    inspector = inspect(engine)
    if "pgs" not in inspector.get_table_names():
        return

    existing = {c["name"] for c in inspector.get_columns("pgs")}
    additions = {
        "property_type": "VARCHAR DEFAULT 'PG'",
        "latitude": "FLOAT",
        "longitude": "FLOAT",
        "ac_available": "BOOLEAN DEFAULT 0",
        "geyser_available": "BOOLEAN DEFAULT 0",
        "parking_available": "BOOLEAN DEFAULT 0",
        "power_backup": "BOOLEAN DEFAULT 0",
        "laundry_available": "BOOLEAN DEFAULT 0",
        "security_available": "BOOLEAN DEFAULT 0",
        "hygiene_rating": "FLOAT DEFAULT 0",
        "room_type": "VARCHAR DEFAULT 'Single'",
        "room_available": "BOOLEAN DEFAULT 1",
        "attached_washroom": "BOOLEAN DEFAULT 0",
        "common_washroom": "BOOLEAN DEFAULT 1",
        "washroom_cleaning_rating": "FLOAT DEFAULT 0",
    }
    with engine.begin() as conn:
        for name, definition in additions.items():
            if name not in existing:
                conn.execute(text(f'ALTER TABLE pgs ADD COLUMN "{name}" {definition}'))


migrate_sqlite()


def seed_demo_data():
    db = SessionLocal()
    try:
        if db.query(PG).count() == 0:
            demo = [
                PG(name="Green View PG", property_type="PG", pg_type="Girls", location="HSR Layout, Bangalore", rent=8500, owner_name="Demo Owner", owner_phone="9000000001", food_available=True, food_type="Veg", food_rating=4.2, cleaning_rating=4.0, water_available=True, wifi_available=True, cctv_available=True, latitude=12.9116, longitude=77.6389, ac_available=False, geyser_available=True, parking_available=True, security_available=True, room_type="Single"),
                PG(name="City Comfort PG", property_type="PG", pg_type="Boys", location="Koramangala, Bangalore", rent=7500, owner_name="Demo Owner", owner_phone="9000000002", food_available=True, food_type="Non-Veg", food_rating=4.0, cleaning_rating=3.8, water_available=True, wifi_available=True, cctv_available=True, latitude=12.9352, longitude=77.6245, parking_available=True, power_backup=True, room_type="Double"),
                PG(name="Smart Co-Living", property_type="Co-Living", pg_type="Unisex", location="Electronic City, Bangalore", rent=9000, owner_name="Demo Owner", owner_phone="9000000003", food_available=True, food_type="Veg", food_rating=4.4, cleaning_rating=4.3, water_available=True, wifi_available=True, cctv_available=True, latitude=12.8452, longitude=77.6602, ac_available=True, geyser_available=True, laundry_available=True, security_available=True, room_type="Single"),
            ]
            db.add_all(demo)
            db.commit()
    finally:
        db.close()


seed_demo_data()


app = FastAPI(
    title="Smart PG API",
    version="2.0.0",
    description="Public Smart PG Management System API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
    


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PGCreate(BaseModel):
    name: str
    property_type: str = "PG"
    pg_type: str = "Unisex"
    location: str
    rent: int

    owner_name: str = "Owner"
    owner_phone: str = ""

    food_available: bool = True
    food_type: Optional[str] = "Veg"
    food_rating: float = 0
    cleaning_rating: float = 0
    water_available: bool = True
    wifi_available: bool = True
    cctv_available: bool = True

    latitude: Optional[float] = None
    longitude: Optional[float] = None

    ac_available: bool = False
    geyser_available: bool = False
    parking_available: bool = False
    power_backup: bool = False
    laundry_available: bool = False
    security_available: bool = False
    hygiene_rating: float = 0

    room_type: str = "Single"
    room_available: bool = True
    attached_washroom: bool = False
    common_washroom: bool = True
    washroom_cleaning_rating: float = 0


class PGResponse(PGCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


@app.get("/")
def home():
    return {
        "message": "Smart PG API is running",
        "docs": "http://127.0.0.1:8000/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "Smart PG API"}


@app.get("/pg", response_model=list[PGResponse])
def get_all_pg(
    location: Optional[str] = None,
    property_type: Optional[str] = None,
    pg_type: Optional[str] = None,
    food_type: Optional[str] = None,
    max_rent: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PG)

    if location:
        query = query.filter(PG.location.ilike(f"%{location}%"))
    if property_type and property_type.lower() != "all":
        query = query.filter(PG.property_type.ilike(property_type))
    if pg_type and pg_type.lower() != "all":
        query = query.filter(PG.pg_type.ilike(pg_type))
    if food_type and food_type.lower() != "all":
        query = query.filter(PG.food_type.ilike(food_type))
    if max_rent is not None:
        query = query.filter(PG.rent <= max_rent)

    return query.order_by(PG.id.desc()).all()


@app.post("/pg")
def add_pg(pg: PGCreate, db: Session = Depends(get_db)):
    new_pg = PG(**pg.model_dump())
    db.add(new_pg)
    db.commit()
    db.refresh(new_pg)
    return {"message": "PG added successfully", "id": new_pg.id}


@app.get("/pg/{pg_id}", response_model=PGResponse)
def get_pg(pg_id: int, db: Session = Depends(get_db)):
    pg = db.query(PG).filter(PG.id == pg_id).first()
    if not pg:
        raise HTTPException(status_code=404, detail="PG not found")
    return pg


@app.put("/pg/{pg_id}")
def update_pg(pg_id: int, pg_data: PGCreate, db: Session = Depends(get_db)):
    pg = db.query(PG).filter(PG.id == pg_id).first()
    if not pg:
        raise HTTPException(status_code=404, detail="PG not found")

    for key, value in pg_data.model_dump().items():
        setattr(pg, key, value)

    db.commit()
    db.refresh(pg)
    return {"message": "PG updated successfully", "id": pg.id}


@app.delete("/pg/{pg_id}")
def delete_pg(pg_id: int, db: Session = Depends(get_db)):
    pg = db.query(PG).filter(PG.id == pg_id).first()
    if not pg:
        raise HTTPException(status_code=404, detail="PG not found")

    db.delete(pg)
    db.commit()
    return {"message": "PG deleted successfully", "id": pg_id}


HEADERS = {"User-Agent": "SmartPG/1.0 (student project)"}


def geocode_location(location: str):
    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": location, "format": "jsonv2", "limit": 1},
        headers=HEADERS,
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"]), data[0].get("display_name", location)


@app.get("/reverse-location")
def reverse_location(latitude: float, longitude: float):
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": latitude, "lon": longitude, "format": "jsonv2"},
            headers=HEADERS,
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()
        return {"display_name": data.get("display_name", "Current Location")}
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Location service error: {exc}")


@app.get("/search-real-pg")
def search_real_pg(location: str, property_type: str = "PG"):
    """Search publicly mapped accommodation using OpenStreetMap."""
    location = location.strip()

    if not location:
        raise HTTPException(status_code=400, detail="Location is required")

    try:
        geo = geocode_location(location)
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Location service error: {exc}"
        )

    if not geo:
        return {
            "location": location,
            "count": 0,
            "results": [],
            "source": "OpenStreetMap",
            "message": "Location was not found."
        }

    latitude, longitude, display_name = geo

    # Search only the selected category so the response is faster.
    radius = 3500
    wanted = (property_type or "PG").strip()
    if wanted not in {"PG", "Hostel", "Co-Living", "Flat", "All"}:
        wanted = "PG"
    if wanted == "PG":
        selectors = f'nwr(around:{radius},{latitude},{longitude})["name"~"PG|P.G.|Paying Guest",i];'
    elif wanted == "Hostel":
        selectors = (
            f'nwr(around:{radius},{latitude},{longitude})["tourism"="hostel"];\n'
            f'      nwr(around:{radius},{latitude},{longitude})["amenity"="hostel"];\n'
            f'      nwr(around:{radius},{latitude},{longitude})["tourism"="guest_house"];'
        )
    elif wanted == "Co-Living":
        selectors = f'nwr(around:{radius},{latitude},{longitude})["name"~"Co.?Living|Coliving",i];'
    elif wanted == "Flat":
        selectors = f'nwr(around:{radius},{latitude},{longitude})["name"~"Flat|Apartment",i];'
    else:
        selectors = (
            f'nwr(around:{radius},{latitude},{longitude})["tourism"="hostel"];\n'
            f'      nwr(around:{radius},{latitude},{longitude})["tourism"="guest_house"];\n'
            f'      nwr(around:{radius},{latitude},{longitude})["amenity"="hostel"];\n'
            f'      nwr(around:{radius},{latitude},{longitude})["name"~"PG|P.G.|Paying Guest|Co.?Living|Coliving|Flat|Apartment",i];'
        )
    query = f"""
    [out:json][timeout:12];
    (
      {selectors}
    );
    out center tags;
    """

    # Several public mirrors: if one is busy, the next one is tried.
    overpass_urls = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.nchc.org.tw/api/interpreter",
    ]

    data = None
    errors = []

    for url in overpass_urls:
        try:
            response = requests.post(
                url,
                data={"data": query},
                timeout=22,
                headers=HEADERS,
            )
            response.raise_for_status()
            data = response.json()
            break
        except requests.RequestException as exc:
            errors.append(f"{url}: {exc}")
        except ValueError as exc:
            errors.append(f"{url}: invalid JSON ({exc})")

    # Never make the frontend crash just because a public OSM mirror is busy.
    if data is None:
        return {
            "location": location,
            "latitude": latitude,
            "longitude": longitude,
            "count": 0,
            "results": [],
            "source": "OpenStreetMap",
            "message": (
                "OpenStreetMap service is temporarily busy. "
                "Please press Retry."
            ),
            "service_errors": errors[-2:],
        }

    results = []
    seen = set()

    for element in data.get("elements", []):
        tags = element.get("tags", {})
        name = (tags.get("name") or "").strip()

        if not name:
            continue

        lat = element.get("lat")
        lon = element.get("lon")

        if lat is None or lon is None:
            center = element.get("center") or {}
            lat = center.get("lat")
            lon = center.get("lon")

        if lat is None or lon is None:
            continue

        address_parts = [
            tags.get("addr:housenumber"),
            tags.get("addr:street"),
            tags.get("addr:suburb"),
            tags.get("addr:neighbourhood"),
            tags.get("addr:city"),
            tags.get("addr:postcode"),
        ]

        address = ", ".join(
            str(value).strip()
            for value in address_parts
            if value
        )

        key = (
            name.lower(),
            address.lower(),
            round(float(lat), 5),
            round(float(lon), 5),
        )

        if key in seen:
            continue
        seen.add(key)

        tourism = (tags.get("tourism") or "").lower()
        amenity = (tags.get("amenity") or "").lower()
        lower_name = name.lower()

        if (
            "co-living" in lower_name
            or "coliving" in lower_name
            or "co living" in lower_name
        ):
            property_type = "Co-Living"
        elif "flat" in lower_name or "apartment" in lower_name:
            property_type = "Flat"
        elif (
            tourism == "hostel"
            or amenity == "hostel"
            or "hostel" in lower_name
        ):
            property_type = "Hostel"
        elif tourism == "guest_house":
            property_type = "Hostel"
        else:
            property_type = "PG"

        website = (
            tags.get("website")
            or tags.get("contact:website")
            or ""
        )

        phone = (
            tags.get("phone")
            or tags.get("contact:phone")
            or ""
        )
        image = tags.get("image") or tags.get("image:url") or ""
        if not image and tags.get("wikimedia_commons"):
            image = "https://commons.wikimedia.org/wiki/Special:FilePath/" + tags.get("wikimedia_commons").replace("File:", "").strip().replace(" ", "_")

        results.append({
            "id": f"osm-{element.get('type')}-{element.get('id')}",
            "name": name,
            "property_type": property_type,
            "pg_type": "Unisex",
            "location": address or display_name,
            "rent": None,
            "owner_name": "OpenStreetMap listing",
            "owner_phone": phone,
            "food_available": bool(
                tags.get("restaurant") or tags.get("cuisine")
            ),
            "food_type": tags.get("cuisine") or "Not specified",
            "food_rating": 0,
            "cleaning_rating": 0,
            "water_available": False,
            "wifi_available": tags.get("internet_access") == "wlan",
            "cctv_available": False,
            "latitude": float(lat),
            "longitude": float(lon),
            "website": website,
            "image": image,
            "source": "OpenStreetMap",
            "map_url": (
                f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}"
                f"#map=18/{lat}/{lon}"
            ),
            "directions_url": (
                f"https://www.google.com/maps/search/?api=1"
                f"&query={lat},{lon}"
            ),
        })

    results.sort(
        key=lambda item: calculate_distance(
            latitude,
            longitude,
            item["latitude"],
            item["longitude"],
        )
    )

    return {
        "location": location,
        "latitude": latitude,
        "longitude": longitude,
        "count": len(results),
        "results": results[:100],
        "source": "OpenStreetMap",
        "message": (
            "Real mapped accommodation loaded successfully."
            if results
            else "No mapped accommodation found in this area."
        ),
    }


def calculate_distance(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)

    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@app.get("/nearby-pgs")
def nearby_pgs(
    latitude: float,
    longitude: float,
    radius_km: float = 10,
    db: Session = Depends(get_db),
):
    results = []

    for pg in db.query(PG).all():
        if pg.latitude is None or pg.longitude is None:
            continue

        distance = calculate_distance(
            latitude, longitude, pg.latitude, pg.longitude
        )

        if distance <= radius_km:
            item = {
                "id": pg.id,
                "name": pg.name,
                "property_type": pg.property_type,
                "pg_type": pg.pg_type,
                "location": pg.location,
                "rent": pg.rent,
                "latitude": pg.latitude,
                "longitude": pg.longitude,
            }
            item["distance_km"] = round(distance, 2)
            results.append(item)

    results.sort(key=lambda x: x["distance_km"])
    return {"count": len(results), "results": results[:100]}


@app.get("/nearby-pgs/search")
def nearby_pg_search(
    location: str,
    radius_km: float = 10,
):
    return search_real_pg(location)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

