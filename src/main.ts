import "./style.css";

type Priority = "none" | "low" | "med" | "high";
type Sort = "newest" | "due" | "priority" | "title";

interface Task {
  id: string;
  title: string;
  list: string;
  done: boolean;
  pri: Priority;
  due: string | null;
  notes: string;
  created: number;
}
interface Store {
  tasks: Task[];
  lists: string[];
}

const KEY = "todo-ts-v2";
const THEME_KEY = "todo-theme";
const PRI_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2, none: 3 };
const PRI_LABEL: Record<Priority, string> = { none: "No priority", low: "Low", med: "Medium", high: "High" };
const SWATCHES = ["#4c6ef5", "#2f9e8f", "#c9873a", "#a05a9e", "#6b8f3a", "#3a86a8"];

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const pad = (n: number): string => String(n).padStart(2, "0");
const iso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const dayDiff = (due: string): number => {
  const n = new Date();
  const t = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((parse(due).getTime() - t) / 86400000);
};
const addDays = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
function dueLabel(due: string): string {
  const n = dayDiff(due);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return parse(due).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- state ----------
function seed(): Store {
  const mk = (title: string, list: string, pri: Priority, due: string | null, notes = ""): Task => ({
    id: uid(), title, list, done: false, pri, due, notes, created: Date.now(),
  });
  return {
    lists: ["Inbox", "Work", "Study", "Personal"],
    tasks: [
      mk("Finish the pitch deck outline", "Work", "high", addDays(0), "Three slides max for the problem section. Ask Dea for the numbers."),
      mk("Reply to Marta about Friday", "Inbox", "med", addDays(1)),
      mk("Read chapter 4 for databases", "Study", "low", addDays(3)),
      mk("Buy oat milk and batteries", "Personal", "none", null),
      mk("Click a task title to open its details", "Inbox", "none", null, "You can change the list, priority and date here, and add notes."),
    ],
  };
}
function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (Array.isArray(s.tasks) && Array.isArray(s.lists) && s.lists.length) return s;
    }
  } catch (_) { /* storage unavailable */ }
  return seed();
}
const store: Store = load();
const save = (): void => {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_) { /* ignore */ }
};

let view = "all";
let sort: Sort = "newest";
let query = "";
let expanded: string | null = null;
let addingList = false;
let undo: { task: Task; at: number } | null = null;
let undoTimer = 0;

// ---------- derived ----------
const isList = (v: string): boolean => v.startsWith("list:");
const listName = (v: string): string => v.slice(5);
const open = (t: Task): boolean => !t.done;

function inView(t: Task, v: string): boolean {
  if (v === "all") return true;
  if (v === "done") return t.done;
  if (v === "today") return open(t) && t.due !== null && dayDiff(t.due) <= 0;
  if (v === "upcoming") return open(t) && t.due !== null && dayDiff(t.due) > 0;
  return t.list === listName(v);
}
function countFor(v: string): number {
  return store.tasks.filter((t) => (v === "done" ? t.done : open(t)) && inView(t, v)).length;
}
const cmp: Record<Sort, (a: Task, b: Task) => number> = {
  newest: (a, b) => b.created - a.created,
  due: (a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"),
  priority: (a, b) => PRI_RANK[a.pri] - PRI_RANK[b.pri],
  title: (a, b) => a.title.localeCompare(b.title),
};
function visible(): Task[] {
  const q = query.trim().toLowerCase();
  return store.tasks
    .filter((t) => inView(t, view))
    .filter((t) => !q || t.title.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q))
    .sort((a, b) => Number(a.done) - Number(b.done) || cmp[sort](a, b) || b.created - a.created);
}
function viewTitle(): string {
  const names: Record<string, string> = { all: "Everything", today: "Today", upcoming: "Coming up", done: "Finished" };
  return isList(view) ? listName(view) : names[view];
}
const swatch = (name: string): string => SWATCHES[store.lists.indexOf(name) % SWATCHES.length] ?? SWATCHES[0];

// ---------- rendering ----------
function fillSelect(sel: HTMLSelectElement, options: [string, string][], value: string): void {
  sel.innerHTML = "";
  for (const [v, label] of options) {
    const o = el("option", "", label);
    o.value = v;
    sel.appendChild(o);
  }
  sel.value = value;
}

