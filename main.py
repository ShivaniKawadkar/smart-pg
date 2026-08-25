import os
import math
import hashlib
import secrets
from typing import Optional

import httpx

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    Boolean,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session


# =========================================================
# DATABASE
# =========================================================

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./pg.db")

connect_args = {}

if DATABASE_URL.startswith("sqlite"):
    connect_args = {
        "check_same_thread": False
    }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


# =========================================================
# USER MODEL
# =========================================================

class UserTable(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    password_hash = Column(
        String,
        nullable=False
    )

    role = Column(
        String,
        default="user",
        nullable=False
    )

    token = Column(
        String,
        unique=True,
        index=True,
        nullable=True
    )


# =========================================================
# PROPERTY MODEL
# =========================================================

class PGTable(Base):
    __tablename__ = "pg"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    name = Column(
        String,
        nullable=False
    )

    property_type = Column(
        String,
        default="PG"
    )

    pg_type = Column(
        String,
        default="Unisex"
    )

    location = Column(
        String,
        index=True
    )

    rent = Column(
        Float,
        nullable=True
    )

    owner_name = Column(
        String,
        nullable=True
    )

    owner_phone = Column(
        String,
        nullable=True
    )

    food_available = Column(
        Boolean,
        default=False
    )

    food_type = Column(
        String,
        nullable=True
    )

    food_rating = Column(
        Float,
        default=0
    )

    cleaning_rating = Column(
        Float,
        default=0
    )

    water_available = Column(
        Boolean,
        default=True
    )

    wifi_available = Column(
        Boolean,
        default=False
    )

    cctv_available = Column(
        Boolean,
        default=False
    )

    latitude = Column(
        Float,
        nullable=True
    )

    longitude = Column(
        Float,
        nullable=True
    )

    ac_available = Column(
        Boolean,
        default=False
    )

    geyser_available = Column(
        Boolean,
        default=False
    )

    parking_available = Column(
        Boolean,
        default=False
    )

    power_backup = Column(
        Boolean,
        default=False
    )

    laundry_available = Column(
        Boolean,
        default=False
    )

    security_available = Column(
        Boolean,
        default=False
    )

    hygiene_rating = Column(
        Float,
        default=0
    )

    room_type = Column(
        String,
        nullable=True
    )

    room_available = Column(
        Boolean,
        default=True
    )

    attached_washroom = Column(
        Boolean,
        default=False
    )

    common_washroom = Column(
        Boolean,
        default=False
    )

    washroom_cleaning_rating = Column(
        Float,
        default=0
    )


Base.metadata.create_all(bind=engine)


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="Smart PG API",
    version="8.0.0",
    description="Smart PG India Wide Real Accommodation System",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE DEPENDENCY
# =========================================================

def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# =========================================================
# PASSWORD
# =========================================================

def hash_password(password: str) -> str:

    salt = secrets.token_hex(16)

    password_hash = hashlib.sha256(
        (salt + password).encode("utf-8")
    ).hexdigest()

    return f"{salt}${password_hash}"


def verify_password(
    password: str,
    stored: str
) -> bool:

    try:

        salt, saved_hash = stored.split(
            "$",
            1
        )

        check_hash = hashlib.sha256(
            (salt + password).encode("utf-8")
        ).hexdigest()

        return secrets.compare_digest(
            check_hash,
            saved_hash
        )

    except Exception:

        return False


# =========================================================
# AUTH MODELS
# =========================================================

class RegisterModel(BaseModel):

    name: str

    email: EmailStr

    password: str

    role: str = "user"


class LoginModel(BaseModel):

    email: EmailStr

    password: str


# =========================================================
# PROPERTY INPUT MODEL
# =========================================================

class PGCreate(BaseModel):

    name: str

    property_type: str = "PG"

    pg_type: str = "Unisex"

    location: str

    rent: Optional[float] = None

    owner_name: Optional[str] = None

    owner_phone: Optional[str] = None

    food_available: bool = False

    food_type: Optional[str] = None

    food_rating: float = 0

    cleaning_rating: float = 0

    water_available: bool = True

    wifi_available: bool = False

    cctv_available: bool = False

    latitude: Optional[float] = None

    longitude: Optional[float] = None

    ac_available: bool = False

    geyser_available: bool = False

    parking_available: bool = False

    power_backup: bool = False

    laundry_available: bool = False

    security_available: bool = False

    hygiene_rating: float = 0

    room_type: Optional[str] = None

    room_available: bool = True

    attached_washroom: bool = False

    common_washroom: bool = False

    washroom_cleaning_rating: float = 0


# =========================================================
# AUTHENTICATION
# =========================================================

def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):

    if not authorization:

        raise HTTPException(
            status_code=401,
            detail="Login required"
        )

    token = authorization.replace(
        "Bearer ",
        ""
    ).strip()

    if not token:

        raise HTTPException(
            status_code=401,
            detail="Invalid login token"
        )

    user = (
        db.query(UserTable)
        .filter(
            UserTable.token == token
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Session expired. Please login again."
        )

    return user


def require_owner(
    user: UserTable = Depends(get_current_user),
):

    if user.role != "owner":

        raise HTTPException(
            status_code=403,
            detail="Only property owners can perform this action"
        )

    return user


# =========================================================
# REGISTER
# =========================================================

@app.post("/auth/register")
def register(
    data: RegisterModel,
    db: Session = Depends(get_db),
):

    email = str(data.email).lower().strip()

    existing = (
        db.query(UserTable)
        .filter(
            UserTable.email == email
        )
        .first()
    )

    if existing:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    role = data.role.lower().strip()

    if role not in ["user", "owner"]:
        role = "user"

    if len(data.password) < 4:

        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 4 characters"
        )

    user = UserTable(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(
            data.password
        ),
        role=role,
    )

    db.add(user)

    db.commit()

    db.refresh(user)

    return {
        "message": "Registration successful",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }
    }


