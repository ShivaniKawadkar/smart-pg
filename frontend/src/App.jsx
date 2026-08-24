import React, { useEffect, useMemo, useState } from "react";

const API_URL = "https://smart-pg-apkp.onrender.com";

const CATEGORIES = [
  {
    key: "PG",
    title: "PG",
    subtitle: "Paying Guest",
    icon: "ðŸ ",
  },
  {
    key: "Hostel",
    title: "Hostel",
    subtitle: "Hostels",
    icon: "ðŸ¨",
  },
  {
    key: "Co-Living",
    title: "Co-Living",
    subtitle: "Shared living",
    icon: "ðŸ¢",
  },
  {
    key: "Flat",
    title: "Flat",
    subtitle: "Flats",
    icon: "ðŸ™ï¸",
  },
];

function App() {
  const [selectedCategory, setSelectedCategory] = useState("PG");

  const [location, setLocation] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  const [properties, setProperties] = useState([]);

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [user, setUser] = useState("Shivani");

  const [pgType, setPgType] = useState("All");
  const [foodType, setFoodType] = useState("All");
  const [hygiene, setHygiene] = useState("All");
  const [maxRent, setMaxRent] = useState("");

  const [complaintType, setComplaintType] = useState(
    "Robbed / Stolen Item"
  );

  const [complaintProperty, setComplaintProperty] = useState("");
  const [complaintDescription, setComplaintDescription] = useState("");
  const [complaintMessage, setComplaintMessage] = useState("");

  // =====================================================
  // LOAD USER
  // =====================================================

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("smart_pg_user");

      if (savedUser) {
        setUser(savedUser);
      }
    } catch (err) {
      console.log(err);
    }
  }, []);

  // =====================================================
  // CATEGORY COUNTS
  // =====================================================

  const categoryCounts = useMemo(() => {
    const counts = {
      PG: 0,
      Hostel: 0,
      "Co-Living": 0,
      Flat: 0,
    };

    properties.forEach((item) => {
      const type = String(item?.property_type || "").trim();

      if (type === "PG") {
        counts.PG += 1;
      }

      if (type === "Hostel") {
        counts.Hostel += 1;
      }

      if (type === "Co-Living") {
        counts["Co-Living"] += 1;
      }

      if (type === "Flat") {
        counts.Flat += 1;
      }
    });

    return counts;
  }, [properties]);

  // =====================================================
  // FETCH WITH TIMEOUT
  // =====================================================

  const fetchWithTimeout = async (
    url,
    options = {},
    timeout = 15000
  ) => {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // =====================================================
  // GOOGLE MAPS URL
  // =====================================================

  const getGoogleMapsUrl = (
    place,
    category = selectedCategory
  ) => {
    const search = String(place || "").trim();

    if (!search) {
      return null;
    }

    let categoryText = "PG paying guest";

    if (category === "Hostel") {
      categoryText = "hostel";
    } else if (category === "Co-Living") {
      categoryText = "co living";
    } else if (category === "Flat") {
      categoryText = "flat apartment";
    }

    const query = `${categoryText} near ${search}`;

    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(query)
    );
  };

  // =====================================================
  // OPEN GOOGLE MAPS
  // ONLY WHEN USER CLICKS MAP BUTTON
  // =====================================================

  const openGoogleMaps = (
    place = location,
    category = selectedCategory
  ) => {
    const search = String(place || "").trim();

    if (!search) {
      alert("Please enter a location first.");
      return false;
    }

    const url = getGoogleMapsUrl(search, category);

    if (!url) {
      return false;
    }

    console.log("OPENING GOOGLE MAPS:", url);

    const mapWindow = window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );

    if (!mapWindow) {
      window.location.href = url;
    }

    return true;
  };

  // =====================================================
  // OPEN MAP FOR PROPERTY
  // =====================================================

  const openMapForProperty = (item) => {
    // 1. Backend directions URL
    if (item?.directions_url) {
      const mapWindow = window.open(
        item.directions_url,
        "_blank",
        "noopener,noreferrer"
      );

      if (!mapWindow) {
        window.location.href = item.directions_url;
      }

      return;
    }

    // 2. Latitude + Longitude
    if (
      item?.latitude !== undefined &&
      item?.longitude !== undefined &&
      item?.latitude !== null &&
      item?.longitude !== null &&
      item?.latitude !== "" &&
      item?.longitude !== ""
    ) {
      const url =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(
          `${item.latitude},${item.longitude}`
        );

      const mapWindow = window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );

      if (!mapWindow) {
        window.location.href = url;
      }

      return;
    }

    // 3. Backend Google Maps URL
    if (item?.google_maps_url) {
      const mapWindow = window.open(
        item.google_maps_url,
        "_blank",
        "noopener,noreferrer"
      );

      if (!mapWindow) {
        window.location.href = item.google_maps_url;
      }

      return;
    }

    // 4. Search property location
    openGoogleMaps(
      item?.location || searchLocation || location,
      item?.property_type || selectedCategory
    );
  };

  // =====================================================
  // NORMALIZE API DATA
  // =====================================================

  const normalizeResults = (data) => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.results)) {
      return data.results;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (Array.isArray(data?.properties)) {
      return data.properties;
    }

    return [];
  };

  // =====================================================
  // FILTER CATEGORY
  // =====================================================

  const filterCategory = (results, category) => {
    return results.filter((item) => {
      const type = String(
        item?.property_type || category
      )
        .trim()
        .toLowerCase();

      const wanted = String(category)
        .trim()
        .toLowerCase();

      // If backend does not provide property_type,
      // keep the result because the endpoint was already
      // searched for the selected category.
      if (!item?.property_type) {
        return true;
      }

      return type === wanted;
    });
  };

  // =====================================================
  // SEARCH LOCATION
  // =====================================================

  const searchLocationData = async (
    customLocation = null,
    customCategory = null
  ) => {
    const place = String(
      customLocation !== null
        ? customLocation
        : location
    ).trim();

    const category =
      customCategory || selectedCategory;

    if (!place) {
      setError("Please enter any location.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setProperties([]);
    setSearchLocation(place);

    console.log(
      "=========================================="
    );

    console.log("SEARCH LOCATION:", place);
    console.log("SEARCH CATEGORY:", category);

    console.log(
      "=========================================="
    );

    // =====================================================
    // STEP 1
    // SMART PG DATABASE
    // =====================================================

    const dbUrl =
      `${API_URL}/pg?location=${encodeURIComponent(place)}` +
      `&property_type=${encodeURIComponent(category)}`;

    console.log(
      "SMART PG DATABASE SEARCH:",
      dbUrl
    );

    let dbResults = [];

    try {
      const dbResponse = await fetchWithTimeout(
        dbUrl,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
        10000
      );

      console.log(
        "SMART PG DATABASE STATUS:",
        dbResponse.status
      );

      if (dbResponse.ok) {
        const dbData = await dbResponse.json();

        console.log(
          "SMART PG DATABASE DATA:",
          dbData
        );

        dbResults = normalizeResults(dbData);

        dbResults = filterCategory(
          dbResults,
          category
        );
      }
    } catch (dbError) {
      console.error(
        "SMART PG DATABASE ERROR:",
        dbError
      );
    }

    // =====================================================
    // STEP 2
    // DATABASE RESULTS FOUND
    // =====================================================

    if (dbResults.length > 0) {
      console.log(
        `FOUND ${dbResults.length} PROPERTIES IN DATABASE`
      );

      setProperties(dbResults);

      setMessage(
        `${dbResults.length} ${category} accommodation(s) found near ${place}.`
      );

      setLoading(false);

      return;
    }

    // =====================================================
    // STEP 3
    // REAL OPENSTREETMAP DATA
    // =====================================================

    const realUrl =
      `${API_URL}/search-real-pg?location=${encodeURIComponent(place)}` +
      `&property_type=${encodeURIComponent(category)}`;

    console.log(
      "REAL MAP SEARCH URL:",
      realUrl
    );

    let realResults = [];

    try {
      const realResponse = await fetchWithTimeout(
        realUrl,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        },
        20000
      );

      console.log(
        "REAL MAP SEARCH STATUS:",
        realResponse.status
      );

      if (realResponse.ok) {
        const realData = await realResponse.json();

        console.log(
          "REAL MAP SEARCH DATA:",
          realData
        );

        realResults = normalizeResults(realData);

        realResults = filterCategory(
          realResults,
          category
        );
      }
    } catch (realError) {
      console.error(
        "REAL MAP SEARCH ERROR:",
        realError
      );
    }

    // =====================================================
    // STEP 4
    // REAL MAP RESULTS FOUND
    // =====================================================

    if (realResults.length > 0) {
      console.log(
        `FOUND ${realResults.length} REAL MAP PROPERTIES`
      );

      setProperties(realResults);

      setMessage(
        `${realResults.length} real mapped ${category} place(s) found near ${place}.`
      );

      setLoading(false);

      return;
    }

    // =====================================================
    // STEP 5
    // NOTHING FOUND
    //
    // IMPORTANT:
    // DO NOT OPEN GOOGLE MAPS AUTOMATICALLY
    // =====================================================

    console.log(
      "NO SMART PG OR OSM RESULTS FOUND."
    );

    setProperties([]);

    setMessage(
      `No mapped ${category} accommodation was found near ${place}.`
    );

    setLoading(false);
  };

  // =====================================================
  // CATEGORY SELECT
  // =====================================================

  const handleCategory = (category) => {
    setSelectedCategory(category);

    setProperties([]);
    setError("");
    setMessage("");

    if (location.trim()) {
      searchLocationData(
        location,
        category
      );
    }
  };

  // =====================================================
  // USE MY LOCATION
  // =====================================================

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError(
        "Your browser does not support location access."
      );

      return;
    }

    setLocationLoading(true);
    setError("");
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        try {
          const reverseUrl =
            `${API_URL}/reverse-location?latitude=` +
            encodeURIComponent(latitude) +
            `&longitude=` +
            encodeURIComponent(longitude);

          const reverseResponse =
            await fetchWithTimeout(
              reverseUrl,
              {
                method: "GET",
                headers: {
                  Accept: "application/json",
                },
              },
              10000
            );

          let place =
            `${latitude}, ${longitude}`;

          if (reverseResponse.ok) {
            const reverseData =
              await reverseResponse.json();

            if (reverseData?.display_name) {
              place =
                reverseData.display_name;
            }
          }

          setLocation(place);

          await searchLocationData(
            place,
            selectedCategory
          );
        } catch (err) {
          console.error(
            "LOCATION ERROR:",
            err
          );

          const coords =
            `${latitude}, ${longitude}`;

          setLocation(coords);

          // IMPORTANT:
          // Do not automatically open Google Maps.
          await searchLocationData(
            coords,
            selectedCategory
          );
        } finally {
          setLocationLoading(false);
        }
      },

      (err) => {
        console.error(err);

        setLocationLoading(false);

        setError(
          "Location permission denied. Please enter your location manually."
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  };

  // =====================================================
  // RESET FILTERS
  // =====================================================

  const resetFilters = () => {
    setPgType("All");
    setFoodType("All");
    setHygiene("All");
    setMaxRent("");
  };

  // =====================================================
  // FILTER PROPERTIES
  // =====================================================

  const filteredProperties = useMemo(() => {
    return properties.filter((item) => {
      // Suitable for
      if (
        pgType !== "All" &&
        item?.pg_type &&
        item.pg_type !== pgType
      ) {
        return false;
      }

      // Food
      if (
        foodType !== "All" &&
        item?.food_type &&
        !String(item.food_type)
          .toLowerCase()
          .includes(foodType.toLowerCase())
      ) {
        return false;
      }

      // Maximum rent
      if (
        maxRent &&
        item?.rent !== null &&
        item?.rent !== undefined &&
        item?.rent !== "" &&
        Number(item.rent) > Number(maxRent)
      ) {
        return false;
      }

      // Hygiene
      if (hygiene === "Good") {
        const rating = Number(
          item?.hygiene_rating ||
            item?.cleaning_rating ||
            0
        );

        if (rating < 3) {
          return false;
        }
      }

      if (hygiene === "Highly hygienic") {
        const rating = Number(
          item?.hygiene_rating ||
            item?.cleaning_rating ||
            0
        );

        if (rating < 4) {
          return false;
        }
      }

      return true;
    });
  }, [
    properties,
    pgType,
    foodType,
    hygiene,
    maxRent,
  ]);

  // =====================================================
  // COMPLAINT
  // =====================================================

  const submitComplaint = (e) => {
    e.preventDefault();

    if (!complaintProperty.trim()) {
      setComplaintMessage(
        "Please enter Property / PG Name."
      );

      return;
    }

    if (!complaintDescription.trim()) {
      setComplaintMessage(
        "Please describe the incident."
      );

      return;
    }

    const complaint = {
      type: complaintType,
      property: complaintProperty,
      description: complaintDescription,
      date: new Date().toISOString(),
    };

    try {
      const old = JSON.parse(
        localStorage.getItem(
          "smart_pg_complaints"
        ) || "[]"
      );

      old.push(complaint);

      localStorage.setItem(
        "smart_pg_complaints",
        JSON.stringify(old)
      );

      setComplaintMessage(
        "Complaint saved successfully."
      );

      setComplaintProperty("");
      setComplaintDescription("");
    } catch (err) {
      console.error(err);

      setComplaintMessage(
        "Unable to save complaint."
      );
    }
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const logout = () => {
    try {
      localStorage.removeItem(
        "smart_pg_user"
      );
    } catch (err) {
      console.log(err);
    }

    setUser("Guest");
  };

  // =====================================================
  // REFRESH
  // =====================================================

  const refreshSearch = () => {
    if (searchLocation.trim()) {
      searchLocationData(
        searchLocation,
        selectedCategory
      );
    } else if (location.trim()) {
      searchLocationData(
        location,
        selectedCategory
      );
    } else {
      setError(
        "Please enter a location first."
      );
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="app">

      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          font-family: Inter, Arial, Helvetica, sans-serif;
          background: #f7f9fc;
          color: #172033;
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .app {
          min-height: 100vh;
        }

        .navbar {
          background: white;
          border-bottom: 1px solid #e8ecf3;
          padding: 14px 5%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 21px;
          font-weight: 800;
        }

        .brand-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef4ff;
          font-size: 22px;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .hello {
          color: #4d5870;
          font-size: 14px;
        }

        .nav-btn,
        .secondary-btn {
          border: 1px solid #dfe5ef;
          background: white;
          padding: 10px 14px;
          border-radius: 9px;
          font-weight: 600;
        }

        .nav-btn:hover,
        .secondary-btn:hover {
          background: #f5f7fb;
        }

        .hero {
          text-align: center;
          padding: 45px 20px 28px;
          background: radial-gradient(
            circle at top,
            #eaf2ff,
            transparent 55%
          );
        }

        .india-badge {
          display: inline-block;
          padding: 8px 15px;
          border-radius: 999px;
          background: #eef5ff;
          color: #315da8;
          font-weight: 700;
          font-size: 13px;
        }

        .hero h1 {
          font-size: clamp(32px, 5vw, 55px);
          margin: 17px 0 12px;
          line-height: 1.05;
        }

        .hero p {
          max-width: 800px;
          margin: auto;
          color: #68738a;
          line-height: 1.7;
        }

        .container {
          width: min(1150px, 92%);
          margin: auto;
        }

        .section {
          margin: 24px 0;
        }

        .section-card {
          background: white;
          border: 1px solid #e4e9f1;
          border-radius: 18px;
          padding: 24px;
          box-shadow:
            0 8px 30px rgba(30,45,75,0.05);
        }

        .section-title {
          margin: 0 0 7px;
          font-size: 22px;
        }

        .section-subtitle {
          color: #737d91;
          margin: 0 0 22px;
        }

        .category-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0,1fr));
          gap: 15px;
        }

        .category-card {
          border: 2px solid #e6ebf3;
          background: white;
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          transition: 0.2s;
        }

        .category-card:hover {
          transform: translateY(-2px);
          border-color: #6c8cff;
        }

        .category-card.selected {
          border-color: #3867ff;
          background: #f2f6ff;
        }

        .category-icon {
          font-size: 34px;
          margin-bottom: 8px;
        }

        .category-title {
          font-weight: 800;
          font-size: 17px;
        }

        .category-subtitle {
          color: #758096;
          font-size: 13px;
          margin-top: 5px;
        }

        .count {
          margin-top: 10px;
          display: inline-block;
          padding: 3px 9px;
          border-radius: 999px;
          background: #edf1f7;
          font-size: 12px;
          font-weight: 700;
        }

        .selected-info {
          margin-top: 18px;
          padding: 12px 15px;
          border-radius: 10px;
          background: #effaf3;
          color: #1d6b3d;
          font-weight: 600;
        }

        .search-row {
          display: flex;
          gap: 10px;
        }

        .location-input {
          flex: 1;
          min-width: 0;
          padding: 14px 16px;
          border: 1px solid #d9e0eb;
          border-radius: 11px;
          outline: none;
          font-size: 16px;
        }

        .location-input:focus {
          border-color: #5578ff;
          box-shadow:
            0 0 0 3px
            rgba(85,120,255,0.1);
        }

        .primary-btn {
          border: none;
          border-radius: 11px;
          padding: 0 20px;
          background: #3867ff;
          color: white;
          font-weight: 800;
        }

        .primary-btn:hover {
          background: #2855e6;
        }

        .map-btn {
          border: none;
          border-radius: 10px;
          padding: 11px 15px;
          background: #1f7a4d;
          color: white;
          font-weight: 700;
        }

        .map-btn:hover {
          background: #17613d;
        }

        .search-actions {
          display: flex;
          gap: 10px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .search-note {
          margin-top: 12px;
          color: #637087;
          font-size: 14px;
        }

        .message {
          margin-top: 15px;
          padding: 13px;
          border-radius: 10px;
          background: #eff7ff;
          color: #285997;
        }

        .error {
          margin-top: 15px;
          padding: 13px;
          border-radius: 10px;
          background: #fff1f1;
          color: #a12d2d;
        }

        .results-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 15px;
        }

        .results-header h2 {
          margin: 0;
        }

        .property-grid {
          display: grid;
          grid-template-columns:
            repeat(3,minmax(0,1fr));
          gap: 18px;
        }

        .property-card {
          background: white;
          border: 1px solid #e2e7ef;
          border-radius: 17px;
          padding: 19px;
          box-shadow:
            0 8px 25px rgba(35,48,75,0.05);
        }

        .property-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 12px 30px
            rgba(35,48,75,0.09);
        }

        .property-top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .property-name {
          font-size: 19px;
          font-weight: 800;
          margin: 0;
        }

        .type-badge {
          white-space: nowrap;
          padding: 5px 8px;
          border-radius: 7px;
          background: #eef3ff;
          color: #365ccc;
          font-size: 12px;
          font-weight: 800;
        }

        .location-text {
          margin: 11px 0;
          color: #69758a;
          line-height: 1.5;
        }

        .details {
          display: grid;
          gap: 7px;
          color: #4f5a6e;
          font-size: 14px;
        }

        .rent {
          margin: 13px 0;
          font-size: 20px;
          font-weight: 800;
          color: #1d6c43;
        }

        .distance {
          color: #66738b;
          font-size: 13px;
        }

        .property-actions {
          display: flex;
          gap: 8px;
          margin-top: 15px;
          flex-wrap: wrap;
        }

        .empty {
          text-align: center;
          background: white;
          border: 1px solid #e3e8ef;
          border-radius: 17px;
          padding: 35px 20px;
        }

        .empty-icon {
          font-size: 40px;
        }

        .empty h3 {
          margin-bottom: 7px;
        }

        .empty p {
          color: #707b90;
        }

        .filter-grid {
          display: grid;
          grid-template-columns:
            repeat(4,minmax(0,1fr));
          gap: 15px;
        }

        .filter label {
          display: block;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 7px;
        }

        .filter select,
        .filter input {
          width: 100%;
          padding: 11px;
          border: 1px solid #dce2ec;
          border-radius: 9px;
          background: white;
        }

        .complaint {
          background: #fff8f0;
          border-color: #f3dfc4;
        }

        .complaint-grid {
          display: grid;
          grid-template-columns:
            repeat(2,minmax(0,1fr));
          gap: 14px;
        }

        .complaint-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .complaint-field.full {
          grid-column: 1 / -1;
        }

        .complaint-field input,
        .complaint-field select,
        .complaint-field textarea {
          padding: 12px;
          border: 1px solid #e0d8cf;
          border-radius: 9px;
          background: white;
        }

        .complaint-field textarea {
          min-height: 100px;
          resize: vertical;
        }

        .complaint-btn {
          margin-top: 14px;
          background: #d94a2d;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 12px 18px;
          font-weight: 800;
        }

        .success-message {
          margin-top: 12px;
          color: #257348;
          font-weight: 700;
        }

        footer {
          margin-top: 50px;
          padding: 35px 20px;
          background: #111827;
          color: white;
          text-align: center;
        }

        footer p {
          color: #aeb7c8;
          margin: 8px 0;
        }

        .spin {
          display: inline-block;
          animation:
            spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .category-grid,
          .property-grid {
            grid-template-columns:
              repeat(2,1fr);
          }

          .filter-grid {
            grid-template-columns:
              repeat(2,1fr);
          }
        }

        @media (max-width: 650px) {
          .navbar {
            align-items: flex-start;
          }

          .search-row {
            flex-direction: column;
          }

          .primary-btn {
            padding: 13px;
          }

          .category-grid,
          .property-grid,
          .filter-grid,
          .complaint-grid {
            grid-template-columns: 1fr;
          }

          .complaint-field.full {
            grid-column: auto;
          }

          .results-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      {/* =====================================================
          NAVBAR
      ===================================================== */}

      <nav className="navbar">
        <div className="brand">
          <div className="brand-icon">
            ðŸ 
          </div>

          Smart PG
        </div>

        <div className="nav-right">
          <span className="hello">
            Hi, {user}
          </span>

          <button
            className="nav-btn"
            onClick={() =>
              alert(
                "Property owner registration can be connected to the backend."
              )
            }
          >
            âž• Add Property
          </button>

          <button
            className="nav-btn"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="hero">
        <div className="india-badge">
          ðŸ‡®ðŸ‡³ INDIA-WIDE ACCOMMODATION
        </div>

        <h1>
          Find Your Perfect Stay
        </h1>

        <p>
          Search PG, Hostel, Co-Living and Flat
          anywhere in India. Enter any city, area,
          landmark or PIN code. Real mapped
          accommodation is shown when available.
          If nothing is found, you can manually
          search Google Maps.
        </p>
      </section>

      <main className="container">

        {/* =====================================================
            CATEGORY
        ===================================================== */}

        <section className="section">
          <div className="section-card">

            <h2 className="section-title">
              1ï¸âƒ£ Choose Accommodation Type First
            </h2>

            <p className="section-subtitle">
              Select one category, then search the
              location.
            </p>

            <div className="category-grid">

              {CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  className={
                    "category-card " +
                    (
                      selectedCategory ===
                      category.key
                        ? "selected"
                        : ""
                    )
                  }
                  onClick={() =>
                    handleCategory(
                      category.key
                    )
                  }
                >

                  <div className="category-icon">
                    {category.icon}
                  </div>

                  <div className="category-title">
                    {category.title}
                  </div>

                  <div className="category-subtitle">
                    {category.subtitle}
                  </div>

                  <span className="count">
                    {categoryCounts[
                      category.key
                    ] || 0}
                  </span>

                </button>
              ))}

            </div>

            <div className="selected-info">
              âœ… Selected:{" "}
              <strong>
                {selectedCategory}
              </strong>{" "}
              â€” now search your location below.
            </div>

          </div>
        </section>

        {/* =====================================================
            LOCATION SEARCH
        ===================================================== */}

        <section className="section">
          <div className="section-card">

            <h2 className="section-title">
              2ï¸âƒ£ Search Location
            </h2>

            <p className="section-subtitle">
              Only{" "}
              <strong>
                {selectedCategory}
              </strong>{" "}
              results will be searched.
            </p>

            <div className="search-row">

              <input
                className="location-input"
                value={location}
                onChange={(e) =>
                  setLocation(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    searchLocationData();
                  }
                }}
                placeholder="Enter city, area, landmark or PIN code..."
              />

              <button
                className="primary-btn"
                onClick={() =>
                  searchLocationData()
                }
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spin">
                      âŸ³
                    </span>{" "}
                    Searching...
                  </>
                ) : (
                  <>ðŸ”Ž Search</>
                )}
              </button>

            </div>

            <div className="search-actions">

              <button
                className="secondary-btn"
                onClick={useMyLocation}
                disabled={locationLoading}
              >
                {locationLoading
                  ? "ðŸ“ Getting Location..."
                  : "ðŸ“ Use My Location"}
              </button>

              <button
                className="map-btn"
                onClick={() =>
                  openGoogleMaps()
                }
              >
                ðŸ—ºï¸ Open Google Maps
              </button>

            </div>

            <div className="search-note">
              ðŸŸ¢ Smart PG checks its database
              first, then real OpenStreetMap
              data. Google Maps opens only when
              you click a map button.
            </div>

            {searchLocation && (
              <div className="search-note">
                ðŸ“ Location:{" "}
                <strong>
                  {searchLocation}
                </strong>
              </div>
            )}

            {message && (
              <div className="message">
                {message}
              </div>
            )}

            {error && (
              <div className="error">
                âš ï¸ {error}
              </div>
            )}

          </div>
        </section>

        {/* =====================================================
            RESULTS
        ===================================================== */}

        <section className="section">

          <div className="results-header">

            <div>

              <h2>
                Available Properties
              </h2>

              <div className="search-note">
                Showing{" "}
                <strong>
                  {filteredProperties.length}
                </strong>{" "}
                properties for{" "}
                <strong>
                  {selectedCategory}
                </strong>

                {searchLocation
                  ? ` near ${searchLocation}`
                  : ""}
              </div>

            </div>

            <button
              className="secondary-btn"
              onClick={refreshSearch}
            >
              ðŸ”„ Refresh
            </button>

          </div>

          {loading ? (

            <div className="empty">

              <div className="empty-icon">
                ðŸ”Ž
              </div>

              <h3>
                Searching location...
              </h3>

              <p>
                Checking Smart PG and real
                OpenStreetMap data.
              </p>

            </div>

          ) : filteredProperties.length === 0 ? (

            <div className="empty">

              <div className="empty-icon">
                {searchLocation
                  ? "ðŸ—ºï¸"
                  : "ðŸ "}
              </div>

              <h3>
                {searchLocation
                  ? "No mapped accommodation found"
                  : "Search a location first"}
              </h3>

              <p>
                {searchLocation
                  ? `No mapped ${selectedCategory} was found near ${searchLocation}.`
                  : "Enter any city, area, landmark or PIN code above."}
              </p>

              {searchLocation && (
                <button
                  className="map-btn"
                  onClick={() =>
                    openGoogleMaps(
                      searchLocation,
                      selectedCategory
                    )
                  }
                >
                  ðŸ—ºï¸ Search on Google Maps
                </button>
              )}

            </div>

          ) : (

            <div className="property-grid">

              {filteredProperties.map(
                (item, index) => (

                  <div
                    className="property-card"
                    key={
                      item?.id ||
                      `${item?.name || "property"}-${index}`
                    }
                  >

                    <div className="property-top">

                      <h3 className="property-name">
                        {item?.name ||
                          "Accommodation"}
                      </h3>

                      <span className="type-badge">
                        {item?.property_type ||
                          selectedCategory}
                      </span>

                    </div>

                    <div className="location-text">
                      ðŸ“{" "}
                      {item?.location ||
                        item?.address ||
                        "Location available on map"}
                    </div>

                    {item?.distance_km !==
                      undefined &&
                      item?.distance_km !==
                        null && (
                        <div className="distance">
                          ðŸ“{" "}
                          {Number(
                            item.distance_km
                          ).toFixed(2)}{" "}
                          km away
                        </div>
                      )}

                    {item?.rent !== null &&
                      item?.rent !==
                        undefined &&
                      item?.rent !== "" && (
                        <div className="rent">
                          â‚¹
                          {Number(
                            item.rent
                          ).toLocaleString(
                            "en-IN"
                          )}
                          /month
                        </div>
                      )}

                    <div className="details">

                      <div>
                        ðŸ‘¤ Suitable for:{" "}
                        {item?.pg_type ||
                          "Unisex"}
                      </div>

                      <div>
                        ðŸ± Food:{" "}
                        {item?.food_type ||
                          "Not specified"}
                      </div>

                      {item?.wifi_available && (
                        <div>
                          ðŸ“¶ Wi-Fi Available
                        </div>
                      )}

                      {item?.cctv_available && (
                        <div>
                          ðŸ“¹ CCTV Available
                        </div>
                      )}

                      {item?.security_available && (
                        <div>
                          ðŸ›¡ï¸ Security Available
                        </div>
                      )}

                      {item?.parking_available && (
                        <div>
                          ðŸš— Parking Available
                        </div>
                      )}

                      {item?.geyser_available && (
                        <div>
                          ðŸš¿ Geyser Available
                        </div>
                      )}

                      {item?.room_type && (
                        <div>
                          ðŸ›ï¸ Room:{" "}
                          {item.room_type}
                        </div>
                      )}

                      {Number(
                        item?.cleaning_rating || 0
                      ) > 0 && (
                        <div>
                          ðŸ§¼ Cleaning:{" "}
                          {item.cleaning_rating}/5
                        </div>
                      )}

                      {Number(
                        item?.hygiene_rating || 0
                      ) > 0 && (
                        <div>
                          ðŸ§¼ Hygiene:{" "}
                          {item.hygiene_rating}/5
                        </div>
                      )}

                      {item?.source && (
                        <div>
                          ðŸŒ Source:{" "}
                          {item.source}
                        </div>
                      )}

                    </div>

                    <div className="property-actions">

                      <button
                        className="map-btn"
                        onClick={() =>
                          openMapForProperty(
                            item
                          )
                        }
                      >
                        ðŸ—ºï¸ View on Map
                      </button>

                      {item?.website && (
                        <button
                          className="secondary-btn"
                          onClick={() => {
                            const siteWindow =
                              window.open(
                                item.website,
                                "_blank",
                                "noopener,noreferrer"
                              );

                            if (!siteWindow) {
                              window.location.href =
                                item.website;
                            }
                          }}
                        >
                          ðŸŒ Website
                        </button>
                      )}

                    </div>

                  </div>

                )
              )}

            </div>

          )}

        </section>

        {/* =====================================================
            FILTERS
        ===================================================== */}

        <section className="section">

          <div className="section-card">

            <h2 className="section-title">
              ðŸ”Ž Stay Filters
            </h2>

            <p className="section-subtitle">
              Boys/Girls/Unisex, Veg/Non-Veg
              and hygiene preferences.
            </p>

            <div className="filter-grid">

              <div className="filter">

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

                  <option value="All">
                    All
                  </option>

                  <option value="Boys">
                    Boys
                  </option>

                  <option value="Girls">
                    Girls
                  </option>

                  <option value="Unisex">
                    Unisex
                  </option>

                </select>

              </div>

              <div className="filter">

                <label>
                  Food
                </label>

                <select
                  value={foodType}
                  onChange={(e) =>
                    setFoodType(
                      e.target.value
                    )
                  }
                >

                  <option value="All">
                    All
                  </option>

                  <option value="Veg">
                    Veg
                  </option>

                  <option value="Non-Veg">
                    Non-Veg
                  </option>

                </select>

              </div>

              <div className="filter">

                <label>
                  Hygiene
                </label>

                <select
                  value={hygiene}
                  onChange={(e) =>
                    setHygiene(
                      e.target.value
                    )
                  }
                >

                  <option value="All">
                    All
                  </option>

                  <option value="Good">
                    Good hygiene
                  </option>

                  <option value="Highly hygienic">
                    Highly hygienic
                  </option>

                </select>

              </div>

              <div className="filter">

                <label>
                  Maximum Rent
                </label>

                <input
                  type="number"
                  min="0"
                  value={maxRent}
                  onChange={(e) =>
                    setMaxRent(
                      e.target.value
                    )
                  }
                  placeholder="â‚¹ Maximum"
                />

              </div>

            </div>

            <div className="search-actions">

              <button
                className="secondary-btn"
                onClick={resetFilters}
              >
                â†» Reset Filters
              </button>

            </div>

          </div>

        </section>

        {/* =====================================================
            COMPLAINT
        ===================================================== */}

        <section className="section">

          <div className="section-card complaint">

            <h2 className="section-title">
              ðŸš¨ Lost / Robbed / Stolen Item Complaint
            </h2>

            <p className="section-subtitle">
              PG, Hostel, Co-Living ya Flat me
              lost, missing ya stolen item ka
              neutral report save karo.
            </p>

            <form onSubmit={submitComplaint}>

              <div className="complaint-grid">

                <div className="complaint-field">

                  <label>
                    Complaint Type
                  </label>

                  <select
                    value={complaintType}
                    onChange={(e) =>
                      setComplaintType(
                        e.target.value
                      )
                    }
                  >

                    <option>
                      Robbed / Stolen Item
                    </option>

                    <option>
                      Lost Item
                    </option>

                    <option>
                      Missing Item
                    </option>

                    <option>
                      Security Complaint
                    </option>

                  </select>

                </div>

                <div className="complaint-field">

                  <label>
                    Property / PG Name
                  </label>

                  <input
                    value={complaintProperty}
                    onChange={(e) =>
                      setComplaintProperty(
                        e.target.value
                      )
                    }
                    placeholder="Enter property name"
                  />

                </div>

                <div className="complaint-field full">

                  <label>
                    Describe the incident
                  </label>

                  <textarea
                    value={
                      complaintDescription
                    }
                    onChange={(e) =>
                      setComplaintDescription(
                        e.target.value
                      )
                    }
                    placeholder="Describe what happened..."
                  />

                </div>

              </div>

              <button
                className="complaint-btn"
                type="submit"
              >
                ðŸš¨ Submit Complaint
              </button>

              {complaintMessage && (
                <div className="success-message">
                  {complaintMessage}
                </div>
              )}

            </form>

          </div>

        </section>

      </main>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer>

        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          ðŸ  Smart PG
        </div>

        <p>
          Find PG, Hostel, Co-Living & Flat
          with category-first search, GPS,
          real map data and incident reporting.
        </p>

        <p>
          Â© 2026 Smart PG
        </p>

      </footer>

    </div>
  );
}

export default App;
