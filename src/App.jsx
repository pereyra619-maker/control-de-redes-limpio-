import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const STORAGE_KEYS = {
  content: "cm_easy_onefile_content_v1",
  tasks: "cm_easy_onefile_tasks_v1",
  workspaces: "cm_easy_onefile_workspaces_v1",
  settings: "cm_easy_onefile_settings_v1",
  activity: "cm_easy_onefile_activity_v1",
};

const CLOUD_TABLE = "cm_shared_boards";

// COMPLETAR SOLO UNA VEZ SI QUERÉS TABLERO COMPARTIDO REAL.
// Si los dejás vacíos, la app funciona perfecto en modo local.
const FIXED_CLOUD_CONFIG = {
  url: "https://ervixuormkqzhontneam.supabase.co",
  anonKey: "sb_publishable_NYTR4gjsuqLOie8tfZtM-w_0bjMarUa",
  boardCode: "ANDREA-MARISOL-CM-NUBE",
  boardTitle: "Tablero compartido Andrea y Marisol",
};

const defaultWorkspaces = ["Master Class"];

const defaultContent = [
  {
    id: 1,
    mesa: "Master Class",
    nombre: "Reel lanzamiento evento",
    fecha: "2026-03-02",
    hora: "10:00",
    red: "Instagram",
    tipo: "Reel",
    objetivo: "Alcance",
    campana: "Escenarios que Venden",
    estado: "Programado",
    link: "https://",
    alcance: 0,
    impresiones: 0,
    likes: 0,
    comentarios: 0,
    compartidos: 0,
    guardados: 0,
    respuestas: 0,
    clicks: 0,
  },
];

const defaultTasks = [
  { id: 1, tarea: "Diseñar piezas de la semana", prioridad: "Alta", mesa: "Master Class", estado: "En curso" },
];

const defaultActivity = [
  {
    id: 1,
    user: "Sistema",
    action: "Base creada",
    detail: "Se cargó la demo inicial",
    timestamp: new Date().toISOString(),
  },
];

function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createLogEntry(user, action, detail) {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    user,
    action,
    detail,
    timestamp: new Date().toISOString(),
  };
}

function calcInteractions(item) {
  return item.likes + item.comentarios + item.compartidos + item.guardados + item.respuestas + item.clicks;
}

function calcER(item) {
  if (!item.alcance) return 0;
  return (calcInteractions(item) / item.alcance) * 100;
}

function getMetricStatus(item) {
  const er = calcER(item);
  if (!item.alcance) return { label: "Sin datos", tone: "soft" };
  if (er >= 8) return { label: "Buena", tone: "good" };
  if (er >= 4) return { label: "Regular", tone: "warn" };
  return { label: "Mala", tone: "bad" };
}

function getFormatFocusLabel(format) {
  if (format === "Historia") return "Clics + respuestas";
  if (format === "Reel") return "Guardados + compartidos";
  if (format === "Carrusel") return "Guardados";
  if (format === "Anuncio") return "Clics";
  return "Interacción general";
}

function getMetricExplanation(item) {
  const status = getMetricStatus(item).label;
  const interactions = calcInteractions(item);
  const er = calcER(item);
  const saves = item.guardados + item.compartidos;
  const conversation = item.comentarios + item.respuestas;

  if (!item.alcance) {
    return "Todavía no hay datos cargados. Apenas completes alcance e interacciones, la app te va a explicar si el rendimiento acompaña bien al formato.";
  }

  if (item.tipo === "Historia") {
    if (status === "Buena") return `Es buena porque en una historia pesan mucho la respuesta rápida y el clic. Acá tenés ${conversation} señales de conversación y ${item.clicks} clics, con un ER de ${er.toFixed(2)}%.`;
    if (status === "Regular") return `Es regular porque la historia tuvo algo de movimiento, pero para este formato conviene empujar más respuesta directa o clic. Hoy suma ${conversation} interacciones conversacionales.`;
    return `Es baja para una historia porque este formato necesita reacción inmediata. Con ${item.clicks} clics y ${conversation} respuestas/comentarios, quedó corta frente al alcance logrado.`;
  }

  if (item.tipo === "Reel") {
    if (status === "Buena") return `Es buena porque el reel no solo llegó, también generó acción. Entre guardados y compartidos suma ${saves}, que es una señal fuerte para contenido de descubrimiento.`;
    if (status === "Regular") return `Es regular porque el reel tuvo visibilidad, pero le falta más guardado o compartido para volverse fuerte. Hoy acumula ${saves} señales de valor.`;
    return `Es baja para un reel porque este formato suele rendir mejor cuando dispara alcance con guardados o compartidos. Acá esas señales quedaron en ${saves}.`;
  }

  if (item.tipo === "Carrusel") {
    if (status === "Buena") return `Es buena porque un carrusel suele medirse muy bien por guardados y compartidos. Acá consiguió ${saves}, lo que indica valor útil o digno de revisar después.`;
    if (status === "Regular") return `Es regular porque el carrusel tuvo lectura, pero para destacarse más debería empujar guardados o compartidos. Por ahora junta ${saves}.`;
    return `Es baja para un carrusel porque este formato necesita ser guardable o compartible. Con ${saves} señales de valor, todavía no terminó de sostener el rendimiento.`;
  }

  if (item.tipo === "Anuncio") {
    if (status === "Buena") return `Es buena porque en un anuncio pesan mucho los clics y la acción concreta. Acá logró ${item.clicks} clics, lo que acompaña bien el objetivo.`;
    if (status === "Regular") return `Es regular porque el anuncio tiene movimiento, pero todavía le falta un poco más de clic efectivo. Hoy registró ${item.clicks} clics.`;
    return `Es baja para un anuncio porque este formato debería convertir mejor en clics o respuesta directa, y hoy solo registra ${item.clicks} clics.`;
  }

  if (status === "Buena") return `Es buena porque el contenido no solo llegó, también consiguió ${interactions} interacciones reales. Para este formato, eso acompaña bien el objetivo cargado.`;
  if (status === "Regular") return `Es regular porque el contenido funciona, pero todavía no convierte su alcance en interacción fuerte. Lleva ${interactions} interacciones totales.`;
  return `Es baja porque el alcance no se tradujo en suficiente reacción. Hoy suma ${interactions} interacciones, que quedó corto para este tipo de pieza.`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateTime(fecha, hora = "00:00") {
  if (!fecha) return null;
  return new Date(`${fecha}T${hora || "00:00"}:00`);
}

function sameMonth(dateA, dateB) {
  return dateA.getMonth() === dateB.getMonth() && dateA.getFullYear() === dateB.getFullYear();
}

function getCalendarDays(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });
}