# =========================================================
# LOGIN
# =========================================================

@app.post("/auth/login")
def login(
    data: LoginModel,
    db: Session = Depends(get_db),
):

    email = str(data.email).lower().strip()

    user = (
        db.query(UserTable)
        .filter(
            UserTable.email == email
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        data.password,
        user.password_hash
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token = secrets.token_urlsafe(48)

    user.token = token

    db.commit()

    db.refresh(user)

    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }
    }


# =========================================================
# LOGOUT
# =========================================================

@app.post("/auth/logout")
def logout(
    user: UserTable = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    user.token = None

    db.commit()

    return {
        "message": "Logout successful"
    }


# =========================================================
# CURRENT USER
# =========================================================

@app.get("/auth/me")
def me(
    user: UserTable = Depends(get_current_user),
):

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


# =========================================================
# HOME
# =========================================================

@app.get("/")
def home():

    return {
        "message": "Smart PG API is running",
        "version": "8.0.0",
        "authentication": "ON",
        "owner_system": "ON",
        "real_india_search": "ON",
        "openstreetmap": "ON",
        "docs": "/docs",
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "authentication": "online",
        "real_search": "online",
    }


# =========================================================
# DATABASE PROPERTY RESPONSE
# =========================================================

def pg_to_dict(pg: PGTable):

    google_maps_url = None
    directions_url = None

    if (
        pg.latitude is not None
        and pg.longitude is not None
    ):

        google_maps_url = (
            "https://www.google.com/maps/search/"
            f"?api=1&query={pg.latitude},{pg.longitude}"
        )

        directions_url = (
            "https://www.google.com/maps/dir/"
            f"?api=1&destination={pg.latitude},{pg.longitude}"
        )

    return {

        "id": pg.id,

        "owner_id": pg.owner_id,

        "name": pg.name,

        "property_type": pg.property_type,

        "pg_type": pg.pg_type,

        "location": pg.location,

        "rent": pg.rent,

        "owner_name": pg.owner_name,

        "owner_phone": pg.owner_phone,

        "food_available": pg.food_available,

        "food_type": pg.food_type,

        "food_rating": pg.food_rating,

        "cleaning_rating": pg.cleaning_rating,

        "water_available": pg.water_available,

        "wifi_available": pg.wifi_available,

        "cctv_available": pg.cctv_available,

        "latitude": pg.latitude,

        "longitude": pg.longitude,

        "ac_available": pg.ac_available,

        "geyser_available": pg.geyser_available,

        "parking_available": pg.parking_available,

        "power_backup": pg.power_backup,

        "laundry_available": pg.laundry_available,

        "security_available": pg.security_available,

        "hygiene_rating": pg.hygiene_rating,

        "room_type": pg.room_type,

        "room_available": pg.room_available,

        "attached_washroom": pg.attached_washroom,

        "common_washroom": pg.common_washroom,

        "washroom_cleaning_rating":
            pg.washroom_cleaning_rating,

        "source": "Smart PG Database",

        "google_maps_url":
            google_maps_url,

        "directions_url":
            directions_url,
    }


# =========================================================
# CREATE PROPERTY
# OWNER ONLY
# =========================================================

@app.post("/pg")
def create_pg(
    data: PGCreate,
    owner: UserTable = Depends(require_owner),
    db: Session = Depends(get_db),
):

    pg = PGTable(
        owner_id=owner.id,
        **data.model_dump()
    )

    db.add(pg)

    db.commit()

    db.refresh(pg)

    return pg_to_dict(pg)


# =========================================================
# GET ALL DATABASE PROPERTIES
# =========================================================

@app.get("/pg")
def get_pgs(
    location: Optional[str] = None,
    property_type: Optional[str] = None,
    pg_type: Optional[str] = None,
    food_type: Optional[str] = None,
    max_rent: Optional[float] = None,
    db: Session = Depends(get_db),
):

    query = db.query(PGTable)

    if property_type:

        ptype = property_type.strip()

        if ptype.lower() != "all":

            query = query.filter(
                PGTable.property_type.ilike(
                    ptype
                )
            )

    if location:

        text = location.strip()

        if text:

            query = query.filter(
                PGTable.location.ilike(
                    f"%{text}%"
                )
            )

    if pg_type and pg_type.lower() != "all":

        query = query.filter(
            PGTable.pg_type.ilike(
                pg_type.strip()
            )
        )

    if food_type and food_type.lower() != "all":

        query = query.filter(
            PGTable.food_type.ilike(
                f"%{food_type.strip()}%"
            )
        )

    if max_rent is not None:

        query = query.filter(
            PGTable.rent <= max_rent
        )

    results = query.all()

    return [
        pg_to_dict(pg)
        for pg in results
    ]


# =========================================================
# OWNER PROPERTIES
# =========================================================

@app.get("/owner/properties")
def owner_properties(
    owner: UserTable = Depends(require_owner),
    db: Session = Depends(get_db),
):

    properties = (
        db.query(PGTable)
        .filter(
            PGTable.owner_id == owner.id
        )
        .all()
    )

    return [
        pg_to_dict(pg)
        for pg in properties
    ]


# =========================================================
# SINGLE PROPERTY
# =========================================================

@app.get("/pg/{pg_id}")
def get_pg(
    pg_id: int,
    db: Session = Depends(get_db),
):

    pg = (
        db.query(PGTable)
        .filter(
            PGTable.id == pg_id
        )
        .first()
    )

    if not pg:

        raise HTTPException(
            status_code=404,
            detail="Property not found"
        )

    return pg_to_dict(pg)


# =========================================================
# UPDATE PROPERTY
# =========================================================

@app.put("/pg/{pg_id}")
def update_pg(
    pg_id: int,
    data: PGCreate,
    owner: UserTable = Depends(require_owner),
    db: Session = Depends(get_db),
):

    pg = (
        db.query(PGTable)
        .filter(
            PGTable.id == pg_id,
            PGTable.owner_id == owner.id,
        )
        .first()
    )

    if not pg:

        raise HTTPException(
            status_code=404,
            detail="Property not found or not owned by you"
        )

    for key, value in data.model_dump().items():

        setattr(
            pg,
            key,
            value
        )

    db.commit()

    db.refresh(pg)

    return pg_to_dict(pg)


# =========================================================
# DELETE PROPERTY
# =========================================================

@app.delete("/pg/{pg_id}")
def delete_pg(
    pg_id: int,
    owner: UserTable = Depends(require_owner),
    db: Session = Depends(get_db),
):

    pg = (
        db.query(PGTable)
        .filter(
            PGTable.id == pg_id,
            PGTable.owner_id == owner.id,
        )
        .first()
    )

    if not pg:

        raise HTTPException(
            status_code=404,
            detail="Property not found or not owned by you"
        )

    db.delete(pg)

    db.commit()

    return {
        "message": "Property deleted successfully"
    }


# =========================================================
# NOMINATIM
# =========================================================

NOMINATIM_URL = (
    "https://nominatim.openstreetmap.org"
)

HEADERS = {
    "User-Agent":
        "SmartPG/8.0 smartpgindia@gmail.com"
}


async def geocode_location(
    location: str,
):

    try:

        async with httpx.AsyncClient(
            timeout=30,
            headers=HEADERS,
            follow_redirects=True,
        ) as client:

            response = await client.get(
                f"{NOMINATIM_URL}/search",
                params={
                    "q": f"{location}, India",
                    "format": "json",
                    "limit": 5,
                    "countrycodes": "in",
                    "addressdetails": 1,
                },
            )

            response.raise_for_status()

            data = response.json()

            if not data:

                return None

            for item in data:

                if (
                    item.get("lat")
                    and item.get("lon")
                ):

                    return {
                        "latitude":
                            float(item["lat"]),

                        "longitude":
                            float(item["lon"]),

                        "display_name":
                            item.get(
                                "display_name",
                                location
                            ),
                    }

    except Exception as e:

        print(
            "GEOCODING ERROR:",
            repr(e)
        )

    return None


# =========================================================
# REVERSE LOCATION
# =========================================================

@app.get("/reverse-location")
async def reverse_location(
    latitude: float,
    longitude: float,
):

    try:

        async with httpx.AsyncClient(
            timeout=30,
            headers=HEADERS,
            follow_redirects=True,
        ) as client:

            response = await client.get(
                f"{NOMINATIM_URL}/reverse",
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "json",
                    "addressdetails": 1,
                },
            )

            response.raise_for_status()

            data = response.json()

            return {
                "display_name":
                    data.get(
                        "display_name",
                        f"{latitude}, {longitude}"
                    ),

                "latitude": latitude,

                "longitude": longitude,
            }

    except Exception:

        return {
            "display_name":
                f"{latitude}, {longitude}",

            "latitude": latitude,

            "longitude": longitude,
        }


