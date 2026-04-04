import { useState, useEffect, useCallback } from "react";

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const FULL_MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CAT_ING = ["Sueldo","Freelance","Inversiones","Venta","Regalo","Otro"];
const CAT_EG = ["Alquiler","Servicios","Comida","Transporte","Salud","Educación","Entretenimiento","Ropa","Impuestos","Otro"];

const INITIAL_ARS = 10910338;
const INITIAL_USD = 4864;

const fmt = (n, cur = "ARS") => {
  const abs = Math.abs(n);
  const f = abs.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = cur === "USD" ? "US$" : "$";
  return (n < 0 ? "-" : "") + symbol + f;
};

const now = new Date();
const CY = now.getFullYear();
const CM = now.getMonth();
const STORAGE_KEY = "finanzas-v3";

function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  const set = useCallback((v) => {
    setVal(v);
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key]);
  return [val, set];
}

export default function App() {
  const [data, setData] = useLocalStorage(STORAGE_KEY, { transactions: [] });
  const [selYear, setSelYear] = useState(CY);
  const [selMonth, setSelMonth] = useState(CM);
  const [view, setView] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("ingreso");
  const [formCur, setFormCur] = useState("ARS");
  const [form, setForm] = useState({ description: "", amount: "", category: CAT_ING[0], date: "" });
  const [editId, setEditId] = useState(null);

  // Dollar rates
  const [rates, setRates] = useState({ blue: null, oficial: null, mep: null, loading: true, error: false, lastUpdate: null });
  const [selectedRate, setSelectedRate] = useState("blue");

  // Fetch dollar rates
  const fetchRates = useCallback(async () => {
    setRates(r => ({ ...r, loading: true, error: false }));
    try {
      const [blueRes, oficialRes, mepRes] = await Promise.all([
        fetch("https://dolarapi.com/v1/dolares/blue"),
        fetch("https://dolarapi.com/v1/dolares/oficial"),
        fetch("https://dolarapi.com/v1/dolares/bolsa"),
      ]);
      const [blue, oficial, mep] = await Promise.all([blueRes.json(), oficialRes.json(), mepRes.json()]);
      setRates({
        blue: { compra: blue.compra, venta: blue.venta },
        oficial: { compra: oficial.compra, venta: oficial.venta },
        mep: { compra: mep.compra, venta: mep.venta },
        loading: false,
        error: false,
        lastUpdate: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (e) {
      console.error("Error fetching rates:", e);
      setRates(r => ({ ...r, loading: false, error: true }));
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchRates]);

  const rate = rates[selectedRate]?.venta || 1200;

  const txs = data.transactions;

  // Dynamic balances
  const totalIngARS = txs.filter(t => t.type === "ingreso" && t.currency === "ARS").reduce((s, t) => s + t.amount, 0);
  const totalEgARS = txs.filter(t => t.type === "egreso" && t.currency === "ARS").reduce((s, t) => s + t.amount, 0);
  const totalIngUSD = txs.filter(t => t.type === "ingreso" && t.currency === "USD").reduce((s, t) => s + t.amount, 0);
  const totalEgUSD = txs.filter(t => t.type === "egreso" && t.currency === "USD").reduce((s, t) => s + t.amount, 0);
  const currentARS = INITIAL_ARS + totalIngARS - totalEgARS;
  const currentUSD = INITIAL_USD + totalIngUSD - totalEgUSD;

  const sumBy = (list, type, cur) => list.filter(t => t.type === type && t.currency === cur).reduce((s, t) => s + t.amount, 0);

  const monthTxs = txs.filter(t => {
    const d = new Date(t.date + "T12:00:00");
    return d.getFullYear() === selYear && d.getMonth() === selMonth;
  });

  const ingARS = sumBy(monthTxs, "ingreso", "ARS"), egARS = sumBy(monthTxs, "egreso", "ARS");
  const ingUSD = sumBy(monthTxs, "ingreso", "USD"), egUSD = sumBy(monthTxs, "egreso", "USD");
  const balARS = ingARS - egARS, balUSD = ingUSD - egUSD;
  const balTotalARS = balARS + balUSD * rate;

  // Balance up to month
  const txsUpToMonth = txs.filter(t => {
    const d = new Date(t.date + "T12:00:00");
    return d.getFullYear() < selYear || (d.getFullYear() === selYear && d.getMonth() <= selMonth);
  });
  const arsUpTo = INITIAL_ARS + sumBy(txsUpToMonth, "ingreso", "ARS") - sumBy(txsUpToMonth, "egreso", "ARS");
  const usdUpTo = INITIAL_USD + sumBy(txsUpToMonth, "ingreso", "USD") - sumBy(txsUpToMonth, "egreso", "USD");

  // Previous month
  const prevMonth = selMonth === 0 ? 11 : selMonth - 1;
  const prevYear = selMonth === 0 ? selYear - 1 : selYear;
  const prevTxs = txs.filter(t => {
    const d = new Date(t.date + "T12:00:00");
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  });
  const prevBalTotal = (sumBy(prevTxs, "ingreso", "ARS") - sumBy(prevTxs, "egreso", "ARS")) + (sumBy(prevTxs, "ingreso", "USD") - sumBy(prevTxs, "egreso", "USD")) * rate;

  // Insights
  const getInsights = () => {
    const ins = [];
    if (monthTxs.length === 0) { ins.push({ icon: "📝", text: "No hay movimientos este mes. ¡Cargá tus ingresos y egresos para ver el análisis!", type: "neutral" }); return ins; }
    if (balTotalARS > 0) ins.push({ icon: "✅", text: `Este mes te quedó un saldo positivo de ${fmt(balTotalARS)}. ¡Buen mes!`, type: "good" });
    else if (balTotalARS < 0) ins.push({ icon: "⚠️", text: `Gastaste ${fmt(Math.abs(balTotalARS))} más de lo que ingresaste. Ojo con los gastos.`, type: "warning" });
    if (prevTxs.length > 0) {
      const diff = balTotalARS - prevBalTotal;
      if (diff > 0) ins.push({ icon: "📈", text: `Mejoraste ${fmt(diff)} respecto a ${FULL_MONTHS[prevMonth]}. ¡Seguí así!`, type: "good" });
      else if (diff < 0) ins.push({ icon: "📉", text: `Tu balance fue ${fmt(Math.abs(diff))} menor que en ${FULL_MONTHS[prevMonth]}.`, type: "neutral" });
    }
    if (balARS > 0 && rate > 0) {
      const canBuy = Math.floor((balARS * 0.7) / rate * 100) / 100;
      if (canBuy >= 1) ins.push({ icon: "💵", text: `Con tu excedente podrías comprar ~US$${canBuy.toFixed(2)} (usando el 70% al ${selectedRate} $${rate.toLocaleString("es-AR")}). ¡Seguí dolarizando!`, type: "tip" });
      else ins.push({ icon: "💵", text: `Tu excedente en pesos es chico para comprar dólares este mes. Intentá reducir gastos.`, type: "neutral" });
    }
    const catTotals = CAT_EG.map(c => ({ c, t: monthTxs.filter(t => t.type === "egreso" && t.category === c).reduce((s, t) => s + (t.currency === "USD" ? t.amount * rate : t.amount), 0) })).filter(x => x.t > 0).sort((a, b) => b.t - a.t);
    const totalEg = egARS + egUSD * rate;
    if (catTotals.length > 0) {
      const top = catTotals[0];
      const pct = totalEg > 0 ? Math.round((top.t / totalEg) * 100) : 0;
      ins.push({ icon: "🏷️", text: `Mayor gasto: "${top.c}" (${pct}%). ${pct > 40 ? "Es mucho, ¿podés optimizarlo?" : "Dentro de lo razonable."}`, type: pct > 40 ? "warning" : "neutral" });
    }
    ins.push({ icon: "🏦", text: `Saldo acumulado a fin de ${FULL_MONTHS[selMonth]}: ${fmt(arsUpTo)} + ${fmt(usdUpTo, "USD")}.`, type: "good" });
    return ins;
  };

  // Annual
  const annualData = MONTHS.map((m, i) => {
    const mt = txs.filter(t => { const d = new Date(t.date + "T12:00:00"); return d.getFullYear() === selYear && d.getMonth() === i; });
    const iA = sumBy(mt, "ingreso", "ARS"), eA = sumBy(mt, "egreso", "ARS"), iU = sumBy(mt, "ingreso", "USD"), eU = sumBy(mt, "egreso", "USD");
    return { month: m, ingARS: iA, egARS: eA, ingUSD: iU, egUSD: eU, balTotal: (iA - eA) + (iU - eU) * rate };
  });
  let cumul = 0;
  const cumulData = annualData.map(d => { cumul += d.balTotal; return { ...d, cumul }; });
  const maxChart = Math.max(...cumulData.map(d => Math.max(d.ingARS + d.ingUSD * rate, d.egARS + d.egUSD * rate, 1)));

  const catBreakdown = (type) => {
    const cats = type === "ingreso" ? CAT_ING : CAT_EG;
    return cats.map(c => ({ c, total: monthTxs.filter(t => t.type === type && t.category === c).reduce((s, t) => s + (t.currency === "USD" ? t.amount * rate : t.amount), 0) })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
  };

  // Form
  const openForm = (type, cur = "ARS") => {
    setFormType(type); setFormCur(cur); setEditId(null);
    setForm({ description: "", amount: "", category: type === "ingreso" ? CAT_ING[0] : CAT_EG[0], date: new Date(selYear, selMonth, 15).toISOString().split("T")[0] });
    setShowForm(true);
  };
  const openEdit = (tx) => { setFormType(tx.type); setFormCur(tx.currency); setEditId(tx.id); setForm({ description: tx.description, amount: String(tx.amount), category: tx.category, date: tx.date }); setShowForm(true); };
  const handleSave = () => {
    const amt = parseFloat(form.amount);
    if (!form.description || isNaN(amt) || amt <= 0 || !form.date) return;
    const newTxs = editId ? txs.map(t => t.id === editId ? { ...t, ...form, amount: amt, type: formType, currency: formCur } : t) : [...txs, { id: Date.now().toString(), type: formType, currency: formCur, ...form, amount: amt }];
    setData({ ...data, transactions: newTxs }); setShowForm(false);
  };
  const handleDelete = (id) => setData({ ...data, transactions: txs.filter(t => t.id !== id) });

  const years = [...new Set([...txs.map(t => new Date(t.date + "T12:00:00").getFullYear()), CY])].sort();

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.topBar}>
        <div style={S.logoWrap}><span style={S.logoIcon}>◈</span><span style={S.logoText}>Mis Finanzas</span></div>
        <div style={S.topRight}>
          <select value={selYear} onChange={e => setSelYear(Number(e.target.value))} style={S.yearSel}>{years.map(y => <option key={y}>{y}</option>)}</select>
        </div>
      </div>

      {/* Dollar rates bar */}
      <div style={S.ratesBar}>
        <div style={S.ratesLeft}>
          {[["blue", "Blue"], ["oficial", "Oficial"], ["mep", "MEP"]].map(([key, label]) => (
            <button key={key} onClick={() => setSelectedRate(key)} style={{ ...S.rateChip, ...(selectedRate === key ? S.rateChipActive : {}) }}>
              <span style={S.rateChipLabel}>{label}</span>
              {rates[key] ? (
                <span style={S.rateChipVal}>${rates[key].venta?.toLocaleString("es-AR")}</span>
              ) : (
                <span style={S.rateChipVal}>--</span>
              )}
            </button>
          ))}
        </div>
        <div style={S.ratesRight}>
          {rates.loading && <span style={S.ratesStatus}>Actualizando...</span>}
          {rates.error && <span style={{ ...S.ratesStatus, color: "#f87171" }}>Error al cargar</span>}
          {rates.lastUpdate && !rates.loading && (
            <span style={S.ratesStatus}>
              Últ. {rates.lastUpdate}
              <button style={S.refreshBtn} onClick={fetchRates} title="Actualizar">↻</button>
            </span>
          )}
        </div>
      </div>

      {/* Rate detail */}
      {rates[selectedRate] && (
        <div style={S.rateDetail}>
          <span style={S.rateDetailItem}>Compra: <strong>${rates[selectedRate].compra?.toLocaleString("es-AR")}</strong></span>
          <span style={S.rateDetailDiv}>·</span>
          <span style={S.rateDetailItem}>Venta: <strong>${rates[selectedRate].venta?.toLocaleString("es-AR")}</strong></span>
          <span style={S.rateDetailTag}>Dólar {selectedRate.charAt(0).toUpperCase() + selectedRate.slice(1)}</span>
        </div>
      )}

      <div style={S.monthRow}>{MONTHS.map((m, i) => (<button key={m} onClick={() => setSelMonth(i)} style={{ ...S.mp, ...(i === selMonth ? S.mpA : {}) }}>{m}</button>))}</div>
      <div style={S.nav}>{[["dashboard", "Resumen"], ["transactions", "Movimientos"], ["annual", "Anual"], ["insights", "Análisis"]].map(([k, l]) => (<button key={k} onClick={() => setView(k)} style={{ ...S.nb, ...(view === k ? S.nbA : {}) }}>{l}</button>))}</div>

      {/* === DASHBOARD === */}
      {view === "dashboard" && (
        <div style={{ animation: "fadeIn .4s" }}>
          <div style={S.patRow}>
            <div style={S.patCardARS}>
              <span style={S.patLbl}>🇦🇷 PATRIMONIO EN PESOS</span>
              <div style={S.patVal}>{fmt(currentARS)}</div>
              <div style={S.patSub2}>Saldo a {MONTHS[selMonth]}: {fmt(arsUpTo)}</div>
            </div>
            <div style={S.patCardUSD}>
              <span style={S.patLblUSD}>🇺🇸 PATRIMONIO EN DÓLARES</span>
              <div style={S.patValUSD}>{fmt(currentUSD, "USD")}</div>
              <div style={S.patSub2USD}>Saldo a {MONTHS[selMonth]}: {fmt(usdUpTo, "USD")}</div>
            </div>
          </div>

          <div style={S.cards3}>
            {[["Balance " + MONTHS[selMonth], balTotalARS, balTotalARS >= 0 ? "#0f5132" : "#b91c1c", "0s"], ["Ingresos", ingARS + ingUSD * rate, "#047857", "0.07s"], ["Egresos", egARS + egUSD * rate, "#b91c1c", "0.14s"]].map(([l, v, c, d], idx) => (
              <div key={l} style={{ ...S.mCard, borderLeft: `4px solid ${c}`, animation: `popIn .35s ease ${d} both` }}>
                <span style={S.mLbl}>{l}</span><span style={{ ...S.mVal, color: c }}>{fmt(v)}</span>
                {idx === 0 && <div style={S.mSub}><span style={{ color: "#10b981" }}>{fmt(balARS)} ARS</span>{balUSD !== 0 && <span style={{ color: "#3b82f6" }}>{fmt(balUSD, "USD")}</span>}</div>}
                {idx === 1 && <div style={S.mSub}><span>{fmt(ingARS)}</span>{ingUSD > 0 && <span>{fmt(ingUSD, "USD")}</span>}</div>}
                {idx === 2 && <div style={S.mSub}><span>{fmt(egARS)}</span>{egUSD > 0 && <span>{fmt(egUSD, "USD")}</span>}</div>}
              </div>
            ))}
          </div>

          <div style={S.qRow}>
            <button style={S.bG} onClick={() => openForm("ingreso", "ARS")}>+ Ingreso $</button>
            <button style={S.bGo} onClick={() => openForm("ingreso", "USD")}>+ Ingreso US$</button>
            <button style={S.bR} onClick={() => openForm("egreso", "ARS")}>+ Egreso $</button>
            <button style={S.bRo} onClick={() => openForm("egreso", "USD")}>+ Egreso US$</button>
          </div>

          <div style={S.bkRow}>
            {[["ingreso", "Ingresos"], ["egreso", "Egresos"]].map(([tp, lb]) => {
              const items = catBreakdown(tp); const tot = items.reduce((s, i) => s + i.total, 0);
              return (<div key={tp} style={S.bkCard}><h3 style={S.bkT}>{lb} por categoría</h3>
                {items.length === 0 ? <p style={S.emp}>Sin {lb.toLowerCase()} este mes</p> : items.map(it => (
                  <div key={it.c} style={{ marginBottom: 11 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>{it.c}</span><span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{fmt(it.total)}</span></div>
                    <div style={S.barBg}><div style={{ height: "100%", borderRadius: 3, transition: "width .5s", width: `${(it.total / tot) * 100}%`, background: tp === "ingreso" ? "linear-gradient(90deg,#0f5132,#10b981)" : "linear-gradient(90deg,#b91c1c,#f87171)" }} /></div>
                  </div>
                ))}</div>);
            })}
          </div>

          <h3 style={S.secT}>Últimos movimientos</h3>
          {monthTxs.length === 0 ? <p style={S.emp}>Agregá tu primer movimiento del mes</p> :
            monthTxs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((tx, i) => (
              <div key={tx.id} style={{ ...S.tR, animation: `slideUp .25s ease ${i * .04}s both` }}>
                <div style={S.tL}><div style={{ ...S.dot, background: tx.type === "ingreso" ? "#0f5132" : "#b91c1c" }} /><div><div style={S.tD}>{tx.description}</div><div style={S.tM}>{tx.category} · {tx.date} · {tx.currency}</div></div></div>
                <span style={{ ...S.tA, color: tx.type === "ingreso" ? "#0f5132" : "#b91c1c" }}>{tx.type === "ingreso" ? "+" : "-"}{fmt(tx.amount, tx.currency)}</span>
              </div>))}
        </div>
      )}

      {/* === TRANSACTIONS === */}
      {view === "transactions" && (
        <div style={{ animation: "fadeIn .4s" }}>
          <div style={S.qRow}>
            <button style={S.bG} onClick={() => openForm("ingreso", "ARS")}>+ Ingreso $</button>
            <button style={S.bGo} onClick={() => openForm("ingreso", "USD")}>+ Ingreso US$</button>
            <button style={S.bR} onClick={() => openForm("egreso", "ARS")}>+ Egreso $</button>
            <button style={S.bRo} onClick={() => openForm("egreso", "USD")}>+ Egreso US$</button>
          </div>
          {monthTxs.length === 0 ? <p style={S.emp}>Sin movimientos en {FULL_MONTHS[selMonth]}</p> :
            monthTxs.sort((a, b) => b.date.localeCompare(a.date)).map((tx, i) => (
              <div key={tx.id} style={{ ...S.txC, animation: `slideUp .25s ease ${i * .03}s both` }}>
                <div style={S.tL}><div style={{ ...S.dot, background: tx.type === "ingreso" ? "#0f5132" : "#b91c1c" }} /><div><div style={S.tD}>{tx.description}</div><div style={S.tM}>{tx.category} · {tx.date} · {tx.currency}</div></div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ ...S.tA, color: tx.type === "ingreso" ? "#0f5132" : "#b91c1c" }}>{tx.type === "ingreso" ? "+" : "-"}{fmt(tx.amount, tx.currency)}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button style={S.eBtn} onClick={() => openEdit(tx)}>✎</button>
                    <button style={S.dBtn} onClick={() => handleDelete(tx.id)}>✕</button>
                  </div>
                </div>
              </div>))}
        </div>
      )}

      {/* === ANNUAL === */}
      {view === "annual" && (
        <div style={{ animation: "fadeIn .4s" }}>
          <h3 style={{ ...S.secT, marginBottom: 14 }}>Evolución {selYear}</h3>
          <div style={S.chBox}>
            <div style={S.chInner}>{cumulData.map((d, i) => {
              const tI = d.ingARS + d.ingUSD * rate, tE = d.egARS + d.egUSD * rate;
              return (
                <div key={d.month} style={S.chCol} onClick={() => setSelMonth(i)}>
                  <div style={S.chBars}><div style={{ ...S.chBar, background: "linear-gradient(180deg,#0f5132,#34d399)", height: `${maxChart ? (tI / maxChart) * 100 : 0}%` }} /><div style={{ ...S.chBar, background: "linear-gradient(180deg,#b91c1c,#fca5a5)", height: `${maxChart ? (tE / maxChart) * 100 : 0}%` }} /></div>
                  <span style={{ fontSize: 10, fontWeight: i === selMonth ? 700 : 400, color: i === selMonth ? "#10b981" : "#64748b" }}>{d.month}</span>
                </div>);
            })}</div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 8 }}><span style={S.lgI}><span style={{ ...S.lgD, background: "#0f5132" }} />Ingresos</span><span style={S.lgI}><span style={{ ...S.lgD, background: "#b91c1c" }} />Egresos</span></div>
          </div>
          <div style={S.tblW}><table style={S.tbl}><thead><tr><th style={S.th}>Mes</th><th style={{ ...S.th, textAlign: "right" }}>Ingresos</th><th style={{ ...S.th, textAlign: "right" }}>Egresos</th><th style={{ ...S.th, textAlign: "right" }}>Balance</th><th style={{ ...S.th, textAlign: "right" }}>Acumulado</th></tr></thead>
            <tbody>{cumulData.map((d, i) => (<tr key={d.month} style={{ background: i === selMonth ? "#0f51320a" : "transparent", cursor: "pointer" }} onClick={() => setSelMonth(i)}>
              <td style={S.td}>{FULL_MONTHS[i]}</td><td style={{ ...S.td, textAlign: "right", color: "#047857" }}>{fmt(d.ingARS + d.ingUSD * rate)}</td><td style={{ ...S.td, textAlign: "right", color: "#b91c1c" }}>{fmt(d.egARS + d.egUSD * rate)}</td>
              <td style={{ ...S.td, textAlign: "right", fontWeight: 600, color: d.balTotal >= 0 ? "#0f5132" : "#b91c1c" }}>{fmt(d.balTotal)}</td><td style={{ ...S.td, textAlign: "right", fontWeight: 600, color: d.cumul >= 0 ? "#0f5132" : "#b91c1c" }}>{fmt(d.cumul)}</td>
            </tr>))}</tbody>
            <tfoot><tr style={{ borderTop: "2px solid #334155" }}><td style={{ ...S.td, fontWeight: 700 }}>Total</td>
              <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: "#047857" }}>{fmt(cumulData.reduce((s, d) => s + d.ingARS + d.ingUSD * rate, 0))}</td>
              <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: "#b91c1c" }}>{fmt(cumulData.reduce((s, d) => s + d.egARS + d.egUSD * rate, 0))}</td>
              <td style={{ ...S.td, textAlign: "right", fontWeight: 700, color: cumul >= 0 ? "#0f5132" : "#b91c1c" }}>{fmt(cumul)}</td><td /></tr></tfoot>
          </table></div>
        </div>
      )}

      {/* === INSIGHTS === */}
      {view === "insights" && (
        <div style={{ animation: "fadeIn .4s" }}>
          <h3 style={S.secT}>Análisis — {FULL_MONTHS[selMonth]} {selYear}</h3>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Conclusiones basadas en tus movimientos · Cotización: dólar {selectedRate} ${rate.toLocaleString("es-AR")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {getInsights().map((ins, i) => (
              <div key={i} style={{ ...S.insC, borderLeft: `4px solid ${ins.type === "good" ? "#10b981" : ins.type === "warning" ? "#f59e0b" : ins.type === "tip" ? "#3b82f6" : "#64748b"}`, animation: `popIn .35s ease ${i * .08}s both` }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{ins.icon}</span><p style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6 }}>{ins.text}</p>
              </div>
            ))}
          </div>
          <div style={S.calcC}>
            <h4 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>💱 Calculadora rápida</h4>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Dólar {selectedRate} — Venta: ${rate.toLocaleString("es-AR")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["Saldo ARS actual", fmt(currentARS), "#e2e8f0"], ["Saldo USD actual", fmt(currentUSD, "USD"), "#3b82f6"], ["Balance del mes", fmt(balTotalARS), balTotalARS >= 0 ? "#10b981" : "#f87171"], ["Patrimonio en ARS", fmt(currentARS + currentUSD * rate), "#f1f5f9"]].map(([l, v, c]) => (
                <div key={l} style={S.calcI}><span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: .3 }}>{l}</span><span style={{ fontSize: 18, fontWeight: 700, color: c, fontFamily: "'Fraunces',serif" }}>{v}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (<div style={S.ov} onClick={() => setShowForm(false)}><div style={{ ...S.mod, animation: "popIn .3s" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={S.modT}>{editId ? "Editar" : "Nuevo"} {formType === "ingreso" ? "Ingreso" : "Egreso"}</h2>
          <span style={{ fontSize: 13, color: "#94a3b8", background: "#0f172a", padding: "4px 12px", borderRadius: 20 }}>{formCur === "USD" ? "🇺🇸 USD" : "🇦🇷 ARS"}</span>
        </div>
        <div style={S.curTog}>
          <button style={{ ...S.curB, ...(formCur === "ARS" ? S.curBA : {}) }} onClick={() => setFormCur("ARS")}>$ Pesos</button>
          <button style={{ ...S.curB, ...(formCur === "USD" ? S.curBU : {}) }} onClick={() => setFormCur("USD")}>US$ Dólares</button>
        </div>
        <div style={{ marginBottom: 14 }}><label style={S.fLbl}>Descripción</label><input style={S.fIn} placeholder="Ej: Sueldo mensual" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div style={{ marginBottom: 14 }}><label style={S.fLbl}>Monto ({formCur === "USD" ? "US$" : "$"})</label><input style={S.fIn} type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, marginBottom: 14 }}><label style={S.fLbl}>Categoría</label><select style={S.fIn} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{(formType === "ingreso" ? CAT_ING : CAT_EG).map(c => <option key={c}>{c}</option>)}</select></div>
          <div style={{ flex: 1, marginBottom: 14 }}><label style={S.fLbl}>Fecha</label><input style={S.fIn} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button style={S.canBtn} onClick={() => setShowForm(false)}>Cancelar</button>
          <button style={formType === "ingreso" ? S.bG : S.bR} onClick={handleSave}>{editId ? "Guardar" : "Agregar"}</button>
        </div>
      </div></div>)}
    </div>
  );
}