function renderSide(): void {
  const side = $("side");
  side.innerHTML = "";
  side.appendChild(el("div", "brand", "Tasklane"));

  const nav = (v: string, label: string, color?: string): HTMLButtonElement => {
    const b = el("button", "nav");
    b.type = "button";
    b.setAttribute("aria-current", String(view === v));
    if (color) {
      const s = el("i", "sw");
      s.style.background = color;
      b.appendChild(s);
    }
    b.appendChild(el("span", "lbl", label));
    const c = countFor(v);
    if (c) b.appendChild(el("span", "cnt", String(c)));
    b.onclick = () => { view = v; expanded = null; render(); };
    return b;
  };

  const smart = el("div", "group");
  smart.appendChild(nav("all", "Everything"));
  smart.appendChild(nav("today", "Today"));
  smart.appendChild(nav("upcoming", "Coming up"));
  smart.appendChild(nav("done", "Finished"));
  side.appendChild(smart);

  side.appendChild(el("div", "gh", "Lists"));
  const lists = el("div", "group");
  for (const l of store.lists) lists.appendChild(nav("list:" + l, l, swatch(l)));
  side.appendChild(lists);

  if (addingList) {
    const inp = el("input", "newlist");
    inp.placeholder = "List name";
    inp.maxLength = 24;
    inp.setAttribute("aria-label", "New list name");
    const done = (ok: boolean): void => {
      const v = inp.value.trim();
      addingList = false;
      if (ok && v && !store.lists.includes(v)) { store.lists.push(v); view = "list:" + v; save(); }
      render();
    };
    inp.onkeydown = (e) => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); };
    inp.onblur = () => { if (addingList) done(true); };
    side.appendChild(inp);
    setTimeout(() => inp.focus(), 0);
  } else {
    const b = el("button", "addlist", "+ New list");
    b.type = "button";
    b.onclick = () => { addingList = true; renderSide(); };
    side.appendChild(b);
  }

  const foot = el("button", "theme", document.documentElement.getAttribute("data-theme") === "dark" ? "Light mode" : "Dark mode");
  foot.type = "button";
  foot.onclick = () => {
    const n = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(n);
    try { localStorage.setItem(THEME_KEY, n); } catch (_) { /* ignore */ }
    renderSide();
  };
  side.appendChild(foot);
}

function chip(text: string, cls = ""): HTMLSpanElement {
  return el("span", "chip " + cls, text);
}

function renderRow(t: Task): HTMLLIElement {
  const li = el("li", `task pri-${t.pri}${t.done ? " done" : ""}${expanded === t.id ? " open" : ""}`);
  const row = el("div", "row");

  const box = el("button", "box");
  box.type = "button";
  box.setAttribute("aria-label", (t.done ? "Mark not done: " : "Mark done: ") + t.title);
  box.innerHTML = '<span><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 4.5"/></svg></span>';
  box.onclick = () => { t.done = !t.done; save(); render(); };
  row.appendChild(box);

  const main = el("button", "main");
  main.type = "button";
  main.setAttribute("aria-expanded", String(expanded === t.id));
  main.appendChild(el("span", "title", t.title));
  const meta = el("span", "meta");
  if (!isList(view)) {
    const c = chip(t.list, "list");
    const s = el("i", "sw");
    s.style.background = swatch(t.list);
    c.prepend(s);
    meta.appendChild(c);
  }
  if (t.due) {
    const late = !t.done && dayDiff(t.due) < 0;
    meta.appendChild(chip((late ? "Overdue, " : "") + dueLabel(t.due), late ? "late" : dayDiff(t.due) === 0 && !t.done ? "now" : ""));
  }
  if (t.pri !== "none") meta.appendChild(chip(PRI_LABEL[t.pri], "p-" + t.pri));
  if (t.notes) meta.appendChild(chip("Notes"));
  main.appendChild(meta);
  main.onclick = () => { expanded = expanded === t.id ? null : t.id; render(); };
  row.appendChild(main);
  li.appendChild(row);

  if (expanded === t.id) li.appendChild(renderDetail(t));
  return li;
}

function renderDetail(t: Task): HTMLDivElement {
  const d = el("div", "detail");
  const title = el("input", "f-title");
  title.value = t.title;
  title.maxLength = 200;
  title.setAttribute("aria-label", "Task title");
  title.onchange = () => { const v = title.value.trim(); if (v) t.title = v; save(); render(); };
  d.appendChild(title);

  const notes = el("textarea", "f-notes");
  notes.placeholder = "Notes";
  notes.rows = 3;
  notes.value = t.notes;
  notes.setAttribute("aria-label", "Notes");
  notes.oninput = () => { t.notes = notes.value; save(); };
  notes.onblur = () => render();
  d.appendChild(notes);

  const grid = el("div", "fields");
  const field = (label: string, node: HTMLElement): void => {
    const w = el("label", "field");
    w.appendChild(el("span", "", label));
    w.appendChild(node);
    grid.appendChild(w);
  };
  const ls = el("select");
  fillSelect(ls, store.lists.map((l) => [l, l]), t.list);
  ls.onchange = () => { t.list = ls.value; save(); render(); };
  field("List", ls);

  const ps = el("select");
  fillSelect(ps, (Object.keys(PRI_LABEL) as Priority[]).map((p) => [p, PRI_LABEL[p]]), t.pri);
  ps.onchange = () => { t.pri = ps.value as Priority; save(); render(); };
  field("Priority", ps);

  const dt = el("input");
  dt.type = "date";
  dt.value = t.due ?? "";
  dt.onchange = () => { t.due = dt.value || null; save(); render(); };
  field("Due", dt);
  d.appendChild(grid);

  const del = el("button", "delete", "Delete task");
  del.type = "button";
  del.onclick = () => {
    const i = store.tasks.indexOf(t);
    store.tasks.splice(i, 1);
    expanded = null;
    undo = { task: t, at: i };
    save();
    render();
    showToast();
  };
  d.appendChild(del);
  return d;
}