# =========================================================
# DISTANCE
# =========================================================

def distance_km(
    lat1,
    lon1,
    lat2,
    lon2,
):

    radius = 6371.0

    p1 = math.radians(lat1)

    p2 = math.radians(lat2)

    dp = math.radians(
        lat2 - lat1
    )

    dl = math.radians(
        lon2 - lon1
    )

    a = (
        math.sin(dp / 2) ** 2
        +
        math.cos(p1)
        *
        math.cos(p2)
        *
        math.sin(dl / 2) ** 2
    )

    return (
        radius
        *
        2
        *
        math.atan2(
            math.sqrt(a),
            math.sqrt(1 - a)
        )
    )


# =========================================================
# OVERPASS SERVERS
# =========================================================

OVERPASS_SERVERS = [

    "https://overpass-api.de/api/interpreter",

    "https://overpass.kumi.systems/api/interpreter",

    "https://overpass.private.coffee/api/interpreter",
]


# =========================================================
# OVERPASS QUERY
# =========================================================

def get_overpass_query(
    lat,
    lon,
    radius,
    category,
):

    category = (
        category
        .strip()
        .lower()
    )

    if category == "pg":

        filters = [

            'nwr["tourism"="hostel"]',

            'nwr["amenity"="hostel"]',

            'nwr["tourism"="guest_house"]',

            'nwr["name"~"PG|paying guest|hostel|boys hostel|girls hostel",i]',

            'nwr["name"~"accommodation|residency|residence",i]',
        ]

    elif category == "hostel":

        filters = [

            'nwr["tourism"="hostel"]',

            'nwr["amenity"="hostel"]',

            'nwr["name"~"hostel|hostels",i]',
        ]

    elif category in [
        "co-living",
        "co living",
        "coliving",
    ]:

        filters = [

            'nwr["name"~"co-living|co living|coliving",i]',

            'nwr["name"~"living",i]',

            'nwr["amenity"="community_centre"]',

            'nwr["name"~"residency|residence",i]',
        ]

    elif category == "flat":

        filters = [

            'nwr["building"="apartments"]',

            'nwr["building"="residential"]',

            'nwr["name"~"apartment|residency|residence|flat|homes",i]',
        ]

    else:

        filters = [

            'nwr["tourism"="hostel"]',

            'nwr["amenity"="hostel"]',

            'nwr["tourism"="guest_house"]',

            'nwr["building"="apartments"]',

            'nwr["amenity"="hotel"]',

            'nwr["name"~"PG|hostel|paying guest|coliving|co-living",i]',
        ]

    parts = []

    for item in filters:

        parts.append(
            f"""
            {item}(
                around:{radius},
                {lat},
                {lon}
            );
            """
        )

    return f"""
    [out:json][timeout:90];

    (
        {''.join(parts)}
    );

    out center tags;
    """


