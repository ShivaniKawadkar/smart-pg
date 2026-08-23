import { useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, Map, Navigation, Plus, X, Save, Trash2,
  Edit, Home, Building2, BedDouble, LogOut, User, MapPin,
  Star, LocateFixed, Phone, Globe, Image as ImageIcon
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const emptyForm = {
  name: "", property_type: "PG", pg_type: "Girls", location: "", rent: "",
  owner_name: "", owner_phone: "", food_available: true, food_type: "Veg",
  food_rating: 0, cleaning_rating: 0, water_available: true, wifi_available: true,
  cctv_available: true, latitude: null, longitude: null, ac_available: false,
  geyser_available: false, parking_available: false, power_backup: false,
  laundry_available: false, security_available: false, hygiene_rating: 0,
  room_type: "Single", room_available: true, attached_washroom: false,
  common_washroom: true, washroom_cleaning_rating: 0,
};

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("smartpg_user")) || null; }
    catch { return null; }
  });
  const [loginName, setLoginName] = useState("");
  const [pgs, setPgs] = useState([]);
  const [realPGs, setRealPGs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [realLoading, setRealLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [propertyType, setPropertyType] = useState("All");
  const [pgType, setPgType] = useState("All");
  const [foodType, setFoodType] = useState("All");
  const [maxRent, setMaxRent] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedAccommodation, setSelectedAccommodation] = useState(null);
  const [incidentType, setIncidentType] = useState("Robbed / Stolen Item");
  const [incidentText, setIncidentText] = useState("");
  const [incidentProperty, setIncidentProperty] = useState("");
  const [incidents, setIncidents] = useState(() => { try { return JSON.parse(localStorage.getItem("smartpg_incidents")) || []; } catch { return []; } });

  const handleLogin = (e) => {
    e.preventDefault();
    const name = loginName.trim();
    if (!name) return alert("Please enter your name");
    const loggedUser = { name, email: `${name.toLowerCase().replace(/\s+/g, "")}@smartpg.com` };
    localStorage.setItem("smartpg_user", JSON.stringify(loggedUser));
    setUser(loggedUser);
  };
  const logout = () => { localStorage.removeItem("smartpg_user"); setUser(null); };

  const fetchPGs = async () => {
    try {
      setLoading(true); setError("");
      const r = await fetch(`${API_URL}/pg`);
      if (!r.ok) throw new Error(`Server error: ${r.status}`);
      const data = await r.json();
      setPgs(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message || "Failed to fetch properties"); setPgs([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (user) fetchPGs(); }, [user]);

  const reverseGeocode = async (lat, lon) => {
    try {
      const r = await fetch(`${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, { headers: { Accept: "application/json" } });
      if (!r.ok) return "Current location";
      const d = await r.json();
      return d.display_name || "Current location";
    } catch { return "Current location"; }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return alert("GPS is not supported by this browser.");
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const loc = { latitude: coords.latitude, longitude: coords.longitude };
        setCurrentLocation(loc);
        const name = await reverseGeocode(loc.latitude, loc.longitude);
        setLocationName(name);
        setSearch(name.split(",").slice(0, 3).join(", "));
        await searchRealPGs(loc);
        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);
        alert(err.code === 1 ? "Location permission denied. Browser address bar se Location Allow karo." : "GPS location nahi mil pa rahi hai.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const getImageFromTags = (tags) => {
    if (tags.image) return tags.image;
    if (tags["image:url"]) return tags["image:url"];
    if (tags.wikimedia_commons) {
      const value = tags.wikimedia_commons.replace(/^File:/i, "").trim();
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(value)}`;
    }
    return "";
  };

  const runOverpass = async (query) => {
    let lastError;
    for (const url of OVERPASS_URLS) {
      try {
        const r = await fetch(url, { method: "POST", body: query });
        if (r.ok) return await r.json();
        lastError = new Error(`Overpass ${r.status}`);
      } catch (e) { lastError = e; }
    }
    throw lastError || new Error("Real accommodation service unavailable");
  };

  const searchRealPGs = async (coords = null) => {
    try {
      setRealLoading(true);
      let location = search.trim() || "Bangalore";
      if (coords) {
        const reverseName = await reverseGeocode(coords.latitude, coords.longitude);
        location = reverseName.split(",").slice(0, 3).join(", ");
        setSearch(location);
        setLocationName(reverseName);
        setCurrentLocation(coords);
      }

      const typeParam = selectedAccommodation && selectedAccommodation !== "All" ? `&property_type=${encodeURIComponent(selectedAccommodation)}` : "";
      const r = await fetch(`${API_URL}/search-real-pg?location=${encodeURIComponent(location)}${typeParam}`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || `Real search failed (${r.status})`);

      const results = Array.isArray(data.results) ? data.results.map((item) => ({
        ...item,
        property_type: item.property_type || "PG",
        pg_type: item.pg_type || "Unisex",
        source: item.source || "OpenStreetMap",
        distanceKm: item.distance_km ?? item.distanceKm ?? null,
        isReal: true,
      })) : [];

      setRealPGs(results);
      setLocationName(data.display_name || data.location || location);
      if (!results.length) {
        setError(`No mapped accommodation found near ${location}.`);
      } else {
        setError("");
      }
    } catch (e) {
      console.error(e);
      setRealPGs([]);
      alert(`Real accommodation search failed: ${e.message}`);
    } finally {
      setRealLoading(false);
      setLocationLoading(false);
    }
  };

  const handleSearch = () => searchRealPGs();
  const filteredPGs = useMemo(() => pgs.filter(pg => {
    const s = search.trim().toLowerCase();
    return (!s || pg.name?.toLowerCase().includes(s) || pg.location?.toLowerCase().includes(s)) &&
      (propertyType === "All" || pg.property_type?.toLowerCase() === propertyType.toLowerCase()) &&
      (pgType === "All" || pg.pg_type?.toLowerCase() === pgType.toLowerCase()) &&
      (foodType === "All" || pg.food_type?.toLowerCase() === foodType.toLowerCase()) &&
      (!maxRent || Number(pg.rent) <= Number(maxRent));
  }), [pgs, search, propertyType, pgType, foodType, maxRent]);
  const getCount = type => type === "All" ? pgs.length : pgs.filter(pg => pg.property_type?.toLowerCase() === type.toLowerCase()).length;
  const getRealCount = type => type === "All" ? realPGs.length : realPGs.filter(pg => pg.property_type?.toLowerCase() === type.toLowerCase()).length;
  const realFilteredPGs = useMemo(() => propertyType === "All" ? realPGs : realPGs.filter(pg => pg.property_type?.toLowerCase() === propertyType.toLowerCase()), [realPGs, propertyType]);
  const clearFilters = () => { setSearch(""); setPropertyType(selectedAccommodation || "PG"); setPgType("All"); setFoodType("All"); setMaxRent(""); setRealPGs([]); setCurrentLocation(null); setLocationName(""); };
  const chooseAccommodation = (type) => { setSelectedAccommodation(type); setPropertyType(type); setRealPGs([]); setSearch(""); setLocationName(""); setCurrentLocation(null); };
  const submitIncident = (e) => { e.preventDefault(); if (!incidentText.trim()) return alert("Please describe the lost/robbed item."); const item = { id: Date.now(), type: incidentType, property: incidentProperty.trim() || "Not specified", description: incidentText.trim(), user: user?.name || "User", date: new Date().toLocaleString("en-IN") }; const next = [item, ...incidents]; setIncidents(next); localStorage.setItem("smartpg_incidents", JSON.stringify(next)); setIncidentText(""); setIncidentProperty(""); alert("Incident report saved successfully."); };
  const updateForm = (field, value) => setForm(p => ({ ...p, [field]: value }));
  const openAddForm = () => { setEditingId(null); setForm({ ...emptyForm, owner_name: user?.name || "" }); setShowForm(true); };
  const openEditForm = pg => { setEditingId(pg.id); setForm({ ...emptyForm, ...pg, rent: pg.rent ?? "" }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const useGPSInForm = () => {
    if (!navigator.geolocation) return alert("GPS not supported");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      updateForm("latitude", Number(coords.latitude.toFixed(6)));
      updateForm("longitude", Number(coords.longitude.toFixed(6)));
      alert("Current GPS coordinates added!");
    }, () => alert("GPS permission allow karo."), { enableHighAccuracy: true, timeout: 15000 });
  };

  const saveProperty = async e => {
    e.preventDefault();
    if (!form.name.trim()) return alert("Please enter property name");
    if (!form.location.trim()) return alert("Please enter location");
    if (!form.rent) return alert("Please enter rent");
    try {
      setSaving(true);
      const payload = { ...form, name: form.name.trim(), location: form.location.trim(), owner_name: form.owner_name.trim() || user?.name || "Owner", rent: Number(form.rent), food_rating: Number(form.food_rating || 0), cleaning_rating: Number(form.cleaning_rating || 0), hygiene_rating: Number(form.hygiene_rating || 0), washroom_cleaning_rating: Number(form.washroom_cleaning_rating || 0) };
      delete payload.id; delete payload.isReal; delete payload.distanceKm; delete payload.website; delete payload.image;
      const r = await fetch(editingId ? `${API_URL}/pg/${editingId}` : `${API_URL}/pg`, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.detail ? JSON.stringify(d.detail) : `Server error: ${r.status}`); }
      await fetchPGs(); closeForm(); alert(editingId ? "Property updated successfully!" : "Property added successfully!");
    } catch (e) { alert(`Error: ${e.message}`); } finally { setSaving(false); }
  };
  const deleteProperty = async id => {
    if (!window.confirm("Are you sure you want to delete this property?")) return;
    try { const r = await fetch(`${API_URL}/pg/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Delete failed"); await fetchPGs(); alert("Property deleted successfully!"); }
    catch (e) { alert(`Error: ${e.message}`); }
  };
  const openMap = pg => { if (pg.latitude == null || pg.longitude == null) return alert("Location coordinates are not available."); window.open(`https://www.google.com/maps?q=${pg.latitude},${pg.longitude}`, "_blank"); };
  const openDirections = pg => { if (pg.latitude == null || pg.longitude == null) return alert("Location coordinates are not available."); window.open(`https://www.google.com/maps/dir/?api=1&destination=${pg.latitude},${pg.longitude}`, "_blank"); };
  const openWebsite = pg => { if (!pg.website) return alert("Website is not available for this listing."); window.open(pg.website.startsWith("http") ? pg.website : `https://${pg.website}`, "_blank"); };
  const getPropertyIcon = type => type === "PG" ? <Home size={18}/> : type === "Co-Living" ? <Building2 size={18}/> : <BedDouble size={18}/>;

  if (!user) return <><style>{styles}</style><div className="login-page"><div className="login-card"><div className="login-logo">🏠</div><h1>Smart PG</h1><p>Find your perfect stay</p><form onSubmit={handleLogin}><label className="login-label">Your Name</label><input className="login-input" value={loginName} onChange={e=>setLoginName(e.target.value)} placeholder="Enter your name"/><button className="login-button">Login</button></form><div className="login-footer">Smart PG Accommodation Finder</div></div></div></>;

  const categories = [["PG","Paying Guest"],["Hostel","Hostels"],["Co-Living","Shared living"],["Flat","Flats"],["All","All properties"]];
  return <div className="app"><style>{styles}</style>
    <nav className="navbar"><div><div className="brand">🏠 Smart PG</div><div className="brand-sub">Real location • GPS • Nearby stays</div></div><div className="navbar-right"><div className="hello"><User size={14}/> Hi, {user.name}</div><button className="add-btn" onClick={openAddForm}><Plus size={18}/> Add Property</button><button className="logout-btn" onClick={logout}><LogOut size={16}/> Logout</button></div></nav>
    <section className="hero"><div className="hero-inner"><div>🇮🇳 INDIA-WIDE ACCOMMODATION</div><h1>Find Your Perfect <span>Stay</span></h1><p>First choose PG, Hostel, Co-Living or Flat. Then search the location. This keeps each accommodation category separate.</p></div></section>
    <section className="section"><h2 className="section-title">1️⃣ Choose Accommodation Type First</h2><p className="section-subtitle">Select one category, then location search will open.</p><div className="categories">{categories.filter(([type])=>type!=="All").map(([type,desc])=><button key={type} className={`category ${selectedAccommodation===type?"active":""}`} onClick={()=>chooseAccommodation(type)}><div className="category-name">{getPropertyIcon(type)}{type}</div><div className="category-desc">{desc}</div><div className="category-count">{getCount(type)}</div></button>)}</div>{selectedAccommodation && <div className="selected-note">✅ Selected: <strong>{selectedAccommodation}</strong> — now search your location below.</div>}</section>
    {selectedAccommodation && <section className="section"><h2 className="section-title">2️⃣ Search Location</h2><p className="section-subtitle">Only <strong>{selectedAccommodation}</strong> results will be searched.</p><div className="search-box"><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key === "Enter" && handleSearch()} placeholder="Enter Bangalore, HSR Layout, Koramangala..."/><button className="gps-btn" onClick={getCurrentLocation} disabled={locationLoading}><LocateFixed size={18}/>{locationLoading ? "Getting GPS..." : "Use My Location"}</button><button className="search-btn" onClick={handleSearch} disabled={realLoading || !search.trim()}><Search size={18}/>{realLoading ? "Loading..." : "Search"}</button></div>{locationName && <div className="current-location"><LocateFixed size={16}/><strong>Location:</strong> {locationName}</div>}<div className="real-search-note">🟢 Real mapped data from OpenStreetMap. Results are filtered by your selected category.</div></section>}

    {selectedAccommodation && realPGs.length>0 && <section className="section"><div className="result-header"><div><h2>🗺️ Real Map Results <span className="real-badge">● REAL MAP DATA</span></h2><div className="section-subtitle">Found <strong>{getRealCount("All")}</strong> mapped accommodations{locationName ? ` near ${locationName.split(",").slice(0, 2).join(", ")}` : ""}</div></div><button className="refresh-btn" onClick={()=>searchRealPGs(currentLocation)}><RefreshCw size={16}/> Search Again</button></div><div className="real-count-strip"><span>🏠 PG ({getRealCount("PG")})</span><span>🛏️ Hostel ({getRealCount("Hostel")})</span><span>🏢 Co-Living ({getRealCount("Co-Living")})</span><span>🏘️ Flat ({getRealCount("Flat")})</span></div>{realFilteredPGs.length===0?<div className="empty"><h3>No {propertyType} mapped accommodation found</h3><p>Try another category or search location.</p></div>:<div className="cards">{realFilteredPGs.map(pg=><RealCard key={pg.id} pg={pg} openMap={openMap} openDirections={openDirections} openWebsite={openWebsite}/>)}</div>}</section>}

    <section className="section"><div className="result-header"><div><h2>Available Properties</h2><div className="section-subtitle">Showing <strong>{filteredPGs.length}</strong> properties added to Smart PG</div></div><button className="refresh-btn" onClick={fetchPGs}><RefreshCw size={16}/> Refresh</button></div>{loading&&<div className="empty">Loading properties...</div>}{!loading&&error&&<div className="error"><h3>⚠️ Unable to load properties</h3><p>{error}</p><button className="refresh-btn" onClick={fetchPGs}>Try Again</button></div>}{!loading&&!error&&!filteredPGs.length&&<div className="empty"><h3>No properties found</h3><p>Search or change filters.</p></div>}{!loading&&!error&&filteredPGs.length>0&&<div className="cards">{filteredPGs.map(pg=><DBCard key={pg.id} pg={pg} openMap={openMap} openDirections={openDirections} openEditForm={openEditForm} deleteProperty={deleteProperty}/>)}</div>}</section>
    <section className="section"><h2 className="section-title">🔎 Stay Filters</h2><p className="section-subtitle">Boys/Girls/Unisex, Veg/Non-Veg/All and hygiene preferences.</p><div className="filters"><div className="field"><label>Suitable For</label><select value={pgType} onChange={e=>setPgType(e.target.value)}><option>All</option><option>Boys</option><option>Girls</option><option>Unisex</option></select></div><div className="field"><label>Food</label><select value={foodType} onChange={e=>setFoodType(e.target.value)}><option>All</option><option>Veg</option><option>Non-Veg</option></select></div><div className="field"><label>Hygiene</label><select onChange={e=>{}}><option>All</option><option>Good hygiene</option><option>Highly hygienic</option></select></div><div className="field"><label>Maximum Rent</label><input type="number" placeholder="₹ Maximum rent" value={maxRent} onChange={e=>setMaxRent(e.target.value)}/></div><button className="reset-btn" onClick={clearFilters}><RefreshCw size={16}/> Reset</button></div></section>
    <section className="section incident-section"><h2 className="section-title">🚨 Lost / Robbed / Stolen Item Complaint</h2><p className="section-subtitle">PG, Hostel, Co-Living ya Flat me lost, missing ya stolen item ka neutral report save karo.</p><form className="incident-form" onSubmit={submitIncident}><div className="field"><label>Complaint Type</label><select value={incidentType} onChange={e=>setIncidentType(e.target.value)}><option>Robbed / Stolen Item</option><option>Lost Item</option><option>Missing Item</option><option>Security Complaint</option></select></div><div className="field"><label>Property / PG Name</label><input value={incidentProperty} onChange={e=>setIncidentProperty(e.target.value)} placeholder="e.g. Green View PG"/></div><div className="field full"><label>Describe the incident</label><textarea value={incidentText} onChange={e=>setIncidentText(e.target.value)} placeholder="Item kya hua, kab hua, aur kis property me hua..." rows="4"/></div><button className="search-btn" type="submit">🚨 Submit Complaint</button></form>{incidents.length>0 && <div className="incident-list">{incidents.map(i=><div className="incident-card" key={i.id}><strong>{i.type}</strong><span>{i.property}</span><p>{i.description}</p><small>{i.date} · Reported by {i.user}</small></div>)}</div>}</section>
    <footer><strong>🏠 Smart PG</strong><p>Find PG, Hostel, Co-Living & Flat with category-first search, GPS, real map data and incident reporting.</p><div>© 2026 Smart PG</div></footer>

    {showForm&&<div className="modal-bg"><div className="modal"><div className="modal-header"><h2>{editingId?"Edit Property":"Add Property"}</h2><button className="close-btn" onClick={closeForm}><X size={18}/></button></div><form onSubmit={saveProperty}><div className="form-grid">{[
      ["name","Property Name *","text","e.g. Shivani PG"],["property_type","Property Type","select",["PG","Co-Living","Hostel","Flat"]],["pg_type","Suitable For","select",["Boys","Girls","Unisex"]],["location","Location *","text","Bangalore"],["rent","Monthly Rent *","number","8000"],["room_type","Room Type","select",["Single","Double","Triple","Shared"]],["owner_name","Owner Name","text","Owner name"],["owner_phone","Owner Phone","text","Phone number"],["food_type","Food Type","select",["Veg","Non-Veg"]],["food_rating","Food Rating","number","0-5"],["cleaning_rating","Cleaning Rating","number","0-5"]].map(([f,l,t,p])=><div className="form-group" key={f}><label>{l}</label>{t==="select"?<select value={form[f]} onChange={e=>updateForm(f,e.target.value)}>{p.map(x=><option key={x}>{x}</option>)}</select>:<input type={t} min={t==="number"?0:undefined} max={f.includes("rating")?5:undefined} step={f.includes("rating")?0.1:undefined} value={form[f]??""} onChange={e=>updateForm(f,e.target.value)} placeholder={p}/>}</div>)}
      <div className="form-group"><label>Latitude</label><input type="number" step="any" value={form.latitude??""} onChange={e=>updateForm("latitude",e.target.value?Number(e.target.value):null)} placeholder="12.9716"/></div><div className="form-group"><label>Longitude</label><input type="number" step="any" value={form.longitude??""} onChange={e=>updateForm("longitude",e.target.value?Number(e.target.value):null)} placeholder="77.5946"/></div></div><button type="button" className="gps-form-btn" onClick={useGPSInForm}><LocateFixed size={16}/> Use Current GPS Coordinates</button><div className="checkboxes">{[["food_available","Food Available"],["water_available","Water Available"],["wifi_available","WiFi Available"],["cctv_available","CCTV Available"],["ac_available","AC Available"],["geyser_available","Geyser Available"],["parking_available","Parking"],["power_backup","Power Backup"],["laundry_available","Laundry"],["security_available","Security"],["room_available","Room Available"],["attached_washroom","Attached Washroom"],["common_washroom","Common Washroom"]].map(([f,l])=><label className="check" key={f}><input type="checkbox" checked={Boolean(form[f])} onChange={e=>updateForm(f,e.target.checked)}/>{l}</label>)}</div><div className="form-actions"><button type="button" className="cancel" onClick={closeForm}>Cancel</button><button type="submit" className="save" disabled={saving}><Save size={17}/>{saving?"Saving...":editingId?"Update Property":"Save Property"}</button></div></form></div></div>}
  </div>;
}

function haversine(lat1, lon1, lat2, lon2) { const R=6371, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180, a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }

function RealCard({pg,openMap,openDirections,openWebsite}) { return <div className="card real-card">{pg.image?<img className="listing-image" src={pg.image} alt={pg.name} onError={e=>{e.currentTarget.style.display="none"}}/>:<div className="image-placeholder"><ImageIcon size={30}/><span>No real photo supplied by listing</span></div>}<div className="card-top"><div className="badges"><span className="badge real">REAL MAP LISTING</span><span className="badge">{pg.property_type}</span></div></div><div className="card-body"><h3>{pg.name}</h3><div className="location"><MapPin size={15}/> {pg.location}</div>{pg.distanceKm!=null&&<div className="distance"><LocateFixed size={14}/> {pg.distanceKm.toFixed(2)} km from your GPS</div>}<div className="rent"><span className="not-available">Rent not available on map data</span></div><div className="info-row"><span className="info">🛏️ {pg.room_type}</span><span className="info">👤 {pg.pg_type}</span></div><div className="amenities">{pg.wifi_available&&<span className="amenity">WiFi</span>}<span className="amenity">📍 GPS/Map</span>{pg.food_available&&<span className="amenity">Food</span>}</div><div className="owner"><strong>{pg.owner_name}</strong>{pg.owner_phone&&<div><Phone size={13}/> {pg.owner_phone}</div>}</div><div className="actions"><button className="action-btn" onClick={()=>openMap(pg)}><Map size={15}/> Map</button><button className="action-btn" onClick={()=>openDirections(pg)}><Navigation size={15}/> Directions</button>{pg.owner_phone&&<a className="action-btn" href={`tel:${pg.owner_phone}`}><Phone size={15}/> Call</a>}{pg.website&&<button className="action-btn" onClick={()=>openWebsite(pg)}><Globe size={15}/> Website</button>}</div></div></div>; }

function DBCard({pg,openMap,openDirections,openEditForm,deleteProperty}) { return <div className="card"><div className="card-top"><div className="badges"><span className="badge">{pg.property_type}</span><span className="badge gender">{pg.pg_type}</span></div></div><div className="card-body"><h3>{pg.name}</h3><div className="location">📍 {pg.location}</div><div className="rent">₹{Number(pg.rent).toLocaleString("en-IN")}<small> / month</small></div><div className="info-row"><span className="info">🛏️ {pg.room_type||"Room not specified"}</span><span className="info">{pg.food_type||"Food not specified"}</span></div><div className="rating-row"><span>🍱 Food {pg.food_rating>0?pg.food_rating:"Not rated"}</span><span>🧹 Cleaning {pg.cleaning_rating>0?pg.cleaning_rating:"Not rated"}</span></div><div className="amenities">{pg.food_available&&<span className="amenity">Food</span>}{pg.water_available&&<span className="amenity">Water</span>}{pg.wifi_available&&<span className="amenity">WiFi</span>}{pg.cctv_available&&<span className="amenity">CCTV</span>}{pg.ac_available&&<span className="amenity">AC</span>}{pg.parking_available&&<span className="amenity">Parking</span>}</div><div className="owner"><strong>{pg.owner_name||"Owner"}</strong> · Property Owner</div><div className="actions">{pg.latitude!=null&&pg.longitude!=null&&<><button className="action-btn" onClick={()=>openMap(pg)}><Map size={15}/> Map</button><button className="action-btn" onClick={()=>openDirections(pg)}><Navigation size={15}/> Directions</button></>}<button className="action-btn edit" onClick={()=>openEditForm(pg)}><Edit size={15}/> Edit</button><button className="action-btn delete" onClick={()=>deleteProperty(pg.id)}><Trash2 size={15}/> Delete</button></div></div></div>; }

const styles = `
*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;color:#172033}button,input,select{font:inherit}button{cursor:pointer}.app{min-height:100vh}.navbar{background:#fff;border-bottom:1px solid #e5e7eb;padding:16px 6%;display:flex;justify-content:space-between;align-items:center;gap:20px;position:sticky;top:0;z-index:10}.brand{font-size:24px;font-weight:800}.brand-sub{color:#64748b;font-size:13px;margin-top:3px}.navbar-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.hello{background:#eff6ff;color:#1d4ed8;padding:9px 13px;border-radius:9px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:5px}.add-btn,.search-btn{border:none;background:#2563eb;color:#fff;padding:11px 17px;border-radius:9px;display:flex;align-items:center;gap:7px;font-weight:700}.logout-btn{border:1px solid #fecaca;color:#dc2626;background:#fff;padding:10px 13px;border-radius:9px;display:flex;align-items:center;gap:6px;font-weight:700}.hero{padding:65px 6%;background:linear-gradient(135deg,#eef4ff,#fff)}.hero-inner{max-width:1100px;margin:auto}.hero h1{font-size:46px;line-height:1.1;margin:12px 0;max-width:700px}.hero h1 span{color:#2563eb}.hero p{color:#64748b;max-width:700px;font-size:17px;line-height:1.6}.search-box{margin-top:28px;display:flex;max-width:1100px;background:#fff;padding:7px;border:1px solid #dbe1ea;border-radius:13px;box-shadow:0 8px 25px rgba(0,0,0,.06)}.search-box input{flex:1;border:none;outline:none;padding:13px;min-width:0}.gps-btn{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:9px;padding:0 15px;display:flex;align-items:center;gap:7px;font-weight:700}.search-btn{padding:0 24px}.current-location{margin-top:14px;background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;padding:10px 13px;border-radius:9px;display:flex;gap:7px;align-items:flex-start;font-size:13px;max-width:900px}.real-search-note{margin-top:13px;color:#64748b;font-size:13px}.section{width:88%;max-width:1250px;margin:35px auto}.section-title{font-size:27px;margin-bottom:7px}.section-subtitle{color:#64748b;margin-bottom:20px}.categories{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}.category{border:1px solid #e2e8f0;background:#fff;padding:22px 15px;border-radius:14px;text-align:left}.category.active{border:2px solid #2563eb;background:#eff6ff}.category-name{font-size:16px;font-weight:800;display:flex;align-items:center;gap:5px}.category-desc{font-size:13px;color:#64748b;margin:6px 0}.category-count{font-size:22px;font-weight:800}.filters{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:20px;display:grid;grid-template-columns:repeat(4,1fr) auto;gap:15px;align-items:end}.field label,.form-group label{display:block;font-size:13px;font-weight:700;margin-bottom:7px}.field select,.field input,.form-group input,.form-group select{width:100%;padding:11px;border:1px solid #dbe1ea;border-radius:9px;outline:none;background:#fff}.reset-btn,.refresh-btn{border:1px solid #cbd5e1;background:#fff;padding:11px 16px;border-radius:9px;display:flex;align-items:center;gap:6px}.result-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:15px}.result-header h2{margin:0}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:15px;overflow:hidden;box-shadow:0 5px 18px rgba(0,0,0,.04)}.real-card{border:2px solid #22c55e}.listing-image{width:100%;height:180px;object-fit:cover;display:block}.image-placeholder{height:150px;background:linear-gradient(135deg,#eef2ff,#f8fafc);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#64748b;gap:8px;font-size:12px}.card-top{padding:15px 17px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center}.badges{display:flex;gap:7px;flex-wrap:wrap}.badge{padding:5px 8px;border-radius:6px;font-size:11px;font-weight:800;background:#dbeafe;color:#1d4ed8}.badge.gender{background:#f1f5f9;color:#475569}.badge.real{background:#dcfce7;color:#166534}.card-body{padding:19px}.card-body h3{margin:0 0 7px;font-size:21px}.location{color:#64748b;margin-bottom:12px;display:flex;align-items:flex-start;gap:5px}.distance{color:#166534;font-size:13px;margin-bottom:13px;display:flex;gap:5px;align-items:center}.rent{font-size:23px;font-weight:800;margin-bottom:14px}.rent small{font-size:12px;color:#64748b;font-weight:500}.not-available{color:#64748b;font-size:14px;font-weight:600}.info-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.info{background:#f8fafc;border:1px solid #e2e8f0;padding:6px 9px;border-radius:7px;font-size:12px}.rating-row{display:flex;gap:15px;color:#64748b;font-size:13px;margin-bottom:15px}.amenities{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:15px}.amenity{font-size:12px;background:#f0fdf4;color:#166534;padding:5px 8px;border-radius:6px}.owner{border-top:1px solid #e2e8f0;padding-top:14px;color:#475569;font-size:13px}.actions{display:flex;gap:8px;margin-top:15px;flex-wrap:wrap}.action-btn{border:1px solid #cbd5e1;background:#fff;padding:8px 11px;border-radius:8px;display:flex;align-items:center;gap:5px;font-size:12px;text-decoration:none;color:#172033}.action-btn.edit{color:#2563eb}.action-btn.delete{color:#dc2626}.empty,.error{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:35px;text-align:center}.error{border-color:#fecaca;background:#fff7f7}footer{margin-top:60px;background:#172033;color:#fff;padding:30px 6%}footer p{color:#cbd5e1}.modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:100}.modal{background:#fff;width:100%;max-width:850px;max-height:90vh;overflow-y:auto;border-radius:16px;padding:25px}.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.modal-header h2{margin:0}.close-btn{border:none;background:#f1f5f9;width:36px;height:36px;border-radius:50%}.form-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.checkboxes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}.check{padding:10px;background:#f8fafc;border-radius:8px;font-size:13px}.check input{margin-right:7px}.gps-form-btn{margin-top:16px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;padding:10px 14px;border-radius:8px;display:flex;align-items:center;gap:7px;font-weight:700}.form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}.cancel{border:1px solid #cbd5e1;background:#fff;padding:11px 17px;border-radius:8px}.save{border:none;background:#2563eb;color:#fff;padding:11px 17px;border-radius:8px;display:flex;align-items:center;gap:7px}.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#2563eb,#4f46e5,#7c3aed);padding:20px}.login-card{width:100%;max-width:430px;background:#fff;padding:40px;border-radius:22px;box-shadow:0 25px 70px rgba(0,0,0,.25)}.login-logo{width:70px;height:70px;margin:0 auto 20px;border-radius:18px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:38px}.login-card h1{text-align:center;margin:0}.login-card p{text-align:center;color:#64748b;margin:10px 0 28px}.login-label{display:block;font-weight:700;font-size:14px;margin-bottom:7px}.login-input{width:100%;padding:14px;border:1px solid #cbd5e1;border-radius:10px;outline:none;font-size:15px}.login-button{width:100%;margin-top:20px;padding:14px;border:none;border-radius:10px;background:#2563eb;color:#fff;font-weight:800;font-size:15px}.login-footer{text-align:center;color:#94a3b8;font-size:12px;margin-top:25px}
.selected-note{margin-top:15px;padding:13px 16px;background:#ecfdf5;border:1px solid #bbf7d0;color:#166534;border-radius:10px}.real-count-strip{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0 20px}.real-count-strip span{background:#fff;border:1px solid #dbe1ea;padding:10px 14px;border-radius:10px;font-weight:700}.incident-form{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:15px}.incident-form .full{grid-column:1/-1}.incident-form textarea{width:100%;resize:vertical;padding:11px;border:1px solid #dbe1ea;border-radius:9px;font:inherit}.incident-list{display:grid;gap:12px;margin-top:18px}.incident-card{background:#fff;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:12px;padding:15px}.incident-card span{display:block;color:#64748b;font-size:13px;margin-top:4px}.incident-card p{margin:8px 0}.incident-card small{color:#94a3b8}.listing-image{background:#eef2ff;object-fit:cover}.real-card .listing-image{height:190px}@media(max-width:1000px){.cards{grid-template-columns:repeat(2,1fr)}.categories{grid-template-columns:repeat(3,1fr)}.filters{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.navbar{padding:14px 4%}.navbar-right{justify-content:flex-end}.hero{padding:40px 4%}.hero h1{font-size:34px}.section{width:92%}.categories,.cards,.filters,.form-grid,.checkboxes{grid-template-columns:1fr}.search-box{flex-direction:column}.gps-btn,.search-btn{padding:12px;justify-content:center}}
`;

export default App;
