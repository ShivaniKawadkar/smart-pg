import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Map,
  Navigation,
  Plus,
  X,
  Save,
  Trash2,
  Edit,
  Home,
  Building2,
  BedDouble,
  LogOut,
  User,
  MapPin,
  LocateFixed,
  Phone,
  Globe,
  Image as ImageIcon,
} from "lucide-react";

const API_URL = "https://smart-pg-backend-shivani.onrender.com";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const emptyForm = {
  name: "",
  property_type: "PG",
  pg_type: "Girls",
  location: "",
  rent: "",
  owner_name: "",
  owner_phone: "",
  food_available: true,
  food_type: "Veg",
  food_rating: 0,
  cleaning_rating: 0,
  water_available: true,
  wifi_available: true,
  cctv_available: true,
  latitude: null,
  longitude: null,
  ac_available: false,
  geyser_available: false,
  parking_available: false,
  power_backup: false,
  laundry_available: false,
  security_available: false,
  hygiene_rating: 0,
  room_type: "Single",
  room_available: true,
  attached_washroom: false,
  common_washroom: true,
  washroom_cleaning_rating: 0,
};

function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("smartpg_user")) || null;
    } catch {
      return null;
    }
  });

  const [loginName, setLoginName] = useState("");

  const [pgs, setPgs] = useState([]);
  const [realPGs, setRealPGs] = useState([]);

  const [loading, setLoading] = useState(false);
  const [realLoading, setRealLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [propertyType, setPropertyType] = useState("All");
  const [pgType, setPgType] = useState("All");
  const [foodType, setFoodType] = useState("All");
  const [maxRent, setMaxRent] = useState("");

  const [currentLocation, setCurrentLocation] = useState(null);
  const [mapLocation, setMapLocation] = useState(null);
  const [locationName, setLocationName] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();

    const name = loginName.trim();

    if (!name) {
      alert("Please enter your name");
      return;
    }

    const loggedUser = {
      name,
      email:
        name.toLowerCase().replace(/\s+/g, "") + "@smartpg.com",
    };

    localStorage.setItem(
      "smartpg_user",
      JSON.stringify(loggedUser)
    );

    setUser(loggedUser);
  };

  const logout = () => {
    localStorage.removeItem("smartpg_user");
    setUser(null);
  };

  const fetchPGs = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/pg`);

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();

      setPgs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(
        "Backend se properties load nahi ho pa rahi hain."
      );
      setPgs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPGs();
    }
  }, [user]);

  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await fetch(
        `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return "Current location";
      }

      const data = await response.json();

      return data.display_name || "Current location";
    } catch {
      return "Current location";
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("GPS is not supported by this browser.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        setCurrentLocation(location);
        setMapLocation(location);

        const name = await reverseGeocode(
          coords.latitude,
          coords.longitude
        );

        setLocationName(name);
        setSearch(
          name
            .split(",")
            .slice(0, 3)
            .join(", ")
        );

        await searchRealPGs(location);

        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);

        if (err.code === 1) {
          alert(
            "Location permission denied. Chrome address bar se Location Allow karo."
          );
        } else {
          alert("GPS location nahi mil pa rahi hai.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const getImageFromTags = (tags = {}) => {
    if (tags.image) return tags.image;

    if (tags["image:url"]) {
      return tags["image:url"];
    }

    if (tags.wikimedia_commons) {
      const value = tags.wikimedia_commons
        .replace(/^File:/i, "")
        .trim();

      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(
        value
      )}`;
    }

    return "";
  };

  const runOverpass = async (query) => {
    let lastError = null;

    for (const url of OVERPASS_URLS) {
      try {
        const response = await fetch(url, {
          method: "POST",
          body: query,
        });

        if (response.ok) {
          return await response.json();
        }

        lastError = new Error(
          `Overpass error ${response.status}`
        );
      } catch (err) {
        lastError = err;
      }
    }

    throw (
      lastError ||
      new Error("Real map service unavailable")
    );
  };

  const searchRealPGs = async (coords = null) => {
    const location = search.trim();

    if (!location && !coords) {
      alert("Pehle city, area ya location enter karo.");
      return;
    }

    try {
      setRealLoading(true);

      let lat;
      let lon;

      if (coords) {
        lat = Number(coords.latitude);
        lon = Number(coords.longitude);
      } else {
        const response = await fetch(
          `${NOMINATIM_URL}/search?format=jsonv2&limit=1&q=${encodeURIComponent(
            location
          )}`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Location search failed");
        }

        const data = await response.json();

        if (!data.length) {
          alert(
            "Location nahi mili. Example: Bangalore, HSR Layout, Koramangala"
          );
          setRealPGs([]);
          return;
        }

        lat = Number(data[0].lat);
        lon = Number(data[0].lon);

        setLocationName(
          data[0].display_name || location
        );
      }

      const selectedType = propertyType;
      const radius = 7000;

      let categoryQuery = `
        (
          node["tourism"="hostel"](around:${radius},${lat},${lon});
          way["tourism"="hostel"](around:${radius},${lat},${lon});
          relation["tourism"="hostel"](around:${radius},${lat},${lon});

          node["amenity"="hostel"](around:${radius},${lat},${lon});
          way["amenity"="hostel"](around:${radius},${lat},${lon});

          node["tourism"="guest_house"](around:${radius},${lat},${lon});
          way["tourism"="guest_house"](around:${radius},${lat},${lon});

          node["tourism"="hotel"](around:${radius},${lat},${lon});
          way["tourism"="hotel"](around:${radius},${lat},${lon});

          node["building"="apartments"](around:${radius},${lat},${lon});
          way["building"="apartments"](around:${radius},${lat},${lon});

          node["name"~"PG|Paying Guest|Hostel|Hostel",i](around:${radius},${lat},${lon});
          way["name"~"PG|Paying Guest|Hostel|Hostel",i](around:${radius},${lat},${lon});

          node["name"~"co.?living|coliving",i](around:${radius},${lat},${lon});
          way["name"~"co.?living|coliving",i](around:${radius},${lat},${lon});
        );
      `;

      if (selectedType === "Hostel") {
        categoryQuery = `
          (
            node["tourism"="hostel"](around:${radius},${lat},${lon});
            way["tourism"="hostel"](around:${radius},${lat},${lon});
            relation["tourism"="hostel"](around:${radius},${lat},${lon});

            node["amenity"="hostel"](around:${radius},${lat},${lon});
            way["amenity"="hostel"](around:${radius},${lat},${lon});
            relation["amenity"="hostel"](around:${radius},${lat},${lon});

            node["name"~"hostel",i](around:${radius},${lat},${lon});
            way["name"~"hostel",i](around:${radius},${lat},${lon});
          );
        `;
      }

      if (selectedType === "PG") {
        categoryQuery = `
          (
            node["tourism"="guest_house"](around:${radius},${lat},${lon});
            way["tourism"="guest_house"](around:${radius},${lat},${lon});

            node["name"~"PG|Paying Guest|paying guest",i](around:${radius},${lat},${lon});
            way["name"~"PG|Paying Guest|paying guest",i](around:${radius},${lat},${lon});
          );
        `;
      }

      if (selectedType === "Flat") {
        categoryQuery = `
          (
            node["building"="apartments"](around:${radius},${lat},${lon});
            way["building"="apartments"](around:${radius},${lat},${lon});

            node["residential"="apartments"](around:${radius},${lat},${lon});
            way["residential"="apartments"](around:${radius},${lat},${lon});
          );
        `;
      }

      if (selectedType === "Co-Living") {
        categoryQuery = `
          (
            node["name"~"co.?living|coliving",i](around:${radius},${lat},${lon});
            way["name"~"co.?living|coliving",i](around:${radius},${lat},${lon});
          );
        `;
      }

      const query = `
        [out:json][timeout:40];
        ${categoryQuery}
        out center tags;
      `;

      const data = await runOverpass(query);

      const results = (data.elements || [])
        .map((item) => {
          const tags = item.tags || {};

          const latitude =
            item.lat ??
            item.center?.lat ??
            null;

          const longitude =
            item.lon ??
            item.center?.lon ??
            null;

          if (
            latitude === null ||
            longitude === null
          ) {
            return null;
          }

          const name =
            tags.name ||
            tags["name:en"] ||
            "Mapped Accommodation";

          let type = "Accommodation";

          if (
            tags.tourism === "hostel" ||
            tags.amenity === "hostel"
          ) {
            type = "Hostel";
          } else if (
            tags.tourism === "guest_house"
          ) {
            type = "PG";
          } else if (
            tags.tourism === "hotel"
          ) {
            type = "Hotel";
          } else if (
            tags.building === "apartments"
          ) {
            type = "Flat";
          } else if (
            /co.?living|coliving/i.test(
              name
            )
          ) {
            type = "Co-Living";
          }

          const address = [
            tags["addr:housenumber"],
            tags["addr:street"],
            tags["addr:suburb"],
            tags["addr:city"],
          ]
            .filter(Boolean)
            .join(", ");

          return {
            id: `osm-${item.type}-${item.id}`,
            name,
            property_type: type,
            pg_type: "Unisex",
            location:
              address ||
              locationName ||
              location ||
              "Mapped location",
            rent: null,
            owner_name: "OpenStreetMap",
            owner_phone:
              tags.phone ||
              tags["contact:phone"] ||
              "",
            food_available: Boolean(
              tags.restaurant ||
                tags.cuisine
            ),
            food_type:
              tags.cuisine ||
              "Not specified",
            wifi_available:
              tags.internet_access === "wlan",
            water_available: true,
            cctv_available: false,
            latitude: Number(latitude),
            longitude: Number(longitude),
            room_type: "Not specified",
            room_available: true,
            website:
              tags.website ||
              tags["contact:website"] ||
              "",
            image: getImageFromTags(tags),
            distanceKm:
              coords
                ? haversine(
                    coords.latitude,
                    coords.longitude,
                    Number(latitude),
                    Number(longitude)
                  )
                : null,
            isReal: true,
          };
        })
        .filter(Boolean);

      const unique = results.filter(
        (item, index, array) =>
          index ===
          array.findIndex(
            (other) =>
              other.name.toLowerCase() ===
                item.name.toLowerCase() &&
              Math.abs(
                other.latitude -
                  item.latitude
              ) < 0.0001 &&
              Math.abs(
                other.longitude -
                  item.longitude
              ) < 0.0001
          )
      );

      unique.sort(
        (a, b) =>
          (a.distanceKm ?? 99999) -
          (b.distanceKm ?? 99999)
      );

      setRealPGs(unique);

      const newMapLocation = {
        latitude: lat,
        longitude: lon,
      };

      setMapLocation(newMapLocation);

      if (!coords) {
        setCurrentLocation(null);
      }

      if (!locationName && location) {
        setLocationName(location);
      }
    } catch (err) {
      console.error(err);
      setRealPGs([]);

      alert(
        "Real map search temporarily unavailable. Thodi der baad Try Again karo."
      );
    } finally {
      setRealLoading(false);
    }
  };

  const handleSearch = () => {
    searchRealPGs();
  };

  const filteredPGs = useMemo(() => {
    const text = search
      .trim()
      .toLowerCase();

    return pgs.filter((pg) => {
      const matchesText =
        !text ||
        pg.name
          ?.toLowerCase()
          .includes(text) ||
        pg.location
          ?.toLowerCase()
          .includes(text);

      const matchesProperty =
        propertyType === "All" ||
        pg.property_type
          ?.toLowerCase() ===
          propertyType.toLowerCase();

      const matchesPGType =
        pgType === "All" ||
        pg.pg_type
          ?.toLowerCase() ===
          pgType.toLowerCase();

      const matchesFood =
        foodType === "All" ||
        pg.food_type
          ?.toLowerCase() ===
          foodType.toLowerCase();

      const matchesRent =
        !maxRent ||
        Number(pg.rent) <=
          Number(maxRent);

      return (
        matchesText &&
        matchesProperty &&
        matchesPGType &&
        matchesFood &&
        matchesRent
      );
    });
  }, [
    pgs,
    search,
    propertyType,
    pgType,
    foodType,
    maxRent,
  ]);

  const getCount = (type) => {
    if (type === "All") {
      return pgs.length;
    }

    return pgs.filter(
      (pg) =>
        pg.property_type
          ?.toLowerCase() ===
        type.toLowerCase()
    ).length;
  };

  const clearFilters = () => {
    setSearch("");
    setPropertyType("All");
    setPgType("All");
    setFoodType("All");
    setMaxRent("");
    setRealPGs([]);
    setCurrentLocation(null);
    setMapLocation(null);
    setLocationName("");
  };

  const updateForm = (
    field,
    value
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const openAddForm = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
      owner_name:
        user?.name || "",
    });

    setShowForm(true);
  };

  const openEditForm = (pg) => {
    setEditingId(pg.id);

    setForm({
      ...emptyForm,
      ...pg,
      rent: pg.rent ?? "",
    });

    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const useGPSInForm = () => {
    if (!navigator.geolocation) {
      alert("GPS not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateForm(
          "latitude",
          Number(
            coords.latitude.toFixed(6)
          )
        );

        updateForm(
          "longitude",
          Number(
            coords.longitude.toFixed(6)
          )
        );

        alert(
          "Current GPS coordinates added!"
        );
      },
      () => {
        alert(
          "GPS permission allow karo."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  };

  const saveProperty = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Property name required");
      return;
    }

    if (!form.location.trim()) {
      alert("Location required");
      return;
    }

    if (!form.rent) {
      alert("Rent required");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,

        name: form.name.trim(),

        location:
          form.location.trim(),

        owner_name:
          form.owner_name.trim() ||
          user?.name ||
          "Owner",

        rent: Number(form.rent),

        food_rating: Number(
          form.food_rating || 0
        ),

        cleaning_rating: Number(
          form.cleaning_rating || 0
        ),

        hygiene_rating: Number(
          form.hygiene_rating || 0
        ),

        washroom_cleaning_rating:
          Number(
            form.washroom_cleaning_rating ||
              0
          ),
      };

      delete payload.id;
      delete payload.isReal;
      delete payload.distanceKm;
      delete payload.website;
      delete payload.image;

      const url = editingId
        ? `${API_URL}/pg/${editingId}`
        : `${API_URL}/pg`;

      const response =
        await fetch(url, {
          method: editingId
            ? "PUT"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            payload
          ),
        });

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          data?.detail
            ? JSON.stringify(
                data.detail
              )
            : `Server error ${response.status}`
        );
      }

      await fetchPGs();

      closeForm();

      alert(
        editingId
          ? "Property updated successfully!"
          : "Property added successfully!"
      );
    } catch (err) {
      alert(
        `Error: ${err.message}`
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProperty = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this property?"
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `${API_URL}/pg/${id}`,
          {
            method: "DELETE",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Delete failed"
        );
      }

      await fetchPGs();

      alert(
        "Property deleted successfully!"
      );
    } catch (err) {
      alert(
        `Error: ${err.message}`
      );
    }
  };

  const openMap = (pg) => {
    if (
      pg.latitude == null ||
      pg.longitude == null
    ) {
      alert(
        "Location coordinates available nahi hain."
      );
      return;
    }

    window.open(
      `https://www.openstreetmap.org/?mlat=${pg.latitude}&mlon=${pg.longitude}#map=18/${pg.latitude}/${pg.longitude}`,
      "_blank"
    );
  };

  const openDirections = (pg) => {
    if (
      pg.latitude == null ||
      pg.longitude == null
    ) {
      alert(
        "Location coordinates available nahi hain."
      );
      return;
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${pg.latitude},${pg.longitude}`,
      "_blank"
    );
  };

  const openWebsite = (pg) => {
    if (!pg.website) {
      alert(
        "Website available nahi hai."
      );
      return;
    }

    const url =
      pg.website.startsWith("http")
        ? pg.website
        : `https://${pg.website}`;

    window.open(url, "_blank");
  };

  const getPropertyIcon = (type) => {
    if (type === "PG") {
      return <Home size={20} />;
    }

    if (type === "Co-Living") {
      return <Building2 size={20} />;
    }

    if (type === "Hostel") {
      return <BedDouble size={20} />;
    }

    if (type === "Flat") {
      return <Building2 size={20} />;
    }

    return <Home size={20} />;
  };

  if (!user) {
    return (
      <>
        <style>{styles}</style>

        <div className="login-page">
          <div className="login-card">
            <div className="login-logo">
              🏠
            </div>

            <h1>Smart PG</h1>

            <p>
              Find your perfect stay
            </p>

            <form
              onSubmit={handleLogin}
            >
              <label className="login-label">
                Your Name
              </label>

              <input
                className="login-input"
                value={loginName}
                onChange={(e) =>
                  setLoginName(
                    e.target.value
                  )
                }
                placeholder="Enter your name"
              />

              <button className="login-button">
                Login
              </button>
            </form>

            <div className="login-footer">
              Smart PG Accommodation
              Finder
            </div>
          </div>
        </div>
      </>
    );
  }

  const categories = [
    ["All", "All Properties"],
    ["PG", "Paying Guest"],
    ["Hostel", "Hostels"],
    ["Co-Living", "Shared Living"],
    ["Flat", "Flats"],
  ];

  return (
    <div className="app">
      <style>{styles}</style>

      <nav className="navbar">
        <div>
          <div className="brand">
            🏠 Smart PG
          </div>

          <div className="brand-sub">
            Real location • GPS •
            Nearby stays
          </div>
        </div>

        <div className="navbar-right">
          <div className="hello">
            <User size={14} />
            Hi, {user.name}
          </div>

          <button
            className="add-btn"
            onClick={openAddForm}
          >
            <Plus size={18} />
            Add Property
          </button>

          <button
            className="logout-btn"
            onClick={logout}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-label">
            📍 SMART GPS ACCOMMODATION
            FINDER
          </div>

          <h1>
            Find Your Perfect{" "}
            <span>
              PG, Hostel, Co-Living
              & Flat
            </span>
          </h1>

          <p>
            Search any city, area,
            landmark or PIN code and
            discover mapped
            accommodation around
            that location.
          </p>

          <div className="search-box">
            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter"
                ) {
                  handleSearch();
                }
              }}
              placeholder="Search Bangalore, HSR Layout, Koramangala..."
            />

            <button
              className="gps-btn"
              onClick={
                getCurrentLocation
              }
              disabled={
                locationLoading
              }
            >
              <LocateFixed size={18} />

              {locationLoading
                ? "Getting GPS..."
                : "Use My Location"}
            </button>

            <button
              className="search-btn"
              onClick={handleSearch}
              disabled={realLoading}
            >
              <Search size={18} />

              {realLoading
                ? "Searching..."
                : "Search"}
            </button>
          </div>

          {locationName && (
            <div className="current-location">
              <MapPin size={17} />

              <div>
                <strong>
                  Location:
                </strong>{" "}
                {locationName}
              </div>
            </div>
          )}

          <div className="real-search-note">
            🟢 Real mapped data from
            OpenStreetMap. Search
            results depend on places
            actually mapped in
            OpenStreetMap.
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">
          1️⃣ Choose Accommodation
        </h2>

        <p className="section-subtitle">
          Select PG, Hostel, Co-Living
          or Flat before searching.
        </p>

        <div className="categories">
          {categories.map(
            ([type, description]) => (
              <button
                key={type}
                className={`category ${
                  propertyType === type
                    ? "active"
                    : ""
                }`}
                onClick={() => {
                  setPropertyType(
                    type
                  );

                  if (search) {
                    setTimeout(
                      () =>
                        searchRealPGs(),
                      0
                    );
                  }
                }}
              >
                <div className="category-name">
                  {getPropertyIcon(
                    type
                  )}

                  {type}
                </div>

                <div className="category-desc">
                  {description}
                </div>

                <div className="category-count">
                  {getCount(type)}
                </div>
              </button>
            )
          )}
        </div>
      </section>

      {mapLocation && (
        <LiveMap
          location={mapLocation}
          results={realPGs}
        />
      )}

      {realPGs.length > 0 && (
        <section className="section">
          <div className="result-header">
            <div>
              <h2>
                📍 Real Mapped
                Accommodations
              </h2>

              <div className="section-subtitle">
                Found{" "}
                <strong>
                  {realPGs.length}
                </strong>{" "}
                mapped places
                {currentLocation
                  ? " near your GPS location"
                  : ""}
              </div>
            </div>

            <button
              className="refresh-btn"
              onClick={() =>
                searchRealPGs(
                  currentLocation
                )
              }
            >
              <RefreshCw size={16} />
              Search Again
            </button>
          </div>

          <div className="cards">
            {realPGs.map((pg) => (
              <RealCard
                key={pg.id}
                pg={pg}
                openMap={openMap}
                openDirections={
                  openDirections
                }
                openWebsite={
                  openWebsite
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="result-header">
          <div>
            <h2>
              🏠 Smart PG Properties
            </h2>

            <div className="section-subtitle">
              Showing{" "}
              <strong>
                {filteredPGs.length}
              </strong>{" "}
              properties added by
              Smart PG users.
            </div>
          </div>

          <button
            className="refresh-btn"
            onClick={fetchPGs}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="empty">
            Loading properties...
          </div>
        )}

        {!loading && error && (
          <div className="error">
            <h3>
              ⚠️ Unable to load
              properties
            </h3>

            <p>{error}</p>

            <button
              className="refresh-btn"
              onClick={fetchPGs}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          filteredPGs.length === 0 && (
            <div className="empty">
              <h3>
                No Smart PG properties
                added yet
              </h3>

              <p>
                Real OpenStreetMap
                search upar available
                hai.
              </p>

              <button
                className="add-btn"
                onClick={
                  openAddForm
                }
              >
                <Plus size={17} />
                Add First Property
              </button>
            </div>
          )}

        {!loading &&
          !error &&
          filteredPGs.length > 0 && (
            <div className="cards">
              {filteredPGs.map(
                (pg) => (
                  <DBCard
                    key={pg.id}
                    pg={pg}
                    openMap={openMap}
                    openDirections={
                      openDirections
                    }
                    openEditForm={
                      openEditForm
                    }
                    deleteProperty={
                      deleteProperty
                    }
                  />
                )
              )}
            </div>
          )}
      </section>

      <section className="section">
        <h2 className="section-title">
          🔎 Stay Filters
        </h2>

        <p className="section-subtitle">
          Boys/Girls/Unisex, food and
          maximum rent.
        </p>

        <div className="filters">
          <div className="field">
            <label>
              Suitable For
            </label>

            <select
              value={pgType}
              onChange={(e) =>
                setPgType(
                  e.target.value
                )
              }
            >
              <option>All</option>
              <option>Boys</option>
              <option>Girls</option>
              <option>Unisex</option>
            </select>
          </div>

          <div className="field">
            <label>Food</label>

            <select
              value={foodType}
              onChange={(e) =>
                setFoodType(
                  e.target.value
                )
              }
            >
              <option>All</option>
              <option>Veg</option>
              <option>Non-Veg</option>
            </select>
          </div>

          <div className="field">
            <label>
              Maximum Rent
            </label>

            <input
              type="number"
              value={maxRent}
              onChange={(e) =>
                setMaxRent(
                  e.target.value
                )
              }
              placeholder="₹ Maximum rent"
            />
          </div>

          <button
            className="reset-btn"
            onClick={
              clearFilters
            }
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </div>
      </section>

      <footer>
        <strong>
          🏠 Smart PG
        </strong>

        <p>
          Find PG, Hostel,
          Co-Living & Flat with
          GPS and real mapped
          location search.
        </p>

        <div>
          © 2026 Smart PG
        </div>
      </footer>

      {showForm && (
        <div className="modal-bg">
          <div className="modal">
            <div className="modal-header">
              <h2>
                {editingId
                  ? "Edit Property"
                  : "Add Property"}
              </h2>

              <button
                className="close-btn"
                onClick={closeForm}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={
                saveProperty
              }
            >
              <div className="form-grid">
                <FormInput
                  label="Property Name *"
                  value={form.name}
                  onChange={(v) =>
                    updateForm(
                      "name",
                      v
                    )
                  }
                  placeholder="e.g. Shivani PG"
                />

                <FormSelect
                  label="Property Type"
                  value={
                    form.property_type
                  }
                  options={[
                    "PG",
                    "Hostel",
                    "Co-Living",
                    "Flat",
                  ]}
                  onChange={(v) =>
                    updateForm(
                      "property_type",
                      v
                    )
                  }
                />

                <FormSelect
                  label="Suitable For"
                  value={
                    form.pg_type
                  }
                  options={[
                    "Boys",
                    "Girls",
                    "Unisex",
                  ]}
                  onChange={(v) =>
                    updateForm(
                      "pg_type",
                      v
                    )
                  }
                />

                <FormInput
                  label="Location *"
                  value={
                    form.location
                  }
                  onChange={(v) =>
                    updateForm(
                      "location",
                      v
                    )
                  }
                  placeholder="Bangalore"
                />

                <FormInput
                  label="Monthly Rent *"
                  type="number"
                  value={form.rent}
                  onChange={(v) =>
                    updateForm(
                      "rent",
                      v
                    )
                  }
                  placeholder="8000"
                />

                <FormSelect
                  label="Room Type"
                  value={
                    form.room_type
                  }
                  options={[
                    "Single",
                    "Double",
                    "Triple",
                    "Shared",
                  ]}
                  onChange={(v) =>
                    updateForm(
                      "room_type",
                      v
                    )
                  }
                />

                <FormInput
                  label="Owner Name"
                  value={
                    form.owner_name
                  }
                  onChange={(v) =>
                    updateForm(
                      "owner_name",
                      v
                    )
                  }
                  placeholder="Owner name"
                />

                <FormInput
                  label="Owner Phone"
                  value={
                    form.owner_phone
                  }
                  onChange={(v) =>
                    updateForm(
                      "owner_phone",
                      v
                    )
                  }
                  placeholder="Phone number"
                />

                <FormSelect
                  label="Food Type"
                  value={
                    form.food_type
                  }
                  options={[
                    "Veg",
                    "Non-Veg",
                  ]}
                  onChange={(v) =>
                    updateForm(
                      "food_type",
                      v
                    )
                  }
                />

                <FormInput
                  label="Food Rating"
                  type="number"
                  value={
                    form.food_rating
                  }
                  onChange={(v) =>
                    updateForm(
                      "food_rating",
                      v
                    )
                  }
                  placeholder="0-5"
                />

                <FormInput
                  label="Cleaning Rating"
                  type="number"
                  value={
                    form.cleaning_rating
                  }
                  onChange={(v) =>
                    updateForm(
                      "cleaning_rating",
                      v
                    )
                  }
                  placeholder="0-5"
                />

                <FormInput
                  label="Latitude"
                  type="number"
                  value={
                    form.latitude ??
                    ""
                  }
                  onChange={(v) =>
                    updateForm(
                      "latitude",
                      v
                        ? Number(v)
                        : null
                    )
                  }
                  placeholder="12.9716"
                />

                <FormInput
                  label="Longitude"
                  type="number"
                  value={
                    form.longitude ??
                    ""
                  }
                  onChange={(v) =>
                    updateForm(
                      "longitude",
                      v
                        ? Number(v)
                        : null
                    )
                  }
                  placeholder="77.5946"
                />
              </div>

              <button
                type="button"
                className="gps-form-btn"
                onClick={
                  useGPSInForm
                }
              >
                <LocateFixed
                  size={16}
                />
                Use Current GPS
              </button>

              <div className="checkboxes">
                {[
                  [
                    "food_available",
                    "Food Available",
                  ],
                  [
                    "water_available",
                    "Water Available",
                  ],
                  [
                    "wifi_available",
                    "WiFi Available",
                  ],
                  [
                    "cctv_available",
                    "CCTV Available",
                  ],
                  [
                    "ac_available",
                    "AC Available",
                  ],
                  [
                    "geyser_available",
                    "Geyser Available",
                  ],
                  [
                    "parking_available",
                    "Parking",
                  ],
                  [
                    "power_backup",
                    "Power Backup",
                  ],
                  [
                    "laundry_available",
                    "Laundry",
                  ],
                  [
                    "security_available",
                    "Security",
                  ],
                  [
                    "room_available",
                    "Room Available",
                  ],
                  [
                    "attached_washroom",
                    "Attached Washroom",
                  ],
                  [
                    "common_washroom",
                    "Common Washroom",
                  ],
                ].map(
                  ([field, label]) => (
                    <label
                      className="check"
                      key={field}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(
                          form[field]
                        )}
                        onChange={(e) =>
                          updateForm(
                            field,
                            e.target
                              .checked
                          )
                        }
                      />

                      {label}
                    </label>
                  )
                )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel"
                  onClick={
                    closeForm
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save"
                  disabled={saving}
                >
                  <Save size={17} />

                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Property"
                    : "Save Property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FormInput({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}) {
  return (
    <div className="form-group">
      <label>{label}</label>

      <input
        type={type}
        value={value ?? ""}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        placeholder={placeholder}
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}) {
  return (
    <div className="form-group">
      <label>{label}</label>

      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
      >
        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          )
        )}
      </select>
    </div>
  );
}

function LiveMap({
  location,
  results,
}) {
  if (!location) {
    return null;
  }

  const lat = Number(
    location.latitude
  );

  const lon = Number(
    location.longitude
  );

  const delta = 0.06;

  const left = lon - delta;
  const right = lon + delta;
  const top = lat + delta;
  const bottom = lat - delta;

  const mapUrl =
    `https://www.openstreetmap.org/export/embed.html?bbox=` +
    `${left}%2C${bottom}%2C${right}%2C${top}` +
    `&layer=mapnik&marker=${lat}%2C${lon}`;

  return (
    <section className="section">
      <div className="map-header">
        <div>
          <h2>
            🗺️ Live Map
          </h2>

          <p>
            📍{" "}
            {lat.toFixed(5)},{" "}
            {lon.toFixed(5)}
          </p>
        </div>

        <a
          className="refresh-btn"
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`}
          target="_blank"
          rel="noreferrer"
        >
          <Map size={16} />
          Open Full Map
        </a>
      </div>

      <div className="live-map">
        <iframe
          title="Smart PG Live Map"
          src={mapUrl}
          loading="lazy"
        />
      </div>

      <div className="map-info">
        🟢 Map location found •{" "}
        {results.length} mapped
        accommodation result
        {results.length === 1
          ? ""
          : "s"} nearby.
      </div>
    </section>
  );
}

function RealCard({
  pg,
  openMap,
  openDirections,
  openWebsite,
}) {
  return (
    <div className="card real-card">
      {pg.image ? (
        <img
          className="listing-image"
          src={pg.image}
          alt={pg.name}
          onError={(e) => {
            e.currentTarget.style.display =
              "none";
          }}
        />
      ) : (
        <div className="image-placeholder">
          <ImageIcon size={30} />
          <span>
            No photo supplied by
            listing
          </span>
        </div>
      )}

      <div className="card-top">
        <div className="badges">
          <span className="badge real">
            REAL MAP DATA
          </span>

          <span className="badge">
            {pg.property_type}
          </span>
        </div>
      </div>

      <div className="card-body">
        <h3>{pg.name}</h3>

        <div className="location">
          <MapPin size={15} />
          {pg.location}
        </div>

        {pg.distanceKm != null && (
          <div className="distance">
            <LocateFixed size={14} />
            {pg.distanceKm.toFixed(
              2
            )}{" "}
            km from GPS
          </div>
        )}

        <div className="rent">
          <span className="not-available">
            Rent not available in
            map data
          </span>
        </div>

        <div className="info-row">
          <span className="info">
            🛏️ {pg.room_type}
          </span>

          <span className="info">
            👤 {pg.pg_type}
          </span>
        </div>

        <div className="amenities">
          {pg.wifi_available && (
            <span className="amenity">
              WiFi
            </span>
          )}

          <span className="amenity">
            📍 GPS/Map
          </span>

          {pg.food_available && (
            <span className="amenity">
              Food
            </span>
          )}
        </div>

        <div className="owner">
          <strong>
            {pg.owner_name}
          </strong>

          {pg.owner_phone && (
            <div>
              <Phone size={13} />
              {pg.owner_phone}
            </div>
          )}
        </div>

        <div className="actions">
          <button
            className="action-btn"
            onClick={() =>
              openMap(pg)
            }
          >
            <Map size={15} />
            Map
          </button>

          <button
            className="action-btn"
            onClick={() =>
              openDirections(pg)
            }
          >
            <Navigation
              size={15}
            />
            Directions
          </button>

          {pg.owner_phone && (
            <a
              className="action-btn"
              href={`tel:${pg.owner_phone}`}
            >
              <Phone size={15} />
              Call
            </a>
          )}

          {pg.website && (
            <button
              className="action-btn"
              onClick={() =>
                openWebsite(pg)
              }
            >
              <Globe size={15} />
              Website
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DBCard({
  pg,
  openMap,
  openDirections,
  openEditForm,
  deleteProperty,
}) {
  return (
    <div className="card">
      <div className="card-top">
        <div className="badges">
          <span className="badge">
            {pg.property_type}
          </span>

          <span className="badge gender">
            {pg.pg_type}
          </span>
        </div>
      </div>

      <div className="card-body">
        <h3>{pg.name}</h3>

        <div className="location">
          📍 {pg.location}
        </div>

        <div className="rent">
          ₹
          {Number(
            pg.rent || 0
          ).toLocaleString(
            "en-IN"
          )}

          <small>
            {" "}
            / month
          </small>
        </div>

        <div className="info-row">
          <span className="info">
            🛏️{" "}
            {pg.room_type ||
              "Room not specified"}
          </span>

          <span className="info">
            {pg.food_type ||
              "Food not specified"}
          </span>
        </div>

        <div className="rating-row">
          <span>
            🍱 Food{" "}
            {pg.food_rating > 0
              ? pg.food_rating
              : "Not rated"}
          </span>

          <span>
            🧹 Cleaning{" "}
            {pg.cleaning_rating >
            0
              ? pg.cleaning_rating
              : "Not rated"}
          </span>
        </div>

        <div className="amenities">
          {pg.food_available && (
            <span className="amenity">
              Food
            </span>
          )}

          {pg.water_available && (
            <span className="amenity">
              Water
            </span>
          )}

          {pg.wifi_available && (
            <span className="amenity">
              WiFi
            </span>
          )}

          {pg.cctv_available && (
            <span className="amenity">
              CCTV
            </span>
          )}

          {pg.ac_available && (
            <span className="amenity">
              AC
            </span>
          )}

          {pg.parking_available && (
            <span className="amenity">
              Parking
            </span>
          )}
        </div>

        <div className="owner">
          <strong>
            {pg.owner_name ||
              "Owner"}
          </strong>{" "}
          · Property Owner
        </div>

        <div className="actions">
          {pg.latitude != null &&
            pg.longitude != null && (
              <>
                <button
                  className="action-btn"
                  onClick={() =>
                    openMap(pg)
                  }
                >
                  <Map size={15} />
                  Map
                </button>

                <button
                  className="action-btn"
                  onClick={() =>
                    openDirections(
                      pg
                    )
                  }
                >
                  <Navigation
                    size={15}
                  />
                  Directions
                </button>
              </>
            )}

          <button
            className="action-btn edit"
            onClick={() =>
              openEditForm(pg)
            }
          >
            <Edit size={15} />
            Edit
          </button>

          <button
            className="action-btn delete"
            onClick={() =>
              deleteProperty(
                pg.id
              )
            }
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function haversine(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R = 6371;

  const dLat =
    ((lat2 - lat1) *
      Math.PI) /
    180;

  const dLon =
    ((lon2 - lon1) *
      Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) **
      2 +
    Math.cos(
      (lat1 * Math.PI) / 180
    ) *
      Math.cos(
        (lat2 * Math.PI) / 180
      ) *
      Math.sin(dLon / 2) **
        2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )
  );
}

const styles = `
*{
  box-sizing:border-box;
}

body{
  margin:0;
  font-family:Arial,Helvetica,sans-serif;
  background:#f5f7fb;
  color:#172033;
}

button,input,select{
  font:inherit;
}

button{
  cursor:pointer;
}

.app{
  min-height:100vh;
}

.navbar{
  background:#fff;
  border-bottom:1px solid #e5e7eb;
  padding:16px 6%;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:20px;
  position:sticky;
  top:0;
  z-index:10;
}

.brand{
  font-size:24px;
  font-weight:800;
}

.brand-sub{
  color:#64748b;
  font-size:13px;
  margin-top:3px;
}

.navbar-right{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap;
}

.hello{
  background:#eff6ff;
  color:#1d4ed8;
  padding:9px 13px;
  border-radius:9px;
  font-size:13px;
  font-weight:700;
  display:flex;
  align-items:center;
  gap:5px;
}

.add-btn,
.search-btn{
  border:none;
  background:#2563eb;
  color:#fff;
  padding:11px 17px;
  border-radius:9px;
  display:flex;
  align-items:center;
  gap:7px;
  font-weight:700;
}

.logout-btn{
  border:1px solid #fecaca;
  color:#dc2626;
  background:#fff;
  padding:10px 13px;
  border-radius:9px;
  display:flex;
  align-items:center;
  gap:6px;
  font-weight:700;
}

.hero{
  padding:65px 6%;
  background:linear-gradient(135deg,#eef4ff,#fff);
}

.hero-inner{
  max-width:1100px;
  margin:auto;
}

.hero-label{
  color:#2563eb;
  font-weight:800;
  font-size:13px;
}

.hero h1{
  font-size:46px;
  line-height:1.1;
  margin:12px 0;
  max-width:800px;
}

.hero h1 span{
  color:#2563eb;
}

.hero p{
  color:#64748b;
  max-width:750px;
  font-size:17px;
  line-height:1.6;
}

.search-box{
  margin-top:28px;
  display:flex;
  max-width:1100px;
  background:#fff;
  padding:7px;
  border:1px solid #dbe1ea;
  border-radius:13px;
  box-shadow:0 8px 25px rgba(0,0,0,.06);
}

.search-box input{
  flex:1;
  border:none;
  outline:none;
  padding:13px;
  min-width:0;
}

.gps-btn{
  border:1px solid #bfdbfe;
  background:#eff6ff;
  color:#1d4ed8;
  border-radius:9px;
  padding:0 15px;
  display:flex;
  align-items:center;
  gap:7px;
  font-weight:700;
}

.search-btn{
  padding:0 24px;
}

.current-location{
  margin-top:14px;
  background:#ecfdf5;
  border:1px solid #bbf7d0;
  color:#166534;
  padding:11px 13px;
  border-radius:9px;
  display:flex;
  gap:7px;
  align-items:flex-start;
  font-size:13px;
}

.real-search-note{
  margin-top:13px;
  color:#64748b;
  font-size:13px;
}

.section{
  width:88%;
  max-width:1250px;
  margin:35px auto;
}

.section-title{
  font-size:27px;
  margin-bottom:7px;
}

.section-subtitle{
  color:#64748b;
  margin-bottom:20px;
}

.categories{
  display:grid;
  grid-template-columns:repeat(5,1fr);
  gap:14px;
}

.category{
  border:1px solid #e2e8f0;
  background:#fff;
  padding:22px 15px;
  border-radius:14px;
  text-align:left;
}

.category.active{
  border:2px solid #2563eb;
  background:#eff6ff;
}

.category-name{
  font-size:16px;
  font-weight:800;
  display:flex;
  align-items:center;
  gap:6px;
}

.category-desc{
  font-size:13px;
  color:#64748b;
  margin:6px 0;
}

.category-count{
  font-size:22px;
  font-weight:800;
}

.filters{
  background:#fff;
  border:1px solid #e2e8f0;
  border-radius:15px;
  padding:20px;
  display:grid;
  grid-template-columns:repeat(4,1fr) auto;
  gap:15px;
  align-items:end;
}

.field label,
.form-group label{
  display:block;
  font-size:13px;
  font-weight:700;
  margin-bottom:7px;
}

.field select,
.field input,
.form-group input,
.form-group select{
  width:100%;
  padding:11px;
  border:1px solid #dbe1ea;
  border-radius:9px;
  outline:none;
  background:#fff;
}

.reset-btn,
.refresh-btn{
  border:1px solid #cbd5e1;
  background:#fff;
  padding:11px 16px;
  border-radius:9px;
  display:flex;
  align-items:center;
  gap:6px;
  text-decoration:none;
  color:#172033;
}

.result-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:18px;
  gap:15px;
}

.result-header h2{
  margin:0;
}

.cards{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:20px;
}

.card{
  background:#fff;
  border:1px solid #e2e8f0;
  border-radius:15px;
  overflow:hidden;
  box-shadow:0 5px 18px rgba(0,0,0,.04);
}

.real-card{
  border:2px solid #22c55e;
}

.listing-image{
  width:100%;
  height:180px;
  object-fit:cover;
  display:block;
}

.image-placeholder{
  height:150px;
  background:linear-gradient(135deg,#eef2ff,#f8fafc);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  color:#64748b;
  gap:8px;
  font-size:12px;
}

.card-top{
  padding:15px 17px;
  background:#f8fafc;
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.badges{
  display:flex;
  gap:7px;
  flex-wrap:wrap;
}

.badge{
  padding:5px 8px;
  border-radius:6px;
  font-size:11px;
  font-weight:800;
  background:#dbeafe;
  color:#1d4ed8;
}

.badge.gender{
  background:#f1f5f9;
  color:#475569;
}

.badge.real{
  background:#dcfce7;
  color:#166534;
}

.card-body{
  padding:19px;
}

.card-body h3{
  margin:0 0 7px;
  font-size:21px;
}

.location{
  color:#64748b;
  margin-bottom:12px;
  display:flex;
  align-items:flex-start;
  gap:5px;
}

.distance{
  color:#166534;
  font-size:13px;
  margin-bottom:13px;
  display:flex;
  gap:5px;
  align-items:center;
}

.rent{
  font-size:23px;
  font-weight:800;
  margin-bottom:14px;
}

.rent small{
  font-size:12px;
  color:#64748b;
  font-weight:500;
}

.not-available{
  color:#64748b;
  font-size:14px;
  font-weight:600;
}

.info-row{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  margin-bottom:14px;
}

.info{
  background:#f8fafc;
  border:1px solid #e2e8f0;
  padding:6px 9px;
  border-radius:7px;
  font-size:12px;
}

.rating-row{
  display:flex;
  gap:15px;
  color:#64748b;
  font-size:13px;
  margin-bottom:15px;
}

.amenities{
  display:flex;
  flex-wrap:wrap;
  gap:7px;
  margin-bottom:15px;
}

.amenity{
  font-size:12px;
  background:#f0fdf4;
  color:#166534;
  padding:5px 8px;
  border-radius:6px;
}

.owner{
  border-top:1px solid #e2e8f0;
  padding-top:14px;
  color:#475569;
  font-size:13px;
}

.owner div{
  display:flex;
  align-items:center;
  gap:5px;
  margin-top:6px;
}

.actions{
  display:flex;
  gap:8px;
  margin-top:15px;
  flex-wrap:wrap;
}

.action-btn{
  border:1px solid #cbd5e1;
  background:#fff;
  padding:8px 11px;
  border-radius:8px;
  display:flex;
  align-items:center;
  gap:5px;
  font-size:12px;
  text-decoration:none;
  color:#172033;
}

.action-btn.edit{
  color:#2563eb;
}

.action-btn.delete{
  color:#dc2626;
}

.empty,
.error{
  background:#fff;
  border:1px solid #e2e8f0;
  border-radius:14px;
  padding:35px;
  text-align:center;
}

.error{
  border-color:#fecaca;
  background:#fff7f7;
}

footer{
  margin-top:60px;
  background:#172033;
  color:#fff;
  padding:30px 6%;
}

footer p{
  color:#cbd5e1;
}

.map-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:15px;
  margin-bottom:15px;
}

.map-header h2{
  margin:0 0 5px;
}

.map-header p{
  margin:0;
  color:#64748b;
  font-size:13px;
}

.live-map{
  width:100%;
  height:430px;
  border-radius:16px;
  overflow:hidden;
  border:1px solid #dbe1ea;
  background:#e2e8f0;
  box-shadow:0 8px 25px rgba(0,0,0,.08);
}

.live-map iframe{
  width:100%;
  height:100%;
  border:0;
}

.map-info{
  margin-top:10px;
  padding:12px;
  border-radius:9px;
  background:#ecfdf5;
  color:#166534;
  font-size:13px;
}

.modal-bg{
  position:fixed;
  inset:0;
  background:rgba(15,23,42,.55);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:20px;
  z-index:100;
}

.modal{
  background:#fff;
  width:100%;
  max-width:850px;
  max-height:90vh;
  overflow-y:auto;
  border-radius:16px;
  padding:25px;
}

.modal-header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:20px;
}

.modal-header h2{
  margin:0;
}

.close-btn{
  border:none;
  background:#f1f5f9;
  width:36px;
  height:36px;
  border-radius:50%;
}

.form-grid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:14px;
}

.checkboxes{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:10px;
  margin-top:20px;
}

.check{
  padding:10px;
  background:#f8fafc;
  border-radius:8px;
  font-size:13px;
}

.check input{
  margin-right:7px;
}

.gps-form-btn{
  margin-top:16px;
  border:1px solid #bfdbfe;
  background:#eff6ff;
  color:#1d4ed8;
  padding:10px 14px;
  border-radius:8px;
  display:flex;
  align-items:center;
  gap:7px;
  font-weight:700;
}

.form-actions{
  display:flex;
  justify-content:flex-end;
  gap:10px;
  margin-top:22px;
}

.cancel{
  border:1px solid #cbd5e1;
  background:#fff;
  padding:11px 17px;
  border-radius:8px;
}

.save{
  border:none;
  background:#2563eb;
  color:#fff;
  padding:11px 17px;
  border-radius:8px;
  display:flex;
  align-items:center;
  gap:7px;
}

.login-page{
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:linear-gradient(135deg,#2563eb,#4f46e5,#7c3aed);
  padding:20px;
}

.login-card{
  width:100%;
  max-width:430px;
  background:#fff;
  padding:40px;
  border-radius:22px;
  box-shadow:0 25px 70px rgba(0,0,0,.25);
}

.login-logo{
  width:70px;
  height:70px;
  margin:0 auto 20px;
  border-radius:18px;
  background:#eff6ff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:38px;
}

.login-card h1{
  text-align:center;
  margin:0;
}

.login-card p{
  text-align:center;
  color:#64748b;
  margin:10px 0 28px;
}

.login-label{
  display:block;
  font-weight:700;
  font-size:14px;
  margin-bottom:7px;
}

.login-input{
  width:100%;
  padding:14px;
  border:1px solid #cbd5e1;
  border-radius:10px;
  outline:none;
  font-size:15px;
}

.login-button{
  width:100%;
  margin-top:20px;
  padding:14px;
  border:none;
  border-radius:10px;
  background:#2563eb;
  color:#fff;
  font-weight:800;
  font-size:15px;
}

.login-footer{
  text-align:center;
  color:#94a3b8;
  font-size:12px;
  margin-top:25px;
}

@media(max-width:1000px){
  .cards{
    grid-template-columns:repeat(2,1fr);
  }

  .categories{
    grid-template-columns:repeat(3,1fr);
  }

  .filters{
    grid-template-columns:repeat(2,1fr);
  }
}

@media(max-width:650px){
  .navbar{
    padding:14px 4%;
  }

  .navbar-right{
    justify-content:flex-end;
  }

  .hero{
    padding:40px 4%;
  }

  .hero h1{
    font-size:34px;
  }

  .section{
    width:92%;
  }

  .categories,
  .cards,
  .filters,
  .form-grid,
  .checkboxes{
    grid-template-columns:1fr;
  }

  .search-box{
    flex-direction:column;
  }

  .gps-btn,
  .search-btn{
    padding:12px;
    justify-content:center;
  }

  .map-header{
    flex-direction:column;
    align-items:flex-start;
  }

  .live-map{
    height:350px;
  }

  .navbar{
    position:relative;
  }
}
`;

export default App;
