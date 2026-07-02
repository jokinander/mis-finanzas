import { useState, useEffect, useCallback } from "react";

const KINES = [
  { id: "salva", name: "Salva", days: ["Martes", "Jueves"], hours: 7, color: "#2563eb", weekly: 14 },
  { id: "tucha", name: "Tucha", days: ["Martes", "Jueves"], hours: 7, color: "#7c3aed", weekly: 14 },
  { id: "jokin", name: "Jokin", days: ["Lunes", "Miércoles", "Viernes"], hours: 7, color: "#059669", weekly: 21 },
  { id: "tomi", name: "Tomi", days: ["Lunes", "Miércoles", "Viernes"], hours: 7, color: "#dc2626", weekly: 21 },
];

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const emptyWeekData = () => ({
  disponiblesMes: 0,
  disponiblesKine: 0,
  dados: 0,
  asistidos: 0,
});

const emptyMonthData = () => ({
  weeks: [{ ...emptyWeekData() }, { ...emptyWeekData() }, { ...emptyWeekData() }, { ...emptyWeekData() }],
});

const emptyReplacements = () => ([]);

const initData = () => {
  const data = {};
  KINES.forEach(k => {
    data[k.id] = {};
    MONTHS.forEach((_, mi) => {
      data[k.id][mi] = emptyMonthData();
    });
  });
  return data;
};

const initReplacements = () => {
  const r = {};
  MONTHS.forEach((_, mi) => { r[mi] = emptyReplacements(); });
  return r;
};

const STORAGE_KEY = "kines-hours-data-v2";
const REPL_KEY = "kines-replacements-v2";

