import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import {
  Truck, Users, Wrench, Package, DollarSign, LayoutDashboard, Plus, Trash2, X,
  AlertTriangle, Pencil, Check, Loader2, Gauge, Fuel, FileText, Printer, Receipt, TrendingUp, TrendingDown, Building2, LayoutGrid, ClipboardPaste, LogOut,
} from "lucide-react";

/* ---------------------------------------------------------------
   TOKENS
   bg: asfalto oscuro / accent: colores corporativos SiderAgro S.A
--------------------------------------------------------------- */
/* Paleta provisoria clara, inspirada en el rubro de SiderAgro S.A (acero + agro).
   Reemplazar los acentos por los hexadecimales exactos del logo cuando se confirmen. */
const C = {
  bg: "#F5F3EF",
  surface: "#FFFFFF",
  raised: "#EAF3EA",
  border: "#E3DFD8",
  text: "#22261F",
  muted: "#6E766E",
  yellow: "#2F6B2F",   // verde acero (acento primario / alerta próxima)
  red: "#7A0F13",      // rojo oscuro (alerta vencida / gastos)
  green: "#4F7942",    // verde agro (acento secundario / ingresos / consumo)
};

const TIPOS_FRETE = ["Local", "Doble", "Remisión", "Viaje", "Segunda Entrega", "Devolución"];
const TIPOS_CUSTO = ["Peajes", "Consumición", "Hospedaje", "Estibaje", "Tape", "Repuestos", "Cubierta", "Mano de Obra", "Otros"];
const ESTADOS_VEICULO = ["Activo", "Inactivo", "Taller"];
const ESTADOS_MOTORISTA = ["Activo", "Inactivo"];
const ESTADOS_VIAGEM = ["En curso", "Finalizado"];
const ESTADOS_PEDIDO = ["Pendiente", "Entregado", "Rechazado", "Devuelto"];

/* Tarifa (%) que se aplica al valor de la factura de cada pedido, según su tipo de flete.
   Editable por el usuario en la pantalla de Pedidos; 100% por defecto hasta que se ajuste. */
const DEFAULT_TARIFAS = Object.fromEntries(TIPOS_FRETE.map((t) => [t, 100]));

/* Ingreso de flete generado por un pedido: valor de la factura × tarifa del tipo de flete. */
function freightRevenue(pedido, tarifas) {
  const pct = Number((tarifas && tarifas[pedido.tipoFlete]) ?? 100);
  return Number(pedido.valorFatura || 0) * (pct / 100);
}

/* Combina abastecimentos por veículo (ordenados por KM) para calcular
   km rodado, consumo (km/l) e custo por km entre um abastecimento e o anterior. */
function withConsumo(abastecimentos) {
  const byPlaca = {};
  abastecimentos.forEach((a) => { (byPlaca[a.placa] = byPlaca[a.placa] || []).push(a); });
  const result = [];
  Object.values(byPlaca).forEach((list) => {
    const sorted = [...list].sort((a, b) => Number(a.km || 0) - Number(b.km || 0));
    sorted.forEach((a, i) => {
      const prev = sorted[i - 1];
      const kmRodado = prev && a.km && prev.km ? Number(a.km) - Number(prev.km) : null;
      const consumo = kmRodado && a.litros ? kmRodado / Number(a.litros) : null;
      const custoPorKm = kmRodado && a.valor ? Number(a.valor) / kmRodado : null;
      result.push({ ...a, kmRodado, consumo, custoPorKm });
    });
  });
  return result;
}
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const SEED_VEICULOS = [
  { id: 1, placa: "AAOP217", peso: 32000, motorista: "Jorge Baez", kmAtual: 1847680, dinatran: "2027-01-30" },
  { id: 2, placa: "AAUC019", peso: 5000, motorista: "Juan Lopez", kmAtual: 29361, dinatran: "2027-03-17" },
  { id: 3, placa: "AASN159", peso: 5000, motorista: "Carlos Lencina", kmAtual: 33696, dinatran: "2026-11-04" },
  { id: 4, placa: "CEU654", peso: 12000, motorista: "Sabino Escobar", kmAtual: 714808, dinatran: "2027-07-03" },
  { id: 5, placa: "AAFS891", peso: 16500, motorista: "Outro", kmAtual: 280060, dinatran: "" },
  { id: 6, placa: "ABAD112", peso: 5000, motorista: "Victor Amarilla", kmAtual: 2031, dinatran: "2027-05-22" },
  { id: 7, placa: "ABAD083", peso: 5000, motorista: "Alejandro Armoa", kmAtual: 2049, dinatran: "2027-05-22" },
  { id: 8, placa: "CEN667", peso: null, motorista: null, kmAtual: null, dinatran: "" },
  { id: 9, placa: "AAOP218", peso: null, motorista: null, kmAtual: null, dinatran: "" },
];

const SEED_MOTORISTAS = ["Jorge Baez", "Juan Lopez", "Carlos Lencina", "Sabino Escobar", "Victor Amarilla", "Alejandro Armoa"]
  .map((nome, i) => ({ id: i + 1, nome, telefone: "" }));

const SEED_MANUTENCOES = [
  { id: 1, placa: "AAOP217", data: "2026-03-20", kmUltima: 1839567, kmProxima: 1849567 },
  { id: 2, placa: "AAUC019", data: "2026-07-07", kmUltima: 29680, kmProxima: 35000 },
  { id: 3, placa: "AASN159", data: "2026-05-05", kmUltima: 30187, kmProxima: 35187 },
  { id: 4, placa: "CEU654", data: "2026-01-06", kmUltima: 709121, kmProxima: 717121 },
  { id: 5, placa: "AAFS891", data: "", kmUltima: 274683, kmProxima: 284683 },
  { id: 6, placa: "ABAD112", data: "", kmUltima: null, kmProxima: 5000 },
  { id: 7, placa: "ABAD083", data: "", kmUltima: null, kmProxima: 5000 },
];

const fmtNum = (n) => (n === null || n === undefined || n === "" ? "—" : Number(n).toLocaleString("es-PY"));
const fmtMoney = (n) => `₲ ${Math.round(Number(n || 0)).toLocaleString("es-PY")}`;
const uid = () => Date.now() + Math.random();

/* Pega texto copiado desde una planilla (columnas separadas por tabulaciones) y arma filas.
   campos: nombres de campo en el mismo orden que las columnas copiadas. */
async function pegarDesdeExcel(setRows, campos, emptyRow) {
  try {
    const texto = await navigator.clipboard.readText();
    const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lineas.length === 0) return;
    const nuevas = lineas.map((linea) => {
      const cols = linea.split("\t");
      const base = emptyRow ? emptyRow() : {};
      campos.forEach((campo, i) => { if (cols[i] !== undefined) base[campo] = cols[i].trim(); });
      return base;
    });
    setRows(nuevas);
  } catch (e) {
    alert("No se pudo leer el portapapeles. Copiá las celdas desde Excel (Ctrl+C) y volvé a tocar \"Pegar del Excel\".");
  }
}

/* Días que faltan para una fecha de vencimiento (negativo si ya venció). */
function diasParaVencer(dataStr) {
  if (!dataStr) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataStr + "T00:00:00");
  return Math.round((venc - hoje) / 86400000);
}

/* ---------------------------------------------------------------
   STORAGE
--------------------------------------------------------------- */
async function loadKey(key, seed) {
  try {
    const res = await window.storage.get(key);
    return res ? JSON.parse(res.value) : seed;
  } catch (e) {
    try { await window.storage.set(key, JSON.stringify(seed)); } catch (_) {}
    return seed;
  }
}
async function saveKey(key, data) {
  try {
    await window.storage.set(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Error al guardar", key, e);
    return false;
  }
}

/* ---------------------------------------------------------------
   ATOMS
--------------------------------------------------------------- */
function EstadoBadge({ estado }) {
  const esVerde = estado === "Activo" || estado === "Finalizado" || estado === "Entregado";
  const esRojo = estado === "Taller" || estado === "Rechazado" || estado === "Devuelto";
  const color = esVerde ? C.green : esRojo ? C.red : C.muted;
  const bg = esVerde ? "rgba(79,121,66,0.12)" : esRojo ? "rgba(122,15,19,0.10)" : "rgba(110,118,110,0.12)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20,
      fontSize: 11.5, fontWeight: 700, color, background: bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {estado || "—"}
    </span>
  );
}

function PlateChip({ placa }) {
  return (
    <span style={{
      display: "inline-flex", flexDirection: "column", alignItems: "center",
      border: `1.5px solid ${C.yellow}`, borderRadius: 6, overflow: "hidden",
      fontFamily: "ui-monospace, 'JetBrains Mono', monospace", fontWeight: 700,
      background: "#FFFFFF", minWidth: 92,
    }}>
      <span style={{ background: C.yellow, color: "#FFFFFF", fontSize: 8, letterSpacing: 2, width: "100%", textAlign: "center", padding: "1px 0" }}>PY</span>
      <span style={{ color: C.text, fontSize: 13, padding: "2px 8px", letterSpacing: 1 }}>{placa || "—"}</span>
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function Button({ children, onClick, variant = "primary", type = "button", style }) {
  const styles = {
    primary: { background: C.yellow, color: "#FFFFFF", border: "none" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    danger: { background: "transparent", color: C.red, border: `1px solid ${C.red}` },
  };
  return (
    <button type={type} onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13,
      padding: "8px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
      ...styles[variant], ...style,
    }}>{children}</button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: C.muted, fontWeight: 600 }}>
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 6,
  color: C.text, padding: "9px 10px", fontSize: 14, fontFamily: "inherit", outline: "none",
};

function EmptyState({ icon: Icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: C.muted }}>
      <Icon size={30} style={{ marginBottom: 10, opacity: 0.6 }} />
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
      <div>
        <h1 style={{
          fontFamily: "'Oswald','Arial Narrow',sans-serif", textTransform: "uppercase",
          letterSpacing: 1.5, fontSize: 26, margin: 0, color: C.text, fontWeight: 700,
        }}>{title}</h1>
        {subtitle && <div style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function ConfirmRow({ onConfirm, onCancel }) {
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: C.muted }}>¿Eliminar?</span>
      <button onClick={onConfirm} style={{ background: C.red, border: "none", borderRadius: 5, color: "#fff", padding: "4px 8px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Sí</button>
      <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, color: C.muted, padding: "4px 8px", cursor: "pointer", fontSize: 12 }}>No</button>
    </span>
  );
}

