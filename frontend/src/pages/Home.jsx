import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import {
  Zap, Activity, Radio, BarChart2, Lightbulb,
  Battery, Leaf, DollarSign, Wifi, WifiOff,
  AlertTriangle, Wind, TreePine, Calendar, CreditCard,
  Sun, TrendingUp
} from "lucide-react";

const API = "http://localhost:8000";

const theme = {
  bg:      "#0a0f1e",
  card:    "#111827",
  border:  "#1f2937",
  accent:  "#10b981",
  accent2: "#3b82f6",
  accent3: "#f59e0b",
  danger:  "#ef4444",
  text:    "#f9fafb",
  muted:   "#6b7280",
};

function formatEnergie(kwh) {
  if (kwh === null || kwh === undefined || isNaN(kwh)) return "--";
  if (kwh === 0) return "0.00 kWh";
  if (kwh >= 1000) return `${(kwh / 1000).toFixed(2)} MWh`;
  return `${Number(kwh).toFixed(2)} kWh`;
}

function formatEnergieRaw(kwh) {
  if (kwh === null || kwh === undefined || isNaN(kwh)) return "--";
  return `${(kwh / 1000).toFixed(2)} MWh`;
}

function MetricCard({ title, value, unit, color, icon: Icon, subtitle }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #111827, #1f2937)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16, padding: "20px",
      display: "flex", flexDirection: "column", gap: 10,
      borderLeft: `3px solid ${color}`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${color}15`, pointerEvents: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: theme.muted, fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ color: color, fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
              {value !== undefined && value !== null && value !== "--" ? value : "--"}
            </span>
            {unit && <span style={{ color: theme.muted, fontSize: 13 }}>{unit}</span>}
          </div>
          {subtitle && <div style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{subtitle}</div>}
        </div>
        <div style={{ width: 42, height: 42, background: `${color}20`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, data, color, unit }) {
  const formatTime = iso => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
  };
  return (
    <div style={{ background: "linear-gradient(135deg, #111827, #1f2937)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ color: theme.text, margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
        <span style={{ background: `${color}20`, color: color, fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>Temps reel</span>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: "center", color: theme.muted, padding: "60px 0", fontSize: 13 }}>
          Aucune donnee disponible
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fill: theme.muted, fontSize: 10 }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: theme.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1f2937", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12 }}
              labelFormatter={formatTime}
              formatter={v => [`${Number(v).toFixed(2)} ${unit}`, title]}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function Home({ source }) {
  const [realtime,      setRealtime]      = useState(null);
  const [statut,        setStatut]        = useState(null);
  const [histTension,   setHistTension]   = useState([]);
  const [histPuissance, setHistPuissance] = useState([]);
  const [lastUpdate,    setLastUpdate]    = useState(null);
  const [alertes,       setAlertes]       = useState([]);
  const [co2,           setCo2]           = useState(null);
  const [cout,          setCout]          = useState(null);

  const isSolaire = source === "solaire";

  const checkAlertes = useCallback((data) => {
    if (isSolaire) { setAlertes([]); return; }
    const a = [];
    if (data.tension < 207 || data.tension > 233)
      a.push(`Tension hors plage : ${Number(data.tension).toFixed(2)} V`);
    if (data.facteur_puissance !== -1 && data.facteur_puissance < 0.85)
      a.push(`Facteur de puissance bas : ${Number(data.facteur_puissance).toFixed(2)}`);
    if (data.frequence < 49.5 || data.frequence > 50.5)
      a.push(`Frequence hors plage : ${Number(data.frequence).toFixed(2)} Hz`);
    setAlertes(a);
  }, [isSolaire]);

  const fetchData = useCallback(async () => {
    const controller = new AbortController();
    const signal = controller.signal;
    try {
      const [rt, st, ht, hp, co2Data, coutData, bilanData] = await Promise.all([
        fetch(`${API}/api/realtime?source=${source}`, { signal }).then(r => r.json()),
        fetch(`${API}/api/statut?source=${source}`, { signal }).then(r => r.json()),
        fetch(`${API}/api/historique?field=tension&periode=1h&source=${source}`, { signal }).then(r => r.json()),
        fetch(`${API}/api/historique?field=puissance_active&periode=1h&source=${source}`, { signal }).then(r => r.json()),
        fetch(`${API}/api/co2?periode=24h&source=${source}`, { signal }).then(r => r.json()),
        // ✅ FIX : pour le site (total), le coût ONEE depend du RESEAU (total - solaire).
        // Pour le solaire, /api/cout = energie produite par periode (base des economies).
        isSolaire
          ? fetch(`${API}/api/cout?source=solaire&periode=24h`, { signal }).then(r => r.json())
          : fetch(`${API}/api/bilan/cout/detail?periode=24h`, { signal }).then(r => r.json()),
        // ✅ FIX : bilan global -> co2_reseau / kwh_reseau pour le site (CO2 base sur le reseau, pas le total)
        fetch(`${API}/api/bilan?periode=24h`, { signal }).then(r => r.json()),
      ]);
      if (!rt.error) { setRealtime(rt); checkAlertes(rt); }
      setStatut(st);
      setHistTension(Array.isArray(ht) ? ht : []);
      setHistPuissance(Array.isArray(hp) ? hp : []);
      // ✅ FIX : pour le site, CO2/energie/arbres basés sur le RESEAU (bilan), pas le total
      if (!isSolaire && !bilanData.erreur) {
        setCo2({
          co2_kg:            bilanData.co2_reseau,
          co2_tonnes:        Number((bilanData.co2_reseau / 1000).toFixed(4)),
          energie_kwh:       bilanData.kwh_total,
          equivalent_arbres: Number((bilanData.co2_reseau / 21.7).toFixed(1)),
        });
      } else {
        setCo2(co2Data);
      }
      setCout(coutData.erreur ? null : coutData);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch(e) {
      if (e.name !== "AbortError") console.error(e);
    }
    return controller;
  }, [source, checkAlertes]);

  useEffect(() => {
    let controller;
    const run = async () => { controller = await fetchData(); };
    run();
    const interval = setInterval(fetchData, 5000);
    return () => {
      clearInterval(interval);
      if (controller) controller.abort();
    };
  }, [source, fetchData]);

  const connecte = statut?.statut === "connecte";

  // ✅ Items coût site — basé sur /api/bilan/cout/detail (kwh_total/cout_total = réseau réel)
  const itemsCoutSite = [
    { label: "HN (07h-17h) — Energie", value: formatEnergie(cout?.kwh_HN),              color: "#10b981", Icon: Battery    },
    { label: "HN — Cout TTC",          value: `${cout?.cout_HN?.toFixed(2) ?? "--"} DH`, color: "#10b981", Icon: DollarSign },
    { label: "HC (23h-07h) — Energie", value: formatEnergie(cout?.kwh_HC),              color: "#3b82f6", Icon: Battery    },
    { label: "HC — Cout TTC",          value: `${cout?.cout_HC?.toFixed(2) ?? "--"} DH`, color: "#3b82f6", Icon: DollarSign },
    { label: "HP (17h-21h) — Energie", value: formatEnergie(cout?.kwh_HP),              color: "#ef4444", Icon: Battery    },
    { label: "HP — Cout TTC",          value: `${cout?.cout_HP?.toFixed(2) ?? "--"} DH`, color: "#ef4444", Icon: DollarSign },
    { label: "Total reseau (24h)",     value: formatEnergie(cout?.kwh_total),           color: "#f59e0b", Icon: Battery   },
    { label: "Total cout (24h)",       value: `${cout?.cout_total?.toFixed(2) ?? "--"} DH`, color: "#f59e0b", Icon: CreditCard },
  ];

  // ✅ Items coût solaire — économies par période
  const itemsCoutSolaire = [
    { label: "HN — Energie produite",  value: formatEnergie(cout?.kwh_HN),              color: "#10b981", Icon: Sun        },
    { label: "HN — Economies TTC",     value: `${cout?.cout_HN?.toFixed(2) ?? "--"} DH`, color: "#10b981", Icon: TrendingUp },
    { label: "HC — Energie produite",  value: formatEnergie(cout?.kwh_HC),              color: "#3b82f6", Icon: Sun        },
    { label: "HC — Economies TTC",     value: `${cout?.cout_HC?.toFixed(2) ?? "--"} DH`, color: "#3b82f6", Icon: TrendingUp },
    { label: "HP — Energie produite",  value: formatEnergie(cout?.kwh_HP),              color: "#f59e0b", Icon: Sun        },
    { label: "HP — Economies TTC",     value: `${cout?.cout_HP?.toFixed(2) ?? "--"} DH`, color: "#f59e0b", Icon: TrendingUp },
    { label: "Total economies jour",   value: `${cout?.cout_jour?.toFixed(2) ?? "--"} DH`, color: "#10b981", Icon: DollarSign },
    { label: "Total economies mois",   value: `${cout?.cout_mois?.toFixed(2) ?? "--"} DH`, color: "#10b981", Icon: Calendar  },
  ];

  const itemsCout = isSolaire ? itemsCoutSolaire : itemsCoutSite;

  return (
    <div style={{ color: theme.text }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: theme.text }}>
            {isSolaire ? "Production Solaire" : "Vue generale"}
          </h1>
          <p style={{ margin: "4px 0 0", color: theme.muted, fontSize: 13 }}>
            {isSolaire
              ? "PM5300 Solaire · Production energetique · Temps reel"
              : "Site Agricole — PM5300 · Consommation · Mise a jour toutes les 5 secondes"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {lastUpdate && (
            <span style={{ color: theme.muted, fontSize: 12, background: "rgba(255,255,255,0.04)", padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 6 }}>
              <Radio size={12} />{lastUpdate}
            </span>
          )}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: connecte ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${connecte ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 20, padding: "7px 16px",
          }}>
            {connecte ? <Wifi size={14} color="#10b981" /> : <WifiOff size={14} color="#ef4444" />}
            <span style={{ fontSize: 12, fontWeight: 600, color: connecte ? theme.accent : theme.danger }}>
              PM5300 {isSolaire ? "Solaire" : "Site"} {connecte ? "Connecte" : "Deconnecte"}
            </span>
          </div>
        </div>
      </div>

      {/* ALERTES */}
      {!isSolaire && alertes.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 24, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <AlertTriangle size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, color: theme.danger, marginBottom: 6, fontSize: 13 }}>{alertes.length} alerte(s) detectee(s)</div>
            {alertes.map((a, i) => <div key={i} style={{ color: "#fca5a5", fontSize: 12, marginTop: 3 }}>• {a}</div>)}
          </div>
        </div>
      )}

      {/* CARTES METRIQUES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 24 }}>
        <MetricCard title="Tension"           value={realtime?.tension?.toFixed(2)}          unit="V"   color="#10b981" icon={Zap}      subtitle={isSolaire ? "Sortie onduleur" : "Reseau monophase"} />
        <MetricCard title="Courant"           value={realtime?.courant?.toFixed(2)}          unit="A"   color="#3b82f6" icon={Activity} />
        <MetricCard title="Frequence"         value={realtime?.frequence?.toFixed(2)}        unit="Hz"  color="#f59e0b" icon={Radio}    subtitle="Nominal : 50 Hz" />
        <MetricCard title="Facteur Puissance" value={realtime?.facteur_puissance === -1 ? "N/A" : realtime?.facteur_puissance?.toFixed(2)} unit="" color="#8b5cf6" icon={BarChart2} subtitle="Min : 0.85" />
        <MetricCard title={isSolaire ? "Puissance Produite" : "Puissance Active"} value={realtime?.puissance_active?.toFixed(2)} unit="kW" color="#ec4899" icon={isSolaire ? Sun : Lightbulb} />
        <MetricCard
          title={isSolaire ? "Energie Produite" : "Energie Active"}
          value={(realtime?.energie_active != null && !isNaN(realtime.energie_active))
            ? (realtime.energie_active / 1000).toFixed(2)
            : "--"}
          unit="MWh"
          color="#06b6d4"
          icon={Battery}
        />
      </div>

      {/* GRAPHIQUES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 16, marginBottom: 24 }}>
        <ChartCard title="Tension (V) — Derniere heure" data={histTension} color="#10b981" unit="V" />
        <ChartCard
          title={isSolaire ? "Puissance Produite (kW) — Derniere heure" : "Puissance Active (kW) — Derniere heure"}
          data={histPuissance}
          color={isSolaire ? "#f59e0b" : "#3b82f6"}
          unit="kW"
        />
      </div>

      {/* CO2 + COUT */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>

        {/* CO2 */}
        <div style={{ background: "linear-gradient(135deg, #111827, #1f2937)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Leaf size={18} color="#10b981" />
            </div>
            <div>
              <div style={{ color: theme.text, fontWeight: 600, fontSize: 14 }}>{isSolaire ? "Impact Environnemental" : "Impact CO2"}</div>
              <div style={{ color: theme.muted, fontSize: 11 }}>{isSolaire ? "Dernieres 24h — CO2 evite grace au solaire" : "Dernieres 24h — Facteur ONEE 0.233 kg/kWh"}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {(isSolaire ? [
              { label: "CO2 evite",        value: `${co2?.co2_kg ?? "--"} kg`,         color: "#10b981", Icon: Leaf       },
              { label: "En tonnes",        value: `${co2?.co2_tonnes ?? "--"} t`,      color: "#10b981", Icon: TrendingUp },
              { label: "Energie produite", value: formatEnergie(co2?.energie_kwh),     color: "#f59e0b", Icon: Sun        },
              { label: "Arbres sauves",    value: `${co2?.equivalent_arbres ?? "--"}`, color: "#10b981", Icon: TreePine   },
            ] : [
              { label: "CO2 emis",       value: `${co2?.co2_kg ?? "--"} kg`,         color: "#ef4444", Icon: Wind      },
              { label: "En tonnes",      value: `${co2?.co2_tonnes ?? "--"} t`,      color: "#f59e0b", Icon: Activity  },
              { label: "Energie source", value: formatEnergie(co2?.energie_kwh),     color: "#3b82f6", Icon: Zap       },
              { label: "Arbres planter", value: `${co2?.equivalent_arbres ?? "--"}`, color: "#10b981", Icon: TreePine  },
            ]).map((item, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${item.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <item.Icon size={16} color={item.color} />
                </div>
                <div>
                  <div style={{ color: item.color, fontSize: 15, fontWeight: 700 }}>{item.value}</div>
                  <div style={{ color: theme.muted, fontSize: 10, marginTop: 2 }}>{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ✅ COUT / ECONOMIES — Tarifs réels ONEE HN/HC/HP */}
        <div style={{ background: "linear-gradient(135deg, #111827, #1f2937)", border: `1px solid ${isSolaire ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`, borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: isSolaire ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isSolaire ? <TrendingUp size={18} color="#10b981" /> : <DollarSign size={18} color="#f59e0b" />}
            </div>
            <div>
              <div style={{ color: theme.text, fontWeight: 600, fontSize: 14 }}>
                {isSolaire ? "Economies realisees" : "Cout energetique — 24h"}
              </div>
              <div style={{ color: theme.muted, fontSize: 11 }}>
                {isSolaire
                  ? "Economies exactes par periode tarifaire MT ONEE"
                  : "Tarification MT ONEE : HN 1.010 / HC 0.740 / HP 1.416 DH/kWh TTC"
                }
              </div>
            </div>
          </div>

          {/* Séparateur périodes */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {[
              { label: "HN 1.010", color: "#10b981" },
              { label: "HC 0.740", color: "#3b82f6" },
              { label: "HP 1.416", color: "#ef4444" },
            ].map((t, i) => (
              <span key={i} style={{ background: `${t.color}15`, color: t.color, fontSize: 10, padding: "2px 8px", borderRadius: 20, border: `1px solid ${t.color}30`, fontWeight: 600 }}>
                {t.label} DH/kWh
              </span>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {itemsCout.map((item, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${item.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <item.Icon size={14} color={item.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: item.color, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.value}</div>
                  <div style={{ color: theme.muted, fontSize: 9, marginTop: 1 }}>{item.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABLEAU */}
      <div style={{ background: "linear-gradient(135deg, #111827, #1f2937)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <BarChart2 size={18} color={theme.muted} />
          <h3 style={{ color: theme.text, margin: 0, fontSize: 14, fontWeight: 600 }}>Toutes les grandeurs — Derniere mesure</h3>
        </div>
        {!realtime ? (
          <div style={{ textAlign: "center", color: theme.muted, padding: "30px 0", fontSize: 13 }}>En attente des donnees...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {Object.entries({
              "Tension":               [`${realtime.tension?.toFixed(2) ?? "N/A"} V`],
              "Courant":               [`${realtime.courant?.toFixed(2) ?? "N/A"} A`],
              "Frequence":             [`${realtime.frequence?.toFixed(2) ?? "N/A"} Hz`],
              "Facteur Puissance":     [realtime.facteur_puissance === -1 ? "N/A" : (realtime.facteur_puissance?.toFixed(2) ?? "N/A")],
              [isSolaire ? "Puissance Produite" : "Puissance Active"]: [`${realtime.puissance_active?.toFixed(2) ?? "N/A"} kW`],
              "Puissance Reactive":    [`${realtime.puissance_reactive?.toFixed(2) ?? "N/A"} kVAR`],
              "Puissance Apparente":   [`${realtime.puissance_apparente?.toFixed(2) ?? "N/A"} kVA`],
              [isSolaire ? "Energie Produite" : "Energie Active"]: [formatEnergieRaw(realtime.energie_active)],
              "Energie Reactive":      [`${(realtime.energie_reactive / 1000)?.toFixed(2) ?? "N/A"} MVARh`],
              "Energie Apparente":     [`${(realtime.energie_apparente / 1000)?.toFixed(2) ?? "N/A"} MVAh`],
            }).map(([key, [val]]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: theme.muted, fontSize: 12 }}>{key}</span>
                <span style={{ color: theme.text, fontWeight: 600, fontSize: 13 }}>{val ?? "N/A"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
