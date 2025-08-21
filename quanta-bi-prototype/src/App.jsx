import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { Parser } from "expr-eval";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";

const Button = ({ className = "", children, ...props }) => (
  <button
    className={`px-3 py-2 rounded-2xl shadow hover:shadow-md active:scale-95 transition text-sm font-medium bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const SecondaryButton = ({ className = "", children, ...props }) => (
  <button
    className={`px-3 py-2 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${className}`}
    {...props}
  />
);

const Select = ({ className = "", children, ...props }) => (
  <select
    className={`w-full rounded-xl border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${className}`}
    {...props}
  >
    {children}
  </select>
);

const Card = ({ title, actions, children, className = "" }) => (
  <div className={`rounded-3xl bg-white dark:bg-slate-900 shadow p-4 ${className}`}>
    {(title || actions) && (
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    )}
    <div className="text-sm text-slate-800 dark:text-slate-200">{children}</div>
  </div>
);

const Tag = ({ children }) => (
  <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
    {children}
  </span>
);

const Spinner = () => (
  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
    <span>Working...</span>
  </div>
);

const Alert = ({ kind = "error", message }) => {
  const colors =
    kind === "error"
      ? "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-100 dark:border-red-800"
      : kind === "success"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:border-emerald-800"
      : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:border-amber-800";
  return (
    <div className={`flex items-start gap-3 p-3 rounded-2xl border ${colors}`}>
      <div className="pt-0.5">⚠️</div>
      <div className="text-sm leading-5">{message}</div>
    </div>
  );
};

const sampleCSV = `country,year,events,fatalities,region
Mozambique,2024,321,812,Southern Africa
DRC,2024,987,2310,Central Africa
Sudan,2024,1201,5440,North Africa
Burkina Faso,2024,844,3160,West Africa
Somalia,2024,760,1200,Horn of Africa`;

function inferType(value) {
  if (value === null || value === undefined || value === "") return "string";
  if (!isNaN(Number(value))) return "number";
  const d = new Date(value);
  if (!isNaN(d.getTime())) return "date";
  if (value === "true" || value === "false") return "boolean";
  return "string";
}

function buildSchema(rows) {
  const first = rows[0] || {};
  return Object.keys(first).map((k) => {
    const colType = inferType(first[k]);
    return { name: k, type: colType };
  });
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows) {
  return Papa.unparse(rows || []);
}

function fromCSV(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return parsed.data;
}

function parseWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function exportXLSX(rows, filename = "export.xlsx") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, filename);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// share state via location.hash
function encodeState(state) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
  catch { return ""; }
}
function decodeState(hash) {
  try { return JSON.parse(decodeURIComponent(escape(atob(hash)))); }
  catch { return null; }
}

// Excel-like function parser bound to current rows
function createExcelParser(rowsRef) {
  const parser = new Parser();

  const toNum = (v) => {
    if (typeof v === "number") return v;
    if (v === true) return 1;
    if (v === false || v === null || v === undefined || v === "") return 0;
    const s = String(v).replace(/,/g, "").trim();
    const n = Number(s);
    return isNaN(n) ? 0 : n;
  };
  const toStr = (v) => (v === null || v === undefined ? "" : String(v));
  const toDate = (v) => (v instanceof Date ? v : new Date(v));

  // logical
  parser.functions.IF = (c, a, b) => (c ? a : b);
  parser.functions.AND = (...xs) => xs.every(Boolean);
  parser.functions.OR  = (...xs) => xs.some(Boolean);
  parser.functions.NOT = (x) => !x;

  // type
  parser.functions.ISBLANK = (x) => x === null || x === undefined || x === "";
  parser.functions.ISNUMBER = (x) => typeof x === "number" || (!isNaN(Number(String(x).replace(/,/g, ""))));
  parser.functions.ISTEXT = (x) => typeof x === "string";
  parser.functions.N = (x) => toNum(x);

  // math
  parser.functions.ABS = Math.abs;
  parser.functions.ROUND = (x, d = 0) => { const p = Math.pow(10, d); return Math.round(toNum(x) * p) / p; };
  parser.functions.FLOOR = (x) => Math.floor(toNum(x));
  parser.functions.CEILING = (x) => Math.ceil(toNum(x));
  parser.functions.MIN = (...xs) => Math.min(...xs.map(toNum));
  parser.functions.MAX = (...xs) => Math.max(...xs.map(toNum));
  parser.functions.SQRT = Math.sqrt;

  // text
  parser.functions.LEN = (t) => toStr(t).length;
  parser.functions.LEFT = (t, n) => toStr(t).slice(0, n);
  parser.functions.RIGHT = (t, n) => toStr(t).slice(-n);
  parser.functions.MID = (t, s, n) => toStr(t).substr(Math.max(0, s - 1), n);
  parser.functions.UPPER = (t) => toStr(t).toUpperCase();
  parser.functions.LOWER = (t) => toStr(t).toLowerCase();
  parser.functions.PROPER = (t) => toStr(t).replace(/\\w\\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  parser.functions.TRIM = (t) => toStr(t).trim().replace(/\\s+/g, " ");
  parser.functions.CONCAT  = (...xs) => xs.map(toStr).join("");
  parser.functions.CONCATENATE = (...xs) => xs.map(toStr).join("");
  parser.functions.TEXTJOIN = (d, ignoreEmpty, ...xs) => xs.filter((x) => !ignoreEmpty || !parser.functions.ISBLANK(x)).map(toStr).join(d);
  parser.functions.SUBSTITUTE = (t, oldS, newS) => toStr(t).split(toStr(oldS)).join(toStr(newS));

  // dates
  parser.functions.TODAY = () => new Date();
  parser.functions.NOW = () => new Date();
  parser.functions.DATE = (y, m, d) => new Date(y, m - 1, d);
  parser.functions.YEAR = (x) => toDate(x).getFullYear();
  parser.functions.MONTH = (x) => toDate(x).getMonth() + 1;
  parser.functions.DAY = (x) => toDate(x).getDate();
  parser.functions.DATEDIF = (a, b, unit) => {
    const d1 = toDate(a), d2 = toDate(b);
    const diffMs = d2 - d1; const day = 1000*60*60*24;
    if (unit === "d") return Math.floor(diffMs / day);
    if (unit === "m") return Math.floor((d2.getFullYear() - d1.getFullYear())*12 + (d2.getMonth() - d1.getMonth()));
    if (unit === "y") return d2.getFullYear() - d1.getFullYear();
    return Math.floor(diffMs / day);
  };

  // criteria builder for *IF functions
  const buildCriteria = (crit) => {
    const s = String(crit).trim();
    const ops = [">=","<=",">","<","=","!="];
    for (const op of ops) {
      if (s.startsWith(op)) {
        const rhsRaw = s.slice(op.length).trim();
        const rhs = rhsRaw.replace(/^"|"$/g, "");
        return (v) => {
          const a = toNum(v);
          const b = toNum(rhsRaw);
          if (op === ">=") return a >= b;
          if (op === "<=") return a <= b;
          if (op === ">") return a > b;
          if (op === "<") return a < b;
          if (op === "=") return String(v) === rhs;
          if (op === "!=") return String(v) !== rhs;
          return false;
        };
      }
    }
    const needle = s.replace(/^\\*=|^\\=|^contains:/i, "");
    return (v) => toStr(v).toLowerCase().includes(needle.toLowerCase());
  };

  parser.functions.SUMIF = (col, criteria, sumCol) => {
    const pred = buildCriteria(criteria);
    return rowsRef.reduce((acc, r) => acc + (pred(r[col]) ? toNum(sumCol ? r[sumCol] : r[col]) : 0), 0);
  };
  parser.functions.COUNTIF = (col, criteria) => {
    const pred = buildCriteria(criteria);
    return rowsRef.reduce((acc, r) => acc + (pred(r[col]) ? 1 : 0), 0);
  };
  parser.functions.AVERAGEIF = (col, criteria, avgCol) => {
    const pred = buildCriteria(criteria);
    let sum = 0, n = 0;
    for (const r of rowsRef) {
      if (pred(r[col])) { sum += toNum(avgCol ? r[avgCol] : r[col]); n++; }
    }
    return n ? sum / n : 0;
  };

  parser.functions.LOOKUP = (key, keyCol, retCol) => {
    const row = rowsRef.find((r) => String(r[keyCol]) === String(key));
    return row ? row[retCol] : null;
  };

  return parser;
}

export default function App() {
  const [theme, setTheme] = useState("light");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState([]);
  const [schema, setSchema] = useState([]);
  const [name, setName] = useState("Untitled Project");

  const [pipeline, setPipeline] = useState([]);
  const [calcExpr, setCalcExpr] = useState("");
  const [calcName, setCalcName] = useState("");

  const [tab, setTab] = useState("data");
  const [chartSpec, setChartSpec] = useState({ type: "bar", x: "country", y: "events", series: "", agg: "sum" });
  const [pivot, setPivot] = useState({ rows: ["country"], cols: ["year"], value: "events", agg: "sum" });

  useEffect(() => {
    const hash = location.hash.replace(/^#/, "");
    if (hash) {
      const st = decodeState(hash);
      if (st && st.rows) {
        setRows(st.rows);
        setSchema(st.schema || buildSchema(st.rows));
        setName(st.name || "Untitled Project");
        setPipeline(st.pipeline || []);
        setChartSpec(st.chartSpec || chartSpec);
        setPivot(st.pivot || pivot);
      }
    }
  }, []);

  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);

  const shareState = () => {
    const st = { rows, schema, name, pipeline, chartSpec, pivot };
    const hash = encodeState(st);
    if (hash) {
      location.hash = hash;
      navigator.clipboard.writeText(location.href);
      alert("Shareable URL copied to clipboard.");
    }
  };

  const onUpload = async (file) => {
    try {
      setBusy(true);
      setError("");
      const ext = file.name.split(".").pop().toLowerCase();
      const buf = await file.arrayBuffer();
      let data = [];
      if (ext === "csv") data = fromCSV(new TextDecoder().decode(new Uint8Array(buf)));
      else if (ext === "xlsx" || ext === "xls") data = parseWorkbook(buf);
      else if (ext === "json") data = JSON.parse(new TextDecoder().decode(new Uint8Array(buf)));
      else if (ext === "twb" || ext === "tds" || ext === "xml") data = importTableauXML(new TextDecoder().decode(new Uint8Array(buf)));
      else if (ext === "pbi.json" || ext === "bim" || ext === "pbit" || ext === "pbids") data = importPbiShim(new TextDecoder().decode(new Uint8Array(buf)));
      else throw new Error("Unsupported file type. Use CSV, XLSX, JSON, or Tableau XML.");

      if (!Array.isArray(data)) {
        setSchema(data.schema || []);
        setRows([]);
      } else {
        setRows(data);
        setSchema(buildSchema(data));
      }
    } catch (e) {
      console.error(e);
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadSample = () => {
    const data = fromCSV(sampleCSV);
    setRows(data);
    setSchema(buildSchema(data));
  };

  // pipeline executor with Excel-like steps
  const applyPipeline = (inputRows) => {
    let out = deepClone(inputRows);
    for (const step of pipeline) {
      try {
        if (step.type === "filter") {
          const p = createExcelParser(out);
          out = out.filter((r) => !!p.parse(step.expr).evaluate(r));
        } else if (step.type === "select") {
          out = out.map((r) => {
            const nr = {};
            step.fields.forEach((f) => (nr[f] = r[f]));
            return nr;
          });
        } else if (step.type === "sort") {
          const { by, dir } = step;
          out.sort((a, b) => {
            if (a[by] < b[by]) return dir === "asc" ? -1 : 1;
            if (a[by] > b[by]) return dir === "asc" ? 1 : -1;
            return 0;
          });
        } else if (step.type === "dedupe") {
          const seen = new Set();
          out = out.filter((r) => {
            const key = step.keys.map((k) => r[k]).join("|");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        } else if (step.type === "mutate") {
          const p = createExcelParser(out);
          out = out.map((r) => ({ ...r, [step.as]: p.parse(step.expr).evaluate(r) }));
        } else if (step.type === "fill") {
          for (const col of step.cols) {
            if (step.direction === "down") {
              let last = null;
              out = out.map((r) => {
                const v = r[col];
                if (v !== null && v !== undefined && v !== "") last = v;
                else if (last !== null) r[col] = last;
                return r;
              });
            } else {
              let last = null;
              for (let i = out.length - 1; i >= 0; i--) {
                const v = out[i][col];
                if (v !== null && v !== undefined && v !== "") last = v;
                else if (last !== null) out[i][col] = last;
              }
            }
          }
        } else if (step.type === "replace") {
          const { col, find, withVal, mode = "exact", caseSensitive = false } = step;
          const cmp = (x) => {
            if (mode === "regex") {
              const re = new RegExp(find, caseSensitive ? "g" : "gi");
              return String(x ?? "").replace(re, withVal);
            }
            if (mode === "contains") {
              const a = caseSensitive ? String(x) : String(x).toLowerCase();
              const b = caseSensitive ? find : String(find).toLowerCase();
              return a.includes(b) ? String(x).split(find).join(withVal) : x;
            }
            return String(x) === String(find) ? withVal : x;
          };
          out = out.map((r) => ({ ...r, [col]: cmp(r[col]) }));
        } else if (step.type === "toNumber") {
          const cols = step.cols || [];
          out = out.map((r) => {
            const nr = { ...r };
            for (const c of cols) nr[c] = Number(String(nr[c]).replace(/,/g, ""));
            return nr;
          });
        } else if (step.type === "toDate") {
          const cols = step.cols || [];
          out = out.map((r) => {
            const nr = { ...r };
            for (const c of cols) nr[c] = new Date(nr[c]);
            return nr;
          });
        } else if (step.type === "trim") {
          const cols = step.cols || [];
          out = out.map((r) => {
            const nr = { ...r };
            for (const c of cols) nr[c] = String(nr[c] ?? "").trim().replace(/\s+/g, " ");
            return nr;
          });
        } else if (step.type === "split") {
          const { col, delim = ",", intoPrefix = `${step.col}_part`, count = 2, dropOriginal = false } = step;
          out = out.map((r) => {
            const parts = String(r[col] ?? "").split(delim);
            const nr = { ...r };
            for (let i = 0; i < count; i++) nr[`${intoPrefix}${i + 1}`] = parts[i] ?? "";
            if (dropOriginal) delete nr[col];
            return nr;
          });
        } else if (step.type === "merge") {
          const { cols, into = "merged", delim = " " } = step;
          out = out.map((r) => ({ ...r, [into]: (cols || []).map((c) => r[c] ?? "").join(delim) }));
        }
      } catch (e) {
        console.warn("Pipeline step failed", step, e);
      }
    }
    return out;
  };

  const workingRows = useMemo(() => applyPipeline(rows), [rows, pipeline]);

  const addFilter = () => setPipeline((p) => [...p, { type: "filter", expr: "IF(events>500, true, false)" }]);
  const addSelect = () => setPipeline((p) => [...p, { type: "select", fields: schema.map((s) => s.name) }]);
  const addSort = () => setPipeline((p) => [...p, { type: "sort", by: schema[0]?.name || "", dir: "asc" }]);
  const addDedupe = () => setPipeline((p) => [...p, { type: "dedupe", keys: schema.slice(0, 2).map((s) => s.name) }]);
  const addFill = () => setPipeline((p) => [...p, { type: "fill", cols: schema.slice(0,1).map((s) => s.name), direction: "down" }]);
  const addReplace = () => setPipeline((p) => [...p, { type: "replace", col: schema[0]?.name || "", find: "", withVal: "", mode: "exact", caseSensitive: false }]);
  const addToNumber = () => setPipeline((p) => [...p, { type: "toNumber", cols: schema.filter((s)=>s.type!=="date").map((s)=>s.name) }]);
  const addToDate = () => setPipeline((p) => [...p, { type: "toDate", cols: schema.filter((s)=>s.type!=="number").map((s)=>s.name) }]);
  const addTrim = () => setPipeline((p) => [...p, { type: "trim", cols: schema.map((s)=>s.name) }]);
  const addSplit = () => setPipeline((p) => [...p, { type: "split", col: schema[0]?.name || "", delim: ",", intoPrefix: "part_", count: 2, dropOriginal: false }]);
  const addMerge = () => setPipeline((p) => [...p, { type: "merge", cols: schema.slice(0,2).map((s)=>s.name), into: "merged", delim: " " }]);

  const addCalc = () => {
    try {
      if (!calcName.trim()) throw new Error("Field name required");
      const p = createExcelParser(workingRows);
      p.parse(calcExpr);
      setPipeline((ppl) => [...ppl, { type: "mutate", as: calcName.trim(), expr: calcExpr }]);
      setCalcExpr("");
      setCalcName("");
    } catch (e) {
      setError("Invalid formula. Use Excel-like functions: IF, AND, OR, NOT, ROUND, TRIM, LEFT, RIGHT, MID, UPPER, LOWER, DATE, YEAR, MONTH, DAY, TODAY, NOW, SUMIF, COUNTIF, AVERAGEIF, LOOKUP.");
    }
  };

  const pivotResult = useMemo(() => buildPivot(workingRows, pivot), [workingRows, pivot]);
  const chartData = useMemo(() => buildChartData(workingRows, chartSpec), [workingRows, chartSpec]);

  function importTableauXML(xmlText) {
    try {
      const doc = new DOMParser().parseFromString(xmlText, "text/xml");
      const cols = Array.from(doc.querySelectorAll("column, column-instance")).map((c) => ({
        name: c.getAttribute("name") || c.getAttribute("caption") || "field",
        type: c.getAttribute("datatype") || "string",
      }));
      return { schema: cols };
    } catch (e) {
      throw new Error("Failed to parse Tableau XML.");
    }
  }

  function importPbiShim(jsonText) {
    try {
      const obj = JSON.parse(jsonText);
      const cols = [];
      const tables = obj.model?.tables || obj.tables || [];
      tables.forEach((t) => {
        (t.columns || []).forEach((c) => cols.push({ name: `${t.name}.${c.name}`, type: c.dataType || "string" }));
      });
      if (!cols.length) throw new Error("Unsupported PBI JSON shape. Provide model with tables and columns.");
      return { schema: cols };
    } catch (e) {
      throw new Error("Failed to parse PBI compatibility JSON.");
    }
  }

  const exportPNG = async (node) => {
    if (!node) return;
    const canvas = await html2canvas(node);
    const link = document.createElement("a");
    link.download = "chart.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const exportPDF = async (node) => {
    if (!node) return;
    const canvas = await html2canvas(node);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, w, h);
    pdf.save("dashboard.pdf");
  };

  const saveProject = () => {
    const project = { name, schema, rows, pipeline, chartSpec, pivot };
    download(`${name.replace(/\\s+/g, "_")}.qbi.json`, JSON.stringify(project, null, 2));
  };

  const loadProject = async (file) => {
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      setName(obj.name || "Restored Project");
      setSchema(obj.schema || []);
      setRows(obj.rows || []);
      setPipeline(obj.pipeline || []);
      setChartSpec(obj.chartSpec || chartSpec);
      setPivot(obj.pivot || pivot);
    } catch (e) {
      setError("Failed to load project JSON.");
    }
  };

  const chartRef = useRef(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-slate-900 dark:bg-white" />
            <div>
              <div className="text-lg font-bold">Quanta BI Prototype</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Power like BI plus Excel lite plus Tableau shim</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SecondaryButton onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              {theme === "light" ? "Dark mode" : "Light mode"}
            </SecondaryButton>
            <SecondaryButton onClick={shareState}>Share</SecondaryButton>
            <Button onClick={saveProject}>Save Project</Button>
          </div>
        </header>

        {error && <div className="mb-3"><Alert kind="error" message={error} /></div>}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <Card title="Project" actions={<Tag>{rows.length} rows</Tag>}>
              <label className="text-xs">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SecondaryButton onClick={loadSample}>Load sample</SecondaryButton>
                <SecondaryButton onClick={() => {
                  const text = prompt("Paste CSV");
                  if (text) {
                    const data = fromCSV(text);
                    setRows(data);
                    setSchema(buildSchema(data));
                  }
                }}>Paste CSV</SecondaryButton>
              </div>
              <div className="mt-3">
                <label className="block text-xs mb-1">Upload data or compat files</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.json,.xml,.twb,.tds,.pbi.json,.bim,.pbit,.pbids"
                  onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                />
              </div>
              <div className="mt-3">
                <label className="block text-xs mb-1">Load project (.qbi.json)</label>
                <input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && loadProject(e.target.files[0])} />
              </div>
              {busy && <div className="mt-3"><Spinner /></div>}
            </Card>

            <Card title="Schema">
              {schema.length === 0 && <div className="text-xs text-slate-500">No schema available. Load data or import a compat file.</div>}
              <div className="max-h-56 overflow-auto space-y-1">
                {schema.map((s) => (
                  <div key={s.name} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-1">
                    <div className="truncate"><span className="font-semibold">{s.name}</span></div>
                    <Tag>{s.type}</Tag>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Transform pipeline" actions={
              <div className="flex gap-2 flex-wrap">
                <SecondaryButton onClick={() => setPipeline([])}>Clear</SecondaryButton>
                <Tag>{pipeline.length} steps</Tag>
              </div>
            }>
              <div className="grid grid-cols-2 gap-2">
                <SecondaryButton onClick={addFilter}>Add filter</SecondaryButton>
                <SecondaryButton onClick={addSelect}>Select fields</SecondaryButton>
                <SecondaryButton onClick={addSort}>Sort</SecondaryButton>
                <SecondaryButton onClick={addDedupe}>Dedupe</SecondaryButton>
                <SecondaryButton onClick={addFill}>Fill down or up</SecondaryButton>
                <SecondaryButton onClick={addReplace}>Find and replace</SecondaryButton>
                <SecondaryButton onClick={addTrim}>Trim spaces</SecondaryButton>
                <SecondaryButton onClick={addToNumber}>To number</SecondaryButton>
                <SecondaryButton onClick={addToDate}>To date</SecondaryButton>
                <SecondaryButton onClick={addSplit}>Split column</SecondaryButton>
                <SecondaryButton onClick={addMerge}>Merge columns</SecondaryButton>
              </div>
              <div className="mt-3 space-y-2">
                {pipeline.map((st, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold">{st.type}</div>
                      <div className="flex items-center gap-2">
                        <SecondaryButton onClick={() => setPipeline((p) => p.filter((_, idx) => idx !== i))}>Remove</SecondaryButton>
                        <SecondaryButton onClick={() => setPipeline((p) => moveItem(p, i, i - 1))}>Up</SecondaryButton>
                        <SecondaryButton onClick={() => setPipeline((p) => moveItem(p, i, i + 1))}>Down</SecondaryButton>
                      </div>
                    </div>
                    {st.type === "filter" && (
                      <Input className="mt-2" value={st.expr} onChange={(e) => updateStep(i, { expr: e.target.value })} placeholder="IF(events>500, true, false)" />
                    )}
                    {st.type === "select" && (
                      <MultiSelect fields={schema.map((s) => s.name)} value={st.fields} onChange={(fields) => updateStep(i, { fields })} />
                    )}
                    {st.type === "sort" && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Select value={st.by} onChange={(e) => updateStep(i, { by: e.target.value })}>
                          {schema.map((s) => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))}
                        </Select>
                        <Select value={st.dir} onChange={(e) => updateStep(i, { dir: e.target.value })}>
                          <option value="asc">asc</option>
                          <option value="desc">desc</option>
                        </Select>
                      </div>
                    )}
                    {st.type === "dedupe" && (
                      <MultiSelect fields={schema.map((s) => s.name)} value={st.keys} onChange={(keys) => updateStep(i, { keys })} />
                    )}
                    {st.type === "mutate" && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <Input value={st.as} onChange={(e) => updateStep(i, { as: e.target.value })} placeholder="newField" />
                        <Input value={st.expr} onChange={(e) => updateStep(i, { expr: e.target.value })} placeholder="ROUND(fatalities/events,2)" />
                      </div>
                    )}
                    {st.type === "fill" && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <MultiSelect fields={schema.map((s)=>s.name)} value={st.cols} onChange={(cols)=>updateStep(i,{cols})} />
                        <Select value={st.direction} onChange={(e)=>updateStep(i,{direction:e.target.value})}>
                          <option value="down">down</option>
                          <option value="up">up</option>
                        </Select>
                      </div>
                    )}
                    {st.type === "replace" && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        <Select value={st.col} onChange={(e)=>updateStep(i,{col:e.target.value})}>
                          {schema.map((s)=> <option key={s.name} value={s.name}>{s.name}</option>)}
                        </Select>
                        <Input placeholder="find" value={st.find} onChange={(e)=>updateStep(i,{find:e.target.value})} />
                        <Input placeholder="replace with" value={st.withVal} onChange={(e)=>updateStep(i,{withVal:e.target.value})} />
                        <Select value={st.mode} onChange={(e)=>updateStep(i,{mode:e.target.value})}>
                          <option value="exact">exact</option>
                          <option value="contains">contains</option>
                          <option value="regex">regex</option>
                        </Select>
                      </div>
                    )}
                    {st.type === "toNumber" && (
                      <div className="mt-2"><MultiSelect fields={schema.map((s)=>s.name)} value={st.cols} onChange={(cols)=>updateStep(i,{cols})} /></div>
                    )}
                    {st.type === "toDate" && (
                      <div className="mt-2"><MultiSelect fields={schema.map((s)=>s.name)} value={st.cols} onChange={(cols)=>updateStep(i,{cols})} /></div>
                    )}
                    {st.type === "trim" && (
                      <div className="mt-2"><MultiSelect fields={schema.map((s)=>s.name)} value={st.cols} onChange={(cols)=>updateStep(i,{cols})} /></div>
                    )}
                    {st.type === "split" && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                        <Select value={st.col} onChange={(e)=>updateStep(i,{col:e.target.value})}>
                          {schema.map((s)=> <option key={s.name} value={s.name}>{s.name}</option>)}
                        </Select>
                        <Input placeholder="," value={st.delim} onChange={(e)=>updateStep(i,{delim:e.target.value})} />
                        <Input placeholder="prefix" value={st.intoPrefix} onChange={(e)=>updateStep(i,{intoPrefix:e.target.value})} />
                        <Input placeholder="parts" type="number" value={st.count} onChange={(e)=>updateStep(i,{count:Number(e.target.value)})} />
                      </div>
                    )}
                    {st.type === "merge" && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        <MultiSelect fields={schema.map((s)=>s.name)} value={st.cols} onChange={(cols)=>updateStep(i,{cols})} />
                        <Input placeholder="into" value={st.into} onChange={(e)=>updateStep(i,{into:e.target.value})} />
                        <Input placeholder="delimiter" value={st.delim} onChange={(e)=>updateStep(i,{delim:e.target.value})} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <div className="text-xs mb-1">Calculated field</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="newField" value={calcName} onChange={(e) => setCalcName(e.target.value)} />
                  <Input placeholder="IF(events>500, 'High', 'Low') or ROUND(fatalities/events,2)" value={calcExpr} onChange={(e) => setCalcExpr(e.target.value)} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <SecondaryButton onClick={addCalc}>Add</SecondaryButton>
                  <Tag>Excel like: IF, AND, OR, NOT, ROUND, TRIM, LEFT or RIGHT or MID, UPPER or LOWER, DATE or YEAR or MONTH or DAY, TODAY or NOW, SUMIF, COUNTIF, AVERAGEIF, LOOKUP</Tag>
                </div>
              </div>
            </Card>

            <Card title="Export">
              <div className="grid grid-cols-2 gap-2">
                <SecondaryButton onClick={() => download("data.csv", toCSV(workingRows))}>CSV</SecondaryButton>
                <SecondaryButton onClick={() => exportXLSX(workingRows)}>Excel</SecondaryButton>
                <SecondaryButton onClick={() => download("data.json", JSON.stringify(workingRows, null, 2))}>JSON</SecondaryButton>
                <SecondaryButton onClick={() => exportPNG(chartRef.current)}>PNG chart</SecondaryButton>
              </div>
              <div className="mt-2">
                <SecondaryButton onClick={() => exportPDF(document.getElementById("dashboard"))}>PDF dashboard</SecondaryButton>
              </div>
            </Card>
          </div>

          <div className="col-span-12 lg:col-span-9 space-y-4">
            <div className="flex items-center gap-2">
              {[
                ["data", "Data"],
                ["pivot", "Pivot"],
                ["chart", "Charts"],
                ["dash", "Dashboard"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-4 py-2 rounded-2xl text-sm border ${tab === id ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "data" && (
              <Card title="Data table" actions={<Tag>{workingRows.length} rows</Tag>}>
                <DataTable rows={workingRows} schema={schema} />
              </Card>
            )}

            {tab === "pivot" && (
              <Card title="Pivot builder">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <DragFieldPicker label="Rows" fields={schema} value={pivot.rows} onChange={(rows) => setPivot({ ...pivot, rows })} />
                  <DragFieldPicker label="Columns" fields={schema} value={pivot.cols} onChange={(cols) => setPivot({ ...pivot, cols })} />
                  <div>
                    <div className="text-xs mb-1">Value and aggregator</div>
                    <Select value={pivot.value} onChange={(e) => setPivot({ ...pivot, value: e.target.value })}>
                      {schema.map((s) => (<option key={s.name} value={s.name}>{s.name}</option>))}
                    </Select>
                    <div className="mt-2">
                      <Select value={pivot.agg} onChange={(e) => setPivot({ ...pivot, agg: e.target.value })}>
                        {["sum","avg","count","min","max"].map((a) => <option key={a} value={a}>{a}</option>)}
                      </Select>
                    </div>
                  </div>
                </div>
                <PivotTable result={pivotResult} />
              </Card>
            )}

            {tab === "chart" && (
              <Card title="Chart builder">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                  <div>
                    <div className="text-xs mb-1">Type</div>
                    <Select value={chartSpec.type} onChange={(e) => setChartSpec({ ...chartSpec, type: e.target.value })}>
                      <option value="bar">Bar</option>
                      <option value="line">Line</option>
                      <option value="pie">Pie</option>
                    </Select>
                  </div>
                  <div>
                    <div className="text-xs mb-1">X</div>
                    <Select value={chartSpec.x} onChange={(e) => setChartSpec({ ...chartSpec, x: e.target.value })}>
                      {schema.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <div className="text-xs mb-1">Y or value</div>
                    <Select value={chartSpec.y} onChange={(e) => setChartSpec({ ...chartSpec, y: e.target.value })}>
                      {schema.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <div className="text-xs mb-1">Series optional</div>
                    <Select value={chartSpec.series} onChange={(e) => setChartSpec({ ...chartSpec, series: e.target.value })}>
                      <option value="">None</option>
                      {schema.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <div className="text-xs mb-1">Aggregator</div>
                    <Select value={chartSpec.agg} onChange={(e) => setChartSpec({ ...chartSpec, agg: e.target.value })}>
                      {["sum","avg","count","min","max"].map((a) => <option key={a} value={a}>{a}</option>)}
                    </Select>
                  </div>
                </div>

                <div ref={chartRef} className="h-[360px] rounded-3xl border border-slate-200 dark:border-slate-800 p-2">
                  <ChartArea spec={chartSpec} data={chartData} />
                </div>
              </Card>
            )}

            {tab === "dash" && (
              <div id="dashboard" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="KPI"><KPIGrid rows={workingRows} /></Card>
                <Card title="Chart">
                  <div ref={chartRef} className="h-[320px]"><ChartArea spec={chartSpec} data={chartData} /></div>
                </Card>
                <Card title="Pivot preview" className="md:col-span-2"><PivotTable result={pivotResult} compact /></Card>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-6 text-xs text-slate-500 text-center">
          Prototype for local testing. Data stays in browser. Tableau and Power BI support is schema only in this build.
        </footer>
      </div>
    </div>
  );

  function updateStep(i, patch) { setPipeline((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s))); }
  function moveItem(arr, from, to) { const a = [...arr]; if (to < 0 || to >= a.length) return a; const [it] = a.splice(from, 1); a.splice(to, 0, it); return a; }
}

function MultiSelect({ fields, value, onChange }) {
  const toggle = (f) => { const set = new Set(value); if (set.has(f)) set.delete(f); else set.add(f); onChange(Array.from(set)); };
  return (
    <div className="flex flex-wrap gap-2">
      {fields.map((f) => (
        <button key={f} type="button" onClick={() => toggle(f)} className={`px-2 py-1 rounded-full text-xs border ${value.includes(f) ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-700"}`}>
          {f}
        </button>
      ))}
    </div>
  );
}

