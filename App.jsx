/**
 * Heritage Route Guide
 * ---------------------------------------------------------------
 * Requirements: React 18, Tailwind CSS 3, lucide-react, leaflet, react-leaflet
 * Optional env: VITE_API_URL (defaults to http://localhost:5000)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, MapPin, User, Camera, BookOpen, ChevronRight, Plus, X, ArrowLeft } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix default Leaflet marker icon issue in React bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/* ============================================================
   1. Config & sample data
   ============================================================ */
const API_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:5000';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=600&q=80';

const VIEWS = [
  { id: 'routes', label: 'Routes' },
  { id: 'map', label: 'Map' },
  { id: 'ar', label: '3D viewer' },
  { id: 'admin', label: 'Admin' },
];

const INITIAL_ROUTES = [
  {
    id: 1,
    title: 'Ancient Temple Trail',
    city: 'Kyoto, Heritage Zone',
    duration: '4 hours',
    center: [35.0116, 135.7681],
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80',
    stops: [
      { id: 101, name: 'The Grand Gateway', era: '12th century', description: 'Main ceremonial entrance adorned with intricate stone carvings.', coords: [35.0116, 135.7681] },
      { id: 102, name: 'Royal Sanctuary and Altar', era: '14th century', description: 'Sacred inner chamber used for royal coronations and rituals.', coords: [35.0180, 135.7720] },
      { id: 103, name: 'Historic Watchtower', era: '15th century', description: 'Strategic vantage point overlooking the ancient valley route.', coords: [35.0050, 135.7600] },
    ],
  },
  {
    id: 2,
    title: 'Royal Fort and Palace Circuit',
    city: 'Rajasthan',
    duration: '1 day',
    center: [26.9124, 75.7873],
    image: 'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=600&q=80',
    stops: [
      { id: 201, name: 'Outer Ramparts', era: '16th century', description: 'Imposing stone defensive walls with cannon bastions.', coords: [26.9124, 75.7873] },
      { id: 202, name: 'Courtyard of Mirrors', era: '17th century', description: 'Ornate hall decorated with thousands of reflective glass tiles.', coords: [26.9200, 75.7950] },
    ],
  },
  {
    id: 3,
    title: 'Medieval Architecture Walk',
    city: 'European Old Town',
    duration: '3 hours',
    center: [50.0755, 14.4378],
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80',
    stops: [
      { id: 301, name: 'Gothic Cathedral Spire', era: '13th century', description: 'Soaring spire visible from every corner of the old town.', coords: [50.0755, 14.4378] },
      { id: 302, name: 'Guildhall Plaza', era: '15th century', description: 'Historical marketplace and municipal gathering hub.', coords: [50.0800, 14.4250] },
    ],
  },
];

/* ============================================================
   2. Shared style tokens
   ============================================================ */
const ui = {
  page: 'min-h-screen flex flex-col bg-[#F3F2EE] text-[#1B2326] font-[Public_Sans,system-ui,sans-serif]',
  heading: 'font-[Source_Serif_4,Georgia,serif] tracking-tight',
  card: 'bg-white border border-[#DAD8D0] rounded-lg shadow-sm',
  muted: 'text-[#5B676B]',
  btnPrimary:
    'inline-flex items-center justify-center gap-2 rounded-md bg-[#2F6F68] px-4 py-2.5 text-sm font-semibold text-white ' +
    'transition-colors hover:bg-[#24564F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6F68]',
  btnSecondary:
    'inline-flex items-center justify-center gap-2 rounded-md border border-[#DAD8D0] bg-white px-4 py-2.5 text-sm font-medium ' +
    'transition-colors hover:bg-[#ECEAE3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6F68]',
  input:
    'w-full rounded-md border border-[#C9C6BB] bg-white px-3 py-2.5 text-sm placeholder:text-[#8A9498] ' +
    'focus:border-[#2F6F68] focus:outline-none focus:ring-2 focus:ring-[#2F6F68]/25',
  era: 'inline-block rounded bg-[#F1E6D2] px-2 py-0.5 text-xs font-medium text-[#7A5418]',
};

