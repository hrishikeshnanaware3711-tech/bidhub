import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flame,
  Home,
  Info,
  LocateFixed,
  Map as MapIcon,
  Menu,
  PhoneCall,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import {
  createIssue,
  getCategories,
  getFlags,
  getIssues,
  getMyIssues,
  assetUrl,
  deleteIssue,
} from "../api";
import MapView from "../components/MapView";
import LocationPicker from "../components/LocationPicker";
import IssueCard from "../components/IssueCard";
import { AIClosureCard, AITranslationCard } from "../components/AIReportTools";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "reports", label: "My Reports", icon: FileText },
  { id: "map", label: "Map", icon: MapIcon },
  { id: "emergency", label: "Emergency", icon: PhoneCall },
];

const DEFAULT_LOCATION = { lat: 28.6139, lng: 77.2090 };

const CATEGORY_META = {
  Pothole: { icon: "▲", tone: "navy" },
  Garbage: { icon: "▦", tone: "green" },
  "Street Light": { icon: "●", tone: "amber" },
  "Water Leakage": { icon: "●", tone: "blue" },
  "Damaged Road": { icon: "!", tone: "red" },
  "Fallen Tree": { icon: "♣", tone: "green" },
  Fire: { icon: "🔥", tone: "red" },
  "Vehicle Accident": { icon: "🚗", tone: "black" },
  "Medical Emergency": { icon: "✚", tone: "blue" },
  Other: { icon: "…", tone: "slate" },
};

function categoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.Other;
}

function formatStatus(status) {
  return status.replace("_", " ");
}

function statusClass(status) {
  return `status-${status.toLowerCase()}`;
}