const S = {
  root: { fontFamily: "'Outfit',sans-serif", background: "#0c0f14", minHeight: "100vh", padding: "20px 16px 48px", maxWidth: 920, margin: "0 auto", color: "#e2e8f0" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  logoWrap: { display: "flex", alignItems: "center", gap: 8 },
  logoIcon: { fontSize: 28, color: "#10b981", fontWeight: 300 },
  logoText: { fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 700, color: "#f1f5f9", letterSpacing: -.5 },
  topRight: { display: "flex", alignItems: "center", gap: 8 },
  yearSel: { padding: "10px 14px", border: "1px solid #334155", borderRadius: 12, background: "#1e293b", fontSize: 14, fontWeight: 500, color: "#e2e8f0", cursor: "pointer" },

  // Rates bar
  ratesBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 },
  ratesLeft: { display: "flex", gap: 6 },
  rateChip: { display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 16px", background: "#1e293b", border: "1px solid #334155", borderRadius: 12, cursor: "pointer", transition: "all .2s", minWidth: 90 },
  rateChipActive: { background: "#0f5132", borderColor: "#10b981", boxShadow: "0 0 12px rgba(16,185,129,0.2)" },
  rateChipLabel: { fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 },
  rateChipVal: { fontSize: 16, fontWeight: 700, color: "#10b981", marginTop: 2 },
  ratesRight: { display: "flex", alignItems: "center" },
  ratesStatus: { fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 6 },
  refreshBtn: { background: "none", border: "none", color: "#10b981", fontSize: 16, cursor: "pointer", padding: "2px 4px" },
  rateDetail: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 16px", background: "#1e293b", borderRadius: 10, fontSize: 13, color: "#94a3b8" },
  rateDetailItem: { color: "#cbd5e1" },
  rateDetailDiv: { color: "#334155" },
  rateDetailTag: { marginLeft: "auto", background: "#0f172a", padding: "3px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, color: "#10b981" },

  monthRow: { display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4 },
  mp: { padding: "7px 13px", border: "none", borderRadius: 20, background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#64748b", flexShrink: 0 },
  mpA: { background: "#0f5132", color: "#fff", fontWeight: 600 },
  nav: { display: "flex", gap: 2, marginBottom: 20, background: "#1e293b", borderRadius: 14, padding: 3 },
  nb: { flex: 1, padding: "10px 6px", border: "none", borderRadius: 12, background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#64748b" },
  nbA: { background: "#0f5132", color: "#fff", fontWeight: 600 },

  // Patrimonio
  patRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 },
  patCardARS: { background: "linear-gradient(135deg,#0f5132,#065f46,#064e3b)", borderRadius: 20, padding: "26px 24px", display: "flex", flexDirection: "column", gap: 4 },
  patCardUSD: { background: "linear-gradient(135deg,#1e3a5f,#1d4ed8,#1e40af)", borderRadius: 20, padding: "26px 24px", display: "flex", flexDirection: "column", gap: 4 },
  patLbl: { fontSize: 11, color: "#86efac", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 },
  patLblUSD: { fontSize: 11, color: "#93c5fd", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 },
  patVal: { fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'Fraunces',serif", letterSpacing: -1, margin: "4px 0" },
  patValUSD: { fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'Fraunces',serif", letterSpacing: -1, margin: "4px 0" },
  patSub2: { fontSize: 13, color: "#bbf7d0", fontWeight: 500 },
  patSub2USD: { fontSize: 13, color: "#bfdbfe", fontWeight: 500 },

  cards3: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 16 },
  mCard: { background: "#1e293b", borderRadius: 16, padding: "18px 16px", display: "flex", flexDirection: "column", gap: 5 },
  mLbl: { fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: .5, fontWeight: 600 },
  mVal: { fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces',serif" },
  mSub: { display: "flex", gap: 10, fontSize: 12, color: "#94a3b8" },
  qRow: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  bG: { padding: "10px 18px", border: "none", borderRadius: 12, background: "#0f5132", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  bGo: { padding: "10px 18px", border: "1px solid #0f5132", borderRadius: 12, background: "transparent", color: "#10b981", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  bR: { padding: "10px 18px", border: "none", borderRadius: 12, background: "#991b1b", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  bRo: { padding: "10px 18px", border: "1px solid #991b1b", borderRadius: 12, background: "transparent", color: "#f87171", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  bkRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10, marginBottom: 20 },
  bkCard: { background: "#1e293b", borderRadius: 16, padding: 18 },
  bkT: { fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 14 },
  barBg: { height: 5, background: "#334155", borderRadius: 3, overflow: "hidden" },
  emp: { color: "#475569", fontSize: 14, padding: "16px 0", textAlign: "center" },
  secT: { fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 },
  tR: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid #1e293b" },
  txC: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 14, marginBottom: 6, background: "#1e293b", border: "1px solid #334155" },
  tL: { display: "flex", alignItems: "center", gap: 12 },
  dot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  tD: { fontSize: 14, fontWeight: 500, color: "#e2e8f0" },
  tM: { fontSize: 11, color: "#64748b", marginTop: 2 },
  tA: { fontSize: 15, fontWeight: 700 },
  eBtn: { width: 30, height: 30, border: "none", borderRadius: 8, background: "#334155", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" },
  dBtn: { width: 30, height: 30, border: "none", borderRadius: 8, background: "#450a0a", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" },
  chBox: { background: "#1e293b", borderRadius: 16, padding: "20px 16px 14px", marginBottom: 20 },
  chInner: { display: "flex", gap: 6, alignItems: "flex-end", height: 160, marginBottom: 10 },
  chCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" },
  chBars: { display: "flex", gap: 2, alignItems: "flex-end", height: "100%", width: "100%" },
  chBar: { flex: 1, borderRadius: "3px 3px 0 0", minHeight: 2, transition: "height .5s" },
  lgI: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" },
  lgD: { width: 7, height: 7, borderRadius: "50%", display: "inline-block" },
  tblW: { overflowX: "auto", background: "#1e293b", borderRadius: 16 },
  tbl: { width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#e2e8f0" },
  th: { padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: .5, borderBottom: "1px solid #334155" },
  td: { padding: "11px 14px", borderBottom: "1px solid #1e293b66" },
  insC: { background: "#1e293b", borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 14 },
  calcC: { background: "#1e293b", borderRadius: 16, padding: 22 },
  calcI: { background: "#0f172a", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 },
  ov: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, backdropFilter: "blur(6px)" },
  mod: { background: "#1e293b", borderRadius: 22, padding: "28px 24px", maxWidth: 440, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,.5)", border: "1px solid #334155" },
  modT: { fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 700, color: "#f1f5f9" },
  curTog: { display: "flex", gap: 6, marginBottom: 16 },
  curB: { flex: 1, padding: "9px 0", border: "1px solid #334155", borderRadius: 10, background: "transparent", color: "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  curBA: { background: "#0f5132", borderColor: "#0f5132", color: "#fff" },
  curBU: { background: "#1d4ed8", borderColor: "#1d4ed8", color: "#fff" },
  fLbl: { display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 5, textTransform: "uppercase", letterSpacing: .3 },
  fIn: { width: "100%", padding: "11px 14px", border: "1px solid #334155", borderRadius: 10, fontSize: 14, background: "#0f172a", color: "#e2e8f0" },
  canBtn: { padding: "10px 22px", border: "1px solid #334155", borderRadius: 12, background: "transparent", color: "#94a3b8", fontWeight: 500, cursor: "pointer", fontSize: 14 },
};