/* ============================================================
   3. Hooks
   ============================================================ */
function useBackendStatus() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/`, { signal: controller.signal })
      .then((res) => setStatus(res.ok ? 'online' : 'offline'))
      .catch((err) => {
        if (err.name !== 'AbortError') setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  return status;
}

function useEscape(handler, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => e.key === 'Escape' && handler();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handler, active]);
}

/* ============================================================
   4. Small UI pieces
   ============================================================ */
const STATUS_COPY = {
  checking: { label: 'Connecting to server', dot: 'bg-amber-400' },
  online: { label: 'Server connected', dot: 'bg-emerald-400' },
  offline: { label: 'Server offline, using sample data', dot: 'bg-rose-400' },
};

function StatusBadge({ status }) {
  const { label, dot } = STATUS_COPY[status];
  return (
    <span role="status" className="hidden sm:inline-flex items-center gap-2 text-xs text-white/80">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function PageTitle({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className={`${ui.heading} text-3xl font-semibold`}>{title}</h2>
      {children && <p className={`${ui.muted} mt-2 max-w-2xl leading-relaxed`}>{children}</p>}
    </div>
  );
}

function Field({ id, label, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={id} className={ui.input} {...inputProps} />
    </div>
  );
}

/* ============================================================
   5. Views
   ============================================================ */
function RouteSelectionView({ routes, onSelectRoute }) {
  return (
    <section aria-labelledby="routes-title">
      <PageTitle title="Choose a heritage route">
        Each route has guided stops, historical notes and a 3D preview of its monuments.
      </PageTitle>

      <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {routes.map((route) => (
          <li key={route.id} className={`${ui.card} flex flex-col overflow-hidden`}>
            <div className="relative h-44 bg-[#E4E2DA]">
              <img
                src={route.image}
                alt=""
                loading="lazy"
                onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }}
                className="h-full w-full object-cover"
              />
              <span className="absolute right-3 top-3 rounded bg-white/95 px-2.5 py-1 text-xs font-medium shadow">
                {route.duration}
              </span>
            </div>
            <div className="flex flex-1 flex-col justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-medium text-[#2F6F68]">{route.city}</p>
                <h3 className={`${ui.heading} mt-1 text-xl font-semibold`}>{route.title}</h3>
                <p className={`${ui.muted} mt-2 flex items-center gap-1.5 text-sm`}>
                  <MapPin size={14} aria-hidden="true" />
                  {route.stops.length} {route.stops.length === 1 ? 'stop' : 'stops'}
                </p>
              </div>
              <button type="button" onClick={() => onSelectRoute(route)} className={ui.btnPrimary}>
                Explore this route
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InteractiveMapView({ route, onSelectLandmark, onOpenAR }) {
  const center = route.center || [35.0116, 135.7681];

  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label={`Map of ${route.title}`}>
      <div className={`${ui.card} flex flex-col overflow-hidden lg:col-span-2`}>
        <div className="border-b border-[#DAD8D0] px-5 py-4">
          <h2 className={`${ui.heading} text-xl font-semibold`}>{route.title}</h2>
          <p className={`${ui.muted} text-sm`}>{route.city}</p>
        </div>

        {/* Real Leaflet Map Container */}
        <div className="relative min-h-[420px] flex-1 z-0">
          <MapContainer center={center} zoom={13} scrollWheelZoom={false} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {route.stops.map((stop, i) => (
              <Marker key={stop.id} position={stop.coords || center}>
                <Popup>
                  <div className="p-1">
                    <span className={ui.era}>{stop.era}</span>
                    <h4 className="font-bold text-sm mt-1">{i + 1}. {stop.name}</h4>
                    <p className="text-xs text-gray-600 mt-1 mb-2">{stop.description}</p>
                    <button
                      type="button"
                      onClick={() => onSelectLandmark(stop)}
                      className="text-xs font-semibold text-[#2F6F68] underline"
                    >
                      View landmark details
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DAD8D0] px-5 py-3 bg-white">
          <p className={`${ui.muted} text-sm`}>Click map pins to explore stops.</p>
          <button type="button" onClick={onOpenAR} className={ui.btnSecondary}>
            <Camera size={16} aria-hidden="true" /> Open 3D viewer
          </button>
        </div>
      </div>

      <aside className={`${ui.card} p-5`}>
        <h3 className={`${ui.heading} mb-4 text-lg font-semibold`}>Stops on this route</h3>
        <ol className="space-y-3">
          {route.stops.map((stop, i) => (
            <li key={stop.id}>
              <button
                type="button"
                onClick={() => onSelectLandmark(stop)}
                className="w-full rounded-md border border-[#DAD8D0] p-3 text-left transition-colors hover:border-[#2F6F68] hover:bg-[#F7F6F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2F6F68]"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold">{i + 1}. {stop.name}</span>
                  <span className={ui.era}>{stop.era}</span>
                </span>
                <span className={`${ui.muted} mt-1 line-clamp-2 block text-xs`}>{stop.description}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </section>
  );
}

function LandmarkDetailView({ landmark, onBack, onOpenAR }) {
  return (
    <article className={`${ui.card} mx-auto max-w-4xl p-6 md:p-8`}>
      <button type="button" onClick={onBack} className={`${ui.btnSecondary} mb-6`}>
        <ArrowLeft size={16} aria-hidden="true" /> Back to map
      </button>

      <span className={ui.era}>{landmark.era}</span>
      <h2 className={`${ui.heading} mt-2 text-3xl font-semibold`}>{landmark.name}</h2>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <p className="max-w-prose leading-relaxed">{landmark.description}</p>
          <div className="rounded-md bg-[#F3F2EE] p-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <BookOpen size={16} aria-hidden="true" /> Historical significance
            </h3>
            <p className={`${ui.muted} text-sm leading-relaxed`}>
              {landmark.significance ?? 'This landmark served as a defensive and ceremonial hub along the ancient corridor.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#C9C6BB] p-6 text-center">
          <Camera size={32} className="mb-3 text-[#2F6F68]" aria-hidden="true" />
          <h3 className="font-semibold">See it in 3D</h3>
          <p className={`${ui.muted} mb-5 mt-1 text-sm`}>Rotate a model of the monument.</p>
          <button type="button" onClick={onOpenAR} className={`${ui.btnPrimary} w-full`}>Open 3D viewer</button>
        </div>
      </div>
    </article>
  );
}

const CUBE_VERTS = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z])));
const CUBE_EDGES = CUBE_VERTS.flatMap((a, i) =>
  CUBE_VERTS.map((b, j) => [i, j]).filter(([i2, j]) => j > i2 && a.filter((v, k) => v !== CUBE_VERTS[j][k]).length === 1)
);

function ARViewerView() {
  const canvasRef = useRef(null);
  const rotation = useRef({ x: 0.5, y: 0.6 });
  const drag = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame;

    const project = ([x, y, z]) => {
      const { x: rx, y: ry } = rotation.current;
      const x1 = x * Math.cos(ry) - z * Math.sin(ry);
      const z1 = x * Math.sin(ry) + z * Math.cos(ry);
      const y1 = y * Math.cos(rx) - z1 * Math.sin(rx);
      const z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      const scale = 110 / (3.5 - z2 * 0.5);
      return [canvas.width / 2 + x1 * scale, canvas.height / 2 + y1 * scale];
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#2F6F68';
      ctx.lineWidth = 2;
      ctx.beginPath();
      CUBE_EDGES.forEach(([a, b]) => {
        const [x1, y1] = project(CUBE_VERTS[a]);
        const [x2, y2] = project(CUBE_VERTS[b]);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      });
      ctx.stroke();
      if (!reduceMotion && !drag.current) rotation.current.y += 0.01;
      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    rotation.current.y += (e.clientX - drag.current.x) * 0.01;
    rotation.current.x += (e.clientY - drag.current.y) * 0.01;
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <section className={`${ui.card} mx-auto max-w-4xl p-6`}>
      <h2 className={`${ui.heading} text-2xl font-semibold`}>3D viewer</h2>
      <p className={`${ui.muted} mb-4 text-sm`}>Preview mode. Drag to rotate the placeholder model.</p>
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        role="img"
        aria-label="Rotating 3D placeholder model"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="h-80 w-full cursor-grab touch-none rounded-md bg-[#F3F2EE] active:cursor-grabbing"
      />
    </section>
  );
}

const EMPTY_FORM = { title: '', city: '', duration: '', stops: '4' };

function AddRouteDialog({ onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const firstField = useRef(null);
  useEscape(onClose, true);
  useEffect(() => firstField.current?.focus(), []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.city.trim()) return;
    const stopCount = Math.min(Math.max(parseInt(form.stops, 10) || 2, 1), 12);
    const base = Date.now();
    const defaultCoords = [35.0116, 135.7681];
    onSave({
      id: base,
      title: form.title.trim(),
      city: form.city.trim(),
      duration: form.duration.trim() || '2 hours',
      image: FALLBACK_IMAGE,
      center: defaultCoords,
      stops: Array.from({ length: stopCount }, (_, i) => ({
        id: base + i + 1,
        name: `Stop ${i + 1}`,
        era: 'Period to be added',
        description: 'Add a description for this stop.',
        coords: [defaultCoords[0] + (i * 0.005), defaultCoords[1] + (i * 0.005)],
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B2326]/60 p-4 overflow-y-auto" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-route-title"
        onMouseDown={(e) => e.stopPropagation()}
        className={`${ui.card} w-full max-w-md p-6 shadow-xl max-h-[90vh] flex flex-col`}
      >
        <div className="mb-4 flex items-center justify-between shrink-0">
          <h3 id="add-route-title" className={`${ui.heading} text-xl font-semibold`}>Add a route</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-[#ECEAE3]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          <div>
            <label htmlFor="route-title" className="mb-1 block text-sm font-medium">Route title</label>
            <input ref={firstField} id="route-title" required value={form.title} onChange={update('title')} placeholder="Ancient Citadel Walk" className={ui.input} />
          </div>
          <Field id="route-city" label="City or region" required value={form.city} onChange={update('city')} placeholder="Rome, Old Quarter" />
          <div className="grid grid-cols-2 gap-4">
            <Field id="route-duration" label="Duration" value={form.duration} onChange={update('duration')} placeholder="2 hours" />
            <Field id="route-stops" label="Number of stops" type="number" min="1" max="12" value={form.stops} onChange={update('stops')} />
          </div>
          <div className="flex gap-3 pt-4 border-t border-[#DAD8D0] mt-4">
            <button type="button" onClick={onClose} className={`${ui.btnSecondary} flex-1`}>Cancel</button>
            <button type="submit" className={`${ui.btnPrimary} flex-1`}>Save route</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminPanelView({ routes, onAddRoute }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const closeDialog = useCallback(() => setDialogOpen(false), []);

  const stats = [
    { label: 'Active visitors', value: '1,482', note: 'Sample data' },
    { label: '3D viewer sessions', value: '3,890', note: 'Sample data' },
    { label: 'Published routes', value: routes.length, note: 'Live count' },
  ];

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle title="Content dashboard">Manage routes, stops and media.</PageTitle>
        <button type="button" onClick={() => setDialogOpen(true)} className={ui.btnPrimary}>
          <Plus size={16} aria-hidden="true" /> Add route
        </button>
      </div>

      <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`${ui.card} p-5`}>
            <dt className={`${ui.muted} text-sm`}>{s.label}</dt>
            <dd className={`${ui.heading} mt-1 text-3xl font-semibold`}>{s.value}</dd>
            <dd className={`${ui.muted} mt-1 text-xs`}>{s.note}</dd>
          </div>
        ))}
      </dl>

      {dialogOpen && (
        <AddRouteDialog
          onClose={closeDialog}
          onSave={(route) => { onAddRoute(route); closeDialog(); }}
        />
      )}
    </section>
  );
}

function LoginView({ onLogin }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) onLogin(name.trim());
  };

  return (
    <section className={`${ui.card} mx-auto mt-10 max-w-md p-8`}>
      <h2 className={`${ui.heading} text-2xl font-semibold`}>Sign in</h2>
      <p className={`${ui.muted} mb-6 mt-1 text-sm`}>Save routes and keep your visit history.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="visitor-name" label="Your name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
        <button type="submit" className={`${ui.btnPrimary} w-full`}>Sign in</button>
      </form>
    </section>
  );
}

/* ============================================================
   6. App shell
   ============================================================ */
export default function App() {
  const [view, setView] = useState('routes');
  const [routes, setRoutes] = useState(INITIAL_ROUTES);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [user, setUser] = useState({ name: 'Explorer Alex', role: 'visitor' });
  const backendStatus = useBackendStatus();

  const activeRoute = useMemo(() => selectedRoute ?? routes[0], [selectedRoute, routes]);

  const openRoute = (route) => { setSelectedRoute(route); setView('map'); };
  const openLandmark = (landmark) => { setSelectedLandmark(landmark); setView('landmark'); };
  const addRoute = (route) => setRoutes((prev) => [route, ...prev]);
  const login = (name) => { setUser({ name, role: 'visitor' }); setView('routes'); };

  const activeNav = view === 'landmark' ? 'map' : view;

  return (
    <div className={ui.page}>
      <header className="bg-[#1B2326] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <button type="button" onClick={() => setView('routes')} className="flex items-center gap-3 text-left">
            <span className="rounded-md bg-[#2F6F68] p-2"><Compass size={22} aria-hidden="true" /></span>
            <span>
              <span className={`${ui.heading} block text-lg font-semibold leading-tight`}>Heritage Route Guide</span>
              <span className="block text-xs text-white/70">Explore historic sites in 3D</span>
            </span>
          </button>

          <div className="flex items-center gap-4">
            <StatusBadge status={backendStatus} />
            <button
              type="button"
              onClick={() => setView('login')}
              className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm transition-colors hover:bg-white/20"
            >
              <User size={16} aria-hidden="true" />
              <span className="max-w-[10rem] truncate">{user.name}</span>
            </button>
          </div>
        </div>

        <nav aria-label="Main" className="border-t border-white/10">
          <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
            {VIEWS.map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setView(id)}
                  aria-current={activeNav === id ? 'page' : undefined}
                  className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                    activeNav === id ? 'border-[#6FB5AC] text-white' : 'border-transparent text-white/70 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-6">
        {view === 'routes' && <RouteSelectionView routes={routes} onSelectRoute={openRoute} />}
        {view === 'map' && <InteractiveMapView route={activeRoute} onSelectLandmark={openLandmark} onOpenAR={() => setView('ar')} />}
        {view === 'landmark' && selectedLandmark && (
          <LandmarkDetailView landmark={selectedLandmark} onBack={() => setView('map')} onOpenAR={() => setView('ar')} />
        )}
        {view === 'ar' && <ARViewerView />}
        {view === 'admin' && <AdminPanelView routes={routes} onAddRoute={addRoute} />}
        {view === 'login' && <LoginView onLogin={login} />}
      </main>

      <footer className="border-t border-[#DAD8D0] py-4 text-center text-xs text-[#5B676B]">
        Heritage Route Guide, built with React, Node.js and Express
      </footer>
    </div>
  );
}