# =========================================================
# OSM CONVERTER
# =========================================================

def osm_to_result(
    element,
    category,
):

    tags = element.get(
        "tags",
        {}
    )

    lat = element.get("lat")

    lon = element.get("lon")

    if lat is None:

        center = element.get(
            "center",
            {}
        )

        lat = center.get("lat")

        lon = center.get("lon")

    if (
        lat is None
        or lon is None
    ):

        return None

    name = (
        tags.get("name")
        or tags.get("brand")
        or f"{category} near location"
    )

    address_parts = []

    for key in [
        "addr:housenumber",
        "addr:street",
        "addr:suburb",
        "addr:neighbourhood",
        "addr:city",
        "addr:district",
        "addr:state",
        "addr:postcode",
    ]:

        if tags.get(key):

            address_parts.append(
                tags[key]
            )

    address = ", ".join(
        address_parts
    )

    google_maps_url = (
        "https://www.google.com/maps/search/"
        f"?api=1&query={lat},{lon}"
    )

    directions_url = (
        "https://www.google.com/maps/dir/"
        f"?api=1&destination={lat},{lon}"
    )

    gender = (
        tags.get("gender")
        or tags.get("female")
        or "Unisex"
    )

    gender_text = str(
        gender
    ).lower()

    if gender_text in [
        "yes",
        "female",
        "girls",
    ]:

        gender = "Girls"

    elif gender_text in [
        "male",
        "boys",
    ]:

        gender = "Boys"

    else:

        gender = "Unisex"

    website = (
        tags.get("website")
        or tags.get("contact:website")
    )

    phone = (
        tags.get("phone")
        or tags.get("contact:phone")
    )

    return {

        "id":
            f"osm-{element.get('type')}-{element.get('id')}",

        "name": name,

        "property_type": category,

        "pg_type": gender,

        "location":
            address
            or tags.get(
                "addr:full",
                "Location available on map"
            ),

        "rent": None,

        "owner_name": None,

        "owner_phone": phone,

        "food_available": False,

        "food_type": None,

        "food_rating": 0,

        "cleaning_rating": 0,

        "water_available": True,

        "wifi_available": False,

        "cctv_available": False,

        "latitude": float(lat),

        "longitude": float(lon),

        "ac_available": False,

        "geyser_available": False,

        "parking_available": False,

        "power_backup": False,

        "laundry_available": False,

        "security_available": False,

        "hygiene_rating": 0,

        "room_type": None,

        "room_available": True,

        "attached_washroom": False,

        "common_washroom": False,

        "washroom_cleaning_rating": 0,

        "source": "OpenStreetMap",

        "google_maps_url":
            google_maps_url,

        "directions_url":
            directions_url,

        "website": website,

        "phone": phone,

        "osm_type":
            element.get("type"),

        "osm_id":
            element.get("id"),
    }