function Badge({ children, tone = "soft" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Section({ title, subtitle, actions, children }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="subtext">{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatBox({ title, value, hint, onClick }) {
  return (
    <button type="button" className="stat-box" onClick={onClick}>
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-hint">{hint}</div>
    </button>
  );
}

const css = `
:root {
  --bg: #070710;
  --bg2: #0d0d18;
  --panel: rgba(18,18,30,.92);
  --panel2: rgba(255,255,255,.04);
  --line: rgba(255,255,255,.09);
  --text: #f5f7fb;
  --muted: #a8adbb;
  --soft: #d6dbeb;
  --pink: #d66bff;
  --violet: #8e72ff;
  --sky: #48bfff;
  --green: #2fd48e;
  --amber: #ffb343;
  --red: #ff6b7d;
}
* { box-sizing: border-box; }
html, body, #root { min-height: 100%; }
body {
  margin: 0;
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top right, rgba(214,107,255,.16), transparent 28%),
    radial-gradient(circle at top left, rgba(72,191,255,.10), transparent 22%),
    linear-gradient(180deg, #050509 0%, #090912 45%, #050509 100%);
  color: var(--text);
}
button, input, select, textarea { font: inherit; }
button { cursor: pointer; }
input, select, textarea {
  width: 100%;
  background: rgba(255,255,255,.03);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 14px;
  padding: 11px 12px;
  outline: none;
}
select option { color: #111827; background: #f6f7fb; }
.app-shell { max-width: 1600px; margin: 0 auto; padding: 20px; display: flex; gap: 20px; }
.sidebar {
  width: 280px; flex-shrink: 0; background: linear-gradient(180deg, rgba(12,12,18,.96), rgba(8,8,12,.88));
  border: 1px solid var(--line); border-radius: 28px; padding: 18px; display: flex; flex-direction: column;
  min-height: calc(100vh - 40px); position: sticky; top: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.35);
}
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
.pill-label { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: rgba(255,255,255,.04); border-radius: 999px; padding: 6px 12px; font-size: 12px; color: var(--soft); }
.brand-title { margin: 10px 0 6px; font-size: 32px; font-weight: 700; }
.brand-sub { margin: 0; color: var(--muted); line-height: 1.6; font-size: 14px; }
.nav { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
.nav button { border: 1px solid var(--line); background: rgba(255,255,255,.03); color: var(--soft); border-radius: 16px; padding: 12px 14px; text-align: left; font-weight: 600; }
.nav button.active { border: none; color: #16111f; background: linear-gradient(90deg, var(--pink), var(--violet)); box-shadow: 0 10px 30px rgba(214,107,255,.24); }
.session-box { margin-top: auto; border: 1px solid var(--line); background: rgba(255,255,255,.03); border-radius: 24px; padding: 14px; }
.hero { border: 1px solid var(--line); background: linear-gradient(135deg, rgba(18,18,30,.95), rgba(8,8,12,.98)); border-radius: 28px; padding: 22px; box-shadow: 0 20px 60px rgba(0,0,0,.30); }
.hero-top { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
.hero-title { margin: 10px 0 6px; font-size: 46px; line-height: 1.05; }
.hero-sub { margin: 0; max-width: 850px; color: var(--muted); line-height: 1.6; }
.actions-row, .filters-row, .row-wrap { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.btn { border: 1px solid var(--line); background: rgba(255,255,255,.04); color: var(--text); border-radius: 14px; padding: 10px 14px; font-weight: 700; }
.btn-primary { border: none; color: #16111f; background: linear-gradient(90deg, var(--pink), var(--violet)); box-shadow: 0 10px 28px rgba(214,107,255,.25); }
.btn-soft { background: rgba(255,255,255,.03); }
.search-box { margin-top: 14px; display: flex; gap: 12px; align-items: center; border: 1px solid var(--line); background: rgba(0,0,0,.22); border-radius: 20px; padding: 10px 14px; }
.search-box input { border: none; padding: 0; background: transparent; }
.workspace-chip { border: 1px solid var(--line); background: rgba(255,255,255,.03); color: var(--soft); border-radius: 14px; padding: 8px 12px; font-weight: 700; }
.workspace-chip.active { border: none; color: #16111f; background: linear-gradient(90deg, var(--pink), var(--violet)); }
.tab-row-mobile { display: none; gap: 8px; flex-wrap: wrap; }
.panel { border: 1px solid var(--line); background: linear-gradient(135deg, rgba(255,255,255,.05), rgba(255,255,255,.025)); border-radius: 24px; padding: 18px; box-shadow: 0 14px 40px rgba(0,0,0,.25); }
.panel-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 16px; }
.panel h2 { margin: 0; font-size: 24px; }
.subtext { margin: 6px 0 0; color: var(--muted); font-size: 14px; line-height: 1.5; }
.panel-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.two-col-wide { display: grid; grid-template-columns: 1.1fr .9fr; gap: 16px; }
.two-col-side { display: grid; grid-template-columns: 1.2fr .8fr; gap: 16px; }
.stat-box { border: 1px solid var(--line); background: linear-gradient(135deg, rgba(214,107,255,.10), rgba(255,255,255,.03)); border-radius: 22px; padding: 16px; text-align: left; }
.stat-title { color: var(--muted); font-size: 13px; }
.stat-value { font-size: 30px; font-weight: 800; margin-top: 6px; }
.stat-hint { color: #8d93a6; font-size: 12px; margin-top: 4px; }
.summary-card { border: 1px solid var(--line); background: linear-gradient(135deg, rgba(214,107,255,.12), rgba(255,255,255,.03)); border-radius: 22px; padding: 16px; }
.summary-row { margin-top: 10px; display: flex; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 14px; }
.summary-row strong { color: var(--text); }
.card { border: 1px solid var(--line); background: linear-gradient(135deg, rgba(214,107,255,.07), rgba(255,255,255,.03)); border-radius: 24px; padding: 16px; }
.card + .card { margin-top: 14px; }
.card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
.card-title-input { font-size: 18px; font-weight: 800; min-width: 260px; }
.chips { display: flex; gap: 8px; flex-wrap: wrap; }
.metrics-top { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; }
.metric-mini { border: 1px solid var(--line); background: rgba(0,0,0,.20); border-radius: 16px; padding: 10px; }
.metric-mini small { color: #8d93a6; text-transform: uppercase; letter-spacing: .14em; font-size: 10px; }
.metric-mini strong { display: block; margin-top: 5px; font-size: 18px; }
.info-box { margin-top: 14px; border: 1px solid rgba(72,191,255,.20); background: rgba(72,191,255,.10); border-radius: 18px; padding: 14px; }
.info-title { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #98dcff; font-weight: 800; }
.info-sub { margin-top: 6px; font-size: 12px; color: var(--muted); text-transform: uppercase; }
.info-box p { margin: 8px 0 0; color: #f3fbff; line-height: 1.6; font-size: 14px; }
.card-grid { margin-top: 14px; display: grid; grid-template-columns: 1.1fr 1.2fr; gap: 14px; }
.inner-box { border: 1px solid var(--line); background: rgba(0,0,0,.20); border-radius: 22px; padding: 14px; }
.inner-title { margin-bottom: 12px; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #8d93a6; font-weight: 800; }
.form-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }
.form-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
.span-2 { grid-column: span 2; }
.span-3 { grid-column: span 3; }
.field-label { border: 1px solid var(--line); background: rgba(255,255,255,.03); border-radius: 16px; padding: 10px; }
.field-label span { display: block; margin-bottom: 6px; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #8d93a6; }
.field-label input { border: none; padding: 0; background: transparent; }
.helper-box { margin-bottom: 12px; border: 1px solid rgba(255,179,67,.20); background: rgba(255,179,67,.10); border-radius: 16px; padding: 10px; color: var(--soft); font-size: 12px; line-height: 1.55; }
.badge { display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; border: 1px solid var(--line); }
.badge-soft { background: rgba(255,255,255,.06); color: var(--soft); }
.badge-good { background: rgba(47,212,142,.15); color: #8ff2c3; border-color: rgba(47,212,142,.2); }
.badge-warn { background: rgba(255,179,67,.15); color: #ffd69a; border-color: rgba(255,179,67,.2); }
.badge-bad { background: rgba(255,107,125,.15); color: #ffadb7; border-color: rgba(255,107,125,.2); }
.calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap: 8px; }
.calendar-head { text-align: center; font-size: 11px; color: #8d93a6; text-transform: uppercase; letter-spacing: .12em; }
.day-cell { min-height: 92px; border: 1px solid var(--line); border-radius: 16px; padding: 8px; background: rgba(0,0,0,.18); }
.day-cell.out { opacity: .48; }
.day-cell.today { border-color: rgba(255,179,67,.26); background: rgba(255,179,67,.10); }
.day-number { font-size: 12px; font-weight: 700; }
.day-tag { margin-top: 6px; border-radius: 10px; background: rgba(255,255,255,.08); padding: 4px 6px; font-size: 10px; color: var(--soft); }
.alert-list, .stack { display: flex; flex-direction: column; gap: 10px; }
.list-item { border: 1px solid var(--line); background: rgba(0,0,0,.18); border-radius: 16px; padding: 12px; }
.list-item-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.72); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 50; }
.modal { width: 100%; max-width: 1000px; border: 1px solid var(--line); background: linear-gradient(135deg, rgba(18,18,30,.97), rgba(10,10,16,.96)); border-radius: 28px; padding: 20px; box-shadow: 0 30px 100px rgba(0,0,0,.50); }
.modal.small-modal { max-width: 760px; }
.modal-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; margin-bottom: 14px; }
.modal-head h3 { margin: 8px 0 4px; font-size: 28px; }
.close-btn { width: 40px; height: 40px; border-radius: 14px; border: 1px solid var(--line); background: rgba(255,255,255,.04); color: var(--text); }
.note { border: 1px solid rgba(255,107,125,.18); background: rgba(255,107,125,.10); border-radius: 16px; padding: 12px; color: #ffd0d7; margin-top: 12px; }
@media (max-width: 1280px) {
  .sidebar { display: none; }
  .tab-row-mobile { display: flex; }
  .grid-4 { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .grid-3 { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .two-col-wide, .two-col-side, .card-grid { grid-template-columns: 1fr; }
}
@media (max-width: 860px) {
  .app-shell { padding: 14px; }
  .hero-title { font-size: 34px; }
  .grid-4, .grid-3, .grid-2, .metrics-top, .form-grid-2, .form-grid-3 { grid-template-columns: 1fr; }
  .span-2, .span-3 { grid-column: span 1; }
  .calendar-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .day-cell { min-height: 82px; }
}
`;

export default function App() {
  const [content, setContent] = useState(() => readStorage(STORAGE_KEYS.content, defaultContent));
  const [tasks, setTasks] = useState(() => readStorage(STORAGE_KEYS.tasks, defaultTasks));
  const [workspaces, setWorkspaces] = useState(() => readStorage(STORAGE_KEYS.workspaces, defaultWorkspaces));
  const [activity, setActivity] = useState(() => readStorage(STORAGE_KEYS.activity, defaultActivity));
  const [activeTab, setActiveTab] = useState("dashboard");
  const [workspaceFilter, setWorkspaceFilter] = useState("Todas");
  const [networkFilter, setNetworkFilter] = useState("Todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [showItemModal, setShowItemModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState("");
  const [activeUser, setActiveUser] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState([]);
  const [cloudClient, setCloudClient] = useState(null);
  const [cloudStatus, setCloudStatus] = useState("Modo local");
  const [cloudError, setCloudError] = useState("");
  const [lastCloudSync, setLastCloudSync] = useState("");
  const realtimeChannelRef = useRef(null);
  const notifiedRef = useRef(notifiedIds);
  const boardCode = FIXED_CLOUD_CONFIG.boardCode || "ANDREA-MARISOL-CM";
  const boardTitle = FIXED_CLOUD_CONFIG.boardTitle || "Tablero compartido";
  const [newItem, setNewItem] = useState({
    mesa: defaultWorkspaces[0], nombre: "", fecha: formatDate(new Date()), hora: "10:00",
    red: "Instagram", tipo: "Post", objetivo: "Alcance", campana: "", estado: "Programado", link: "https://",
  });
  const [newTask, setNewTask] = useState({ tarea: "", prioridad: "Media", mesa: defaultWorkspaces[0], estado: "Pendiente" });

  useEffect(() => saveStorage(STORAGE_KEYS.content, content), [content]);
  useEffect(() => saveStorage(STORAGE_KEYS.tasks, tasks), [tasks]);
  useEffect(() => saveStorage(STORAGE_KEYS.workspaces, workspaces), [workspaces]);
  useEffect(() => saveStorage(STORAGE_KEYS.activity, activity), [activity]);

  const mesas = useMemo(() => ["Todas", ...workspaces], [workspaces]);
  const safeCurrentWorkspace = useMemo(() => workspaceFilter === "Todas" || workspaces.includes(workspaceFilter) ? workspaceFilter : "Todas", [workspaceFilter, workspaces]);

  const filteredContent = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return content.filter((item) => {
      const mesaOk = safeCurrentWorkspace === "Todas" || item.mesa === safeCurrentWorkspace;
      const networkOk = networkFilter === "Todas" || item.red === networkFilter;
      const searchOk = !term || [item.nombre, item.campana, item.mesa, item.red, item.tipo, item.objetivo, item.estado, item.link]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
      return mesaOk && networkOk && searchOk;
    });
  }, [content, safeCurrentWorkspace, networkFilter, searchTerm]);

  const filteredTasks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return tasks.filter((task) => {
      const mesaOk = safeCurrentWorkspace === "Todas" || task.mesa === safeCurrentWorkspace;
      const searchOk = !term || [task.tarea, task.mesa, task.estado, task.prioridad].some((value) => String(value).toLowerCase().includes(term));
      return mesaOk && searchOk;
    });
  }, [tasks, safeCurrentWorkspace, searchTerm]);

  const totals = useMemo(() => {
    const totalAlcance = filteredContent.reduce((sum, i) => sum + i.alcance, 0);
    const avgER = filteredContent.length ? filteredContent.reduce((sum, i) => sum + calcER(i), 0) / filteredContent.length : 0;
    return { piezas: filteredContent.length, totalAlcance, avgER };
  }, [filteredContent]);

  const operationalSummary = useMemo(() => ({
    publicados: filteredContent.filter((i) => i.estado === "Publicado").length,
    editados: filteredContent.filter((i) => i.estado === "Editado").length,
    editando: filteredContent.filter((i) => i.estado === "Editando").length,
    programados: filteredContent.filter((i) => i.estado === "Programado").length,
  }), [filteredContent]);

  const piecePerformance = useMemo(() => [...filteredContent].map((item) => ({
    id: item.id, nombre: item.nombre, mesa: item.mesa, tipo: item.tipo, red: item.red,
    estado: getMetricStatus(item), interactions: calcInteractions(item), er: calcER(item), explanation: getMetricExplanation(item),
  })).filter((item) => item.er > 0 || item.interactions > 0).sort((a, b) => (b.er - a.er) || (b.interactions - a.interactions)).slice(0, 6), [filteredContent]);

  const topPerformer = useMemo(() => filteredContent.length ? [...filteredContent].sort((a, b) => (calcER(b) - calcER(a)) || (calcInteractions(b) - calcInteractions(a)))[0] : null, [filteredContent]);
  const calendarDays = useMemo(() => getCalendarDays(calendarDate), [calendarDate]);
  const todayString = formatDate(new Date());
  const itemsByDate = useMemo(() => {
    const map = {};
    filteredContent.forEach((item) => { if (!item.fecha) return; if (!map[item.fecha]) map[item.fecha] = []; map[item.fecha].push(item); });
    return map;
  }, [filteredContent]);

  function addActivity(action, detail, user = activeUser || "Invitada") {
    setActivity((prev) => [createLogEntry(user, action, detail), ...prev].slice(0, 40));
  }

  function closeItemModal() { setShowItemModal(false); }
  function closeTaskModal() { setShowTaskModal(false); }

  function handleAddItem(e) {
    e.preventDefault();
    if (!newItem.nombre || !newItem.fecha) return;
    const item = { id: Date.now(), ...newItem, alcance: 0, impresiones: 0, likes: 0, comentarios: 0, compartidos: 0, guardados: 0, respuestas: 0, clicks: 0 };
    setContent((prev) => [item, ...prev]);
    addActivity("Nueva pieza", `${item.nombre} en ${item.mesa}`);
    setNewItem((prev) => ({ ...prev, mesa: workspaces[0] || "General", nombre: "", fecha: formatDate(new Date()), hora: "10:00", campana: "", link: "https://", estado: "Programado" }));
    closeItemModal();
    setActiveTab("contenido");
  }

  function handleAddTask(e) {
    e.preventDefault();
    if (!newTask.tarea) return;
    const taskToAdd = { id: Date.now(), ...newTask };
    setTasks((prev) => [taskToAdd, ...prev]);
    addActivity("Nueva tarea", `${taskToAdd.tarea} • ${taskToAdd.mesa}`);
    setNewTask({ tarea: "", prioridad: "Media", mesa: workspaces[0] || "General", estado: "Pendiente" });
    closeTaskModal();
    setActiveTab("equipo");
  }

  function addWorkspace() {
    const value = newWorkspace.trim();
    if (!value || workspaces.includes(value)) { setNewWorkspace(""); return; }
    setWorkspaces((prev) => [...prev, value]);
    addActivity("Nueva mesa", value);
    setNewWorkspace("");
  }

  function removeWorkspace(name) {
    setContent((prev) => prev.filter((item) => item.mesa !== name));
    setTasks((prev) => prev.filter((task) => task.mesa !== name));
    setWorkspaces((prev) => prev.filter((w) => w !== name));
    addActivity("Mesa eliminada", `${name} y sus datos asociados`);
    if (workspaceFilter === name) setWorkspaceFilter("Todas");
  }

  function updateMetric(id, field, value) { setContent((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: Number(value) || 0 } : item))); }
  function updateField(id, field, value) { setContent((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))); }
  function updateContentState(id, newState) { setContent((prev) => prev.map((item) => (item.id === id ? { ...item, estado: newState } : item))); }
  function updateTaskStatus(id, newStatus) { setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, estado: newStatus } : task))); }

  function renderDashboard() {
    return (
      <div className="stack">
        <div className="grid-4">
          <StatBox title="Usuario activo" value={activeUser || "Sin nombre"} hint="Ir a ajustes" onClick={() => setActiveTab("ajustes")} />
          <StatBox title="Piezas" value={totals.piezas} hint="Abrir contenido" onClick={() => setActiveTab("contenido")} />
          <StatBox title="Alcance total" value={totals.totalAlcance.toLocaleString("es-AR")} hint="Ver calendario" onClick={() => setActiveTab("calendario")} />
          <StatBox title="ER promedio" value={`${totals.avgER.toFixed(2)}%`} hint="Ver equipo" onClick={() => setActiveTab("equipo")} />
        </div>
        <Section title="Rendimiento por pieza" subtitle="Acá ves qué piezas rindieron mejor o peor, una por una, sin mezclar formatos." actions={
          <select value={networkFilter} onChange={(e) => setNetworkFilter(e.target.value)}>
            <option>Todas</option><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>LinkedIn</option>
          </select>
        }>
          {piecePerformance.length ? (
            <div className="grid-3">
              {piecePerformance.map((piece) => (
                <div key={piece.id} className="summary-card">
                  <div className="chips">
                    <Badge tone="soft">{piece.mesa}</Badge><Badge tone="soft">{piece.red}</Badge><Badge tone="soft">{piece.tipo}</Badge><Badge tone={piece.estado.tone}>{piece.estado.label}</Badge>
                  </div>
                  <div style={{ marginTop: 12, fontWeight: 800 }}>{piece.nombre}</div>
                  <div className="summary-row"><span>Interacciones</span><strong>{piece.interactions.toLocaleString("es-AR")}</strong></div>
                  <div className="summary-row"><span>ER</span><strong>{piece.er.toFixed(2)}%</strong></div>
                  <p className="subtext" style={{ marginTop: 10 }}>{piece.explanation}</p>
                </div>
              ))}
            </div>
          ) : <div className="list-item">Todavía no hay suficientes datos para evaluar piezas individuales.</div>}
        </Section>
        <div className="two-col-wide">
          <Section title="Mesas de trabajo" subtitle="Ambas personas manejan las mismas mesas del tablero compartido.">
            <div className="row-wrap" style={{ marginBottom: 12 }}>
              <input value={newWorkspace} onChange={(e) => setNewWorkspace(e.target.value)} placeholder="Nueva mesa / cliente" />
              <button className="btn btn-primary" onClick={addWorkspace}>Agregar mesa</button>
            </div>
            <div className="row-wrap">
              {mesas.map((mesa) => (
                <div key={mesa} className="row-wrap" style={{ gap: 6 }}>
                  <button className={`workspace-chip ${safeCurrentWorkspace === mesa ? "active" : ""}`} onClick={() => setWorkspaceFilter(mesa)}>{mesa}</button>
                  {mesa !== "Todas" && <button className="btn btn-soft" onClick={() => removeWorkspace(mesa)}>Eliminar</button>}
                </div>
              ))}
            </div>
          </Section>
          <Section title="Lectura rápida" subtitle="Lo más útil para ver qué está funcionando hoy.">
            {topPerformer ? (
              <div className="stack">
                <div className="info-box" style={{ borderColor: "rgba(47,212,142,.20)", background: "rgba(47,212,142,.10)" }}>
                  <div className="info-title" style={{ color: "#8ff2c3" }}>Mejor pieza actual</div>
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800 }}>{topPerformer.nombre}</div>
                  <div className="chips" style={{ marginTop: 8 }}>
                    <Badge tone="soft">{topPerformer.mesa}</Badge><Badge tone="soft">{topPerformer.tipo}</Badge><Badge tone={getMetricStatus(topPerformer).tone}>{getMetricStatus(topPerformer).label}</Badge>
                  </div>
                  <p>{getMetricExplanation(topPerformer)}</p>
                </div>
                <div className="stack">
                  <div className="list-item list-item-head"><span>Publicado</span><Badge tone="good">{operationalSummary.publicados}</Badge></div>
                  <div className="list-item list-item-head"><span>Editado</span><Badge tone="soft">{operationalSummary.editados}</Badge></div>
                  <div className="list-item list-item-head"><span>Editando</span><Badge tone="bad">{operationalSummary.editando}</Badge></div>
                  <div className="list-item list-item-head"><span>Programado</span><Badge tone="warn">{operationalSummary.programados}</Badge></div>
                </div>
              </div>
            ) : <div className="list-item">Todavía no hay piezas con datos suficientes para destacar una mejor.</div>}
          </Section>
        </div>
      </div>
    );
  }

  function renderContenido() {
    return (
      <Section title="Control de contenido" subtitle="Planificación, calendario, estado y métricas por pieza." actions={
        <>
          <Badge tone="soft">Activo: {activeUser || "Sin nombre"}</Badge>
          <Badge tone={cloudClient && sessionActive ? "good" : "warn"}>{cloudClient && sessionActive ? "Guardado compartido" : "Modo local"}</Badge>
        </>
      }>
        <div className="stack">
          {filteredContent.map((item) => {
            const er = calcER(item), interactions = calcInteractions(item), metricStatus = getMetricStatus(item), explanation = getMetricExplanation(item);
            return (
              <div key={item.id} className="card">
                <div className="card-head">
                  <div>
                    <input className="card-title-input" value={item.nombre} onChange={(e) => updateField(item.id, "nombre", e.target.value)} />
                    <div className="chips" style={{ marginTop: 10 }}>
                      <Badge tone="soft">{item.mesa}</Badge><Badge tone="soft">{item.red}</Badge><Badge tone="soft">{item.tipo}</Badge><Badge tone={item.estado === "Publicado" ? "good" : item.estado === "Programado" ? "warn" : item.estado === "Editando" ? "bad" : "soft"}>{item.estado}</Badge>
                    </div>
                  </div>
                  <div className="metrics-top">
                    <div className="metric-mini"><small>Interacciones</small><strong>{interactions}</strong></div>
                    <div className="metric-mini"><small>ER</small><strong>{er.toFixed(2)}%</strong></div>
                    <div className="metric-mini"><small>Rendimiento</small><strong>{metricStatus.label}</strong></div>
                    <div className="metric-mini"><small>Objetivo</small><strong style={{ fontSize: 14 }}>{item.objetivo}</strong></div>
                  </div>
                </div>
                <div className="info-box">
                  <div className="info-title">Lectura de la métrica</div>
                  <div className="info-sub">Qué pesa más acá: {getFormatFocusLabel(item.tipo)}</div>
                  <p>{explanation}</p>
                </div>
                <div className="card-grid">
                  <div className="inner-box">
                    <div className="inner-title">Datos base</div>
                    <div className="form-grid-2">
                      <select value={item.mesa} onChange={(e) => updateField(item.id, "mesa", e.target.value)}>{workspaces.map((mesa) => <option key={mesa}>{mesa}</option>)}</select>
                      <select value={item.estado} onChange={(e) => updateContentState(item.id, e.target.value)}><option>Programado</option><option>Editando</option><option>Editado</option><option>Publicado</option></select>
                      <select value={item.red} onChange={(e) => updateField(item.id, "red", e.target.value)}><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>LinkedIn</option></select>
                      <select value={item.tipo} onChange={(e) => updateField(item.id, "tipo", e.target.value)}><option>Post</option><option>Reel</option><option>Historia</option><option>Carrusel</option><option>Anuncio</option></select>
                      <input type="date" value={item.fecha} onChange={(e) => updateField(item.id, "fecha", e.target.value)} />
                      <input type="time" value={item.hora || "00:00"} onChange={(e) => updateField(item.id, "hora", e.target.value)} />
                      <select className="span-2" value={item.objetivo} onChange={(e) => updateField(item.id, "objetivo", e.target.value)}><option>Alcance</option><option>Interacción</option><option>Comunidad</option><option>Leads</option><option>Ventas</option></select>
                      <input className="span-2" value={item.campana} onChange={(e) => updateField(item.id, "campana", e.target.value)} placeholder="Campaña" />
                      <input className="span-2" value={item.link} onChange={(e) => updateField(item.id, "link", e.target.value)} placeholder="Link" />
                    </div>
                  </div>
                  <div className="inner-box">
                    <div className="inner-title">Métricas</div>
                    <div className="helper-box"><strong>Guía rápida:</strong> Alcance = personas únicas. Impresiones = veces que se mostró (puede repetir). Likes = “me gusta”. No son lo mismo.</div>
                    <div className="form-grid-3">
                      {[
                        ["alcance", "Alcance"], ["impresiones", "Impresiones"], ["likes", "Likes"], ["comentarios", "Comentarios"],
                        ["compartidos", "Compartidos"], ["guardados", "Guardados"], ["respuestas", "Respuestas"], ["clicks", "Clicks"],
                      ].map(([field, label]) => (
                        <label key={field} className="field-label">
                          <span>{label}</span>
                          <input type="number" value={item[field]} onChange={(e) => updateMetric(item.id, field, e.target.value)} />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    );
  }

  function renderCalendario() {
    return (
      <div className="two-col-side">
        <Section title="Calendario" subtitle="Vista mensual de publicaciones programadas.">
          <div className="list-item-head" style={{ marginBottom: 12 }}>
            <div className="row-wrap">
              <button className="btn btn-soft" onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>◀</button>
              <strong>{calendarDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</strong>
              <button className="btn btn-soft" onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>▶</button>
            </div>
          </div>
          <div className="calendar-grid" style={{ marginBottom: 8 }}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="calendar-head">{d}</div>)}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dateKey = formatDate(day), items = itemsByDate[dateKey] || [], isCurrentMonth = sameMonth(day, calendarDate), isToday = dateKey === todayString;
              return (
                <div key={dateKey} className={`day-cell ${!isCurrentMonth ? "out" : ""} ${isToday ? "today" : ""}`}>
                  <div className="day-number">{day.getDate()}</div>
                  {items.slice(0, 2).map((item) => <div key={item.id} className="day-tag">{item.hora} • {item.red}</div>)}
                  {items.length > 2 ? <div className="day-tag">+{items.length - 2} más</div> : null}
                </div>
              );
            })}
          </div>
        </Section>
        <div className="stack">
          <Section title="Última actividad" subtitle="Cambios recientes del tablero.">
            <div className="stack">
              {activity.slice(0, 5).map((entry) => (
                <div key={entry.id} className="list-item">
                  <div style={{ fontWeight: 700 }}>{entry.action}</div>
                  <div className="small muted" style={{ marginTop: 4 }}>{entry.detail}</div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    );
  }

  function renderEquipo() {
    return (
      <div className="grid-2">
        <Section title="Tareas del equipo" subtitle="Ambas personas ven y editan las mismas tareas.">
          <div className="stack">
            {filteredTasks.map((task) => (
              <div key={task.id} className="list-item">
                <div className="list-item-head">
                  <div>
                    <div style={{ fontWeight: 700 }}>{task.tarea}</div>
                    <div className="chips" style={{ marginTop: 8 }}>
                      <Badge tone="soft">{task.mesa}</Badge>
                      <Badge tone={task.prioridad === "Alta" ? "bad" : task.prioridad === "Media" ? "warn" : "soft"}>{task.prioridad}</Badge>
                    </div>
                  </div>
                  <select style={{ width: 130 }} value={task.estado} onChange={(e) => updateTaskStatus(task.id, e.target.value)}>
                    <option>Pendiente</option><option>En curso</option><option>Hecha</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Actividad reciente" subtitle="Movimientos del equipo en el tablero compartido.">
          <div className="stack">
            {activity.slice(0, 8).map((entry) => (
              <div key={entry.id} className="list-item">
                <div className="list-item-head">
                  <div>
                    <div style={{ fontWeight: 700 }}>{entry.action}</div>
                    <div className="small muted" style={{ marginTop: 4 }}>{entry.detail}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="small">{entry.user}</div>
                    <div className="small muted">{new Date(entry.timestamp).toLocaleString("es-AR")}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  function renderAjustes() {
    return (
      <div className="two-col-wide">
        <Section title="Acceso simple" subtitle="La idea es que vos y Marisol solo entren con su nombre y trabajen. Nada de pegar URLs todos los días.">
          <div className="chips" style={{ marginBottom: 14 }}>
            <Badge tone={cloudClient ? "good" : "warn"}>{cloudStatus}</Badge>
            <Badge tone={sessionActive ? "good" : "warn"}>{sessionActive ? "Sesión activa" : "Sin entrar"}</Badge>
            <Badge tone="soft">{boardCode}</Badge>
            {lastCloudSync ? <Badge tone="soft">{lastCloudSync}</Badge> : null}
          </div>
          <div className="grid-2">
            <input value={activeUser} onChange={(e) => setActiveUser(e.target.value)} placeholder="Tu nombre" />
            {!sessionActive ? <button className="btn btn-primary" onClick={() => setSessionActive(true)}>Entrar</button> : <button className="btn btn-soft" onClick={() => setSessionActive(false)}>Salir</button>}
          </div>
          {cloudError ? <div className="note">{cloudError}</div> : null}
        </Section>
        <Section title="Modo de trabajo" subtitle="Más simple y más parecido a una herramienta de uso diario.">
          <div className="stack small muted">
            <div>• Ya no hace falta mostrar URL, anon key o códigos técnicos en pantalla para trabajar todos los días.</div>
            <div>• La nube queda fija por detrás una sola vez y después ustedes solo entran con su nombre.</div>
            <div>• El tablero compartido es uno solo, así ambas ven y modifican lo mismo.</div>
            <div>• Si una cambia algo, la otra lo ve cuando la nube está configurada.</div>
          </div>
        </Section>
      </div>
    );
  }

  function renderActiveTab() {
    if (activeTab === "contenido") return renderContenido();
    if (activeTab === "calendario") return renderCalendario();
    if (activeTab === "equipo") return renderEquipo();
    if (activeTab === "ajustes") return renderAjustes();
    return renderDashboard();
  }

  return (
    <>
      <style>{css}</style>
      <div className="app-shell">
        <aside className="sidebar">
          <div>
            <div className="pill-label">✨ Panel CM premium</div>
            <div className="brand-title">Control premium</div>
            <p className="brand-sub">Más simple para usar todos los días y con lectura de métricas mucho más útil.</p>
          </div>
          <nav className="nav">
            <button className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
            <button className={activeTab === "contenido" ? "active" : ""} onClick={() => setActiveTab("contenido")}>Contenido</button>
            <button className={activeTab === "calendario" ? "active" : ""} onClick={() => setActiveTab("calendario")}>Calendario</button>
            <button className={activeTab === "equipo" ? "active" : ""} onClick={() => setActiveTab("equipo")}>Equipo</button>
            <button className={activeTab === "ajustes" ? "active" : ""} onClick={() => setActiveTab("ajustes")}>Ajustes</button>
          </nav>
          <div className="session-box">
            <small>Sesión</small>
            <div style={{ marginTop: 8, fontWeight: 700 }}>{activeUser || "Sin nombre"}</div>
            <div className="chips" style={{ marginTop: 10 }}>
              <Badge tone={sessionActive ? "good" : "warn"}>{sessionActive ? "Activa" : "Pendiente"}</Badge>
              <Badge tone="soft">Local</Badge>
            </div>
          </div>
        </aside>
        <main className="main">
          <div className="hero">
            <div className="hero-top">
              <div>
                <div className="pill-label">✨ Panel CM premium</div>
                <div className="hero-title">{activeTab === "dashboard" ? "Dashboard" : activeTab === "contenido" ? "Contenido" : activeTab === "calendario" ? "Calendario" : activeTab === "equipo" ? "Equipo" : "Ajustes"}</div>
                <p className="hero-sub">Visual tipo app de pago, buscador rápido y una forma de trabajo mucho menos engorrosa. Este archivo ya trae el estilo adentro, así no tenés que tocar otras carpetas.</p>
              </div>
              <div className="actions-row">
                <button className="btn btn-primary" onClick={() => setShowItemModal(true)}>+ Nuevo contenido</button>
                <button className="btn btn-soft" onClick={() => setShowTaskModal(true)}>Nueva tarea</button>
              </div>
            </div>
            <div className="filters-row" style={{ marginTop: 14 }}>
              {mesas.map((mesa) => <button key={mesa} className={`workspace-chip ${safeCurrentWorkspace === mesa ? "active" : ""}`} onClick={() => setWorkspaceFilter(mesa)}>{mesa}</button>)}
            </div>
            <div className="search-box">
              <span>🔎</span>
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar contenido, cliente, campaña o tarea" />
            </div>
          </div>
          <div className="tab-row-mobile">
            <button className={`workspace-chip ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
            <button className={`workspace-chip ${activeTab === "contenido" ? "active" : ""}`} onClick={() => setActiveTab("contenido")}>Contenido</button>
            <button className={`workspace-chip ${activeTab === "calendario" ? "active" : ""}`} onClick={() => setActiveTab("calendario")}>Calendario</button>
            <button className={`workspace-chip ${activeTab === "equipo" ? "active" : ""}`} onClick={() => setActiveTab("equipo")}>Equipo</button>
            <button className={`workspace-chip ${activeTab === "ajustes" ? "active" : ""}`} onClick={() => setActiveTab("ajustes")}>Ajustes</button>
          </div>
          {renderActiveTab()}
        </main>
      </div>

      {showItemModal ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-head">
              <div><div className="pill-label">✨ Modal premium</div><h3>Crear contenido</h3><p className="brand-sub">Carga rápida y limpia, separada del tablero principal.</p></div>
              <button className="close-btn" onClick={closeItemModal}>✕</button>
            </div>
            <form onSubmit={handleAddItem} className="form-grid-3">
              <select value={newItem.mesa} onChange={(e) => setNewItem((prev) => ({ ...prev, mesa: e.target.value }))}>{workspaces.map((mesa) => <option key={mesa}>{mesa}</option>)}</select>
              <input className="span-2" value={newItem.nombre} onChange={(e) => setNewItem((prev) => ({ ...prev, nombre: e.target.value }))} placeholder="Nombre del contenido" />
              <input type="date" value={newItem.fecha} onChange={(e) => setNewItem((prev) => ({ ...prev, fecha: e.target.value }))} />
              <input type="time" value={newItem.hora} onChange={(e) => setNewItem((prev) => ({ ...prev, hora: e.target.value }))} />
              <select value={newItem.red} onChange={(e) => setNewItem((prev) => ({ ...prev, red: e.target.value }))}><option>Instagram</option><option>Facebook</option><option>TikTok</option><option>LinkedIn</option></select>
              <select value={newItem.tipo} onChange={(e) => setNewItem((prev) => ({ ...prev, tipo: e.target.value }))}><option>Post</option><option>Reel</option><option>Historia</option><option>Carrusel</option><option>Anuncio</option></select>
              <select value={newItem.objetivo} onChange={(e) => setNewItem((prev) => ({ ...prev, objetivo: e.target.value }))}><option>Alcance</option><option>Interacción</option><option>Comunidad</option><option>Leads</option><option>Ventas</option></select>
              <select value={newItem.estado} onChange={(e) => setNewItem((prev) => ({ ...prev, estado: e.target.value }))}><option>Programado</option><option>Editando</option><option>Editado</option><option>Publicado</option></select>
              <input className="span-2" value={newItem.campana} onChange={(e) => setNewItem((prev) => ({ ...prev, campana: e.target.value }))} placeholder="Tema / campaña" />
              <input className="span-3" value={newItem.link} onChange={(e) => setNewItem((prev) => ({ ...prev, link: e.target.value }))} placeholder="Link de pieza" />
              <div className="actions-row span-3" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-soft" onClick={closeItemModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar contenido</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showTaskModal ? (
        <div className="modal-backdrop">
          <div className="modal small-modal">
            <div className="modal-head">
              <div><div className="pill-label">✨ Modal premium</div><h3>Crear tarea</h3><p className="brand-sub">Rápida y limpia para el equipo.</p></div>
              <button className="close-btn" onClick={closeTaskModal}>✕</button>
            </div>
            <form onSubmit={handleAddTask} className="form-grid-2">
              <input className="span-2" value={newTask.tarea} onChange={(e) => setNewTask((prev) => ({ ...prev, tarea: e.target.value }))} placeholder="Nueva tarea" />
              <select value={newTask.mesa} onChange={(e) => setNewTask((prev) => ({ ...prev, mesa: e.target.value }))}>{workspaces.map((mesa) => <option key={mesa}>{mesa}</option>)}</select>
              <select value={newTask.prioridad} onChange={(e) => setNewTask((prev) => ({ ...prev, prioridad: e.target.value }))}><option>Alta</option><option>Media</option><option>Baja</option></select>
              <div className="actions-row span-2" style={{ marginTop: 6 }}>
                <button type="button" className="btn btn-soft" onClick={closeTaskModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar tarea</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
