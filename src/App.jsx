
import { useEffect, useMemo, useState } from 'react';
import {
  checkApiHealth,
  getHospitals,
  getHospitalDetails,
  getNearbyHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
  login,
} from './api';
import './App.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦' },
  { id: 'hospitals', label: 'Hospitals', icon: '✚' },
  { id: 'resources', label: 'Resources', icon: '◈' },
  { id: 'specialists', label: 'Specialists', icon: '♡' },
  { id: 'nearby', label: 'Nearby hospitals', icon: '⌖' },
];

function statusClass(status) {
  const value = String(status || '').toLowerCase();

  if (value.includes('operational') || value === 'available') return 'good';
  if (value.includes('limited') || value.includes('partial')) return 'warning';
  if (value.includes('unavailable') || value.includes('inactive')) return 'bad';

  return 'neutral';
}

function App() {
  const [apiStatus, setApiStatus] = useState('Checking...');
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [page, setPage] = useState('dashboard');

  const [hospitals, setHospitals] = useState([]);
  const [details, setDetails] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospitalEditor, setHospitalEditor] = useState(null);
  const [hospitalForm, setHospitalForm] = useState({
    name: '', address: '', phone: '', email: '', latitude: '', longitude: '', operationalStatus: 'operational',
  });
  const [hospitalSaving, setHospitalSaving] = useState(false);
  const [deletingHospitalId, setDeletingHospitalId] = useState(null);
  const [hospitalMessage, setHospitalMessage] = useState('');
  const [hospitalFormError, setHospitalFormError] = useState('');

  const [latitude, setLatitude] = useState('32.7266');
  const [longitude, setLongitude] = useState('74.8570');
  const [radius, setRadius] = useState('25');

  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [nearbyError, setNearbyError] = useState('');

  useEffect(() => {
    checkApiHealth()
      .then(() => setApiStatus('Connected'))
      .catch(() => setApiStatus('Connection failed'));
  }, []);

  useEffect(() => {
    if (!token) return undefined;

    let active = true;
    setLoading(true);
    setError('');

    getHospitals(token)
      .then((data) => {
        if (active) {
          setHospitals(Array.isArray(data.hospitals) ? data.hospitals : []);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || hospitals.length === 0) {
      setDetails([]);
      return undefined;
    }

    let active = true;
    setDetailsLoading(true);
    setDetailsError('');

    Promise.all(
      hospitals.map(async (hospital) => {
        try {
          const data = await getHospitalDetails(hospital.id, token);
          return {
            hospital,
            resources: Array.isArray(data.resources) ? data.resources : [],
            specialists: Array.isArray(data.specialists) ? data.specialists : [],
          };
        } catch (err) {
          return { hospital, resources: [], specialists: [], error: err.message };
        }
      })
    )
      .then((results) => {
        if (active) {
          setDetails(results);

          const failed = results.filter((item) => item.error).length;
          if (failed > 0) {
            setDetailsError(
              `Details could not be loaded for ${failed} hospital(s). Check their API permissions or server logs.`
            );
          }
        }
      })
      .catch((err) => {
        if (active) setDetailsError(err.message);
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token, hospitals]);

  const resources = useMemo(
    () =>
      details.flatMap((item) =>
        item.resources.map((resource) => ({
          ...resource,
          hospitalName: item.hospital.name,
          hospitalId: item.hospital.id,
        }))
      ),
    [details]
  );

  const specialists = useMemo(
    () =>
      details.flatMap((item) =>
        item.specialists.map((specialist) => ({
          ...specialist,
          hospitalName: item.hospital.name,
          hospitalId: item.hospital.id,
        }))
      ),
    [details]
  );

  const filteredHospitals = hospitals.filter((hospital) =>
    `${hospital.name || ''} ${hospital.address || ''} ${hospital.operational_status || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredResources = resources.filter((resource) =>
    `${resource.name || ''} ${resource.resource_name || ''} ${resource.hospitalName || ''} ${resource.status || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredSpecialists = specialists.filter((specialist) =>
    `${specialist.name || ''} ${specialist.specialty || ''} ${specialist.specialization || ''} ${specialist.hospitalName || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await login(email, password);
      setUser(data.user);
      setToken(data.token);
      setPassword('');
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function searchNearby(event) {
    event.preventDefault();
    setNearbyError('');

    const lat = Number(latitude);
    const lng = Number(longitude);
    const distance = Number(radius);

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      setNearbyError('Enter a valid latitude, longitude, and positive radius.');
      return;
    }

    setNearbyLoading(true);

    try {
      const data = await getNearbyHospitals(token, lat, lng, distance);
      const rows = Array.isArray(data)
        ? data
        : data.hospitals || data.results || data.nearbyHospitals || [];

      setNearby(rows);
      if (!rows.length) {
        setNearbyError(
          'No hospitals were returned. Try a larger radius or check the API response format.'
        );
      }
    } catch (err) {
      setNearby([]);
      setNearbyError(err.message);
    } finally {
      setNearbyLoading(false);
    }
  }

  function logout() {
    setToken('');
    setUser(null);
    setHospitals([]);
    setDetails([]);
    setNearby([]);
    setSelectedHospital(null);
    setSearch('');
    setError('');
    setDetailsError('');
    setNearbyError('');
    setPage('dashboard');
    setPassword('');
  }

  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  function openHospital(hospital) {
    setSelectedHospital(hospital);
  }

  function startCreateHospital() {
    setHospitalMessage('');
    setHospitalFormError('');
    setHospitalForm({ name: '', address: '', phone: '', email: '', latitude: '', longitude: '', operationalStatus: 'operational' });
    setHospitalEditor({ mode: 'create', hospital: null });
    setSelectedHospital(null);
  }

  function startEditHospital(hospital) {
    setHospitalMessage('');
    setHospitalFormError('');
    setHospitalForm({
      name: hospital.name || '',
      address: hospital.address || '',
      phone: hospital.phone || '',
      email: hospital.email || '',
      latitude: hospital.latitude ?? '',
      longitude: hospital.longitude ?? '',
      operationalStatus: hospital.operational_status || 'operational',
    });
    setHospitalEditor({ mode: 'edit', hospital });
    setSelectedHospital(null);
  }

  async function handleHospitalSubmit(event) {
    event.preventDefault();
    setHospitalFormError('');
    setHospitalMessage('');

    if (!isAdmin) {
      setHospitalFormError('Only administrators can create or edit hospital records.');
      return;
    }

    const lat = Number(hospitalForm.latitude);
    const lng = Number(hospitalForm.longitude);
    if (!hospitalForm.name.trim() || !hospitalForm.address.trim()) {
      setHospitalFormError('Hospital name and address are required.');
      return;
    }
    if (hospitalForm.latitude === '' || hospitalForm.longitude === '' || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setHospitalFormError('Enter a valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }
    if (!['operational', 'limited', 'closed'].includes(hospitalForm.operationalStatus)) {
      setHospitalFormError('Choose a valid operational status.');
      return;
    }

    const payload = {
      name: hospitalForm.name.trim(),
      address: hospitalForm.address.trim(),
      phone: hospitalForm.phone.trim() || null,
      email: hospitalForm.email.trim() || null,
      latitude: lat,
      longitude: lng,
      operationalStatus: hospitalForm.operationalStatus,
    };

    setHospitalSaving(true);
    try {
      if (hospitalEditor?.mode === 'edit') {
        await updateHospital(hospitalEditor.hospital.id, token, payload);
        setHospitalMessage('Hospital updated successfully.');
      } else {
        await createHospital(token, payload);
        setHospitalMessage('Hospital created successfully.');
      }
      const refreshed = await getHospitals(token);
      setHospitals(Array.isArray(refreshed.hospitals) ? refreshed.hospitals : []);
      setHospitalEditor(null);
    } catch (err) {
      setHospitalFormError(err.message || 'Could not save the hospital.');
    } finally {
      setHospitalSaving(false);
    }
  }

  async function handleDeleteHospital(hospital) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Delete "${hospital.name}" (ID: ${hospital.id})? This cannot be undone. Its linked resource and specialist records may also be deleted.`
    );
    if (!confirmed) return;

    setDeletingHospitalId(hospital.id);
    setHospitalMessage('');
    setHospitalFormError('');
    try {
      await deleteHospital(hospital.id, token);
      const refreshed = await getHospitals(token);
      setHospitals(Array.isArray(refreshed.hospitals) ? refreshed.hospitals : []);
      setHospitalMessage(`"${hospital.name}" was deleted successfully.`);
      if (selectedHospital?.id === hospital.id) setSelectedHospital(null);
    } catch (err) {
      setHospitalFormError(err.message || 'Could not delete the hospital.');
    } finally {
      setDeletingHospitalId(null);
    }
  }

  function renderHospitalTable(rows) {
    if (!rows.length) {
      return (
        <div className="empty-state">
          <span className="empty-icon">✚</span>
          <strong>No hospitals found</strong>
          <p>Try a different search or check that your database contains records.</p>
        </div>
      );
    }

    return (
      <div className="table-wrap">
        <table className="hospital-directory-table">
          <thead>
            <tr>
              <th>HOSPITAL</th>
              <th>STATUS</th>
              <th>ADDRESS</th>
              <th>PHONE</th>
              <th>DETAILS</th>
              {isAdmin && <th>ACTIONS</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((hospital) => (
              <tr key={hospital.id}>
                <td>
                  <div className="hospital-cell">
                    <div className="hospital-avatar">✚</div>
                    <div>
                      <strong>{hospital.name || 'Unnamed hospital'}</strong>
                      <span>ID: {hospital.id}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-pill ${statusClass(hospital.operational_status)}`}>
                    {hospital.operational_status || 'Unknown'}
                  </span>
                </td>
                <td>{hospital.address || '—'}</td>
                <td>{hospital.phone || '—'}</td>
                <td>
                  <button className="text-button" onClick={() => openHospital(hospital)}>
                    View details →
                  </button>
                </td>
                {isAdmin && (
                  <td>
                    <div className="hospital-row-actions">
                      <button className="secondary-button hospital-edit-button" type="button" onClick={() => startEditHospital(hospital)}>Edit</button>
                      <button className="danger-button hospital-delete-button" type="button" disabled={deletingHospitalId === hospital.id} onClick={() => handleDeleteHospital(hospital)}>
                        {deletingHospitalId === hospital.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderResourcesTable(rows) {
    if (detailsLoading && !details.length) {
      return <div className="empty-state">Loading resources from hospital records…</div>;
    }

    if (!rows.length) {
      return <div className="empty-state">No resource records were returned by the hospital details API.</div>;
    }

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>RESOURCE</th>
              <th>HOSPITAL</th>
              <th>TOTAL</th>
              <th>AVAILABLE</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((resource, index) => (
              <tr key={resource.id ?? `${resource.hospitalId}-${index}`}>
                <td>
                  <strong>{resource.name || resource.resource_name || 'Unnamed resource'}</strong>
                  {resource.notes && <span className="sub-cell">{resource.notes}</span>}
                </td>
                <td>{resource.hospitalName}</td>
                <td>{resource.total_quantity ?? resource.quantity_total ?? '—'}</td>
                <td>{resource.available_quantity ?? resource.quantity_available ?? '—'}</td>
                <td>
                  <span className={`status-pill ${statusClass(resource.status)}`}>
                    {resource.status || 'Not specified'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderSpecialistsTable(rows) {
    if (detailsLoading && !details.length) {
      return <div className="empty-state">Loading specialists from hospital records…</div>;
    }

    if (!rows.length) {
      return <div className="empty-state">No specialist records were returned by the hospital details API.</div>;
    }

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SPECIALIST</th>
              <th>HOSPITAL</th>
              <th>AVAILABILITY</th>
              <th>AVAILABLE COUNT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((specialist, index) => {
              const available = specialist.available;
              return (
                <tr key={specialist.id ?? `${specialist.hospitalId}-${index}`}>
                  <td>
                    <div className="hospital-cell">
                      <div className="specialist-avatar">♡</div>
                      <div>
                        <strong>{specialist.name || specialist.specialty || specialist.specialization || 'Specialist'}</strong>
                        <span>{specialist.specialty || specialist.specialization || 'Medical specialist'}</span>
                      </div>
                    </div>
                  </td>
                  <td>{specialist.hospitalName}</td>
                  <td>
                    <span className={`status-pill ${available === true ? 'good' : available === false ? 'bad' : 'neutral'}`}>
                      {available === true ? 'Available' : available === false ? 'Unavailable' : 'Unknown'}
                    </span>
                  </td>
                  <td>{specialist.count_available ?? specialist.available_count ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderNearbyTable() {
    if (!nearby.length) return null;

    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>HOSPITAL</th>
              <th>ADDRESS</th>
              <th>STATUS</th>
              <th>DISTANCE</th>
            </tr>
          </thead>
          <tbody>
            {nearby.map((hospital, index) => (
              <tr key={hospital.id ?? index}>
                <td><strong>{hospital.name || hospital.hospital_name || 'Hospital'}</strong></td>
                <td>{hospital.address || '—'}</td>
                <td>
                  <span className={`status-pill ${statusClass(hospital.operational_status || hospital.status)}`}>
                    {hospital.operational_status || hospital.status || 'Unknown'}
                  </span>
                </td>
                <td>
                  {hospital.distance_km != null
                    ? `${Number(hospital.distance_km).toFixed(2)} km`
                    : hospital.distance != null
                      ? `${hospital.distance} km`
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function pageHeading() {
    const headings = {
      dashboard: ['Overview', 'MedLink Dashboard', 'A live overview of your hospital coordination network.'],
      hospitals: ['NETWORK DIRECTORY', 'Hospitals', 'Browse and inspect hospital records from your backend.'],
      resources: ['RESOURCE MONITORING', 'Medical Resources', 'Review recorded supplies and reported availability.'],
      specialists: ['CARE NETWORK', 'Specialists', 'Review specialist records across registered hospitals.'],
      nearby: ['LOCATION SEARCH', 'Nearby Hospitals', 'Search for hospitals around coordinates you provide.'],
    };

    return headings[page] || headings.dashboard;
  }

  const heading = pageHeading();

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-brand">
          <div className="brand-icon">✚</div>
          <div><h2>MedLink</h2><span>Healthcare coordination</span></div>
        </div>

        <section className="login-panel">
          <div className="login-heading">
            <p className="eyebrow">HEALTHCARE NETWORK</p>
            <h1>Welcome back</h1>
            <p>Sign in to access your hospital coordination dashboard.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your registered email"
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
            {error && <p className="error-message">{error}</p>}
            <button className="login-button" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in to MedLink'}
            </button>
          </form>
          <p className="login-api-status">API status: {apiStatus}</p>
        </section>
        <p className="login-footer">MedLink · Emergency and Hospital Coordination System</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✚</div>
          <div><h2>MedLink</h2><span>Healthcare coordination</span></div>
        </div>

        <p className="menu-heading">WORKSPACE</p>
        <nav className="navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => {
                setPage(item.id);
                setSearch('');
                setSelectedHospital(null);
                setError('');
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span className={`connection-dot ${apiStatus === 'Connected' ? 'connected' : 'failed'}`} />
          <div><strong>MedLink API</strong><span>{apiStatus}</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><span className="breadcrumb">Workspace / </span><span className="breadcrumb-current">{heading[1]}</span></div>
          <div className="profile">
            <div className="profile-avatar">{(user?.name || user?.email || 'U')[0].toUpperCase()}</div>
            <div className="profile-text"><strong>{user?.name || user?.email}</strong><span>{user?.role || 'User'}</span></div>
            <button className="secondary-button" onClick={logout}>Log out</button>
          </div>
        </header>

        <section className="page-content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">{heading[0]}</p>
              <h1>{heading[1]}</h1>
              <p className="subtitle">{heading[2]}</p>
            </div>
            <div className="date-chip">
              <span className={`connection-dot ${apiStatus === 'Connected' ? 'connected' : 'failed'}`} />
              {apiStatus}
            </div>
          </div>

          {error && <p className="error-message page-error">{error}</p>}
          {detailsError && (page === 'resources' || page === 'specialists') && (
            <p className="info-message">{detailsError}</p>
          )}

          {page === 'dashboard' && (
            <>
              <div className="stats-grid">
                <article className="stat-card">
                  <div className="stat-top"><span>Registered hospitals</span><span className="stat-icon blue">✚</span></div>
                  <h2>{hospitals.length}</h2><p>Records returned by the API</p>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Operational hospitals</span><span className="stat-icon green">✓</span></div>
                  <h2>{hospitals.filter((h) => String(h.operational_status).toLowerCase() === 'operational').length}</h2>
                  <p>Marked operational in the database</p>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Resource records</span><span className="stat-icon purple">◈</span></div>
                  <h2>{resources.length}</h2><p>Across loaded hospital details</p>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span>Specialist records</span><span className="stat-icon orange">♡</span></div>
                  <h2>{specialists.length}</h2><p>Across loaded hospital details</p>
                </article>
              </div>

              <section className="panel">
                <div className="panel-header">
                  <div><h2>Hospital directory</h2><p>Latest hospital records from your API.</p></div>
                  <button className="text-button" onClick={() => setPage('hospitals')}>View all hospitals →</button>
                </div>
                {loading ? <div className="empty-state">Loading hospitals…</div> : renderHospitalTable(hospitals.slice(0, 5))}
              </section>
            </>
          )}

          {page === 'hospitals' && (
            <section className="panel">
              <div className="panel-header">
                <div><h2>Hospital directory</h2><p>Search hospital names, addresses, and status.</p></div>
                <div className="hospital-header-actions">
                  <span className="record-count">{filteredHospitals.length} records</span>
                  {isAdmin && (
                    <button className="login-button hospital-add-button" type="button" onClick={startCreateHospital}>
                      + Add Hospital
                    </button>
                  )}
                </div>
              </div>
              {hospitalMessage && <p className="success-message">{hospitalMessage}</p>}
              {hospitalFormError && <p className="error-message">{hospitalFormError}</p>}
              <div className="toolbar">
                <div className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search hospitals…" /></div>
                <button className="secondary-button" onClick={() => setSearch('')}>Clear search</button>
              </div>
              {loading ? <div className="empty-state">Loading hospitals…</div> : renderHospitalTable(filteredHospitals)}
            </section>
          )}

          {page === 'resources' && (
            <section className="panel">
              <div className="panel-header">
                <div><h2>Medical resources</h2><p>Quantities and statuses recorded by each hospital.</p></div>
                <span className="record-count">{filteredResources.length} records</span>
              </div>
              <div className="toolbar">
                <div className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search resources or hospitals…" /></div>
                <button className="secondary-button" onClick={() => setSearch('')}>Clear search</button>
              </div>
              {renderResourcesTable(filteredResources)}
              <p className="demo-note">Resource quantities reflect backend records and may be demo data. Confirm availability with the hospital before making clinical or emergency decisions.</p>
            </section>
          )}

          {page === 'specialists' && (
            <section className="panel">
              <div className="panel-header">
                <div><h2>Specialist directory</h2><p>Specialists returned in hospital details.</p></div>
                <span className="record-count">{filteredSpecialists.length} records</span>
              </div>
              <div className="toolbar">
                <div className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search specialists or hospitals…" /></div>
                <button className="secondary-button" onClick={() => setSearch('')}>Clear search</button>
              </div>
              {renderSpecialistsTable(filteredSpecialists)}
              <p className="demo-note">Specialist status is shown as returned by the backend and is not a guarantee of current clinical availability.</p>
            </section>
          )}

          {page === 'nearby' && (
            <section className="panel">
              <div className="panel-header">
                <div><h2>Find nearby hospitals</h2><p>Enter a location and search radius for the API query.</p></div>
              </div>
              <form className="nearby-form" onSubmit={searchNearby}>
                <div className="field-group">
                  <label htmlFor="latitude">Latitude</label>
                  <input id="latitude" type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} required />
                </div>
                <div className="field-group">
                  <label htmlFor="longitude">Longitude</label>
                  <input id="longitude" type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} required />
                </div>
                <div className="field-group">
                  <label htmlFor="radius">Radius (km)</label>
                  <input id="radius" type="number" min="0.1" step="any" value={radius} onChange={(event) => setRadius(event.target.value)} required />
                </div>
                <button className="login-button nearby-button" type="submit" disabled={nearbyLoading}>
                  {nearbyLoading ? 'Searching…' : 'Search nearby'}
                </button>
              </form>
              <p className="demo-note">The default coordinates are a sample location in Jammu. They do not use your device's GPS location.</p>
              {nearbyError && <p className="info-message">{nearbyError}</p>}
              {renderNearbyTable()}
            </section>
          )}

          {hospitalEditor && (
            <div className="modal-backdrop" onClick={() => !hospitalSaving && setHospitalEditor(null)}>
              <section className="details-modal hospital-editor-modal" onClick={(event) => event.stopPropagation()}>
                <div className="panel-header">
                  <div><p className="eyebrow">HOSPITAL MANAGEMENT</p><h2>{hospitalEditor.mode === 'edit' ? 'Edit hospital' : 'Add hospital'}</h2></div>
                  <button className="secondary-button" type="button" disabled={hospitalSaving} onClick={() => setHospitalEditor(null)}>Cancel</button>
                </div>
                <form className="hospital-editor-form" onSubmit={handleHospitalSubmit}>
                  <div className="hospital-form-grid">
                    <div className="field-group hospital-field-wide"><label htmlFor="hospital-name">Hospital name *</label><input id="hospital-name" value={hospitalForm.name} onChange={(event) => setHospitalForm({ ...hospitalForm, name: event.target.value })} required /></div>
                    <div className="field-group hospital-field-wide"><label htmlFor="hospital-address">Address *</label><input id="hospital-address" value={hospitalForm.address} onChange={(event) => setHospitalForm({ ...hospitalForm, address: event.target.value })} required /></div>
                    <div className="field-group"><label htmlFor="hospital-phone">Phone</label><input id="hospital-phone" type="tel" value={hospitalForm.phone} onChange={(event) => setHospitalForm({ ...hospitalForm, phone: event.target.value })} /></div>
                    <div className="field-group"><label htmlFor="hospital-email">Email</label><input id="hospital-email" type="email" value={hospitalForm.email} onChange={(event) => setHospitalForm({ ...hospitalForm, email: event.target.value })} /></div>
                    <div className="field-group"><label htmlFor="hospital-latitude">Latitude *</label><input id="hospital-latitude" type="number" min="-90" max="90" step="any" value={hospitalForm.latitude} onChange={(event) => setHospitalForm({ ...hospitalForm, latitude: event.target.value })} required /></div>
                    <div className="field-group"><label htmlFor="hospital-longitude">Longitude *</label><input id="hospital-longitude" type="number" min="-180" max="180" step="any" value={hospitalForm.longitude} onChange={(event) => setHospitalForm({ ...hospitalForm, longitude: event.target.value })} required /></div>
                    <div className="field-group hospital-field-wide"><label htmlFor="hospital-status">Operational status *</label><select id="hospital-status" value={hospitalForm.operationalStatus} onChange={(event) => setHospitalForm({ ...hospitalForm, operationalStatus: event.target.value })} required><option value="operational">Operational</option><option value="limited">Limited</option><option value="closed">Closed</option></select></div>
                  </div>
                  {hospitalFormError && <p className="error-message">{hospitalFormError}</p>}
                  <div className="hospital-form-actions"><button className="secondary-button" type="button" disabled={hospitalSaving} onClick={() => setHospitalEditor(null)}>Cancel</button><button className="login-button" type="submit" disabled={hospitalSaving}>{hospitalSaving ? 'Saving…' : 'Save hospital'}</button></div>
                </form>
              </section>
            </div>
          )}


          {selectedHospital && (
            <div className="modal-backdrop" onClick={() => setSelectedHospital(null)}>
              <section className="details-modal" onClick={(event) => event.stopPropagation()}>
                <div className="panel-header">
                  <div><p className="eyebrow">HOSPITAL RECORD</p><h2>{selectedHospital.name}</h2></div>
                  <button className="secondary-button" onClick={() => setSelectedHospital(null)}>Close</button>
                </div>
                <div className="detail-grid">
                  <div><span>Hospital ID</span><strong>{selectedHospital.id}</strong></div>
                  <div><span>Operational status</span><strong>{selectedHospital.operational_status || 'Unknown'}</strong></div>
                  <div><span>Address</span><strong>{selectedHospital.address || '—'}</strong></div>
                  <div><span>Phone</span><strong>{selectedHospital.phone || '—'}</strong></div>
                  <div><span>Email</span><strong>{selectedHospital.email || '—'}</strong></div>
                  <div><span>Coordinates</span><strong>{selectedHospital.latitude ?? '—'}, {selectedHospital.longitude ?? '—'}</strong></div>
                </div>
              </section>
            </div>
          )}

          <footer>MedLink · Emergency and Hospital Coordination System<span>Local development build</span></footer>
        </section>
      </main>
    </div>
  );
}

export default App;