# =========================================================
# REAL INDIA SEARCH
# =========================================================

@app.get("/search-real-accommodation")
async def search_real_accommodation(
    location: str,
    property_type: str = "PG",
):

    location = location.strip()

    property_type = property_type.strip()

    if not location:

        return []

    # -----------------------------------------------------
    # GET REAL LOCATION COORDINATES
    # -----------------------------------------------------

    geo = await geocode_location(
        location
    )

    if not geo:

        return []

    lat = geo["latitude"]

    lon = geo["longitude"]

    # -----------------------------------------------------
    # SEARCH 15 KM
    # -----------------------------------------------------

    query = get_overpass_query(
        lat,
        lon,
        15000,
        property_type,
    )

    elements = []

    # -----------------------------------------------------
    # TRY MULTIPLE OVERPASS SERVERS
    # -----------------------------------------------------

    for server in OVERPASS_SERVERS:

        try:

            async with httpx.AsyncClient(
                timeout=100,
                headers=HEADERS,
                follow_redirects=True,
            ) as client:

                response = await client.post(
                    server,
                    content=query.encode(
                        "utf-8"
                    ),
                )

                response.raise_for_status()

                data = response.json()

                elements = data.get(
                    "elements",
                    []
                )

                if elements:

                    print(
                        "OVERPASS SUCCESS:",
                        server,
                        "RESULTS:",
                        len(elements)
                    )

                    break

        except Exception as e:

            print(
                "OVERPASS ERROR:",
                server,
                repr(e)
            )

            continue

    # -----------------------------------------------------
    # CONVERT RESULTS
    # -----------------------------------------------------

    results = []

    for element in elements:

        result = osm_to_result(
            element,
            property_type,
        )

        if not result:

            continue

        result["distance_km"] = round(
            distance_km(
                lat,
                lon,
                result["latitude"],
                result["longitude"],
            ),
            2
        )

        results.append(result)

    # -----------------------------------------------------
    # SORT BY DISTANCE
    # -----------------------------------------------------

    results.sort(
        key=lambda x:
            x.get(
                "distance_km",
                999999
            )
    )

    # -----------------------------------------------------
    # REMOVE DUPLICATES
    # -----------------------------------------------------

    unique = []

    seen = set()

    for item in results:

        key = (
            str(
                item["name"]
            ).lower().strip(),

            round(
                item["latitude"],
                4
            ),

            round(
                item["longitude"],
                4
            ),
        )

        if key in seen:

            continue

        seen.add(key)

        unique.append(item)

    return unique[:100]