export default function App() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initData();
    } catch (e) {
      return initData();
    }
  });
  const [replacements, setReplacements] = useState(() => {
    try {
      const saved = localStorage.getItem(REPL_KEY);
      return saved ? JSON.parse(saved) : initReplacements();
    } catch (e) {
      return initReplacements();
    }
  });
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(2026);
  const [view, setView] = useState("semanal");
  const [selectedKine, setSelectedKine] = useState("salva");
  const [saving, setSaving] = useState(false);
  const [newReplName, setNewReplName] = useState("");
  const [newReplHours, setNewReplHours] = useState("");
  const [newReplReemplaza, setNewReplReemplaza] = useState("");

  const save = useCallback((newData, newRepl) => {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData || data));
      localStorage.setItem(REPL_KEY, JSON.stringify(newRepl || replacements));
    } catch (e) {}
    setTimeout(() => setSaving(false), 300);
  }, [data, replacements]);

  const updateWeekField = (kineId, monthIdx, weekIdx, field, value) => {
    const val = value === "" ? 0 : Math.max(0, parseInt(value) || 0);
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[kineId][monthIdx].weeks[weekIdx][field] = val;
      save(next, replacements);
      return next;
    });
  };

  const addWeek = (kineId, monthIdx) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[kineId][monthIdx].weeks.length < 6) {
        next[kineId][monthIdx].weeks.push({ ...emptyWeekData() });
        save(next, replacements);
      }
      return next;
    });
  };

  const removeWeek = (kineId, monthIdx) => {
    setData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (next[kineId][monthIdx].weeks.length > 1) {
        next[kineId][monthIdx].weeks.pop();
        save(next, replacements);
      }
      return next;
    });
  };

  const addReplacement = () => {
    if (!newReplName.trim() || !newReplHours) return;
    setReplacements(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[month].push({ name: newReplName.trim(), hours: parseInt(newReplHours) || 0, reemplaza: newReplReemplaza });
      save(data, next);
      return next;
    });
    setNewReplName("");
    setNewReplHours("");
    setNewReplReemplaza("");
  };

  const removeReplacement = (idx) => {
    setReplacements(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[month].splice(idx, 1);
      save(data, next);
      return next;
    });
  };

  const getMonthTotals = (kineId, monthIdx) => {
    const weeks = data[kineId][monthIdx].weeks;
    return {
      disponiblesMes: weeks.reduce((s, w) => s + w.disponiblesMes, 0),
      disponiblesKine: weeks.reduce((s, w) => s + w.disponiblesKine, 0),
      dados: weeks.reduce((s, w) => s + w.dados, 0),
      asistidos: weeks.reduce((s, w) => s + w.asistidos, 0),
      cancelados: weeks.reduce((s, w) => s + (w.dados - w.asistidos), 0),
    };
  };

  const getGeneralMonth = (monthIdx) => {
    const totals = { disponiblesMes: 0, disponiblesKine: 0, dados: 0, asistidos: 0, cancelados: 0 };
    KINES.forEach(k => {
      const mt = getMonthTotals(k.id, monthIdx);
      totals.disponiblesMes += mt.disponiblesMes;
      totals.disponiblesKine += mt.disponiblesKine;
      totals.dados += mt.dados;
      totals.asistidos += mt.asistidos;
      totals.cancelados += mt.cancelados;
    });
    const replHours = (replacements[monthIdx] || []).reduce((s, r) => s + r.hours, 0);
    totals.reemplazos = replHours;
    return totals;
  };

  const pct = (a, b) => b === 0 ? "—" : `${Math.round((a / b) * 100)}%`;

  const [copied, setCopied] = useState(false);

  const exportResumen = () => {
    let text = `══════════════════════════════════\n`;
    text += `  RESUMEN ${MONTHS[month].toUpperCase()} ${year}\n`;
    text += `  Grupo Agile — Kinesiología\n`;
    text += `══════════════════════════════════\n\n`;

    KINES.forEach(k => {
      const t = getMonthTotals(k.id, month);
      text += `▸ ${k.name.toUpperCase()} (${k.days.join(", ")})\n`;
      text += `  Turnos disp. mes:   ${t.disponiblesMes}\n`;
      text += `  Turnos disp. kine:  ${t.disponiblesKine}\n`;
      text += `  Turnos dados:       ${t.dados}\n`;
      text += `  Turnos asistidos:   ${t.asistidos}\n`;
      text += `  Cancelados:         ${t.cancelados}\n`;
      text += `  % Asistencia:       ${pct(t.asistidos, t.dados)}\n\n`;
    });

    const g = getGeneralMonth(month);
    text += `──────────────────────────────────\n`;
    text += `  TOTAL GENERAL\n`;
    text += `──────────────────────────────────\n`;
    text += `  Turnos disp. mes:   ${g.disponiblesMes}\n`;
    text += `  Turnos disp. kine:  ${g.disponiblesKine}\n`;
    text += `  Turnos dados:       ${g.dados}\n`;
    text += `  Turnos asistidos:   ${g.asistidos}\n`;
    text += `  Cancelados:         ${g.cancelados}\n`;
    text += `  % Asistencia:       ${pct(g.asistidos, g.dados)}\n\n`;

    const repls = replacements[month] || [];
    if (repls.length > 0) {
      text += `──────────────────────────────────\n`;
      text += `  REEMPLAZOS\n`;
      text += `──────────────────────────────────\n`;
      repls.forEach(r => {
        text += `  ${r.name}${r.reemplaza ? ` → reemplaza a ${r.reemplaza}` : ""}: ${r.hours}hs\n`;
      });
      text += `  Total reemplazos: ${repls.reduce((s, r) => s + r.hours, 0)}hs\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      window.prompt("Copiá este texto:", text);
    });
  };

  const kineObj = KINES.find(k => k.id === selectedKine);

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      minHeight: "100vh",
      color: "#e2e8f0",
      padding: "0",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: "rgba(15,23,42,0.8)",
        borderBottom: "1px solid rgba(148,163,184,0.1)",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "white",
          }}>GA</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Grupo Agile</h1>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Kinesiología — Control de Horas {year}</p>
          </div>
        </div>
        {saving && <span style={{ fontSize: 11, color: "#facc15", fontFamily: "'Space Mono', monospace" }}>Guardando...</span>}
      </div>

      {/* Navigation */}
      <div style={{
        display: "flex", gap: 0, padding: "12px 24px",
        borderBottom: "1px solid rgba(148,163,184,0.08)",
        overflowX: "auto",
      }}>
        {[
          { key: "semanal", label: "Semanal" },
          { key: "mensual", label: "Mensual" },
          { key: "general", label: "General" },
          { key: "anual", label: "Anual" },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key)} style={{
            padding: "8px 20px",
            background: view === v.key ? "rgba(37,99,235,0.2)" : "transparent",
            border: "1px solid",
            borderColor: view === v.key ? "#2563eb" : "transparent",
            borderRadius: 8,
            color: view === v.key ? "#60a5fa" : "#94a3b8",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.2s",
            fontFamily: "'DM Sans', sans-serif",
            whiteSpace: "nowrap",
          }}>{v.label}</button>
        ))}
      </div>

      {/* Month selector */}
      <div style={{ padding: "12px 24px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{
          background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0",
          padding: "8px 12px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
        }}>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{
          background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0",
          padding: "8px 12px", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
        }}>
          {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        {(view === "semanal" || view === "mensual") && (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {KINES.map(k => (
              <button key={k.id} onClick={() => setSelectedKine(k.id)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: "2px solid",
                borderColor: selectedKine === k.id ? k.color : "transparent",
                background: selectedKine === k.id ? `${k.color}22` : "rgba(51,65,85,0.3)",
                color: selectedKine === k.id ? k.color : "#94a3b8",
                cursor: "pointer", transition: "all 0.2s",
                fontFamily: "'DM Sans', sans-serif",
              }}>{k.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "8px 24px 24px" }}>

        {/* VISTA SEMANAL */}
        {view === "semanal" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                <span style={{ color: kineObj.color }}>{kineObj.name}</span> — {MONTHS[month]}
              </h2>
              <span style={{
                fontSize: 11, color: "#64748b", fontFamily: "'Space Mono', monospace",
                background: "rgba(100,116,139,0.1)", padding: "4px 8px", borderRadius: 6,
              }}>
                {kineObj.days.join(" · ")} | {kineObj.weekly}hs/sem
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => addWeek(selectedKine, month)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "rgba(37,99,235,0.15)", border: "1px solid #2563eb33", color: "#60a5fa",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>+ Agregar semana</button>
              <button onClick={() => removeWeek(selectedKine, month)} style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "rgba(220,38,38,0.1)", border: "1px solid #dc262633", color: "#f87171",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>- Quitar semana</button>
              <span style={{ fontSize: 12, color: "#64748b", alignSelf: "center", fontFamily: "'Space Mono', monospace" }}>
                {data[selectedKine][month].weeks.length} semanas
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 180 }}>Métrica</th>
                    {data[selectedKine][month].weeks.map((_, i) => (
                      <th key={i} style={thStyle}>Sem {i + 1}</th>
                    ))}
                    <th style={{ ...thStyle, color: "#facc15" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: "disponiblesMes", label: "Turnos disp. mes" },
                    { key: "disponiblesKine", label: "Turnos disp. kine" },
                    { key: "dados", label: "Turnos dados" },
                    { key: "asistidos", label: "Turnos asistidos" },
                  ].map(field => (
                    <tr key={field.key}>
                      <td style={labelStyle}>{field.label}</td>
                      {data[selectedKine][month].weeks.map((w, wi) => (
                        <td key={wi} style={cellStyle}>
                          <input
                            type="number"
                            min="0"
                            value={w[field.key] || ""}
                            placeholder="0"
                            onChange={e => updateWeekField(selectedKine, month, wi, field.key, e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                      ))}
                      <td style={{ ...cellStyle, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#facc15" }}>
                        {data[selectedKine][month].weeks.reduce((s, w) => s + (w[field.key] || 0), 0)}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...labelStyle, color: "#f87171" }}>Cancelados</td>
                    {data[selectedKine][month].weeks.map((w, wi) => (
                      <td key={wi} style={{ ...cellStyle, fontFamily: "'Space Mono', monospace", color: "#f87171" }}>
                        {w.dados - w.asistidos}
                      </td>
                    ))}
                    <td style={{ ...cellStyle, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#f87171" }}>
                      {data[selectedKine][month].weeks.reduce((s, w) => s + (w.dados - w.asistidos), 0)}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...labelStyle, color: "#60a5fa" }}>% Asistencia</td>
                    {data[selectedKine][month].weeks.map((w, wi) => (
                      <td key={wi} style={{ ...cellStyle, fontFamily: "'Space Mono', monospace", color: "#60a5fa" }}>
                        {pct(w.asistidos, w.dados)}
                      </td>
                    ))}
                    <td style={{ ...cellStyle, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#60a5fa" }}>
                      {pct(
                        data[selectedKine][month].weeks.reduce((s, w) => s + w.asistidos, 0),
                        data[selectedKine][month].weeks.reduce((s, w) => s + w.dados, 0)
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Reemplazos */}
            <div style={{
              marginTop: 24, padding: 16, borderRadius: 12,
              background: "rgba(51,65,85,0.2)", border: "1px solid rgba(148,163,184,0.1)",
            }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>
                Reemplazos — {MONTHS[month]}
              </h3>
              {(replacements[month] || []).map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
                  background: "rgba(251,191,36,0.05)", padding: "8px 12px", borderRadius: 8,
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                  {r.reemplaza && <span style={{ fontSize: 12, color: "#94a3b8" }}>→ reemplaza a <strong>{r.reemplaza}</strong></span>}
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#fbbf24" }}>{r.hours}hs</span>
                  <button onClick={() => removeReplacement(i)} style={{
                    marginLeft: "auto", background: "none", border: "none", color: "#f87171",
                    cursor: "pointer", fontSize: 16, padding: "0 4px",
                  }}>×</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <input
                  placeholder="Nombre"
                  value={newReplName}
                  onChange={e => setNewReplName(e.target.value)}
                  style={{ ...inputStyle, width: 120 }}
                />
                <select
                  value={newReplReemplaza}
                  onChange={e => setNewReplReemplaza(e.target.value)}
                  style={{
                    background: "rgba(15,23,42,0.6)", border: "1px solid #334155", borderRadius: 6,
                    color: "#e2e8f0", padding: "6px 8px", fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <option value="">¿A quién reemplaza?</option>
                  {KINES.map(k => <option key={k.id} value={k.name}>{k.name}</option>)}
                </select>
                <input
                  type="number"
                  placeholder="Horas"
                  value={newReplHours}
                  onChange={e => setNewReplHours(e.target.value)}
                  style={{ ...inputStyle, width: 70 }}
                />
                <button onClick={addReplacement} style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: "rgba(251,191,36,0.2)", border: "1px solid #fbbf2433",
                  color: "#fbbf24", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>+ Agregar</button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA MENSUAL */}
        {view === "mensual" && (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
              <span style={{ color: kineObj.color }}>{kineObj.name}</span> — Resumen {MONTHS[month]}
            </h2>
            {(() => {
              const t = getMonthTotals(selectedKine, month);
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  {[
                    { label: "Disp. Mes", value: t.disponiblesMes, color: "#94a3b8" },
                    { label: "Disp. Kine", value: t.disponiblesKine, color: "#60a5fa" },
                    { label: "Dados", value: t.dados, color: "#a78bfa" },
                    { label: "Asistidos", value: t.asistidos, color: "#34d399" },
                    { label: "Cancelados", value: t.cancelados, color: "#f87171" },
                    { label: "% Asistencia", value: pct(t.asistidos, t.dados), color: "#facc15" },
                  ].map((item, i) => (
                    <div key={i} style={{
                      background: "rgba(30,41,59,0.6)", borderRadius: 12,
                      padding: 16, border: `1px solid ${item.color}22`,
                    }}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: item.color, fontFamily: "'Space Mono', monospace" }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {(() => {
              const t = getMonthTotals(selectedKine, month);
              const max = Math.max(t.disponiblesMes, 1);
              const bars = [
                { label: "Disp. Mes", value: t.disponiblesMes, color: "#475569" },
                { label: "Disp. Kine", value: t.disponiblesKine, color: "#2563eb" },
                { label: "Dados", value: t.dados, color: "#7c3aed" },
                { label: "Asistidos", value: t.asistidos, color: "#059669" },
                { label: "Cancelados", value: t.cancelados, color: "#dc2626" },
              ];
              return (
                <div style={{ marginTop: 24 }}>
                  {bars.map((b, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8" }}>{b.label}</span>
                        <span style={{ fontFamily: "'Space Mono', monospace", color: b.color }}>{b.value}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: "rgba(51,65,85,0.4)" }}>
                        <div style={{
                          height: "100%", borderRadius: 4, background: b.color,
                          width: `${(b.value / max) * 100}%`, transition: "width 0.5s ease",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* VISTA GENERAL */}
        {view === "general" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                General — {MONTHS[month]} {year}
              </h2>
              <button onClick={exportResumen} style={{
                padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: copied ? "rgba(52,211,153,0.2)" : "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(124,58,237,0.25))",
                border: copied ? "1px solid #34d39955" : "1px solid rgba(96,165,250,0.3)",
                color: copied ? "#34d399" : "#60a5fa",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                transition: "all 0.3s",
              }}>
                {copied ? "✓ Copiado al portapapeles" : "📋 Exportar resumen"}
              </button>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Kine</th>
                    <th style={thStyle}>Disp. Mes</th>
                    <th style={thStyle}>Disp. Kine</th>
                    <th style={thStyle}>Dados</th>
                    <th style={thStyle}>Asistidos</th>
                    <th style={thStyle}>Cancelados</th>
                    <th style={thStyle}>% Asist.</th>
                  </tr>
                </thead>
                <tbody>
                  {KINES.map(k => {
                    const t = getMonthTotals(k.id, month);
                    return (
                      <tr key={k.id}>
                        <td style={{ ...labelStyle, color: k.color }}>{k.name}</td>
                        <td style={monoCell}>{t.disponiblesMes}</td>
                        <td style={monoCell}>{t.disponiblesKine}</td>
                        <td style={monoCell}>{t.dados}</td>
                        <td style={{ ...monoCell, color: "#34d399" }}>{t.asistidos}</td>
                        <td style={{ ...monoCell, color: "#f87171" }}>{t.cancelados}</td>
                        <td style={{ ...monoCell, color: "#facc15" }}>{pct(t.asistidos, t.dados)}</td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const g = getGeneralMonth(month);
                    return (
                      <tr style={{ borderTop: "2px solid #334155" }}>
                        <td style={{ ...labelStyle, fontWeight: 700, color: "#e2e8f0" }}>TOTAL</td>
                        <td style={{ ...monoCell, fontWeight: 700 }}>{g.disponiblesMes}</td>
                        <td style={{ ...monoCell, fontWeight: 700 }}>{g.disponiblesKine}</td>
                        <td style={{ ...monoCell, fontWeight: 700 }}>{g.dados}</td>
                        <td style={{ ...monoCell, fontWeight: 700, color: "#34d399" }}>{g.asistidos}</td>
                        <td style={{ ...monoCell, fontWeight: 700, color: "#f87171" }}>{g.cancelados}</td>
                        <td style={{ ...monoCell, fontWeight: 700, color: "#facc15" }}>{pct(g.asistidos, g.dados)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {(replacements[month] || []).length > 0 && (
              <div style={{
                marginTop: 20, padding: 16, borderRadius: 12,
                background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.15)",
              }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>Reemplazos</h3>
                {replacements[month].map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{r.name}</span>
                    {r.reemplaza && <span style={{ color: "#94a3b8" }}>→ {r.reemplaza}</span>}
                    <span style={{ fontFamily: "'Space Mono', monospace", color: "#fbbf24" }}>{r.hours}hs</span>
                  </div>
                ))}
                <div style={{
                  marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(251,191,36,0.2)",
                  fontSize: 13, fontWeight: 700,
                }}>
                  Total reemplazos: <span style={{ fontFamily: "'Space Mono', monospace", color: "#fbbf24" }}>
                    {replacements[month].reduce((s, r) => s + r.hours, 0)}hs
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VISTA ANUAL */}
        {view === "anual" && (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
              Resumen Anual — {year}
            </h2>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Mes</th>
                    <th style={thStyle}>Disp. Mes</th>
                    <th style={thStyle}>Disp. Kine</th>
                    <th style={thStyle}>Dados</th>
                    <th style={thStyle}>Asistidos</th>
                    <th style={thStyle}>Cancel.</th>
                    <th style={thStyle}>% Asist.</th>
                    <th style={thStyle}>Reempl.</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((m, mi) => {
                    const g = getGeneralMonth(mi);
                    const replH = (replacements[mi] || []).reduce((s, r) => s + r.hours, 0);
                    const hasData = g.disponiblesMes > 0 || g.dados > 0;
                    return (
                      <tr key={mi} style={{ opacity: hasData ? 1 : 0.3 }}>
                        <td style={{ ...labelStyle, cursor: "pointer" }} onClick={() => { setMonth(mi); setView("general"); }}>
                          {m}
                        </td>
                        <td style={monoCell}>{g.disponiblesMes}</td>
                        <td style={monoCell}>{g.disponiblesKine}</td>
                        <td style={monoCell}>{g.dados}</td>
                        <td style={{ ...monoCell, color: "#34d399" }}>{g.asistidos}</td>
                        <td style={{ ...monoCell, color: "#f87171" }}>{g.cancelados}</td>
                        <td style={{ ...monoCell, color: "#facc15" }}>{pct(g.asistidos, g.dados)}</td>
                        <td style={{ ...monoCell, color: "#fbbf24" }}>{replH > 0 ? `${replH}hs` : "—"}</td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const totals = { dm: 0, dk: 0, d: 0, a: 0, c: 0, r: 0 };
                    MONTHS.forEach((_, mi) => {
                      const g = getGeneralMonth(mi);
                      totals.dm += g.disponiblesMes;
                      totals.dk += g.disponiblesKine;
                      totals.d += g.dados;
                      totals.a += g.asistidos;
                      totals.c += g.cancelados;
                      totals.r += (replacements[mi] || []).reduce((s, r) => s + r.hours, 0);
                    });
                    return (
                      <tr style={{ borderTop: "2px solid #334155" }}>
                        <td style={{ ...labelStyle, fontWeight: 700 }}>TOTAL ANUAL</td>
                        <td style={{ ...monoCell, fontWeight: 700 }}>{totals.dm}</td>
                        <td style={{ ...monoCell, fontWeight: 700 }}>{totals.dk}</td>
                        <td style={{ ...monoCell, fontWeight: 700 }}>{totals.d}</td>
                        <td style={{ ...monoCell, fontWeight: 700, color: "#34d399" }}>{totals.a}</td>
                        <td style={{ ...monoCell, fontWeight: 700, color: "#f87171" }}>{totals.c}</td>
                        <td style={{ ...monoCell, fontWeight: 700, color: "#facc15" }}>{pct(totals.a, totals.d)}</td>
                        <td style={{ ...monoCell, fontWeight: 700, color: "#fbbf24" }}>{totals.r > 0 ? `${totals.r}hs` : "—"}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mini chart */}
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Evolución mensual</h3>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
                {MONTHS.map((m, mi) => {
                  const g = getGeneralMonth(mi);
                  const maxAll = Math.max(...MONTHS.map((_, i) => getGeneralMonth(i).asistidos), 1);
                  const h = (g.asistidos / maxAll) * 100;
                  return (
                    <div key={mi} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, fontFamily: "'Space Mono', monospace", color: "#64748b" }}>
                        {g.asistidos > 0 ? g.asistidos : ""}
                      </span>
                      <div style={{
                        width: "100%", maxWidth: 32,
                        height: `${Math.max(h, 2)}%`,
                        background: g.asistidos > 0 ? "linear-gradient(180deg, #2563eb, #7c3aed)" : "rgba(51,65,85,0.3)",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.5s ease",
                        cursor: "pointer",
                      }} onClick={() => { setMonth(mi); setView("general"); }} />
                      <span style={{ fontSize: 9, color: "#64748b" }}>{m.slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Styles
const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid rgba(148,163,184,0.1)",
  fontFamily: "'Space Mono', monospace",
  whiteSpace: "nowrap",
};

const labelStyle = {
  padding: "10px 12px",
  fontSize: 13,
  fontWeight: 600,
  color: "#cbd5e1",
  borderBottom: "1px solid rgba(148,163,184,0.05)",
  whiteSpace: "nowrap",
};

const cellStyle = {
  padding: "6px 8px",
  borderBottom: "1px solid rgba(148,163,184,0.05)",
  textAlign: "center",
};

const monoCell = {
  ...cellStyle,
  fontFamily: "'Space Mono', monospace",
  fontSize: 13,
  color: "#e2e8f0",
};

const inputStyle = {
  width: "100%",
  maxWidth: 72,
  padding: "6px 8px",
  background: "rgba(15,23,42,0.6)",
  border: "1px solid #334155",
  borderRadius: 6,
  color: "#e2e8f0",
  fontSize: 14,
  fontFamily: "'Space Mono', monospace",
  textAlign: "center",
  outline: "none",
};