function DataTable({ rows, schema }) {
  if (!rows || rows.length === 0) return <div className="text-xs text-slate-500">No rows to display.</div>;
  const cols = schema.length ? schema.map((s) => s.name) : Object.keys(rows[0]);
  return (
    <div className="overflow-auto max-h-[520px] rounded-2xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
          <tr>{cols.map((c) => (<th key={c} className="text-left px-3 py-2 whitespace-nowrap">{c}</th>))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-950">
              {cols.map((c) => (<td key={c} className="px-3 py-2 align-top break-words max-w-[260px]">{String(r[c] ?? "")}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DragFieldPicker({ label, fields, value, onChange }) {
  return (
    <div>
      <div className="text-xs mb-1">{label}</div>
      <div className="flex flex-wrap gap-2 min-h-[40px] p-2 rounded-xl border border-slate-200 dark:border-slate-800">
        {value.map((v) => (<span key={v} className="px-2 py-1 rounded-full text-xs bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">{v}</span>))}
      </div>
      <div className="mt-2"><MultiSelect fields={fields.map((s) => s.name)} value={value} onChange={onChange} /></div>
    </div>
  );
}

function KPIGrid({ rows }) {
  const count = rows.length;
  const cols = count ? Object.keys(rows[0]) : [];
  const numericCols = cols.filter((c) => !isNaN(Number(rows[0]?.[c])));
  const sum = (col) => rows.reduce((a, r) => a + (Number(r[col]) || 0), 0);
  const firstNum = numericCols[0];
  const secondNum = numericCols[1];
  return (
    <div className="grid grid-cols-3 gap-3">
      <KPI title="Rows" value={count} />
      {firstNum && <KPI title={`Sum ${firstNum}`} value={sum(firstNum)} />}
      {secondNum && <KPI title={`Sum ${secondNum}`} value={sum(secondNum)} />}
    </div>
  );
}

function KPI({ title, value }) {
  return (
    <div className="rounded-2xl p-4 bg-slate-100 dark:bg-slate-800">
      <div className="text-[11px] text-slate-500">{title}</div>
      <div className="text-2xl font-bold">{Intl.NumberFormat().format(value)}</div>
    </div>
  );
}

function ChartArea({ spec, data }) {
  if (!data || data.length === 0) return <div className="text-xs text-slate-500 p-3">No chart data. Load data first.</div>;
  if (spec.type === "bar") {
    const keys = Object.keys(data[0]).filter((k) => k !== spec.x);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={spec.x} />
          <YAxis />
          <Tooltip />
          <Legend />
          {keys.map((k) => (<Bar key={k} dataKey={k} />))}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (spec.type === "line") {
    const keys = Object.keys(data[0]).filter((k) => k !== spec.x);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={spec.x} />
          <YAxis />
          <Tooltip />
          <Legend />
          {keys.map((k) => (<Line key={k} type="monotone" dataKey={k} />))}
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (spec.type === "pie") {
    const key = Object.keys(data[0]).find((k) => k !== spec.x) || spec.y;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey={key} nameKey={spec.x} outerRadius={120}>
            {data.map((_, i) => (<Cell key={i} />))}
          </Pie>
          <Tooltip /><Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  return null;
}

function PivotTable({ result, compact }) {
  if (!result) return null;
  const { values, rowKeys, colKeys } = result;
  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
          <tr>
            <th className="px-3 py-2 text-left"></th>
            {colKeys.map((ck) => (<th key={ck} className="px-3 py-2 text-right whitespace-nowrap">{ck}</th>))}
            <th className="px-3 py-2 text-right">Row total</th>
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((rk, i) => (
            <tr key={rk} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-950">
              <td className="px-3 py-2 font-semibold whitespace-nowrap">{rk}</td>
              {colKeys.map((ck, j) => (<td key={ck} className="px-3 py-2 text-right align-top">{fmt(values[i][j])}</td>))}
              <td className="px-3 py-2 text-right font-semibold">{fmt(values[i].reduce((a, b) => a + (b || 0), 0))}</td>
            </tr>
          ))}
          <tr className="bg-slate-100 dark:bg-slate-800 font-semibold">
            <td className="px-3 py-2">Column total</td>
            {colKeys.map((_, j) => (<td key={j} className="px-3 py-2 text-right">{fmt(values.reduce((a, row) => a + (row[j] || 0), 0))}</td>))}
            <td className="px-3 py-2 text-right">{fmt(values.flat().reduce((a, b) => a + (b || 0), 0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
  function fmt(n) { if (n === null || n === undefined) return ""; return Number.isFinite(n) ? Intl.NumberFormat().format(n) : String(n); }
}

function buildChartData(rows, spec) {
  if (!rows || rows.length === 0) return [];
  const { x, y, series, agg } = spec;
  if (!series) {
    const groups = groupBy(rows, (r) => r[x]);
    return Object.entries(groups).map(([kx, arr]) => ({ [x]: kx, [y]: aggregate(arr, y, agg) }));
  }
  const groups = groupBy(rows, (r) => r[x]);
  const seriesVals = Array.from(new Set(rows.map((r) => r[series])));
  return Object.entries(groups).map(([kx, arr]) => {
    const obj = { [x]: kx };
    seriesVals.forEach((sv) => {
      const subset = arr.filter((r) => r[series] === sv);
      obj[String(sv)] = aggregate(subset, y, agg);
    });
    return obj;
  });
}

function buildPivot(rows, spec) {
  if (!rows || rows.length === 0) return null;
  const rowKeys = Array.from(new Set(rows.map((r) => spec.rows.map((k) => r[k]).join(" | "))));
  const colKeys = Array.from(new Set(rows.map((r) => spec.cols.map((k) => r[k]).join(" | "))));
  const values = rowKeys.map(() => colKeys.map(() => 0));
  const idxRow = new Map(rowKeys.map((k, i) => [k, i]));
  const idxCol = new Map(colKeys.map((k, i) => [k, i]));
  for (const r of rows) {
    const rk = spec.rows.map((k) => r[k]).join(" | ");
    const ck = spec.cols.map((k) => r[k]).join(" | ");
    const i = idxRow.get(rk);
    const j = idxCol.get(ck);
    const val = Number(r[spec.value]) || 0;
    if (spec.agg === "sum" || spec.agg === "count") values[i][j] += spec.agg === "count" ? 1 : val;
    if (spec.agg === "min") values[i][j] = values[i][j] === 0 ? val : Math.min(values[i][j], val);
    if (spec.agg === "max") values[i][j] = Math.max(values[i][j], val);
    if (spec.agg === "avg") { /* handled below */ }
  }
  if (spec.agg === "avg") {
    const counts = rowKeys.map(() => colKeys.map(() => 0));
    const idxRow2 = new Map(rowKeys.map((k, i) => [k, i]));
    const idxCol2 = new Map(colKeys.map((k, i) => [k, i]));
    for (const r of rows) {
      const rk = spec.rows.map((k) => r[k]).join(" | ");
      const ck = spec.cols.map((k) => r[k]).join(" | ");
      const i = idxRow2.get(rk);
      const j = idxCol2.get(ck);
      const val = Number(r[spec.value]) || 0;
      values[i][j] += val;
      counts[i][j] += 1;
    }
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < values[0].length; j++) {
        values[i][j] = counts[i][j] ? values[i][j] / counts[i][j] : 0;
      }
    }
  }
  return { rows, cols: [], values, rowKeys, colKeys };
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => { const k = keyFn(item); (acc[k] ||= []).push(item); return acc; }, {});
}

function aggregate(arr, field, agg) {
  if (agg === "count") return arr.length;
  const nums = arr.map((r) => Number(r[field]) || 0);
  if (agg === "sum") return nums.reduce((a, b) => a + b, 0);
  if (agg === "avg") return nums.reduce((a, b) => a + b, 0) / (nums.length || 1);
  if (agg === "min") return Math.min(...nums);
  if (agg === "max") return Math.max(...nums);
  return 0;
}