export default function CitizenPage({ user }) {
  const [activeTab, setActiveTab] = useState("home");
  const [reportStep, setReportStep] = useState(1);
  const [categories, setCategories] = useState([]);
  const [flags, setFlags] = useState([]);
  const [issues, setIssues] = useState([]);
  const [myIssues, setMyIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Pothole");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const fileInputRef = useRef(null);

  async function refreshData() {
    setRefreshing(true);
    try {
      const [all, mine, categoryData, flagData] = await Promise.all([
        getIssues(),
        getMyIssues(user.id),
        getCategories(),
        getFlags(),
      ]);
      setIssues(all);
      setMyIssues(mine);
      setCategories(categoryData.filter((item) => item !== "Auto Detect"));
      setFlags(flagData);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function goTo(tab) {
    setError("");
    setSuccess("");
    setActiveTab(tab);
    setMobileMenu(false);
  }

  function openReport() {
    setError("");
    setSuccess("");
    setAiResult(null);
    setReportStep(1);
    setActiveTab("report");
  }

  function useMyLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("This browser does not provide location access.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setError("Location access was denied or unavailable.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function choosePhoto(event) {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("The image must be 5 MB or smaller.");
      return;
    }
    setPhoto(file);
    setError("");
  }

  function nextStep() {
    setError("");
    if (!selectedCategory) {
      setError("Choose an incident type first.");
      return;
    }
    setReportStep(2);
  }

  function previousStep() {
    setError("");
    setReportStep(1);
  }

  async function deleteResolvedIssue(issue) {
    if (issue.status !== "RESOLVED") {
      setError("Only resolved incidents can be deleted.");
      return;
    }

    const confirmed = window.confirm(
      `Delete resolved incident #${issue.id}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteIssue(issue.id, user.id);
      setSelectedIssue(null);
      setSuccess(`Incident #${issue.id} deleted from your reports.`);
      await refreshData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!description.trim()) {
      setError("Please describe the incident.");
      return;
    }

    if (!location) {
      setError("Please pin the incident location.");
      return;
    }

    setLoading(true);

    try {
      const result = await createIssue({
        userId: user.id,
        category: selectedCategory,
        description: description.trim(),
        latitude: location.lat,
        longitude: location.lng,
        photo,
      });

      setAiResult(result);
      setSuccess(
        result.duplicate_of_id
          ? `Incident #${result.id} submitted. Possible duplicate of #${result.duplicate_of_id}.`
          : `Incident #${result.id} submitted successfully.`,
      );

      setDescription("");
      setPhoto(null);
      setLocation(DEFAULT_LOCATION);
      setReportStep(1);
      setActiveTab("reports");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await refreshData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const recentIssues = useMemo(() => issues.slice(0, 4), [issues]);

  const filteredIssues = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();
    if (!value) return issues;
    return issues.filter(
      (issue) =>
        issue.category.toLowerCase().includes(value) ||
        issue.description.toLowerCase().includes(value),
    );
  }, [issues, searchTerm]);

  return (
    <div className="citizen-page">
      <header className="citizen-header">
        <div className="brand-lockup">
          <div className="brand-pin" aria-hidden="true">
            <span />
          </div>
          <div>
            <strong>OneMap</strong>
            <span>Safer Communities. Stronger Cities.</span>
          </div>
        </div>

        <div className="citizen-header-actions">
          <button className="header-icon-button" type="button" aria-label="Notifications">
            <Info size={18} />
          </button>
          <button className="profile-pill" type="button">
            <span className="profile-avatar">
              <UserRound size={16} />
            </span>
            <span>{user.name}</span>
            <ChevronRight size={15} className="profile-chevron" />
          </button>
          <button
            className="mobile-menu-button"
            type="button"
            onClick={() => setMobileMenu((value) => !value)}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {error ? (
        <div className="toast toast-error">
          <AlertTriangle size={17} />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}><X size={15} /></button>
        </div>
      ) : null}

      {success ? (
        <div className="toast toast-success">
          <Sparkles size={17} />
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess("")}><X size={15} /></button>
        </div>
      ) : null}

      <div className="citizen-shell">
        <aside className={`citizen-sidebar ${mobileMenu ? "mobile-open" : ""}`}>
          <div className="sidebar-brand">
            <div className="brand-pin small"><span /></div>
            <div>
              <strong>OneMap</strong>
              <small>Civic response</small>
            </div>
          </div>

          <nav className="citizen-nav">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? "nav-item active" : "nav-item"}
                onClick={() => goTo(id)}
              >
                <Icon size={17} />
                <span>{label}</span>
                {id === "reports" && myIssues.length > 0 ? (
                  <b>{myIssues.length}</b>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="sidebar-emergency-card">
            <div className="sidebar-emergency-icon"><PhoneCall size={18} /></div>
            <div>
              <strong>Need urgent help?</strong>
              <span>Use the emergency line.</span>
            </div>
            <button type="button" onClick={() => goTo("emergency")}>Open</button>
          </div>
        </aside>

        <main className="citizen-main">
          {activeTab === "home" ? (
            <HomeScreen
              issues={issues}
              myIssues={myIssues}
              onReport={openReport}
              onNavigate={goTo}
              flags={flags}
            />
          ) : null}

          {activeTab === "report" ? (
            <ReportScreen
              step={reportStep}
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              description={description}
              setDescription={setDescription}
              photo={photo}
              photoPreview={photoPreview}
              choosePhoto={choosePhoto}
              fileInputRef={fileInputRef}
              location={location}
              setLocation={setLocation}
              useMyLocation={useMyLocation}
              nextStep={nextStep}
              previousStep={previousStep}
              submitReport={submitReport}
              loading={loading}
              aiResult={aiResult}
              onEmergency={() => goTo("emergency")}
              onCancel={() => goTo("home")}
            />
          ) : null}

          {activeTab === "map" ? (
            <CitizenMapScreen
              issues={filteredIssues}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedIssue={selectedIssue}
              setSelectedIssue={setSelectedIssue}
              onRefresh={refreshData}
              refreshing={refreshing}
            />
          ) : null}

          {activeTab === "reports" ? (
            <ReportsScreen
              issues={myIssues}
              onSelect={setSelectedIssue}
              selectedIssue={selectedIssue}
              onReport={openReport}
              onDelete={deleteResolvedIssue}
            />
          ) : null}

          {activeTab === "emergency" ? (
            <EmergencyScreen onBack={() => goTo("home")} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function HomeScreen({ issues, myIssues, onReport, onNavigate, flags }) {
  return (
    <div className="screen-content home-screen">
      <section className="mobile-hero-card">
        <div className="mobile-hero-copy">
          <span className="screen-eyebrow">REPORT • TRACK • BUILD</span>
          <h1>Make your city safer, one report at a time.</h1>
          <p>
            Capture a civic problem, pin the location and let the response team see the incident clearly.
          </p>
          <button type="button" className="blue-button" onClick={onReport}>
            <Plus size={17} /> Report an Incident
          </button>
        </div>
        <div className="hero-glow-orb" aria-hidden="true" />
      </section>

      <section className="quick-action-grid">
        <button type="button" className="quick-action-card" onClick={() => onNavigate("reports")}>
          <span className="quick-icon navy"><FileText size={18} /></span>
          <strong>My Reports</strong>
          <small>Track submissions</small>
          <b>{myIssues.length}</b>
        </button>
        <button type="button" className="quick-action-card emergency" onClick={() => onNavigate("emergency")}>
          <span className="quick-icon red"><PhoneCall size={18} /></span>
          <strong>Emergency</strong>
          <small>Call for immediate help</small>
          <b>112</b>
        </button>
        <button type="button" className="quick-action-card" onClick={() => onNavigate("map")}>
          <span className="quick-icon blue"><MapIcon size={18} /></span>
          <strong>Live Map</strong>
          <small>See nearby incidents</small>
          <b>{issues.length}</b>
        </button>
      </section>

      <section className="mobile-section">
        <div className="section-title-row">
          <div>
            <span>LOCAL AWARENESS</span>
            <h2>Incident snapshot</h2>
          </div>
          <button type="button" className="text-link" onClick={() => onNavigate("map")}>View map <ChevronRight size={14} /></button>
        </div>

        <div className="mini-stat-grid">
          {flags.slice(0, 4).map((flag) => (
            <div className="mini-stat-card" key={flag.id}>
              <span className={`flag-symbol flag-symbol-${flag.id.toLowerCase()}`}>⚑</span>
              <strong>{issues.filter((issue) => issue.flag === flag.id).length}</strong>
              <small>{flag.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="mobile-section">
        <div className="section-title-row">
          <div>
            <span>COMMUNITY MAP</span>
            <h2>Reported issues</h2>
          </div>
          <button type="button" className="icon-refresh" onClick={() => onNavigate("map")}><MapIcon size={17} /></button>
        </div>
        <div className="mobile-map-mini">
          <MapView issues={issues.slice(0, 8)} heightClass="map-height-small" />
        </div>
      </section>
    </div>
  );
}

function ReportScreen({
  step,
  categories,
  selectedCategory,
  setSelectedCategory,
  description,
  setDescription,
  photo,
  photoPreview,
  choosePhoto,
  fileInputRef,
  location,
  setLocation,
  useMyLocation,
  nextStep,
  previousStep,
  submitReport,
  loading,
  aiResult,
  onEmergency,
  onCancel,
}) {
  return (
    <div className="screen-content report-screen">
      <div className="mobile-screen-header">
        <button type="button" className="back-button" onClick={step === 2 ? previousStep : onCancel}>
          <ChevronLeft size={18} />
        </button>
        <div>
          <span>REPORT INCIDENT</span>
          <strong>{step === 1 ? "Choose problem type" : "Details, photo & location"}</strong>
        </div>
        <span className="step-counter">0{step}/02</span>
      </div>

      {aiResult ? (
        <>
          <div className="post-analysis-card">
            <div className="analysis-top">
              <span className="ai-chip"><Sparkles size={14} /> AI processed</span>
              <span className={`flag-chip flag-chip-${aiResult.flag.toLowerCase()}`}>⚑ {aiResult.flag}</span>
            </div>
            <strong>{aiResult.ai_category || aiResult.category}</strong>
            <p>{aiResult.ai_summary || "Incident analysis completed."}</p>
          </div>
          {aiResult.id ? (
            <AITranslationCard
              issue={aiResult}
              user={{ id: aiResult.user_id }}
              text={aiResult.ai_summary || aiResult.description}
            />
          ) : null}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <div className="mobile-intro">
            <span className="screen-eyebrow">STEP 01</span>
            <h1>What is the problem?</h1>
            <p>Select the type of issue you are facing.</p>
          </div>

          <div className="category-list">
            {categories.map((category) => {
              const meta = categoryMeta(category);
              const active = selectedCategory === category;
              return (
                <button
                  type="button"
                  className={active ? "category-choice active" : "category-choice"}
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                >
                  <span className={`category-icon category-${meta.tone}`}>{meta.icon}</span>
                  <span>{category}</span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>

          <div className="report-helper-note">
            <Sparkles size={15} />
            AI will review the description and photo to suggest incident type, flag and priority.
          </div>

          <button type="button" className="blue-button full" onClick={nextStep}>
            Next <ChevronRight size={17} />
          </button>
        </>
      ) : (
        <form className="report-form-mobile" onSubmit={submitReport}>
          <div className="mobile-intro compact">
            <span className="screen-eyebrow">STEP 02</span>
            <h1>Tell us what happened.</h1>
          </div>

          <label className="field-label">
            <span>Describe the issue</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              placeholder="Add more details about the problem..."
              rows={5}
            />
            <small>{description.length}/500</small>
          </label>

          <div className="ai-suggest-card">
            <div className="ai-suggest-icon"><Sparkles size={18} /></div>
            <div>
              <strong>AI-assisted response</strong>
              <span>Category: {selectedCategory}</span>
              <span>Priority will be suggested after analysis.</span>
            </div>
          </div>

          <div className="upload-section">
            <span className="field-title">Add photo</span>
            <button type="button" className="photo-upload" onClick={() => fileInputRef.current?.click()}>
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" />
              ) : (
                <>
                  <Camera size={23} />
                  <strong>Upload Photo</strong>
                  <small>JPG, PNG or WEBP · 5 MB max</small>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={choosePhoto}
              hidden
            />
          </div>

          <div className="upload-section">
            <div className="field-title-row">
              <span className="field-title">Pin location</span>
              <button type="button" className="tiny-action-button" onClick={useMyLocation}>
                <LocateFixed size={13} /> Use my location
              </button>
            </div>
            <LocationPicker
              location={location}
              onPick={setLocation}
              onUseMyLocation={useMyLocation}
            />
          </div>

          <div className="emergency-inline-card">
            <div>
              <strong>In immediate danger?</strong>
              <span>Use the emergency response line.</span>
            </div>
            <button type="button" onClick={onEmergency}><PhoneCall size={16} /> 112</button>
          </div>

          <div className="submit-row">
            <button type="button" className="ghost-button" onClick={previousStep}>
              <ChevronLeft size={17} /> Back
            </button>
            <button type="submit" className="blue-button" disabled={loading}>
              {loading ? "Processing..." : "Submit Report"}
              {loading ? null : <Send size={16} />}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function CitizenMapScreen({
  issues,
  searchTerm,
  setSearchTerm,
  selectedIssue,
  setSelectedIssue,
  onRefresh,
  refreshing,
}) {
  return (
    <div className="screen-content map-screen">
      <div className="mobile-screen-header simple">
        <div>
          <span>LOCATION AWARENESS</span>
          <strong>Reported issues</strong>
        </div>
        <button type="button" className="icon-refresh" onClick={onRefresh} disabled={refreshing}>
          <span className={refreshing ? "rotating" : ""}><LocateFixed size={17} /></span>
        </button>
      </div>

      <div className="map-search-row">
        <div className="search-box">
          <Search size={16} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search incidents..."
          />
        </div>
        <button type="button" className="filter-button"><Menu size={15} /> Filters</button>
      </div>

      <div className="mobile-map-large">
        <MapView
          issues={issues}
          heightClass="map-height-tall"
          selectedIssueId={selectedIssue?.id}
          onSelectIssue={setSelectedIssue}
        />
      </div>

      {selectedIssue ? (
        <div className="mobile-map-detail">
          <div>
            <span className="screen-eyebrow">SELECTED INCIDENT</span>
            <h3>#{selectedIssue.id} · {selectedIssue.category}</h3>
            <p>{selectedIssue.description}</p>
          </div>
          <span className={`status-badge ${statusClass(selectedIssue.status)}`}>{formatStatus(selectedIssue.status)}</span>
        </div>
      ) : (
        <div className="map-tip"><MapIcon size={16} /> Tap a flag to view incident details.</div>
      )}
    </div>
  );
}

function ReportsScreen({ issues, selectedIssue, onSelect, onReport, onDelete }) {
  const [filter, setFilter] = useState("ALL");

  const visibleIssues = issues.filter((issue) => {
    if (filter === "ALL") return true;
    if (filter === "PENDING") return ["REPORTED", "ASSIGNED"].includes(issue.status);
    if (filter === "IN PROGRESS") return issue.status === "IN_PROGRESS";
    if (filter === "RESOLVED") return issue.status === "RESOLVED";
    return true;
  });

  return (
    <div className="screen-content reports-screen">
      <div className="mobile-screen-header simple">
        <div>
          <span>YOUR ACTIVITY</span>
          <strong>My Reports</strong>
        </div>
        <button type="button" className="blue-circle-button" onClick={onReport}><Plus size={17} /></button>
      </div>

      <div className="segmented-filter">
        {[
          ["ALL", "All"],
          ["PENDING", "Pending"],
          ["IN PROGRESS", "In Progress"],
          ["RESOLVED", "Resolved"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="report-list-mobile">
        {visibleIssues.length ? (
          visibleIssues.map((issue) => (
            <button
              type="button"
              className={selectedIssue?.id === issue.id ? "report-list-item selected" : "report-list-item"}
              key={issue.id}
              onClick={() => onSelect(issue)}
            >
              <div className={`report-list-image flag-${issue.flag.toLowerCase()}`}>
                {issue.photo_url ? <img src={assetUrl(issue.photo_url)} alt="Issue" /> : issue.flag === "RED" ? "🔥" : issue.flag === "BLACK" ? "🚗" : issue.flag === "BLUE" ? "🚑" : "🌳"}
              </div>
              <div className="report-list-copy">
                <div className="report-list-topline">
                  <strong>{issue.category}</strong>
                  <span className={`mini-status ${statusClass(issue.status)}`}>{formatStatus(issue.status)}</span>
                </div>
                <p>{issue.description}</p>
                <small><LocateFixed size={12} /> Near mapped location</small>
              </div>
              <ChevronRight size={16} />
            </button>
          ))
        ) : (
          <div className="empty-reports">
            <FileText size={34} />
            <h3>No reports in this filter.</h3>
            <p>Submit an incident and it will appear here.</p>
            <button type="button" className="blue-button" onClick={onReport}>Report an Incident</button>
          </div>
        )}
      </div>

      {selectedIssue ? (
        <div className="selected-report-panel">
          <div className="selected-report-heading">
            <div>
              <span className="screen-eyebrow">INCIDENT #{selectedIssue.id}</span>
              <h3>{selectedIssue.category}</h3>
            </div>
            <div className="selected-report-actions">
              {selectedIssue.status === "RESOLVED" ? (
                <button type="button" className="delete-outline-button" onClick={() => onDelete(selectedIssue)}>
                  <Trash2 size={14} /> Delete
                </button>
              ) : null}
              <button type="button" className="icon-refresh" onClick={() => onSelect(null)}><X size={16} /></button>
            </div>
          </div>
          <IssueCard issue={selectedIssue} />
          <AIClosureCard issue={selectedIssue} user={{ id: selectedIssue.user_id }} />
        </div>
      ) : null}
    </div>
  );
}

function EmergencyScreen({ onBack }) {
  return (
    <div className="screen-content emergency-screen">
      <div className="emergency-topbar">
        <button type="button" className="back-button" onClick={onBack}><ChevronLeft size={18} /></button>
        <span>EMERGENCY SERVICES</span>
        <ShieldAlert size={18} />
      </div>

      <div className="emergency-hero">
        <div className="emergency-ring">
          <div className="emergency-phone-icon"><PhoneCall size={30} /></div>
        </div>
        <h1>Need immediate help?</h1>
        <p>Use India's unified emergency response number for police, fire, health and other urgent assistance.</p>
      </div>

      <a className="emergency-call-button" href="tel:112">
        <PhoneCall size={20} />
        Call Emergency
        <span>112</span>
      </a>

      <div className="emergency-info-card">
        <div className="emergency-info-icon"><LocateFixed size={18} /></div>
        <div>
          <strong>Your incident location</strong>
          <span>Keep your location pin enabled so you can explain where help is needed.</span>
        </div>
      </div>

      <div className="emergency-warning">
        <AlertTriangle size={17} />
        <span>For life-threatening situations, contact emergency services directly. Do not wait for an AI classification.</span>
      </div>
    </div>
  );
}