# =========================================================
# SMART SEARCH
# DATABASE + REAL OSM
# =========================================================

@app.get("/smart-search")
async def smart_search(
    location: str,
    property_type: str = "PG",
    db: Session = Depends(get_db),
):

    location = location.strip()

    property_type = property_type.strip()

    if not location:

        return []

    # -----------------------------------------------------
    # DATABASE RESULTS
    # -----------------------------------------------------

    database_results = []

    query = db.query(PGTable)

    if property_type.lower() != "all":

        query = query.filter(
            PGTable.property_type.ilike(
                property_type
            )
        )

    query = query.filter(
        PGTable.location.ilike(
            f"%{location}%"
        )
    )

    database_properties = query.all()

    for pg in database_properties:

        item = pg_to_dict(pg)

        item["source"] = (
            "Smart PG Database"
        )

        database_results.append(item)

    # -----------------------------------------------------
    # REAL OPENSTREETMAP RESULTS
    # -----------------------------------------------------

    real_results = []

    try:

        if property_type.lower() == "all":

            categories = [
                "PG",
                "Hostel",
                "Co-Living",
                "Flat",
            ]

        else:

            categories = [
                property_type
            ]

        for category in categories:

            try:

                items = (
                    await search_real_accommodation(
                        location=location,
                        property_type=category,
                    )
                )

                real_results.extend(items)

            except Exception as e:

                print(
                    "REAL SEARCH ERROR:",
                    category,
                    repr(e)
                )

    except Exception as e:

        print(
            "SMART SEARCH ERROR:",
            repr(e)
        )

    # -----------------------------------------------------
    # COMBINE DATABASE + REAL RESULTS
    # -----------------------------------------------------

    combined = []

    seen = set()

    for item in (
        database_results
        + real_results
    ):

        name = str(
            item.get(
                "name",
                ""
            )
        ).lower().strip()

        lat = item.get(
            "latitude"
        )

        lon = item.get(
            "longitude"
        )

        if lat is not None and lon is not None:

            key = (
                name,
                round(
                    float(lat),
                    4
                ),
                round(
                    float(lon),
                    4
                ),
            )

        else:

            key = (
                name,
                str(
                    item.get(
                        "location",
                        ""
                    )
                ).lower().strip(),
            )

        if key in seen:

            continue

        seen.add(key)

        combined.append(item)

    # -----------------------------------------------------
    # DISTANCE SORT
    # -----------------------------------------------------

    geo = await geocode_location(
        location
    )

    if geo:

        search_lat = geo["latitude"]

        search_lon = geo["longitude"]

        for item in combined:

            if (
                item.get("latitude")
                is not None
                and
                item.get("longitude")
                is not None
            ):

                item["distance_km"] = round(
                    distance_km(
                        search_lat,
                        search_lon,
                        float(
                            item["latitude"]
                        ),
                        float(
                            item["longitude"]
                        ),
                    ),
                    2
                )

        combined.sort(
            key=lambda x:
                x.get(
                    "distance_km",
                    999999
                )
        )

    return combined[:100]