/* ---------------------------------------------------------------
   APP
--------------------------------------------------------------- */
export default function App() {
  const [loading, setLoading] = useState(true);
  const tieneAuth = typeof window !== "undefined" && !!window.auth;
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(tieneAuth);

  useEffect(() => {
    if (!tieneAuth) return;
    window.auth.getSession().then((s) => { setSesion(s); setCargandoSesion(false); });
    const unsub = window.auth.onAuthChange((s) => setSesion(s));
    return () => { if (unsub) unsub(); };
  }, []);

  const [tab, setTab] = useState("dashboard");
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [viagens, setViagens] = useState([]);
  const [custos, setCustos] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [abastecimentos, setAbastecimentos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [tarifas, setTarifas] = useState(DEFAULT_TARIFAS);
  const [sucursales, setSucursales] = useState(["Casa Matriz"]);
  const [avisoDinatranOculto, setAvisoDinatranOculto] = useState(false);

  useEffect(() => {
    (async () => {
      const [v, m, vi, c, ma, ab, pe, ta, su] = await Promise.all([
        loadKey("veiculos", SEED_VEICULOS),
        loadKey("motoristas", SEED_MOTORISTAS),
        loadKey("viagens", []),
        loadKey("custos", []),
        loadKey("manutencoes", SEED_MANUTENCOES),
        loadKey("abastecimentos", []),
        loadKey("pedidos", []),
        loadKey("tarifasFrete", DEFAULT_TARIFAS),
        loadKey("sucursales", ["Casa Matriz"]),
      ]);
      let viFinal = vi;
      let maxNum = Math.max(0, ...vi.map((x) => x.numero || 0));
      if (vi.some((x) => !x.numero)) {
        viFinal = vi.map((x) => (x.numero ? x : { ...x, numero: ++maxNum }));
        saveKey("viagens", viFinal);
      }
      let vFinal = v;
      if (v.some((x) => !x.estado)) {
        vFinal = v.map((x) => (x.estado ? x : { ...x, estado: "Activo" }));
        saveKey("veiculos", vFinal);
      }
      let mFinal = m;
      if (m.some((x) => !x.estado)) {
        mFinal = m.map((x) => (x.estado ? x : { ...x, estado: "Activo" }));
        saveKey("motoristas", mFinal);
      }
      setVeiculos(vFinal); setMotoristas(mFinal); setViagens(viFinal); setCustos(c); setManutencoes(ma); setAbastecimentos(ab);
      setPedidos(pe); setTarifas({ ...DEFAULT_TARIFAS, ...ta });
      setSucursales(su && su.length ? su : ["Casa Matriz"]);
      setLoading(false);
    })();
  }, []);

  const persist = useCallback((key, setter, data) => {
    setter(data);
    saveKey(key, data);
  }, []);

  const navGroups = [
    {
      section: null,
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "viagens", label: "Viajes", icon: Truck },
        { id: "pedidos", label: "Pedidos", icon: Receipt },
      ],
    },
    {
      section: "Cadastros",
      items: [
        { id: "veiculos", label: "Vehículos", icon: Package },
        { id: "motoristas", label: "Choferes", icon: Users },
      ],
    },
    {
      section: "Operación",
      items: [
        { id: "custos", label: "Costos", icon: DollarSign },
        { id: "abastecimento", label: "Abastecimientos", icon: Fuel },
        { id: "manutencao", label: "Mantenimiento", icon: Wrench },
        { id: "relatorios", label: "Reportes", icon: FileText },
      ],
    },
  ];

  const alertasDinatranApp = veiculos
    .filter((v) => v.dinatran)
    .map((v) => ({ placa: v.placa, dias: diasParaVencer(v.dinatran) }))
    .filter((a) => a.dias <= 30)
    .sort((a, b) => a.dias - b.dias);
  const hayDinatranVencido = alertasDinatranApp.some((a) => a.dias < 0);

  if (tieneAuth && cargandoSesion) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
        <Loader2 className="spin" size={22} style={{ marginRight: 8 }} />
        Verificando sesión...
        <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (tieneAuth && !sesion) {
    return <Login />;
  }

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
        <Loader2 className="spin" size={22} style={{ marginRight: 8 }} />
        Cargando datos...
        <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #A6A198; }
        select { color-scheme: light; }
        @media print {
          body * { visibility: hidden; }
          #report-print-area, #report-print-area * { visibility: visible; }
          #report-print-area { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; color: #111 !important; }
          #report-print-area * { background: #fff !important; color: #111 !important; border-color: #ccc !important; }
        }
      `}</style>

      {alertasDinatranApp.length > 0 && !avisoDinatranOculto && tab !== "veiculos" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "10px 20px", background: hayDinatranVencido ? "rgba(122,15,19,0.10)" : "rgba(47,107,47,0.08)",
          borderBottom: `1px solid ${hayDinatranVencido ? C.red : C.yellow}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: hayDinatranVencido ? C.red : C.yellow }}>
            <AlertTriangle size={16} />
            {alertasDinatranApp.length === 1
              ? `El Dinatran de ${alertasDinatranApp[0].placa} ${alertasDinatranApp[0].dias < 0 ? "está vencido" : `vence en ${alertasDinatranApp[0].dias} días`}.`
              : `${alertasDinatranApp.length} vehículos con Dinatran vencido o por vencer dentro de 1 mes.`}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setTab("veiculos")} style={{ background: "none", border: "none", textDecoration: "underline", color: "inherit", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              Ver vehículos
            </button>
            <button onClick={() => setAvisoDinatranOculto(true)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", display: "flex" }}>
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

      {/* SIDEBAR */}
      <div style={{
        width: 230, flexShrink: 0, background: "#1B2420", borderRight: `1px solid #2A342E`,
        display: "flex", flexDirection: "column", position: "sticky", top: 0, alignSelf: "flex-start", minHeight: "100vh",
      }}>
        <div style={{ padding: "20px 18px 14px" }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: 1, textTransform: "uppercase", color: "#fff" }}>
            Control <span style={{ color: C.yellow }}>de Flota</span>
          </div>
          <div style={{ fontSize: 10.5, color: "#8B9690", marginTop: 2 }}>Registros y Panel de Control</div>
        </div>
        <div style={{ flex: 1, padding: "6px 12px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {navGroups.map((group, gi) => (
            <div key={gi} style={{ marginTop: group.section ? 16 : 0 }}>
              {group.section && (
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6E796F", textTransform: "uppercase", letterSpacing: 0.8, padding: "0 10px", marginBottom: 6 }}>
                  {group.section}
                </div>
              )}
              {group.items.map((n) => {
                const active = tab === n.id;
                return (
                  <button key={n.id} onClick={() => setTab(n.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8,
                    border: "none", cursor: "pointer", textAlign: "left", fontSize: 13.5, fontWeight: 600, width: "100%",
                    background: active ? C.yellow : "transparent",
                    color: active ? "#fff" : "#9AA69C",
                    marginBottom: 2,
                  }}>
                    <n.icon size={16} />
                    {n.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: 14, borderTop: "1px solid #2A342E" }}>
          {tieneAuth && (
            <button
              onClick={() => window.auth.signOut()}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", marginBottom: 10,
                background: "none", border: "1px solid #2A342E", borderRadius: 7, padding: "8px 10px",
                color: "#9AA69C", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              }}
            >
              <LogOut size={14} /> Cerrar sesión
            </button>
          )}
          <div style={{ fontSize: 10, color: "#6E796F" }}>
            Los datos se guardan automáticamente en esta app.
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: "28px 34px", minWidth: 0 }}>
        {tab === "dashboard" && (
          <Dashboard veiculos={veiculos} viagens={viagens} custos={custos} manutencoes={manutencoes} abastecimentos={abastecimentos} pedidos={pedidos} tarifas={tarifas} sucursales={sucursales} />
        )}
        {tab === "veiculos" && (
          <VeiculosPage veiculos={veiculos} setVeiculos={(d) => persist("veiculos", setVeiculos, d)} motoristas={motoristas} sucursales={sucursales} setSucursales={(d) => persist("sucursales", setSucursales, d)} />
        )}
        {tab === "motoristas" && (
          <MotoristasPage motoristas={motoristas} setMotoristas={(d) => persist("motoristas", setMotoristas, d)} />
        )}
        {tab === "viagens" && (
          <ViagensPage
            viagens={viagens} setViagens={(d) => persist("viagens", setViagens, d)}
            veiculos={veiculos} setVeiculos={(d) => persist("veiculos", setVeiculos, d)}
            motoristas={motoristas} sucursales={sucursales}
            pedidos={pedidos} setPedidos={(d) => persist("pedidos", setPedidos, d)}
            custos={custos} setCustos={(d) => persist("custos", setCustos, d)}
            abastecimentos={abastecimentos}
            tarifas={tarifas}
          />
        )}
        {tab === "pedidos" && (
          <PedidosPage pedidos={pedidos} setPedidos={(d) => persist("pedidos", setPedidos, d)} viagens={viagens} veiculos={veiculos} tarifas={tarifas} setTarifas={(d) => persist("tarifasFrete", setTarifas, d)} />
        )}
        {tab === "abastecimento" && (
          <AbastecimentoPage abastecimentos={abastecimentos} setAbastecimentos={(d) => persist("abastecimentos", setAbastecimentos, d)} veiculos={veiculos} viagens={viagens} />
        )}
        {tab === "custos" && (
          <CustosPage custos={custos} setCustos={(d) => persist("custos", setCustos, d)} veiculos={veiculos} />
        )}
        {tab === "manutencao" && (
          <ManutencaoPage manutencoes={manutencoes} setManutencoes={(d) => persist("manutencoes", setManutencoes, d)} veiculos={veiculos} setVeiculos={(d) => persist("veiculos", setVeiculos, d)} />
        )}
        {tab === "relatorios" && (
          <RelatoriosPage veiculos={veiculos} viagens={viagens} custos={custos} abastecimentos={abastecimentos} manutencoes={manutencoes} pedidos={pedidos} tarifas={tarifas} sucursales={sucursales} />
        )}
      </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   DASHBOARD
--------------------------------------------------------------- */
/* ---------------------------------------------------------------
   LOGIN
--------------------------------------------------------------- */
function Login() {
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await window.auth.signIn(usuario, clave);
    } catch (err) {
      setError("Usuario o contraseña incorrectos.");
    }
    setCargando(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <form onSubmit={entrar} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, width: 320 }}>
        <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 20, textTransform: "uppercase", marginBottom: 4, color: C.text }}>
          Control <span style={{ color: C.yellow }}>de Flota</span>
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 20 }}>Ingresá tu usuario y contraseña para continuar.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Usuario (email)">
            <input type="email" style={inputStyle} value={usuario} onChange={(e) => setUsuario(e.target.value)} required autoFocus />
          </Field>
          <Field label="Contraseña">
            <input type="password" style={inputStyle} value={clave} onChange={(e) => setClave(e.target.value)} required />
          </Field>
          {error && <div style={{ color: C.red, fontSize: 12.5 }}>{error}</div>}
          <Button type="submit" style={{ justifyContent: "center", marginTop: 4 }}>{cargando ? "Ingresando..." : "Ingresar"}</Button>
        </div>
      </form>
    </div>
  );
}