function showToast(): void {
  const box = $("toast");
  box.innerHTML = "";
  if (!undo) { box.hidden = true; return; }
  box.hidden = false;
  box.appendChild(el("span", "", "Task deleted"));
  const b = el("button", "", "Undo");
  b.type = "button";
  b.onclick = () => {
    if (undo) { store.tasks.splice(undo.at, 0, undo.task); undo = null; save(); box.hidden = true; render(); }
  };
  box.appendChild(b);
  window.clearTimeout(undoTimer);
  undoTimer = window.setTimeout(() => { undo = null; box.hidden = true; }, 6000);
}

function renderMain(): void {
  $("vtitle").textContent = viewTitle();
  const inScope = store.tasks.filter((t) => inView(t, view));
  const done = inScope.filter((t) => t.done).length;
  const pct = inScope.length ? Math.round((done / inScope.length) * 100) : 0;
  $("pfill").style.width = pct + "%";
  $("ptext").textContent = inScope.length ? `${done} of ${inScope.length} done` : "Nothing here yet";

  const list = $("list");
  list.innerHTML = "";
  const rows = visible();
  if (!rows.length) {
    const e = el("li", "empty");
    e.appendChild(el("b", "", query ? "No matches" : "Nothing in " + viewTitle().toLowerCase()));
    e.appendChild(document.createTextNode(query ? "Try a shorter search." : "Add a task above to get going."));
    list.appendChild(e);
  }
  for (const t of rows) list.appendChild(renderRow(t));

  const listSel = $<HTMLSelectElement>("a-list");
  const keep = listSel.value;
  const def = isList(view) ? listName(view) : keep && store.lists.includes(keep) ? keep : store.lists[0];
  fillSelect(listSel, store.lists.map((l) => [l, l]), def);
}

function render(): void {
  renderSide();
  renderMain();
}

// ---------- wiring ----------
function applyTheme(t: string): void {
  document.documentElement.setAttribute("data-theme", t);
}
let saved: string | null = null;
try { saved = localStorage.getItem(THEME_KEY); } catch (_) { /* ignore */ }
applyTheme(saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

const hr = new Date().getHours();
$("greet").textContent = (hr < 5 ? "Still up" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening");
$("today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

fillSelect($<HTMLSelectElement>("a-pri"), (Object.keys(PRI_LABEL) as Priority[]).map((p) => [p, PRI_LABEL[p]]), "none");
fillSelect($<HTMLSelectElement>("sort"), [["newest", "Newest first"], ["due", "Due date"], ["priority", "Priority"], ["title", "A to Z"]], sort);

$<HTMLFormElement>("add").onsubmit = (e) => {
  e.preventDefault();
  const inp = $<HTMLInputElement>("a-title");
  const title = inp.value.trim();
  if (!title) return;
  const due = $<HTMLInputElement>("a-due").value;
  store.tasks.push({
    id: uid(),
    title,
    list: $<HTMLSelectElement>("a-list").value,
    done: false,
    pri: $<HTMLSelectElement>("a-pri").value as Priority,
    due: due || null,
    notes: "",
    created: Date.now(),
  });
  inp.value = "";
  $<HTMLInputElement>("a-due").value = "";
  $<HTMLSelectElement>("a-pri").value = "none";
  save();
  render();
  inp.focus();
};
$<HTMLInputElement>("q").oninput = (e) => { query = (e.target as HTMLInputElement).value; renderMain(); };
$<HTMLSelectElement>("sort").onchange = (e) => { sort = (e.target as HTMLSelectElement).value as Sort; renderMain(); };

document.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey) return;
  if (e.key === "n") { e.preventDefault(); $("a-title").focus(); }
  if (e.key === "/") { e.preventDefault(); $("q").focus(); }
});

render();