# =========================================================
# NEARBY DATABASE PG
# =========================================================

@app.get("/nearby-pgs")
def nearby_pgs(
    latitude: float,
    longitude: float,
    radius_km: float = 10,
    property_type: Optional[str] = None,
    db: Session = Depends(get_db),
):

    query = db.query(PGTable)

    if (
        property_type
        and property_type.lower() != "all"
    ):

        query = query.filter(
            PGTable.property_type.ilike(
                property_type
            )
        )

    properties = query.all()

    results = []

    for pg in properties:

        if (
            pg.latitude is None
            or pg.longitude is None
        ):

            continue

        distance = distance_km(
            latitude,
            longitude,
            pg.latitude,
            pg.longitude,
        )

        if distance <= radius_km:

            item = pg_to_dict(pg)

            item["distance_km"] = round(
                distance,
                2
            )

            results.append(item)

    results.sort(
        key=lambda x:
            x["distance_km"]
    )

    return results


# =========================================================
# REAL NEARBY SEARCH
# =========================================================

@app.get("/nearby-real-accommodation")
async def nearby_real_accommodation(
    latitude: float,
    longitude: float,
    property_type: str = "PG",
    radius_km: int = 15,
):

    query = get_overpass_query(
        latitude,
        longitude,
        radius_km * 1000,
        property_type,
    )

    elements = []

    for server in OVERPASS_SERVERS:

        try:

            async with httpx.AsyncClient(
                timeout=100,
                headers=HEADERS,
                follow_redirects=True,
            ) as client:

                response = await client.post(
                    server,
                    content=query.encode(
                        "utf-8"
                    ),
                )

                response.raise_for_status()

                data = response.json()

                elements = data.get(
                    "elements",
                    []
                )

                if elements:

                    break

        except Exception as e:

            print(
                "NEARBY REAL ERROR:",
                repr(e)
            )

            continue

    results = []

    for element in elements:

        item = osm_to_result(
            element,
            property_type
        )

        if not item:

            continue

        distance = distance_km(
            latitude,
            longitude,
            item["latitude"],
            item["longitude"],
        )

        item["distance_km"] = round(
            distance,
            2
        )

        results.append(item)

    results.sort(
        key=lambda x:
            x["distance_km"]
    )

    return results[:100]


# =========================================================
# STARTUP
# =========================================================

@app.on_event("startup")
def startup():

    Base.metadata.create_all(
        bind=engine
    )

    print(
        "================================="
    )

    print(
        "SMART PG API STARTED"
    )

    print(
        "VERSION: 8.0.0"
    )

    print(
        "AUTHENTICATION: ON"
    )

    print(
        "USER LOGIN: ON"
    )

    print(
        "OWNER LOGIN: ON"
    )

    print(
        "OWNER PROPERTY CONTROL: ON"
    )

    print(
        "REAL INDIA SEARCH: ON"
    )

    print(
        "OPENSTREETMAP: ON"
    )

    print(
        "NOMINATIM: ON"
    )

    print(
        "OVERPASS: ON"
    )

    print(
        "================================="
    )