function Dashboard({ veiculos: veiculosProp, viagens: viagensProp, custos: custosProp, manutencoes, abastecimentos: abastecimentosProp, pedidos: pedidosProp, tarifas, sucursales }) {
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");

  const mesDeData = (d) => (d ? MESES[new Date(d + "T00:00:00").getMonth()] : null);
  const sucursalDelVehiculo = (placa) => veiculosProp.find((v) => v.placa === placa)?.sucursal || "";

  const veiculos = veiculosProp.filter((v) => (!filtroPlaca || v.placa === filtroPlaca) && (!filtroSucursal || v.sucursal === filtroSucursal));
  const viagens = viagensProp.filter((v) =>
    (!filtroPlaca || v.placa === filtroPlaca) &&
    (!filtroMes || v.mes === filtroMes) &&
    (!filtroSucursal || (v.sucursal || sucursalDelVehiculo(v.placa)) === filtroSucursal)
  );
  const viagensIds = new Set(viagens.map((v) => v.id));
  const custos = custosProp.filter((c) =>
    (!filtroPlaca || c.placa === filtroPlaca) &&
    (!filtroMes || mesDeData(c.data) === filtroMes) &&
    (!filtroSucursal || sucursalDelVehiculo(c.placa) === filtroSucursal)
  );
  const abastecimentos = abastecimentosProp.filter((a) =>
    (!filtroPlaca || a.placa === filtroPlaca) &&
    (!filtroMes || mesDeData(a.data) === filtroMes) &&
    (!filtroSucursal || sucursalDelVehiculo(a.placa) === filtroSucursal)
  );
  const pedidos = pedidosProp.filter((p) => viagensIds.has(p.viagemId));
  const hayFiltros = filtroPlaca || filtroMes || filtroSucursal;

  const totalCustosGerais = custos.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalCombustivel = abastecimentos.reduce((s, a) => s + Number(a.valor || 0), 0);
  const totalGasto = totalCustosGerais + totalCombustivel;
  const totalViagens = viagens.length;

  const totalIngreso = pedidos.reduce((s, p) => s + freightRevenue(p, tarifas), 0);
  const resultado = totalIngreso - totalGasto;
  const comparativoIngresoGasto = [
    { name: "Ingresos", value: totalIngreso },
    { name: "Gastos", value: totalGasto },
  ];

  const comConsumo = useMemo(() => withConsumo(abastecimentos), [abastecimentos]);

  const consumoPorVeiculo = useMemo(() => {
    const map = {};
    comConsumo.forEach((a) => {
      if (a.consumo) { if (!map[a.placa]) map[a.placa] = { sum: 0, count: 0 }; map[a.placa].sum += a.consumo; map[a.placa].count++; }
    });
    return Object.entries(map).map(([name, v]) => ({ name, value: +(v.sum / v.count).toFixed(1) }));
  }, [comConsumo]);

  const combustivelPorVeiculo = useMemo(() => {
    const map = {};
    abastecimentos.forEach((a) => { map[a.placa] = (map[a.placa] || 0) + Number(a.valor || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [abastecimentos]);

  const alertas = useMemo(() => {
    return veiculos.map((v) => {
      const m = manutencoes.filter((x) => x.placa === v.placa).sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0];
      if (!m || !m.kmProxima || !v.kmAtual) return null;
      const falta = m.kmProxima - v.kmAtual;
      return { placa: v.placa, falta, vencida: falta <= 0 };
    }).filter(Boolean).sort((a, b) => a.falta - b.falta);
  }, [veiculos, manutencoes]);

  const vencidas = alertas.filter((a) => a.vencida).length;
  const proximas = alertas.filter((a) => !a.vencida && a.falta <= 1000).length;

  const alertasDinatran = useMemo(() => {
    return veiculos
      .filter((v) => v.dinatran)
      .map((v) => ({ placa: v.placa, dias: diasParaVencer(v.dinatran) }))
      .sort((a, b) => a.dias - b.dias);
  }, [veiculos]);
  const dinatranVencidos = alertasDinatran.filter((a) => a.dias < 0).length;
  const dinatranProximos = alertasDinatran.filter((a) => a.dias >= 0 && a.dias <= 30).length;

  const porCategoria = useMemo(() => {
    const map = {};
    custos.forEach((c) => { map[c.tipo] = (map[c.tipo] || 0) + Number(c.valor || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [custos]);

  const porVeiculo = useMemo(() => {
    const map = {};
    custos.forEach((c) => { map[c.placa] = (map[c.placa] || 0) + Number(c.valor || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [custos]);

  const porMes = useMemo(() => {
    const map = {};
    viagens.forEach((v) => { map[v.mes] = (map[v.mes] || 0) + 1; });
    return MESES.filter((m) => map[m]).map((m) => ({ name: m.slice(0, 3), value: map[m] }));
  }, [viagens]);

  const PIE_COLORS = [C.yellow, C.green, "#3B5B92", "#B98A2E", C.red, "#5C8B72", "#8C6A3F", C.muted, "#A0522D", "#7C6A5C"];

  return (
    <div>
      <SectionHeader title="Panel de Control" subtitle="Resumen general de la flota, costos, viajes y mantenimiento" />

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,220px))", gap: 12, alignItems: "flex-end" }}>
          <Field label="Vehículo">
            <select style={inputStyle} value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value)}>
              <option value="">Todos</option>
              {veiculosProp.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
            </select>
          </Field>
          <Field label="Mes">
            <select style={inputStyle} value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
              <option value="">Todos</option>
              {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Sucursal">
            <select style={inputStyle} value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
              <option value="">Todas</option>
              {(sucursales || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {hayFiltros && (
            <Button variant="ghost" onClick={() => { setFiltroPlaca(""); setFiltroMes(""); setFiltroSucursal(""); }}>
              <X size={14} /> Limpiar filtros
            </Button>
          )}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 22 }}>
        <KPI icon={Truck} label="Vehículos registrados" value={veiculos.length} />
        <KPI icon={Package} label="Viajes registrados" value={totalViagens} />
        <KPI icon={Receipt} label="Ingreso por fletes" value={fmtMoney(totalIngreso)} />
        <KPI icon={DollarSign} label="Total general (costos + combustible)" value={fmtMoney(totalGasto)} />
        <KPI icon={Fuel} label="Gasto en combustible" value={fmtMoney(totalCombustivel)} />
        <KPI icon={resultado >= 0 ? TrendingUp : TrendingDown} label="Resultado (ingresos − gastos)" value={fmtMoney(resultado)} highlight={resultado >= 0 ? "green" : "red"} />
        <KPI icon={AlertTriangle} label="Mantenimiento vencido" value={vencidas} highlight={vencidas > 0 ? "red" : null} />
        <KPI icon={Gauge} label="Mantenimiento próximo (≤1000km)" value={proximas} highlight={proximas > 0 ? "yellow" : null} />
        <KPI icon={FileText} label="Dinatran vencido" value={dinatranVencidos} highlight={dinatranVencidos > 0 ? "red" : null} />
        <KPI icon={FileText} label="Dinatran próximo (≤30 días)" value={dinatranProximos} highlight={dinatranProximos > 0 ? "yellow" : null} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Card>
          <ChartTitle>Ingresos por fletes vs. gastos</ChartTitle>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparativoIngresoGasto}>
                <CartesianGrid stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 12 }} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  <Cell fill={C.green} />
                  <Cell fill={C.red} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <ChartTitle>Costos por categoría</ChartTitle>
          {porCategoria.length === 0 ? <EmptyState icon={DollarSign} text="Todavía no hay costos registrados." /> : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={porCategoria} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {porCategoria.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <ChartTitle>Costos por vehículo</ChartTitle>
          {porVeiculo.length === 0 ? <EmptyState icon={Truck} text="Todavía no hay costos registrados." /> : (
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porVeiculo}>
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={C.yellow} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <ChartTitle>Viajes por mes</ChartTitle>
          {porMes.length === 0 ? <EmptyState icon={Package} text="Todavía no hay viajes registrados." /> : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={porMes}>
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke={C.yellow} strokeWidth={2.5} dot={{ fill: C.yellow }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <ChartTitle>Alertas de mantenimiento</ChartTitle>
          {alertas.length === 0 ? <EmptyState icon={Wrench} text="Registre el KM actual y el mantenimiento para ver alertas." /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
              {alertas.map((a) => (
                <div key={a.placa} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 7,
                  background: a.vencida ? "rgba(122,15,19,0.10)" : a.falta <= 1000 ? "rgba(47,107,47,0.08)" : C.bg,
                  border: `1px solid ${a.vencida ? C.red : a.falta <= 1000 ? C.yellow : C.border}`,
                }}>
                  <PlateChip placa={a.placa} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: a.vencida ? C.red : a.falta <= 1000 ? C.yellow : C.muted }}>
                    {a.vencida ? `Vencido hace ${fmtNum(Math.abs(a.falta))} km` : `Faltan ${fmtNum(a.falta)} km`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <ChartTitle>Combustible por vehículo (₲)</ChartTitle>
          {combustivelPorVeiculo.length === 0 ? <EmptyState icon={Fuel} text="Todavía no hay cargas de combustible registradas." /> : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={combustivelPorVeiculo}>
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={C.red} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <ChartTitle>Consumo promedio por vehículo (km/l)</ChartTitle>
          {consumoPorVeiculo.length === 0 ? <EmptyState icon={Gauge} text="Registre al menos 2 cargas de combustible por vehículo para calcular el consumo." /> : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consumoPorVeiculo}>
                  <CartesianGrid stroke={C.border} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v} km/l`} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill={C.green} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <ChartTitle>Alertas de vencimiento Dinatran</ChartTitle>
          {alertasDinatran.length === 0 ? <EmptyState icon={FileText} text="Cargá la fecha de vencimiento Dinatran de cada vehículo para ver alertas." /> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8 }}>
              {alertasDinatran.map((a) => (
                <div key={a.placa} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 7,
                  background: a.dias < 0 ? "rgba(122,15,19,0.10)" : a.dias <= 30 ? "rgba(47,107,47,0.08)" : C.bg,
                  border: `1px solid ${a.dias < 0 ? C.red : a.dias <= 30 ? C.yellow : C.border}`,
                }}>
                  <PlateChip placa={a.placa} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: a.dias < 0 ? C.red : a.dias <= 30 ? C.yellow : C.muted }}>
                    {a.dias < 0 ? `Vencido hace ${Math.abs(a.dias)}d` : `Faltan ${a.dias}d`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = { background: C.raised, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, color: C.text };

function ChartTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>{children}</div>;
}

function KPI({ icon: Icon, label, value, highlight }) {
  const color = highlight === "red" ? C.red : highlight === "yellow" ? C.yellow : highlight === "green" ? C.green : C.text;
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ background: C.bg, borderRadius: 8, padding: 10, border: `1px solid ${C.border}` }}>
        <Icon size={19} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'Oswald',sans-serif" }}>{value}</div>
        <div style={{ fontSize: 11.5, color: C.muted }}>{label}</div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------
   VEHÍCULOS
--------------------------------------------------------------- */
function VeiculosPage({ veiculos, setVeiculos, motoristas, sucursales, setSucursales }) {
  const [form, setForm] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [novaSucursal, setNovaSucursal] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const openNew = () => setForm({ id: null, placa: "", peso: "", motorista: "", kmAtual: "", sucursal: sucursales[0] || "", estado: "Activo" });
  const openEdit = (v) => setForm({ ...v });

  const save = (e) => {
    e.preventDefault();
    if (!form.placa) return;
    if (form.id) {
      setVeiculos(veiculos.map((v) => (v.id === form.id ? { ...form } : v)));
    } else {
      setVeiculos([...veiculos, { ...form, id: uid() }]);
    }
    setForm(null);
  };

  const remove = (id) => { setVeiculos(veiculos.filter((v) => v.id !== id)); setConfirmId(null); };

  const addSucursal = () => {
    const nome = novaSucursal.trim();
    if (!nome || sucursales.includes(nome)) return;
    setSucursales([...sucursales, nome]);
    setNovaSucursal("");
  };
  const removeSucursal = (nome) => {
    if (veiculos.some((v) => v.sucursal === nome)) return; // no borra si hay vehículos usándola
    setSucursales(sucursales.filter((s) => s !== nome));
    if (filtroSucursal === nome) setFiltroSucursal("");
  };

  const listados = veiculos.filter((v) => (!filtroSucursal || v.sucursal === filtroSucursal) && (!filtroEstado || v.estado === filtroEstado));

  return (
    <div>
      <SectionHeader title="Vehículos" subtitle={`${veiculos.length} registrados`}
        action={<Button onClick={openNew}><Plus size={15} /> Nuevo vehículo</Button>} />

      <Card style={{ marginBottom: 18 }}>
        <ChartTitle>Sucursales (casa matriz y filiales)</ChartTitle>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          Creá acá las sucursales de la empresa y asigná cada vehículo a una. Así podés saber qué camiones son de la casa matriz y cuáles de cada filial.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {sucursales.map((s) => (
            <span key={s} style={{
              display: "inline-flex", alignItems: "center", gap: 6, background: C.raised,
              border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 10px", fontSize: 12.5, fontWeight: 600,
            }}>
              <Building2 size={13} /> {s}
              <button onClick={() => removeSucursal(s)} title="Eliminar sucursal" style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex" }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, maxWidth: 340 }}>
          <input style={inputStyle} placeholder="Nombre de la nueva sucursal" value={novaSucursal} onChange={(e) => setNovaSucursal(e.target.value)} />
          <Button variant="ghost" onClick={addSucursal}><Plus size={14} /> Agregar</Button>
        </div>
      </Card>

      {form && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <Field label="Chapa">
              <input style={inputStyle} value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} placeholder="AAOP217" required />
            </Field>
            <Field label="Sucursal">
              <select style={inputStyle} value={form.sucursal || ""} onChange={(e) => setForm({ ...form, sucursal: e.target.value })}>
                <option value="">Seleccione</option>
                {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select style={inputStyle} value={form.estado || "Activo"} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_VEICULO.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="Peso (kg)">
              <input type="number" style={inputStyle} value={form.peso ?? ""} onChange={(e) => setForm({ ...form, peso: e.target.value })} />
            </Field>
            <Field label="Chofer">
              <select style={inputStyle} value={form.motorista || ""} onChange={(e) => setForm({ ...form, motorista: e.target.value })}>
                <option value="">Seleccione</option>
                {motoristas.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
              </select>
            </Field>
            <Field label="KM actual">
              <input type="number" style={inputStyle} value={form.kmAtual ?? ""} onChange={(e) => setForm({ ...form, kmAtual: e.target.value })} />
            </Field>
            <Field label="Vencimiento Dinatran">
              <input type="date" style={inputStyle} value={form.dinatran || ""} onChange={(e) => setForm({ ...form, dinatran: e.target.value })} />
            </Field>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Button type="submit"><Check size={14} /> Guardar</Button>
              <Button variant="ghost" onClick={() => setForm(null)}><X size={14} /> Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {veiculos.length > 0 && (
        <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,220px))", gap: 12 }}>
          <Field label="Filtrar por sucursal">
            <select style={inputStyle} value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
              <option value="">Todas</option>
              {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Filtrar por estado">
            <select style={inputStyle} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS_VEICULO.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
        </div>
      )}

      {listados.length === 0 ? <EmptyState icon={Truck} text="No hay vehículos registrados." /> : (
        <Card style={{ padding: 0 }}>
          <Table
            headers={["Chapa", "Estado", "Sucursal", "Peso (kg)", "Chofer", "KM actual", "Vencimiento Dinatran", ""]}
            rows={listados.map((v) => {
              const dias = diasParaVencer(v.dinatran);
              return [
                <PlateChip placa={v.placa} />,
                <EstadoBadge estado={v.estado} />,
                v.sucursal ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Building2 size={13} color={C.muted} /> {v.sucursal}</span> : "—",
                fmtNum(v.peso), v.motorista || "—", fmtNum(v.kmAtual),
                !v.dinatran ? "—" : (
                  <span style={{ fontWeight: 700, color: dias < 0 ? C.red : dias <= 30 ? C.yellow : C.text }}>
                    {v.dinatran.split("-").reverse().join("/")}
                    {dias < 0 ? " (vencido)" : dias <= 30 ? ` (${dias}d)` : ""}
                  </span>
                ),
                <RowActions onEdit={() => openEdit(v)} onDelete={() => setConfirmId(v.id)} confirming={confirmId === v.id} onConfirm={() => remove(v.id)} onCancel={() => setConfirmId(null)} />,
              ];
            })}
          />
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   CHOFERES
--------------------------------------------------------------- */
function MotoristasPage({ motoristas, setMotoristas }) {
  const [form, setForm] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const save = (e) => {
    e.preventDefault();
    if (!form.nome) return;
    if (form.id) setMotoristas(motoristas.map((m) => (m.id === form.id ? { ...form } : m)));
    else setMotoristas([...motoristas, { ...form, id: uid() }]);
    setForm(null);
  };
  const remove = (id) => { setMotoristas(motoristas.filter((m) => m.id !== id)); setConfirmId(null); };

  return (
    <div>
      <SectionHeader title="Choferes" subtitle={`${motoristas.length} registrados`}
        action={<Button onClick={() => setForm({ id: null, nome: "", telefone: "", estado: "Activo" })}><Plus size={15} /> Nuevo chofer</Button>} />

      {form && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <Field label="Nombre"><input style={inputStyle} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></Field>
            <Field label="Teléfono"><input style={inputStyle} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
            <Field label="Estado">
              <select style={inputStyle} value={form.estado || "Activo"} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_MOTORISTA.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Button type="submit"><Check size={14} /> Guardar</Button>
              <Button variant="ghost" onClick={() => setForm(null)}><X size={14} /> Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {motoristas.length === 0 ? <EmptyState icon={Users} text="No hay choferes registrados." /> : (
        <Card style={{ padding: 0 }}>
          <Table
            headers={["Nombre", "Estado", "Teléfono", ""]}
            rows={motoristas.map((m) => [
              m.nome, <EstadoBadge estado={m.estado || "Activo"} />, m.telefone || "—",
              <RowActions onEdit={() => setForm({ ...m })} onDelete={() => setConfirmId(m.id)} confirming={confirmId === m.id} onConfirm={() => remove(m.id)} onCancel={() => setConfirmId(null)} />,
            ])}
          />
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   VIAJES
--------------------------------------------------------------- */
function ViagensPage({ viagens, setViagens, veiculos, setVeiculos, motoristas, sucursales, pedidos, setPedidos, custos, setCustos, abastecimentos, tarifas }) {
  const [form, setForm] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroAno, setFiltroAno] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 25;

  const sucursalDelVehiculo = (placa) => veiculos.find((x) => x.placa === placa)?.sucursal || "";

  const emptyViagemRow = () => ({ placa: "", motorista: "", data: "", dataChegada: "", estado: "En curso", sucursal: "", kmInicial: "", kmFinal: "" });

  const openNew = () => setForm({ id: null, placa: "", motorista: "", data: "", dataChegada: "", mes: "", estado: "En curso", sucursal: "", kmInicial: "", kmFinal: "" });
  const openNewMultiple = () => setForm({ bulk: true, rows: [emptyViagemRow(), emptyViagemRow(), emptyViagemRow(), emptyViagemRow(), emptyViagemRow()] });
  const openEdit = (v) => setForm({ ...v });

  const updateBulkRow = (idx, field, value) => {
    setForm({ ...form, rows: form.rows.map((r, i) => (i === idx ? { ...r, [field]: value, sucursal: field === "placa" ? (r.sucursal || sucursalDelVehiculo(value)) : r.sucursal } : r)) });
  };
  const addBulkRow = () => setForm({ ...form, rows: [...form.rows, emptyViagemRow()] });
  const removeBulkRow = (idx) => setForm({ ...form, rows: form.rows.length > 1 ? form.rows.filter((_, i) => i !== idx) : form.rows });

  const saveBulk = (e) => {
    e.preventDefault();
    const validas = form.rows.filter((r) => r.placa && r.data);
    if (validas.length === 0) return;
    let numero = Math.max(0, ...viagens.map((v) => v.numero || 0));
    const nuevos = validas.map((r) => {
      numero += 1;
      const mes = MESES[new Date(r.data + "T00:00:00").getMonth()];
      return { ...r, id: uid(), numero, mes, estado: r.estado || "En curso" };
    });
    setViagens([...viagens, ...nuevos]);
    // Actualiza el KM actual del vehículo si corresponde
    let veiculosAtualizados = veiculos;
    nuevos.forEach((r) => {
      if (r.kmFinal && r.placa) {
        veiculosAtualizados = veiculosAtualizados.map((x) => (x.placa === r.placa && Number(r.kmFinal) > Number(x.kmAtual || 0) ? { ...x, kmAtual: r.kmFinal } : x));
      }
    });
    if (veiculosAtualizados !== veiculos) setVeiculos(veiculosAtualizados);
    setForm(null);
  };

  const onPlacaChange = (placa) => {
    const v = veiculos.find((x) => x.placa === placa);
    setForm({ ...form, placa, sucursal: form.sucursal || v?.sucursal || "", kmInicial: form.kmInicial || v?.kmAtual || "" });
  };

  const save = (e) => {
    e.preventDefault();
    if (!form.placa || !form.data) return;
    const mes = MESES[new Date(form.data + "T00:00:00").getMonth()];
    const record = { ...form, mes };
    if (form.id) {
      setViagens(viagens.map((v) => (v.id === form.id ? { ...v, ...record } : v)));
    } else {
      const numero = Math.max(0, ...viagens.map((v) => v.numero || 0)) + 1;
      setViagens([...viagens, { ...record, id: uid(), numero, estado: record.estado || "En curso" }]);
    }
    // Si cargaste el KM final, actualiza el KM actual del vehículo (solo si es mayor al que ya tenía)
    if (record.kmFinal && record.placa) {
      const vehiculo = veiculos.find((x) => x.placa === record.placa);
      if (vehiculo && Number(record.kmFinal) > Number(vehiculo.kmAtual || 0)) {
        setVeiculos(veiculos.map((x) => (x.placa === record.placa ? { ...x, kmAtual: record.kmFinal } : x)));
      }
    }
    setForm(null);
  };
  const remove = (id) => { setViagens(viagens.filter((v) => v.id !== id)); setConfirmId(null); if (expandedId === id) setExpandedId(null); };
  const toggleEstado = (v) => setViagens(viagens.map((x) => (x.id === v.id ? { ...x, estado: x.estado === "Finalizado" ? "En curso" : "Finalizado" } : x)));

  const statsDaViagem = (viagemId) => {
    const seus = pedidos.filter((p) => p.viagemId === viagemId);
    const valorFacturas = seus.reduce((s, p) => s + Number(p.valorFatura || 0), 0);
    const ingreso = seus.reduce((s, p) => s + freightRevenue(p, tarifas), 0);
    return { cantidad: seus.length, valorFacturas, ingreso };
  };

  const cols = ["N°", "Fecha", "Vehículo", "Sucursal", "Chofer", "Estado", "Km recorridos", "Pedidos", "Valor facturas", "Ingreso flete", ""];

  const anosDisponibles = Array.from(new Set(viagens.filter((v) => v.data).map((v) => v.data.slice(0, 4)))).sort((a, b) => b.localeCompare(a));

  const filtrados = [...viagens]
    .filter((v) => !filtroSucursal || (v.sucursal || sucursalDelVehiculo(v.placa)) === filtroSucursal)
    .filter((v) => !filtroEstado || (v.estado || "En curso") === filtroEstado)
    .filter((v) => !filtroAno || (v.data || "").slice(0, 4) === filtroAno)
    .filter((v) => !filtroMes || v.mes === filtroMes)
    .filter((v) => {
      if (!busca.trim()) return true;
      const q = busca.trim().toLowerCase();
      return (v.placa || "").toLowerCase().includes(q) || (v.motorista || "").toLowerCase().includes(q);
    })
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const sorted = filtrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [numeroBusca, setNumeroBusca] = useState("");
  const [numeroGenerado, setNumeroGenerado] = useState(null);

  const viagemDelReporte = numeroGenerado ? viagens.find((v) => String(v.numero) === String(numeroGenerado)) : null;

  const generarReporte = () => {
    if (!numeroBusca.trim()) return;
    setNumeroGenerado(numeroBusca.trim());
  };

  return (
    <div>
      <SectionHeader title="Viajes / Fletes" subtitle={`${viagens.length} registrados`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={() => { setMostrarReporte(!mostrarReporte); setNumeroGenerado(null); setNumeroBusca(""); }}>
              <FileText size={15} /> {mostrarReporte ? "Ocultar reporte" : "Generar reporte"}
            </Button>
            <Button variant="ghost" onClick={openNewMultiple}><LayoutGrid size={15} /> Varios Viajes</Button>
            <Button onClick={openNew}><Plus size={15} /> Nuevo viaje</Button>
          </div>
        } />

      {mostrarReporte && (
        <Card style={{ marginBottom: 18 }}>
          <ChartTitle>Reporte de viaje (placa, fecha, km, pedidos y costos)</ChartTitle>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
            <Field label="N° de viaje">
              <input
                type="number" style={{ ...inputStyle, maxWidth: 160 }} placeholder="Ej: 3" value={numeroBusca}
                onChange={(e) => { setNumeroBusca(e.target.value); setNumeroGenerado(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") generarReporte(); }}
              />
            </Field>
            <Button onClick={generarReporte}><FileText size={14} /> Generar</Button>
          </div>

          {numeroGenerado && !viagemDelReporte && (
            <EmptyState icon={Package} text={`No se encontró ningún viaje con el N° ${numeroGenerado}.`} />
          )}

          {viagemDelReporte && (() => {
            const v = viagemDelReporte;
            const vehiculo = veiculos.find((x) => x.placa === v.placa);
            const pedidosDoViagem = pedidos.filter((p) => p.viagemId === v.id);
            const custosDoViagem = custos.filter((c) => c.viagemId === v.id);
            const abastecimentosDoViagem = (abastecimentos || []).filter((a) => a.viagemId === v.id);
            const km = v.kmInicial && v.kmFinal ? Number(v.kmFinal) - Number(v.kmInicial) : null;
            const fleteTotal = pedidosDoViagem.reduce((s, p) => s + freightRevenue(p, tarifas), 0);
            const facturaTotal = pedidosDoViagem.reduce((s, p) => s + Number(p.valorFatura || 0), 0);

            const custosPorTipo = {};
            TIPOS_CUSTO.forEach((t) => { custosPorTipo[t] = 0; });
            custosDoViagem.forEach((c) => { custosPorTipo[c.tipo] = (custosPorTipo[c.tipo] || 0) + Number(c.valor || 0); });
            const combustibleValor = abastecimentosDoViagem.reduce((s, a) => s + Number(a.valor || 0), 0);
            const combustibleLitros = abastecimentosDoViagem.reduce((s, a) => s + Number(a.litros || 0), 0);
            const custoTotal = custosDoViagem.reduce((s, c) => s + Number(c.valor || 0), 0) + combustibleValor;
            const lucro = fleteTotal - custoTotal;
            const margen = fleteTotal > 0 ? (lucro / fleteTotal) * 100 : 0;
            const DARK = "#1B2420";
            const finalizado = (v.estado || "En curso") === "Finalizado";

            const filasVacias = Math.max(0, 6 - pedidosDoViagem.length);

            return (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <Button onClick={() => window.print()}><Printer size={15} /> Imprimir / PDF</Button>
                </div>
                <div id="report-print-area">

                  {/* CABEÇALHO + KPIS */}
                  <Card style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{ background: DARK, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.yellow, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Truck size={26} color="#fff" />
                        </div>
                        <div>
                          <div style={{ color: "#fff", fontSize: 20, fontWeight: 700, fontFamily: "'Oswald',sans-serif", textTransform: "uppercase", letterSpacing: 1 }}>Reporte del viaje</div>
                          <div style={{ color: C.yellow, fontSize: 13.5, fontWeight: 700, letterSpacing: 1 }}>VIAJE N° {v.numero}</div>
                        </div>
                      </div>
                      <span style={{
                        background: finalizado ? C.green : "#5B6660", color: "#fff", padding: "6px 14px", borderRadius: 20,
                        fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, textTransform: "uppercase", letterSpacing: 0.5,
                      }}>
                        <Check size={13} /> {v.estado || "En curso"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
                      {[
                        { icon: DollarSign, label: "Flete total", value: fmtMoney(fleteTotal), color: C.text },
                        { icon: DollarSign, label: "Costo total", value: fmtMoney(custoTotal), color: C.red },
                        { icon: lucro >= 0 ? TrendingUp : TrendingDown, label: "Lucro / Pérdida", value: fmtMoney(lucro), color: lucro >= 0 ? C.green : C.red },
                        { icon: Gauge, label: "Margen de lucro", value: `${margen.toFixed(1)}%`, color: C.yellow },
                      ].map((k, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: DARK, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <k.icon size={16} color="#fff" />
                          </div>
                          <div>
                            <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</div>
                            <div style={{ fontSize: 17, fontWeight: 700, color: k.color, fontFamily: "'Oswald',sans-serif" }}>{k.value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, alignItems: "start" }}>
                    {/* DATOS DEL VIAJE */}
                    <Card style={{ padding: 0, overflow: "hidden" }}>
                      <div style={{ background: DARK, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
                        <FileText size={15} /> Datos del viaje
                      </div>
                      {[
                        { icon: Truck, label: "Placa", value: <PlateChip placa={v.placa} /> },
                        { icon: Users, label: "Chofer", value: v.motorista || "—" },
                        { icon: FileText, label: "Fecha salida", value: v.data ? v.data.split("-").reverse().join("/") : "—" },
                        { icon: FileText, label: "Fecha llegada", value: v.dataChegada ? v.dataChegada.split("-").reverse().join("/") : "—" },
                        { icon: Gauge, label: "KM recorrido", value: km !== null ? `${fmtNum(km)} km` : "—" },
                        { icon: Package, label: "Peso vehículo (kg)", value: vehiculo ? fmtNum(vehiculo.peso) : "—" },
                        { icon: Check, label: "Status del viaje", value: <EstadoBadge estado={v.estado || "En curso"} /> },
                      ].map((r, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, flexShrink: 0 }}>
                            <r.icon size={13} />
                          </div>
                          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{r.label}</span>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{r.value}</span>
                          </div>
                        </div>
                      ))}
                    </Card>

                    {/* DETALLE DE COSTOS */}
                    <Card style={{ padding: 0, overflow: "hidden" }}>
                      <div style={{ background: DARK, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
                        <DollarSign size={15} /> Detalle de costos
                      </div>
                      {TIPOS_CUSTO.map((t, i) => (
                        <div key={t} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
                          <span style={{ color: C.muted }}>{t}</span>
                          <span style={{ fontWeight: 700 }}>{fmtMoney(custosPorTipo[t] || 0)}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
                        <span style={{ color: C.muted }}>Combustible {combustibleLitros ? `(${fmtNum(combustibleLitros)} L)` : ""}</span>
                        <span style={{ fontWeight: 700 }}>{fmtMoney(combustibleValor)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "rgba(122,15,19,0.08)", borderTop: `1px solid ${C.border}` }}>
                        <span style={{ color: C.red, fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}>Total</span>
                        <span style={{ color: C.red, fontWeight: 700, fontSize: 15 }}>{fmtMoney(custoTotal)}</span>
                      </div>
                    </Card>
                  </div>

                  {/* PEDIDOS */}
                  <Card style={{ padding: 0, overflow: "hidden" }}>
                    <div style={{ background: DARK, color: "#fff", padding: "12px 16px", fontWeight: 700, fontSize: 12.5, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 8 }}>
                      <Receipt size={15} /> Pedidos del viaje
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr>
                            {["N° pedido", "Cliente", "N° factura", "Valor factura", "% flete", "Valor flete"].map((h) => (
                              <th key={h} style={{ textAlign: "left", padding: "10px 16px", color: C.muted, fontWeight: 700, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pedidosDoViagem.map((p) => (
                            <tr key={p.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ padding: "9px 16px" }}>{p.pedido || "—"}</td>
                              <td style={{ padding: "9px 16px" }}>{p.cliente || "—"}</td>
                              <td style={{ padding: "9px 16px" }}>{p.fatura || "—"}</td>
                              <td style={{ padding: "9px 16px" }}>{fmtMoney(p.valorFatura)}</td>
                              <td style={{ padding: "9px 16px" }}>{Number((tarifas && tarifas[p.tipoFlete]) ?? 100)}%</td>
                              <td style={{ padding: "9px 16px", color: C.green, fontWeight: 700 }}>{fmtMoney(freightRevenue(p, tarifas))}</td>
                            </tr>
                          ))}
                          {Array.from({ length: filasVacias }).map((_, i) => (
                            <tr key={`vacia-${i}`} style={{ borderBottom: `1px solid ${C.border}`, color: C.muted }}>
                              <td style={{ padding: "9px 16px" }}>—</td>
                              <td style={{ padding: "9px 16px" }}>—</td>
                              <td style={{ padding: "9px 16px" }}>—</td>
                              <td style={{ padding: "9px 16px" }}>—</td>
                              <td style={{ padding: "9px 16px" }}>—</td>
                              <td style={{ padding: "9px 16px" }}>—</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: C.bg }}>
                            <td colSpan={3} style={{ padding: "10px 16px" }} />
                            <td style={{ padding: "10px 16px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", color: C.muted }}>Total facturas</td>
                            <td colSpan={1} style={{ padding: "10px 16px", fontWeight: 700 }}>{fmtMoney(facturaTotal)}</td>
                            <td style={{ padding: "10px 16px", fontWeight: 700, color: C.green }}>{fmtMoney(fleteTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </Card>
                </div>
              </>
            );
          })()}
        </Card>
      )}

      <Card style={{ marginBottom: 18, background: "rgba(47,107,47,0.06)", borderColor: C.yellow }}>
        <div style={{ fontSize: 12.5, color: C.muted }}>
          Elegí un viaje de la lista para ver sus datos, pedidos, costos y resultado en pestañas, sin cambiar de pantalla.
          Al cargar el KM final, el KM actual del vehículo se actualiza solo.
        </div>
      </Card>

      {form && form.bulk && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={saveBulk}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
              Completá varios viajes de una sola vez. Las filas vacías se ignoran al guardar.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {form.rows.map((row, idx) => (
                <div key={idx} style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10,
                  padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, alignItems: "flex-end",
                }}>
                  <Field label="Vehículo">
                    <select style={inputStyle} value={row.placa} onChange={(e) => updateBulkRow(idx, "placa", e.target.value)}>
                      <option value="">Seleccione</option>
                      {veiculos.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
                    </select>
                  </Field>
                  <Field label="Sucursal">
                    <select style={inputStyle} value={row.sucursal || ""} onChange={(e) => setForm({ ...form, rows: form.rows.map((r, i) => (i === idx ? { ...r, sucursal: e.target.value } : r)) })}>
                      <option value="">Seleccione</option>
                      {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Chofer">
                    <select style={inputStyle} value={row.motorista} onChange={(e) => updateBulkRow(idx, "motorista", e.target.value)}>
                      <option value="">Seleccione</option>
                      {motoristas.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                    </select>
                  </Field>
                  <Field label="Fecha salida">
                    <input type="date" style={inputStyle} value={row.data} onChange={(e) => updateBulkRow(idx, "data", e.target.value)} />
                  </Field>
                  <Field label="Fecha llegada">
                    <input type="date" style={inputStyle} value={row.dataChegada || ""} onChange={(e) => updateBulkRow(idx, "dataChegada", e.target.value)} />
                  </Field>
                  <Field label="Estado">
                    <select style={inputStyle} value={row.estado || "En curso"} onChange={(e) => updateBulkRow(idx, "estado", e.target.value)}>
                      {ESTADOS_VIAGEM.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </Field>
                  <Field label="KM inicial">
                    <input type="number" style={inputStyle} value={row.kmInicial ?? ""} onChange={(e) => updateBulkRow(idx, "kmInicial", e.target.value)} />
                  </Field>
                  <Field label="KM final">
                    <input type="number" style={inputStyle} value={row.kmFinal ?? ""} onChange={(e) => updateBulkRow(idx, "kmFinal", e.target.value)} />
                  </Field>
                  {form.rows.length > 1 && (
                    <button type="button" onClick={() => removeBulkRow(idx)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", justifySelf: "start" }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button variant="ghost" type="button" onClick={addBulkRow}><Plus size={14} /> Agregar otra fila</Button>
              <Button type="submit"><Check size={14} /> Guardar viajes</Button>
              <Button variant="ghost" onClick={() => setForm(null)}><X size={14} /> Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {form && !form.bulk && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <Field label="Vehículo">
              <select style={inputStyle} value={form.placa} onChange={(e) => onPlacaChange(e.target.value)} required>
                <option value="">Seleccione</option>
                {veiculos.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
              </select>
            </Field>
            <Field label="Sucursal">
              <select style={inputStyle} value={form.sucursal || ""} onChange={(e) => setForm({ ...form, sucursal: e.target.value })}>
                <option value="">Seleccione</option>
                {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Chofer">
              <select style={inputStyle} value={form.motorista} onChange={(e) => setForm({ ...form, motorista: e.target.value })}>
                <option value="">Seleccione</option>
                {motoristas.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
              </select>
            </Field>
            <Field label="Fecha salida">
              <input type="date" style={inputStyle} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
            </Field>
            <Field label="Fecha llegada">
              <input type="date" style={inputStyle} value={form.dataChegada || ""} onChange={(e) => setForm({ ...form, dataChegada: e.target.value })} />
            </Field>
            <Field label="Estado del viaje">
              <select style={inputStyle} value={form.estado || "En curso"} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_VIAGEM.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
            <Field label="KM inicial">
              <input type="number" style={inputStyle} value={form.kmInicial ?? ""} onChange={(e) => setForm({ ...form, kmInicial: e.target.value })} />
            </Field>
            <Field label="KM final">
              <input type="number" style={inputStyle} value={form.kmFinal ?? ""} onChange={(e) => setForm({ ...form, kmFinal: e.target.value })} />
            </Field>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Button type="submit"><Check size={14} /> Guardar</Button>
              <Button variant="ghost" onClick={() => setForm(null)}><X size={14} /> Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {viagens.length > 0 && (
        <div style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,200px))", gap: 12 }}>
          <Field label="Buscar (chapa o chofer)">
            <input style={inputStyle} placeholder="Ej: AAOP217, Carlos..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} />
          </Field>
          <Field label="Año">
            <select style={inputStyle} value={filtroAno} onChange={(e) => { setFiltroAno(e.target.value); setPagina(1); }}>
              <option value="">Todos</option>
              {anosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Field>
          <Field label="Mes">
            <select style={inputStyle} value={filtroMes} onChange={(e) => { setFiltroMes(e.target.value); setPagina(1); }}>
              <option value="">Todos</option>
              {MESES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Sucursal">
            <select style={inputStyle} value={filtroSucursal} onChange={(e) => { setFiltroSucursal(e.target.value); setPagina(1); }}>
              <option value="">Todas</option>
              {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select style={inputStyle} value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}>
              <option value="">Todos</option>
              {ESTADOS_VIAGEM.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </Field>
        </div>
      )}

      {filtrados.length === 0 ? <EmptyState icon={Package} text={viagens.length === 0 ? "No hay viajes registrados." : "Ningún viaje coincide con los filtros."} /> : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
          {/* LISTA */}
          <div>
            <Card style={{ padding: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, maxHeight: 640, overflowY: "auto" }}>
                {sorted.map((v) => {
                  const selected = expandedId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => setExpandedId(v.id)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
                        padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${selected ? C.yellow : C.border}`,
                        borderLeft: `4px solid ${C.yellow}`,
                        background: selected ? C.raised : C.surface,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14.5, color: C.text }}>Viaje {v.numero}</span>
                          <EstadoBadge estado={v.estado || "En curso"} />
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                          <FileText size={12} /> {v.data ? v.data.split("-").reverse().join("/") : "—"}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                          <Truck size={12} /> {v.placa}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 5 }}>
                          <Users size={12} /> {v.motorista || "—"}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setForm({ ...v })} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: 5, color: C.muted, cursor: "pointer" }}>
                          <Pencil size={13} />
                        </button>
                        {confirmId === v.id ? (
                          <div style={{ display: "flex", gap: 3 }}>
                            <button onClick={() => remove(v.id)} style={{ background: C.red, border: "none", borderRadius: 6, padding: "5px 6px", color: "#fff", cursor: "pointer", fontSize: 10 }}>Sí</button>
                            <button onClick={() => setConfirmId(null)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 6px", color: C.muted, cursor: "pointer", fontSize: 10 }}>No</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmId(v.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: 5, color: C.red, cursor: "pointer" }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalPaginas > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
                  <Button variant="ghost" onClick={() => setPagina(Math.max(1, paginaActual - 1))} style={paginaActual === 1 ? { opacity: 0.4, pointerEvents: "none" } : {}}>Anterior</Button>
                  <span style={{ fontSize: 11.5, color: C.muted }}>{paginaActual}/{totalPaginas}</span>
                  <Button variant="ghost" onClick={() => setPagina(Math.min(totalPaginas, paginaActual + 1))} style={paginaActual === totalPaginas ? { opacity: 0.4, pointerEvents: "none" } : {}}>Siguiente</Button>
                </div>
              )}
            </Card>
          </div>

          {/* DETALLE */}
          <div>
            {(() => {
              const viagemSelecionada = filtrados.find((v) => v.id === expandedId) || sorted[0];
              if (!viagemSelecionada) return <EmptyState icon={Package} text="Elegí un viaje de la lista para ver su detalle." />;
              return (
                <ViagemDetalle
                  viagem={viagemSelecionada}
                  sucursal={viagemSelecionada.sucursal || sucursalDelVehiculo(viagemSelecionada.placa)}
                  pedidos={pedidos} setPedidos={setPedidos}
                  custos={custos} setCustos={setCustos}
                  abastecimentos={abastecimentos}
                  veiculos={veiculos}
                  tarifas={tarifas}
                  onEdit={(v) => setForm({ ...v })}
                  onToggleEstado={toggleEstado}
                />
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

/* Panel embebido: pedidos, costos y resultado del viaje, editables sin salir de la pantalla de Viajes. */
function ViagemDetalle({ viagem, sucursal, pedidos, setPedidos, custos, setCustos, abastecimentos, tarifas, veiculos, onEdit, onToggleEstado }) {
  const [tab, setTab] = useState("datos");
  const [pedidoRows, setPedidoRows] = useState([emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow()]);
  const [custoRows, setCustoRows] = useState([{ tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }]);
  const [confirmPedidoId, setConfirmPedidoId] = useState(null);
  const [confirmCustoId, setConfirmCustoId] = useState(null);

  const pedidosDoViagem = pedidos.filter((p) => p.viagemId === viagem.id);
  const custosDoViagem = custos.filter((c) => c.viagemId === viagem.id);
  const abastecimentosDoViagem = (abastecimentos || []).filter((a) => a.viagemId === viagem.id);
  const vehiculo = (veiculos || []).find((x) => x.placa === viagem.placa);
  const entregados = pedidosDoViagem.filter((p) => p.estado === "Entregado").length;
  const totalPedidos = pedidosDoViagem.reduce((s, p) => s + Number(p.valorFatura || 0), 0);

  const updatePedidoRow = (idx, field, value) => setPedidoRows(pedidoRows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const addPedidoRow = () => setPedidoRows([...pedidoRows, emptyPedidoRow()]);
  const removePedidoRow = (idx) => setPedidoRows(pedidoRows.length > 1 ? pedidoRows.filter((_, i) => i !== idx) : pedidoRows);
  const savePedidos = () => {
    const validas = pedidoRows.filter((r) => r.valorFatura && r.tipoFlete);
    if (validas.length === 0) return;
    const nuevos = validas.map((r) => ({ ...r, viagemId: viagem.id, id: uid() }));
    setPedidos([...pedidos, ...nuevos]);
    setPedidoRows([emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow()]);
  };
  const removePedido = (id) => { setPedidos(pedidos.filter((p) => p.id !== id)); setConfirmPedidoId(null); };
  const toggleEstadoPedido = (p) => setPedidos(pedidos.map((x) => (x.id === p.id ? { ...x, estado: ESTADOS_PEDIDO[(ESTADOS_PEDIDO.indexOf(x.estado || "Pendiente") + 1) % ESTADOS_PEDIDO.length] } : x)));

  const updateCustoRow = (idx, field, value) => setCustoRows(custoRows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const addCustoRow = () => setCustoRows([...custoRows, { tipo: "", valor: "", data: "", obs: "" }]);
  const removeCustoRow = (idx) => setCustoRows(custoRows.length > 1 ? custoRows.filter((_, i) => i !== idx) : custoRows);
  const saveCustos = () => {
    const validas = custoRows.filter((r) => r.tipo && r.valor);
    if (validas.length === 0) return;
    const nuevos = validas.map((r) => ({ ...r, placa: viagem.placa, viagemId: viagem.id, id: uid() }));
    setCustos([...custos, ...nuevos]);
    setCustoRows([{ tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }]);
  };
  const removeCusto = (id) => { setCustos(custos.filter((c) => c.id !== id)); setConfirmCustoId(null); };

  const fleteTotal = pedidosDoViagem.reduce((s, p) => s + freightRevenue(p, tarifas), 0);
  const combustibleValor = abastecimentosDoViagem.reduce((s, a) => s + Number(a.valor || 0), 0);
  const combustibleLitros = abastecimentosDoViagem.reduce((s, a) => s + Number(a.litros || 0), 0);
  const custoTotal = custosDoViagem.reduce((s, c) => s + Number(c.valor || 0), 0) + combustibleValor;
  const lucro = fleteTotal - custoTotal;
  const margen = fleteTotal > 0 ? (lucro / fleteTotal) * 100 : 0;
  const km = viagem.kmInicial && viagem.kmFinal ? Number(viagem.kmFinal) - Number(viagem.kmInicial) : null;

  const TABS = [
    { id: "datos", label: "Datos" },
    { id: "pedidos", label: "Pedidos" },
    { id: "costos", label: "Costos" },
    { id: "resultado", label: "Resultado" },
  ];

  return (
    <div style={{ background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 22, textTransform: "uppercase", color: C.text }}>
            Viaje {viagem.numero}
          </div>
          <Button variant="ghost" onClick={() => onEdit(viagem)}><Pencil size={14} /> Editar</Button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={{ cursor: "pointer" }} onClick={() => onToggleEstado(viagem)} title="Clic para cambiar el estado">
            <EstadoBadge estado={viagem.estado || "En curso"} />
          </span>
        </div>
        <div style={{ display: "flex", gap: 4, borderBottom: `2px solid ${C.border}` }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700,
              color: tab === t.id ? C.yellow : C.muted,
              borderBottom: tab === t.id ? `2px solid ${C.yellow}` : "2px solid transparent", marginBottom: -2,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {tab === "datos" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 0, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
            {[
              { icon: Truck, label: "Placa", value: <PlateChip placa={viagem.placa} /> },
              { icon: Users, label: "Chofer", value: viagem.motorista || "—" },
              { icon: Building2, label: "Sucursal", value: sucursal || "—" },
              { icon: FileText, label: "Fecha salida", value: viagem.data ? viagem.data.split("-").reverse().join("/") : "—" },
              { icon: FileText, label: "Fecha llegada", value: viagem.dataChegada ? viagem.dataChegada.split("-").reverse().join("/") : "—" },
              { icon: Gauge, label: "KM recorrido", value: km !== null ? `${fmtNum(km)} km` : "—" },
              { icon: Package, label: "Peso vehículo (kg)", value: vehiculo ? fmtNum(vehiculo.peso) : "—" },
            ].map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: i < 2 ? "none" : `1px solid ${C.border}`, borderLeft: i % 2 === 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, flexShrink: 0 }}>
                  <r.icon size={14} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{r.label}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "pedidos" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 17 }}>Pedidos</div>
                <div style={{ fontSize: 12, color: C.muted }}>{pedidosDoViagem.length} registrados · {entregados} entregados · {fmtMoney(totalPedidos)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setPedidoRows([emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow()])}><LayoutGrid size={14} /> Varios Pedidos</Button>
                <Button onClick={() => setPedidoRows([emptyPedidoRow()])}><Plus size={14} /> Nuevo Pedido</Button>
              </div>
            </div>

            {pedidosDoViagem.length > 0 && (
              <Card style={{ padding: 0, marginBottom: 14 }}>
                <Table
                  headers={["Factura", "Pedido", "Cliente", "Tipo de flete", "Monto", "Estado", ""]}
                  rows={pedidosDoViagem.map((p) => [
                    p.fatura || "—", p.pedido || "—", p.cliente || "—", p.tipoFlete || "—",
                    fmtMoney(p.valorFatura),
                    <span style={{ cursor: "pointer" }} onClick={() => toggleEstadoPedido(p)} title="Clic para cambiar el estado">
                      <EstadoBadge estado={p.estado || "Pendiente"} />
                    </span>,
                    <RowActions onEdit={() => {}} onDelete={() => setConfirmPedidoId(p.id)} confirming={confirmPedidoId === p.id} onConfirm={() => removePedido(p.id)} onCancel={() => setConfirmPedidoId(null)} />,
                  ])}
                />
              </Card>
            )}

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" }}>
                <div>
                  <ChartTitle>Agregar pedidos</ChartTitle>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: -8, marginBottom: 10 }}>Completá una línea por pedido o pegá los datos desde Excel.</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => pegarDesdeExcel(setPedidoRows, ["fatura", "pedido", "cliente", "tipoFlete", "valorFatura", "estado"], emptyPedidoRow)}><ClipboardPaste size={13} /> Pegar del Excel</Button>
                  <Button variant="ghost" onClick={addPedidoRow}><Plus size={13} /> Agregar línea</Button>
                </div>
              </div>
              <div style={{ overflowX: "auto", padding: "10px 16px 16px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Factura", "Pedido", "Cliente", "Tipo de flete", "Monto factura", "Estado", ""].map((h) => (
                        <th key={h} style={{ background: C.text, color: "#fff", textAlign: "left", padding: "9px 10px", fontSize: 11.5, fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pedidoRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: 6 }}><input style={inputStyle} value={row.fatura} onChange={(e) => updatePedidoRow(idx, "fatura", e.target.value)} /></td>
                        <td style={{ padding: 6 }}><input style={inputStyle} value={row.pedido} onChange={(e) => updatePedidoRow(idx, "pedido", e.target.value)} /></td>
                        <td style={{ padding: 6 }}><input style={inputStyle} value={row.cliente} onChange={(e) => updatePedidoRow(idx, "cliente", e.target.value)} /></td>
                        <td style={{ padding: 6 }}>
                          <select style={inputStyle} value={row.tipoFlete} onChange={(e) => updatePedidoRow(idx, "tipoFlete", e.target.value)}>
                            <option value="">Seleccione...</option>
                            {TIPOS_FRETE.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 6 }}><input type="number" style={inputStyle} value={row.valorFatura} onChange={(e) => updatePedidoRow(idx, "valorFatura", e.target.value)} /></td>
                        <td style={{ padding: 6 }}>
                          <select style={inputStyle} value={row.estado || "Pendiente"} onChange={(e) => updatePedidoRow(idx, "estado", e.target.value)}>
                            {ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{e}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 6 }}>
                          {pedidoRows.length > 1 && (
                            <button type="button" onClick={() => removePedidoRow(idx)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Button onClick={savePedidos}><Check size={13} /> Guardar pedidos</Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab === "costos" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 17 }}>Costos</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setCustoRows([{ tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }, { tipo: "", valor: "", data: "", obs: "" }])}><LayoutGrid size={14} /> Varios Costos</Button>
                <Button onClick={() => setCustoRows([{ tipo: "", valor: "", data: "", obs: "" }])}><Plus size={14} /> Nuevo Costo</Button>
              </div>
            </div>
            {custosDoViagem.length > 0 && (
              <Card style={{ padding: 0, marginBottom: 14 }}>
                <Table
                  headers={["Categoría", "Valor", "Fecha", "Obs.", ""]}
                  rows={custosDoViagem.map((c) => [
                    c.tipo, fmtMoney(c.valor), c.data ? c.data.split("-").reverse().join("/") : "—", c.obs || "—",
                    <RowActions onEdit={() => {}} onDelete={() => setConfirmCustoId(c.id)} confirming={confirmCustoId === c.id} onConfirm={() => removeCusto(c.id)} onCancel={() => setConfirmCustoId(null)} />,
                  ])}
                />
              </Card>
            )}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" }}>
                <div>
                  <ChartTitle>Agregar costos</ChartTitle>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: -8, marginBottom: 10 }}>Completá una línea por costo o pegá los datos desde Excel.</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" onClick={() => pegarDesdeExcel(setCustoRows, ["tipo", "valor", "data", "obs"], () => ({ tipo: "", valor: "", data: "", obs: "" }))}><ClipboardPaste size={13} /> Pegar del Excel</Button>
                  <Button variant="ghost" onClick={addCustoRow}><Plus size={13} /> Agregar línea</Button>
                </div>
              </div>
              <div style={{ overflowX: "auto", padding: "10px 16px 16px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Categoría", "Valor (₲)", "Fecha", "Observación", ""].map((h) => (
                        <th key={h} style={{ background: C.text, color: "#fff", textAlign: "left", padding: "9px 10px", fontSize: 11.5, fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {custoRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: 6 }}>
                          <select style={inputStyle} value={row.tipo} onChange={(e) => updateCustoRow(idx, "tipo", e.target.value)}>
                            <option value="">Seleccione...</option>
                            {TIPOS_CUSTO.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 6 }}><input type="number" style={inputStyle} value={row.valor} onChange={(e) => updateCustoRow(idx, "valor", e.target.value)} /></td>
                        <td style={{ padding: 6 }}><input type="date" style={inputStyle} value={row.data} onChange={(e) => updateCustoRow(idx, "data", e.target.value)} /></td>
                        <td style={{ padding: 6 }}><input style={inputStyle} value={row.obs} onChange={(e) => updateCustoRow(idx, "obs", e.target.value)} /></td>
                        <td style={{ padding: 6 }}>
                          {custoRows.length > 1 && (
                            <button type="button" onClick={() => removeCustoRow(idx)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Button onClick={saveCustos}><Check size={13} /> Guardar costos</Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {tab === "resultado" && (
          <div>
            <Card style={{
              marginBottom: 16, textAlign: "center",
              background: lucro >= 0 ? "rgba(47,107,47,0.10)" : "rgba(122,15,19,0.10)",
              borderColor: lucro >= 0 ? C.green : C.red,
            }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Lucro / Pérdida del viaje</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: lucro >= 0 ? C.green : C.red, fontFamily: "'Oswald',sans-serif" }}>{fmtMoney(lucro)}</div>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              <KPI icon={Receipt} label="Flete total" value={fmtMoney(fleteTotal)} />
              <KPI icon={DollarSign} label="Costo total" value={fmtMoney(custoTotal)} />
              <KPI icon={Fuel} label="Combustible" value={combustibleLitros ? `${fmtMoney(combustibleValor)} (${fmtNum(combustibleLitros)} L)` : fmtMoney(combustibleValor)} />
              <KPI icon={Gauge} label="Margen de lucro" value={`${margen.toFixed(1)}%`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PEDIDOS
--------------------------------------------------------------- */
function emptyPedidoRow() {
  return { fatura: "", pedido: "", cliente: "", valorFatura: "", tipoFlete: "", estado: "Pendiente" };
}

function PedidosPage({ pedidos, setPedidos, viagens, veiculos, tarifas, setTarifas }) {
  const [form, setForm] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const viagensOrdenadas = [...viagens].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const viagemLabel = (v) => `N° ${v.numero ?? "—"} · ${v.data ? v.data.split("-").reverse().join("/") : "—"} · ${v.placa}${v.motorista ? " · " + v.motorista : ""}`;
  const viagemById = (id) => viagens.find((v) => v.id === id);

  const openNew = () => setForm({ viagemId: "", rows: [emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow(), emptyPedidoRow()], editId: null });
  const openNewUnico = () => setForm({ viagemId: "", rows: [emptyPedidoRow()], editId: null });
  const openEdit = (p) => setForm({ viagemId: p.viagemId, rows: [{ fatura: p.fatura, pedido: p.pedido, cliente: p.cliente, valorFatura: p.valorFatura, tipoFlete: p.tipoFlete, estado: p.estado || "Pendiente" }], editId: p.id });

  const updateRow = (idx, field, value) => {
    setForm({ ...form, rows: form.rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)) });
  };
  const addRow = () => setForm({ ...form, rows: [...form.rows, emptyPedidoRow()] });
  const removeRow = (idx) => setForm({ ...form, rows: form.rows.length > 1 ? form.rows.filter((_, i) => i !== idx) : form.rows });

  const save = (e) => {
    e.preventDefault();
    if (!form.viagemId) return;
    if (form.editId) {
      const row = form.rows[0];
      setPedidos(pedidos.map((p) => (p.id === form.editId ? { ...row, viagemId: form.viagemId, id: form.editId } : p)));
    } else {
      const validas = form.rows.filter((r) => r.valorFatura && r.tipoFlete);
      if (validas.length === 0) return;
      const nuevos = validas.map((r) => ({ ...r, viagemId: form.viagemId, id: uid() }));
      setPedidos([...pedidos, ...nuevos]);
    }
    setForm(null);
  };
  const remove = (id) => { setPedidos(pedidos.filter((p) => p.id !== id)); setConfirmId(null); };
  const toggleEstadoPedido = (p) => setPedidos(pedidos.map((x) => (x.id === p.id ? { ...x, estado: ESTADOS_PEDIDO[(ESTADOS_PEDIDO.indexOf(x.estado || "Pendiente") + 1) % ESTADOS_PEDIDO.length] } : x)));

  const sorted = [...pedidos].sort((a, b) => {
    const va = viagemById(a.viagemId)?.data || "";
    const vb = viagemById(b.viagemId)?.data || "";
    return vb.localeCompare(va);
  });

  return (
    <div>
      <SectionHeader title="Pedidos" subtitle={`${pedidos.length} registrados`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={openNew}><LayoutGrid size={15} /> Varios Pedidos</Button>
            <Button onClick={openNewUnico}><Plus size={15} /> Nuevo Pedido</Button>
          </div>
        } />

      {setTarifas && (
        <Card style={{ marginBottom: 18 }}>
          <ChartTitle>Tarifa de flete por tipo (%)</ChartTitle>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
            El ingreso de cada pedido se calcula como: valor de la factura × tarifa del tipo de flete.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            {TIPOS_FRETE.map((t) => (
              <Field key={t} label={t}>
                <input
                  type="number" style={inputStyle} value={tarifas?.[t] ?? 100}
                  onChange={(e) => setTarifas({ ...tarifas, [t]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </Card>
      )}

      {form && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={save}>
            <div style={{ marginBottom: 14, maxWidth: 340 }}>
              <Field label="Viaje">
                <select style={inputStyle} value={form.viagemId} onChange={(e) => setForm({ ...form, viagemId: e.target.value })} required>
                  <option value="">Seleccione</option>
                  {viagensOrdenadas.map((v) => <option key={v.id} value={v.id}>{viagemLabel(v)}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {form.rows.map((row, idx) => (
                <div key={idx} style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10,
                  padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, alignItems: "flex-end",
                }}>
                  <Field label="Factura">
                    <input style={inputStyle} value={row.fatura} onChange={(e) => updateRow(idx, "fatura", e.target.value)} />
                  </Field>
                  <Field label="Pedido">
                    <input style={inputStyle} value={row.pedido} onChange={(e) => updateRow(idx, "pedido", e.target.value)} />
                  </Field>
                  <Field label="Cliente">
                    <input style={inputStyle} value={row.cliente} onChange={(e) => updateRow(idx, "cliente", e.target.value)} />
                  </Field>
                  <Field label="Valor factura (₲)">
                    <input type="number" style={inputStyle} value={row.valorFatura} onChange={(e) => updateRow(idx, "valorFatura", e.target.value)} required />
                  </Field>
                  <Field label="Tipo de flete">
                    <select style={inputStyle} value={row.tipoFlete} onChange={(e) => updateRow(idx, "tipoFlete", e.target.value)} required>
                      <option value="">Seleccione</option>
                      {TIPOS_FRETE.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Estado del pedido">
                    <select style={inputStyle} value={row.estado || "Pendiente"} onChange={(e) => updateRow(idx, "estado", e.target.value)}>
                      {ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </Field>
                  {!form.editId && form.rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(idx)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", justifySelf: "start" }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {!form.editId && (
                <Button variant="ghost" type="button" onClick={addRow}><Plus size={14} /> Agregar otra factura</Button>
              )}
              <Button type="submit"><Check size={14} /> Guardar</Button>
              <Button variant="ghost" onClick={() => setForm(null)}><X size={14} /> Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {sorted.length === 0 ? <EmptyState icon={Receipt} text="No hay pedidos registrados." /> : (
        <Card style={{ padding: 0 }}>
          <Table
            headers={["Viaje N°", "Fecha", "Vehículo", "Sucursal", "Factura", "Pedido", "Cliente", "Valor factura", "Tipo de flete", "Estado", "Ingreso flete", ""]}
            rows={sorted.map((p) => {
              const v = viagemById(p.viagemId);
              const sucursal = v ? veiculos.find((x) => x.placa === v.placa)?.sucursal : null;
              return [
                <span style={{ fontWeight: 700, color: C.muted }}>{v?.numero ?? "—"}</span>,
                v?.data ? v.data.split("-").reverse().join("/") : "—",
                v ? <PlateChip placa={v.placa} /> : "—",
                sucursal || "—",
                p.fatura || "—", p.pedido || "—", p.cliente || "—",
                fmtMoney(p.valorFatura), p.tipoFlete || "—",
                <span style={{ cursor: "pointer" }} onClick={() => toggleEstadoPedido(p)} title="Clic para cambiar el estado">
                  <EstadoBadge estado={p.estado || "Pendiente"} />
                </span>,
                <span style={{ color: C.green, fontWeight: 700 }}>{fmtMoney(freightRevenue(p, tarifas))}</span>,
                <RowActions onEdit={() => openEdit(p)} onDelete={() => setConfirmId(p.id)} confirming={confirmId === p.id} onConfirm={() => remove(p.id)} onCancel={() => setConfirmId(null)} />,
              ];
            })}
          />
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   ABASTECIMENTO
--------------------------------------------------------------- */
function AbastecimentoPage({ abastecimentos, setAbastecimentos, veiculos, viagens }) {
  const [form, setForm] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const openNew = () => setForm({ id: null, placa: "", data: "", km: "", litros: "", valor: "", posto: "", viagemId: "" });

  const save = (e) => {
    e.preventDefault();
    if (!form.placa || !form.litros || !form.valor) return;
    if (form.id) setAbastecimentos(abastecimentos.map((a) => (a.id === form.id ? { ...form } : a)));
    else setAbastecimentos([...abastecimentos, { ...form, id: uid() }]);
    setForm(null);
  };
  const remove = (id) => { setAbastecimentos(abastecimentos.filter((a) => a.id !== id)); setConfirmId(null); };

  const comConsumo = useMemo(() => withConsumo(abastecimentos), [abastecimentos]);
  const sorted = [...comConsumo].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const totalValor = abastecimentos.reduce((s, a) => s + Number(a.valor || 0), 0);
  const totalLitros = abastecimentos.reduce((s, a) => s + Number(a.litros || 0), 0);

  return (
    <div>
      <SectionHeader title="Combustible" subtitle={`${abastecimentos.length} registros · ${fmtNum(totalLitros)} L · ${fmtMoney(totalValor)}`}
        action={<Button onClick={openNew}><Plus size={15} /> Nueva carga</Button>} />

      <Card style={{ marginBottom: 18, background: "rgba(47,107,47,0.06)", borderColor: C.yellow }}>
        <div style={{ fontSize: 12.5, color: C.muted }}>
          Cada carga de combustible queda separada de los viajes — una sola carga puede cubrir varios viajes.
          El consumo (km/l) se calcula automáticamente en base al KM informado en cada carga del mismo vehículo.
        </div>
      </Card>

      {form && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <Field label="Vehículo">
              <select style={inputStyle} value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} required>
                <option value="">Seleccione</option>
                {veiculos.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" style={inputStyle} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </Field>
            <Field label="KM en la carga">
              <input type="number" style={inputStyle} value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} />
            </Field>
            <Field label="Litros">
              <input type="number" step="0.01" style={inputStyle} value={form.litros} onChange={(e) => setForm({ ...form, litros: e.target.value })} required />
            </Field>
            <Field label="Valor total (₲)">
              <input type="number" step="0.01" style={inputStyle} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} required />
            </Field>
            <Field label="Estación (opcional)">
              <input style={inputStyle} value={form.posto} onChange={(e) => setForm({ ...form, posto: e.target.value })} />
            </Field>
            <Field label="Viaje (opcional)">
              <select style={inputStyle} value={form.viagemId || ""} onChange={(e) => setForm({ ...form, viagemId: e.target.value })}>
                <option value="">Ninguno</option>
                {[...viagens].sort((a, b) => (b.numero || 0) - (a.numero || 0)).map((v) => (
                  <option key={v.id} value={v.id}>N° {v.numero} · {v.placa}</option>
                ))}
              </select>
            </Field>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Button type="submit"><Check size={14} /> Guardar</Button>
              <Button variant="ghost" onClick={() => setForm(null)}><X size={14} /> Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {sorted.length === 0 ? <EmptyState icon={Fuel} text="No hay cargas de combustible registradas." /> : (
        <Card style={{ padding: 0 }}>
          <Table
            headers={["Fecha", "Vehículo", "KM", "Litros", "Valor", "₲/L", "Consumo (km/l)", ""]}
            rows={sorted.map((a) => [
              a.data ? a.data.split("-").reverse().join("/") : "—",
              <PlateChip placa={a.placa} />, fmtNum(a.km), fmtNum(a.litros), fmtMoney(a.valor),
              a.litros ? fmtMoney(Number(a.valor) / Number(a.litros)) : "—",
              a.consumo ? `${a.consumo.toFixed(1)} km/l` : "—",
              <RowActions onEdit={() => setForm({ ...a })} onDelete={() => setConfirmId(a.id)} confirming={confirmId === a.id} onConfirm={() => remove(a.id)} onCancel={() => setConfirmId(null)} />,
            ])}
          />
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   COSTOS
--------------------------------------------------------------- */
function emptyCustoRow() {
  return { tipo: "", valor: "", data: "", obs: "" };
}

function CustosPage({ custos, setCustos, veiculos }) {
  const [form, setForm] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const openNew = () => setForm({ placa: "", rows: [emptyCustoRow(), emptyCustoRow(), emptyCustoRow()], editId: null });
  const openEdit = (c) => setForm({ placa: c.placa, rows: [{ tipo: c.tipo, valor: c.valor, data: c.data, obs: c.obs }], editId: c.id });

  const updateRow = (idx, field, value) => setForm({ ...form, rows: form.rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)) });
  const addRow = () => setForm({ ...form, rows: [...form.rows, emptyCustoRow()] });
  const removeRow = (idx) => setForm({ ...form, rows: form.rows.length > 1 ? form.rows.filter((_, i) => i !== idx) : form.rows });

  const save = (e) => {
    e.preventDefault();
    if (!form.placa) return;
    if (form.editId) {
      const row = form.rows[0];
      setCustos(custos.map((c) => (c.id === form.editId ? { ...row, placa: form.placa, id: form.editId } : c)));
    } else {
      const validas = form.rows.filter((r) => r.tipo && r.valor);
      if (validas.length === 0) return;
      const nuevos = validas.map((r) => ({ ...r, placa: form.placa, id: uid() }));
      setCustos([...custos, ...nuevos]);
    }
    setForm(null);
  };
  const remove = (id) => { setCustos(custos.filter((c) => c.id !== id)); setConfirmId(null); };
  const sorted = [...custos].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  return (
    <div>
      <SectionHeader title="Costos" subtitle={`${custos.length} registrados · Total ${fmtMoney(custos.reduce((s, c) => s + Number(c.valor || 0), 0))}`}
        action={<Button onClick={openNew}><Plus size={15} /> Nuevo costo</Button>} />

      {form && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={save}>
            <div style={{ marginBottom: 14, maxWidth: 260 }}>
              <Field label="Vehículo">
                <select style={inputStyle} value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} required>
                  <option value="">Seleccione</option>
                  {veiculos.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {form.rows.map((row, idx) => (
                <div key={idx} style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10,
                  padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, alignItems: "flex-end",
                }}>
                  <Field label="Categoría">
                    <select style={inputStyle} value={row.tipo} onChange={(e) => updateRow(idx, "tipo", e.target.value)}>
                      <option value="">Seleccione</option>
                      {TIPOS_CUSTO.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Valor (₲)">
                    <input type="number" style={inputStyle} value={row.valor} onChange={(e) => updateRow(idx, "valor", e.target.value)} />
                  </Field>
                  <Field label="Fecha">
                    <input type="date" style={inputStyle} value={row.data} onChange={(e) => updateRow(idx, "data", e.target.value)} />
                  </Field>
                  <Field label="Observación">
                    <input style={inputStyle} value={row.obs} onChange={(e) => updateRow(idx, "obs", e.target.value)} />
                  </Field>
                  {!form.editId && form.rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(idx)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", justifySelf: "start" }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {!form.editId && (
                <Button variant="ghost" type="button" onClick={addRow}><Plus size={14} /> Agregar otro costo</Button>
              )}
              <Button type="submit"><Check size={14} /> Guardar</Button>
              <Button variant="ghost" onClick={() => setForm(null)}><X size={14} /> Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {sorted.length === 0 ? <EmptyState icon={DollarSign} text="No hay costos registrados." /> : (
        <Card style={{ padding: 0 }}>
          <Table
            headers={["Fecha", "Vehículo", "Categoría", "Valor", "Obs.", ""]}
            rows={sorted.map((c) => [
              c.data ? c.data.split("-").reverse().join("/") : "—",
              <PlateChip placa={c.placa} />, c.tipo, fmtMoney(c.valor), c.obs || "—",
              <RowActions onEdit={() => openEdit(c)} onDelete={() => setConfirmId(c.id)} confirming={confirmId === c.id} onConfirm={() => remove(c.id)} onCancel={() => setConfirmId(null)} />,
            ])}
          />
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   MANTENIMIENTO
--------------------------------------------------------------- */
function ManutencaoPage({ manutencoes, setManutencoes, veiculos, setVeiculos }) {
  const [form, setForm] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const openNew = () => setForm({ id: null, placa: "", data: "", kmUltima: "", kmProxima: "" });

  const save = (e) => {
    e.preventDefault();
    if (!form.placa || !form.kmProxima) return;
    if (form.id) setManutencoes(manutencoes.map((m) => (m.id === form.id ? { ...form } : m)));
    else setManutencoes([...manutencoes, { ...form, id: uid() }]);
    setForm(null);
  };
  const remove = (id) => { setManutencoes(manutencoes.filter((m) => m.id !== id)); setConfirmId(null); };
  const sorted = [...manutencoes].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  return (
    <div>
      <SectionHeader title="Mantenimiento" subtitle={`${manutencoes.length} registros`}
        action={<Button onClick={openNew}><Plus size={15} /> Nuevo mantenimiento</Button>} />

      {form && (
        <Card style={{ marginBottom: 18 }}>
          <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <Field label="Vehículo">
              <select style={inputStyle} value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} required>
                <option value="">Seleccione</option>
                {veiculos.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
              </select>
            </Field>
            <Field label="Fecha del mantenimiento">
              <input type="date" style={inputStyle} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </Field>
            <Field label="KM en el mantenimiento">
              <input type="number" style={inputStyle} value={form.kmUltima} onChange={(e) => setForm({ ...form, kmUltima: e.target.value })} />
            </Field>
            <Field label="Próximo mantenimiento (KM)">
              <input type="number" style={inputStyle} value={form.kmProxima} onChange={(e) => setForm({ ...form, kmProxima: e.target.value })} required />
            </Field>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Button type="submit"><Check size={14} /> Guardar</Button>
              <Button variant="ghost" onClick={() => setForm(null)}><X size={14} /> Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {sorted.length === 0 ? <EmptyState icon={Wrench} text="No hay mantenimientos registrados." /> : (
        <Card style={{ padding: 0 }}>
          <Table
            headers={["Fecha", "Vehículo", "KM mantenimiento", "Próximo (KM)", "Faltan", ""]}
            rows={sorted.map((m) => {
              const v = veiculos.find((x) => x.placa === m.placa);
              const falta = v?.kmAtual && m.kmProxima ? m.kmProxima - v.kmAtual : null;
              return [
                m.data ? m.data.split("-").reverse().join("/") : "—",
                <PlateChip placa={m.placa} />, fmtNum(m.kmUltima), fmtNum(m.kmProxima),
                falta === null ? "—" : (
                  <span style={{ color: falta <= 0 ? C.red : falta <= 1000 ? C.yellow : C.green, fontWeight: 700 }}>
                    {falta <= 0 ? `Vencido (${fmtNum(Math.abs(falta))} km)` : `${fmtNum(falta)} km`}
                  </span>
                ),
                <RowActions onEdit={() => setForm({ ...m })} onDelete={() => setConfirmId(m.id)} confirming={confirmId === m.id} onConfirm={() => remove(m.id)} onCancel={() => setConfirmId(null)} />,
              ];
            })}
          />
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   REPORTES
--------------------------------------------------------------- */
function RelatoriosPage({ veiculos, viagens, custos, abastecimentos, manutencoes, pedidos, tarifas, sucursales }) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [placaFiltro, setPlacaFiltro] = useState("");
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [viagemFiltro, setViagemFiltro] = useState("");

  const inRange = (data) => {
    if (!data) return true;
    if (dataInicio && data < dataInicio) return false;
    if (dataFim && data > dataFim) return false;
    return true;
  };
  const placasDaSucursal = sucursalFiltro ? new Set(veiculos.filter((v) => v.sucursal === sucursalFiltro).map((v) => v.placa)) : null;
  const matchPlaca = (p) => (!placaFiltro || p === placaFiltro) && (!placasDaSucursal || placasDaSucursal.has(p));

  const viagensF = viagens.filter((v) => inRange(v.data) && matchPlaca(v.placa));
  const viagensFIds = new Set(viagensF.map((v) => v.id));
  const custosF = custos.filter((c) => inRange(c.data) && matchPlaca(c.placa));
  const abastecimentosF = abastecimentos.filter((a) => inRange(a.data) && matchPlaca(a.placa));
  const pedidosF = pedidos.filter((p) => viagensFIds.has(p.viagemId));

  const totalCustos = custosF.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalCombustivel = abastecimentosF.reduce((s, a) => s + Number(a.valor || 0), 0);
  const totalLitros = abastecimentosF.reduce((s, a) => s + Number(a.litros || 0), 0);
  const totalGeral = totalCustos + totalCombustivel;
  const totalIngreso = pedidosF.reduce((s, p) => s + freightRevenue(p, tarifas), 0);
  const resultado = totalIngreso - totalGeral;

  const comConsumo = withConsumo(abastecimentos).filter((a) => inRange(a.data) && matchPlaca(a.placa));
  const consumos = comConsumo.filter((a) => a.consumo);
  const consumoMedio = consumos.length ? consumos.reduce((s, a) => s + a.consumo, 0) / consumos.length : null;

  const kmPorVeiculo = useMemo(() => {
    const map = {};
    comConsumo.forEach((a) => { if (a.kmRodado) map[a.placa] = (map[a.placa] || 0) + a.kmRodado; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [comConsumo]);
  const totalKmRodados = kmPorVeiculo.reduce((s, [, km]) => s + km, 0);

  const porCategoria = useMemo(() => {
    const map = {};
    custosF.forEach((c) => { map[c.tipo] = (map[c.tipo] || 0) + Number(c.valor || 0); });
    return Object.entries(map);
  }, [custosF]);

  const periodoLabel = dataInicio || dataFim
    ? `${dataInicio ? dataInicio.split("-").reverse().join("/") : "inicio"} hasta ${dataFim ? dataFim.split("-").reverse().join("/") : "hoy"}`
    : "Todo el período";

  const viagemSeleccionada = viagemFiltro ? viagens.find((v) => v.id === viagemFiltro) : null;
  const pedidosDelViaje = viagemFiltro ? pedidos.filter((p) => p.viagemId === viagemFiltro) : [];
  const custosDelViaje = viagemFiltro ? custos.filter((c) => c.viagemId === viagemFiltro) : [];
  const ingresoDelViaje = pedidosDelViaje.reduce((s, p) => s + freightRevenue(p, tarifas), 0);
  const facturasDelViaje = pedidosDelViaje.reduce((s, p) => s + Number(p.valorFatura || 0), 0);
  const costosDelViaje = custosDelViaje.reduce((s, c) => s + Number(c.valor || 0), 0);
  const resultadoDelViaje = ingresoDelViaje - costosDelViaje;
  const viagensOrdenadasParaFiltro = [...viagensF].sort((a, b) => (b.numero || 0) - (a.numero || 0));

  const [vista, setVista] = useState(null);
  const REPORTES_MENU = [
    { id: "resultado", icon: TrendingUp, title: "Resultado por viaje", desc: "Ingresos, costos, combustible, utilidad y margen." },
    { id: "rendimiento", icon: Truck, title: "Rendimiento de vehículos", desc: "Viajes, kilómetros, combustible y consumo medio." },
    { id: "pedidos", icon: Package, title: "Pedidos", desc: "Pedidos entregados, pendientes, rechazados y devueltos." },
    { id: "costos", icon: DollarSign, title: "Costos operativos", desc: "Gastos agrupados por categoría y viaje." },
    { id: "abastecimientos", icon: Fuel, title: "Abastecimientos", desc: "Litros, montos, precio medio y ciclos de combustible." },
    { id: "diagnostico", icon: Check, title: "Diagnóstico", desc: "Verifique las hojas y referencias del sistema." },
  ];

  const pedidosPorEstado = useMemo(() => {
    const map = {};
    ESTADOS_PEDIDO.forEach((e) => { map[e] = 0; });
    pedidosF.forEach((p) => { const e = p.estado || "Pendiente"; map[e] = (map[e] || 0) + 1; });
    return map;
  }, [pedidosF]);

  const precioMedioLitro = totalLitros ? totalCombustivel / totalLitros : null;

  if (!vista) {
    return (
      <div>
        <SectionHeader title="Reportes" subtitle="Seleccione el tipo de informe que desea consultar" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {REPORTES_MENU.map((r) => (
            <Card
              key={r.id}
              style={{ cursor: "pointer" }}
            >
              <div onClick={() => setVista(r.id)}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(47,107,47,0.10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <r.icon size={20} color={C.yellow} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>{r.title}</div>
                <div style={{ fontSize: 12.5, color: C.muted }}>{r.desc}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Reportes" subtitle="Filtre por período y vehículo, y después genere el reporte en PDF"
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={() => setVista(null)}>← Volver</Button>
            <Button onClick={() => window.print()}><Printer size={15} /> Generar PDF / Imprimir</Button>
          </div>
        } />

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          <Field label="Fecha inicio">
            <input type="date" style={inputStyle} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </Field>
          <Field label="Fecha fin">
            <input type="date" style={inputStyle} value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </Field>
          <Field label="Vehículo">
            <select style={inputStyle} value={placaFiltro} onChange={(e) => setPlacaFiltro(e.target.value)}>
              <option value="">Todos</option>
              {veiculos.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
            </select>
          </Field>
          <Field label="Sucursal">
            <select style={inputStyle} value={sucursalFiltro} onChange={(e) => setSucursalFiltro(e.target.value)}>
              <option value="">Todas</option>
              {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          {vista === "resultado" && (
            <Field label="Detalle de un viaje específico">
              <select style={inputStyle} value={viagemFiltro} onChange={(e) => setViagemFiltro(e.target.value)}>
                <option value="">Ninguno (ver totales generales)</option>
                {viagensOrdenadasParaFiltro.map((v) => (
                  <option key={v.id} value={v.id}>
                    N° {v.numero} · {v.data ? v.data.split("-").reverse().join("/") : "—"} · {v.placa}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </Card>

      {vista === "resultado" && viagemSeleccionada && (
        <div id="report-print-area">
        <Card style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 18, textTransform: "uppercase" }}>
              Detalle del viaje N° {viagemSeleccionada.numero}
            </div>
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
            <PlateChip placa={viagemSeleccionada.placa} /> · {viagemSeleccionada.data ? viagemSeleccionada.data.split("-").reverse().join("/") : "—"}
            {viagemSeleccionada.motorista ? ` · ${viagemSeleccionada.motorista}` : ""}
            {" · "}<EstadoBadge estado={viagemSeleccionada.estado || "En curso"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 18 }}>
            <KPI icon={Receipt} label="Pedidos" value={pedidosDelViaje.length} />
            <KPI icon={DollarSign} label="Valor facturas" value={fmtMoney(facturasDelViaje)} />
            <KPI icon={Receipt} label="Ingreso flete" value={fmtMoney(ingresoDelViaje)} />
            <KPI icon={DollarSign} label="Costos del viaje" value={fmtMoney(costosDelViaje)} />
            <KPI icon={resultadoDelViaje >= 0 ? TrendingUp : TrendingDown} label="Resultado neto" value={fmtMoney(resultadoDelViaje)} highlight={resultadoDelViaje >= 0 ? "green" : "red"} />
          </div>

          <ChartTitle>Pedidos de este viaje</ChartTitle>
          {pedidosDelViaje.length === 0 ? <EmptyState icon={Receipt} text="Este viaje no tiene pedidos cargados." /> : (
            <Card style={{ padding: 0, marginBottom: 18 }}>
              <Table
                headers={["Factura", "Pedido", "Cliente", "Valor factura", "Tipo de flete", "Ingreso flete"]}
                rows={pedidosDelViaje.map((p) => [
                  p.fatura || "—", p.pedido || "—", p.cliente || "—", fmtMoney(p.valorFatura), p.tipoFlete || "—",
                  <span style={{ color: C.green, fontWeight: 700 }}>{fmtMoney(freightRevenue(p, tarifas))}</span>,
                ])}
              />
            </Card>
          )}

          <ChartTitle>Costos de este viaje</ChartTitle>
          {custosDelViaje.length === 0 ? <EmptyState icon={DollarSign} text="Este viaje no tiene costos cargados." /> : (
            <Card style={{ padding: 0 }}>
              <Table
                headers={["Categoría", "Valor", "Fecha", "Obs."]}
                rows={custosDelViaje.map((c) => [
                  c.tipo, fmtMoney(c.valor), c.data ? c.data.split("-").reverse().join("/") : "—", c.obs || "—",
                ])}
              />
            </Card>
          )}
        </Card>
        </div>
      )}

      {!(vista === "resultado" && viagemSeleccionada) && (
      <div id="report-print-area">
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontWeight: 700, fontSize: 20, textTransform: "uppercase" }}>
            {REPORTES_MENU.find((r) => r.id === vista)?.title}{placaFiltro ? ` — ${placaFiltro}` : ""}
          </div>
          <div style={{ color: C.muted, fontSize: 13 }}>{periodoLabel}</div>
        </div>

        {vista === "resultado" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 20 }}>
              <KPI icon={Package} label="Viajes en el período" value={viagensF.length} />
              <KPI icon={Receipt} label="Ingreso por fletes" value={fmtMoney(totalIngreso)} />
              <KPI icon={DollarSign} label="Costos generales" value={fmtMoney(totalCustos)} />
              <KPI icon={Fuel} label="Combustible" value={fmtMoney(totalCombustivel)} />
              <KPI icon={DollarSign} label="Total general (costos)" value={fmtMoney(totalGeral)} />
              <KPI icon={resultado >= 0 ? TrendingUp : TrendingDown} label="Resultado (ingresos − gastos)" value={fmtMoney(resultado)} highlight={resultado >= 0 ? "green" : "red"} />
            </div>
            <Card style={{ marginBottom: 16 }}>
              <ChartTitle>Ingresos por fletes vs. gastos</ChartTitle>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[{ name: "Ingresos", value: totalIngreso }, { name: "Gastos", value: totalGeral }]}>
                    <CartesianGrid stroke={C.border} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 12 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                    <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill={C.green} />
                      <Cell fill={C.red} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </>
        )}

        {vista === "rendimiento" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 20 }}>
              <KPI icon={Package} label="Viajes en el período" value={viagensF.length} />
              <KPI icon={Truck} label="Km rodados" value={totalKmRodados ? `${fmtNum(totalKmRodados)} km` : "—"} />
              <KPI icon={Fuel} label="Combustible" value={fmtMoney(totalCombustivel)} />
              <KPI icon={Gauge} label="Consumo promedio" value={consumoMedio ? `${consumoMedio.toFixed(1)} km/l` : "—"} />
            </div>
            <Card style={{ marginBottom: 16, padding: 0 }}>
              <div style={{ padding: "14px 16px 0" }}><ChartTitle>Km rodados por vehículo</ChartTitle></div>
              {kmPorVeiculo.length === 0 ? <div style={{ padding: 16 }}><EmptyState icon={Truck} text="No hay suficientes cargas de combustible con KM para calcular los km rodados." /></div> : (
                <Table
                  headers={["Vehículo", "Km rodados"]}
                  rows={kmPorVeiculo.map(([placa, km]) => [<PlateChip placa={placa} />, `${fmtNum(km)} km`])}
                />
              )}
            </Card>
            <Card style={{ padding: 0 }}>
              <div style={{ padding: "14px 16px 0" }}><ChartTitle>Viajes del período</ChartTitle></div>
              {viagensF.length === 0 ? <div style={{ padding: 16 }}><EmptyState icon={Package} text="No hay viajes en el período seleccionado." /></div> : (
                <Table
                  headers={["Fecha", "Vehículo", "Chofer", "Estado"]}
                  rows={[...viagensF].sort((a, b) => (a.data || "").localeCompare(b.data || "")).map((v) => [
                    v.data ? v.data.split("-").reverse().join("/") : "—", <PlateChip placa={v.placa} />, v.motorista || "—", <EstadoBadge estado={v.estado || "En curso"} />,
                  ])}
                />
              )}
            </Card>
          </>
        )}

        {vista === "pedidos" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 20 }}>
              {ESTADOS_PEDIDO.map((e) => (
                <KPI key={e} icon={Receipt} label={e} value={pedidosPorEstado[e] || 0} />
              ))}
            </div>
            <Card style={{ padding: 0 }}>
              <div style={{ padding: "14px 16px 0" }}><ChartTitle>Pedidos del período</ChartTitle></div>
              {pedidosF.length === 0 ? <div style={{ padding: 16 }}><EmptyState icon={Receipt} text="No hay pedidos en el período seleccionado." /></div> : (
                <Table
                  headers={["Factura", "Pedido", "Cliente", "Tipo de flete", "Monto", "Estado"]}
                  rows={pedidosF.map((p) => [
                    p.fatura || "—", p.pedido || "—", p.cliente || "—", p.tipoFlete || "—", fmtMoney(p.valorFatura),
                    <EstadoBadge estado={p.estado || "Pendiente"} />,
                  ])}
                />
              )}
            </Card>
          </>
        )}

        {vista === "costos" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 20 }}>
              <KPI icon={DollarSign} label="Costos generales" value={fmtMoney(totalCustos)} />
              <KPI icon={Fuel} label="Combustible" value={fmtMoney(totalCombustivel)} />
              <KPI icon={DollarSign} label="Total general" value={fmtMoney(totalGeral)} />
            </div>
            <Card style={{ padding: 0 }}>
              <div style={{ padding: "14px 16px 0" }}><ChartTitle>Costos por categoría</ChartTitle></div>
              {porCategoria.length === 0 ? <div style={{ padding: 16 }}><EmptyState icon={DollarSign} text="No hay costos en el período seleccionado." /></div> : (
                <Table headers={["Categoría", "Total"]} rows={porCategoria.map(([tipo, valor]) => [tipo, fmtMoney(valor)])} />
              )}
            </Card>
          </>
        )}

        {vista === "abastecimientos" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 20 }}>
              <KPI icon={Fuel} label="Litros cargados" value={`${fmtNum(totalLitros)} L`} />
              <KPI icon={DollarSign} label="Monto total" value={fmtMoney(totalCombustivel)} />
              <KPI icon={DollarSign} label="Precio medio / litro" value={precioMedioLitro ? fmtMoney(precioMedioLitro) : "—"} />
              <KPI icon={Gauge} label="Consumo promedio" value={consumoMedio ? `${consumoMedio.toFixed(1)} km/l` : "—"} />
            </div>
            <Card style={{ padding: 0 }}>
              <div style={{ padding: "14px 16px 0" }}><ChartTitle>Cargas de combustible del período</ChartTitle></div>
              {abastecimentosF.length === 0 ? <div style={{ padding: 16 }}><EmptyState icon={Fuel} text="No hay cargas de combustible en el período seleccionado." /></div> : (
                <Table
                  headers={["Fecha", "Vehículo", "Litros", "Valor", "Consumo"]}
                  rows={comConsumo.sort((a, b) => (a.data || "").localeCompare(b.data || "")).map((a) => [
                    a.data ? a.data.split("-").reverse().join("/") : "—", <PlateChip placa={a.placa} />, fmtNum(a.litros), fmtMoney(a.valor),
                    a.consumo ? `${a.consumo.toFixed(1)} km/l` : "—",
                  ])}
                />
              )}
              <div style={{ padding: 14, fontSize: 12.5, color: C.muted, borderTop: `1px solid ${C.border}` }}>
                Total: {fmtNum(totalLitros)} L · {fmtMoney(totalCombustivel)}
              </div>
            </Card>
          </>
        )}

        {vista === "diagnostico" && (
          <Card style={{ padding: 0 }}>
            <div style={{ padding: "14px 16px 0" }}><ChartTitle>Referencias del sistema</ChartTitle></div>
            <Table
              headers={["Hoja / referencia", "Cantidad de registros"]}
              rows={[
                ["Vehículos", veiculos.length],
                ["Viajes", viagens.length],
                ["Pedidos", pedidos.length],
                ["Costos", custos.length],
                ["Abastecimientos", abastecimentos.length],
                ["Sucursales", (sucursales || []).length],
                ["Tipos de flete", TIPOS_FRETE.length],
                ["Tipos de costo", TIPOS_CUSTO.length],
              ]}
            />
          </Card>
        )}
      </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   TABLE / ROW ACTIONS
--------------------------------------------------------------- */
function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: "left", padding: "12px 14px", color: C.muted, fontWeight: 700,
                fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${C.border}`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: `1px solid ${C.border}` }}>
              {row.map((cell, ci) => <td key={ci} style={{ padding: "10px 14px" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({ onEdit, onDelete, confirming, onConfirm, onCancel }) {
  if (confirming) return <ConfirmRow onConfirm={onConfirm} onCancel={onCancel} />;
  return (
    <span style={{ display: "inline-flex", gap: 10 }}>
      <button onClick={onEdit} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><Pencil size={15} /></button>
      <button onClick={onDelete} style={{ background: "none", border: "none", color: C.red, cursor: "pointer" }}><Trash2 size={15} /></button>
    </span>
  );
}
