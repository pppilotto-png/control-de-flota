"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

type FreightType = "Local" | "Nacional" | "Dobro" | "Devolución" | "Remisión";
type Order = { invoice: string; order: string; client: string; amount: number; freightType: FreightType };
type ImportedOrder = Order & { row: number; tripId: number; error?: string };
type FreightRates = Record<FreightType, number>;
type TripStatus = "En curso" | "En tránsito" | "Cargando" | "Pendiente" | "Finalizado";
type Trip = { id: number; branch: string; startDate: string; endDate?: string; driver: string; helper?: string; vehicle: string; status: TripStatus; kmInitial: number; kmFinal: number; orders: Order[] };
type ImportedTrip = Trip & { row: number; error?: string };
type CostType = "Consumición" | "Peaje" | "Tape" | "Hospedaje" | "Reparo/Mantenimiento" | "Otros";
type TripCost = { id: number; tripId: number; date: string; type: CostType; description: string; quantity: number; unitValue: number };
type ImportedCost = Omit<TripCost, "id"> & { row: number; error?: string };
type Filters = { dateFrom: string; dateTo: string; branch: string; vehicle: string; driver: string; status: string };
type Branch = { id: number; name: string; active: boolean };
type FleetStatus = "Activo" | "Taller" | "Inactivo";
type Vehicle = { id: number; plate: string; active: boolean; fleetStatus?: FleetStatus; brand?: string; model?: string; year?: number; type?: string; branch?: string; currentKm?: number; insuranceExpiry?: string; inspectionExpiry?: string };
type Driver = { id: number; name: string; active: boolean };
type FuelEntry = { id: number; tripId?: number; date: string; vehicle: string; station: string; liters: number; pricePerLiter: number; totalValue: number; odometer: number; fullTank: boolean };
type FuelCycle = { id: string; vehicle: string; startOdometer: number; endOdometer: number; distance: number; cost: number; liters: number; entryIds: number[]; allocations: { tripId: number; km: number; value: number }[] };
type MaintenanceType = "Preventivo" | "Correctivo" | "Neumáticos" | "Documentación" | "Otros";
type Maintenance = { id: number; vehicle: string; date: string; type: MaintenanceType; description: string; km: number; value: number; nextDate?: string; nextKm?: number };
type ServiceRequestStatus = "Nuevo" | "En análisis" | "Aprobado" | "En mantenimiento" | "Concluido";
type ServiceRequestPriority = "Baja" | "Media" | "Alta" | "Urgente";
type ServiceRequest = { id: number; protocol: string; createdAt: string; driver: string; phone: string; vehicle: string; type: MaintenanceType; priority: ServiceRequestPriority; odometer?: number; description: string; status: ServiceRequestStatus; notes?: string; maintenanceId?: number; photoKeys?: string[] };
type DocumentOwner = "Vehículo" | "Chofer";
type FleetDocument = { id: number; ownerType: DocumentOwner; owner: string; type: string; number?: string; issueDate?: string; expiryDate?: string; reminderDays: number; notes?: string; fileKey?: string; fileName?: string; createdAt: string };
type UserRole = "Administrador" | "Operador" | "Consulta";
type ErpUser = { id: number; name: string; email: string; role: UserRole; active: boolean };
type AuditEntry = { id: string; at: string; user: string; action: string; module: string; detail: string };
type TrashEntry = { id: string; deletedAt: string; deletedBy: string; collection: string; label: string; record: Record<string, unknown> };
type BonusReview = { month: string; driver: string; noDamageReturns: boolean };
type HelperAssignment = { driver: string; helper: string };
type HelperBonusReview = { month: string; driver: string; helper: string; noDamageReturns: boolean };
type ErpSnapshot = { version: 1; exportedAt: string; trips: Trip[]; tripCosts: TripCost[]; fuelEntries: FuelEntry[]; maintenance: Maintenance[]; serviceRequests: ServiceRequest[]; documents: FleetDocument[]; branches: Branch[]; vehicles: Vehicle[]; drivers: Driver[]; freightRates: FreightRates; users?: ErpUser[]; auditLog?: AuditEntry[]; trash?: TrashEntry[]; bonusReviews?: BonusReview[]; helperAssignments?: HelperAssignment[]; helperBonusReviews?: HelperBonusReview[] };

const freightTypes: FreightType[] = ["Local", "Nacional", "Dobro", "Devolución", "Remisión"];
const initialRates: FreightRates = { Local: 5, Nacional: 8, Dobro: 10, Devolución: 5, Remisión: 4 };
const costTypes: CostType[] = ["Consumición", "Peaje", "Tape", "Hospedaje", "Reparo/Mantenimiento", "Otros"];

const initialTrips: Trip[] = [];

const initialBranches: Branch[] = [
  { id: 1, name: "Asunción", active: true },
  { id: 2, name: "Ciudad del Este", active: true },
  { id: 3, name: "Encarnación", active: true },
];
const initialVehicles: Vehicle[] = [];
const initialDrivers: Driver[] = [];
const tripStatuses: TripStatus[] = ["Pendiente", "Cargando", "En curso", "En tránsito", "Finalizado"];
const initialCosts: TripCost[] = [];
const initialFuelEntries: FuelEntry[] = [];
const initialMaintenance: Maintenance[] = [];
const initialUsers: ErpUser[] = [{ id: 1, name: "Administrador", email: "admin@example.invalid", role: "Administrador", active: true }];

const money = new Intl.NumberFormat("es-PY", { style: "currency", currency: "PYG", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("es-PY");
const navItems = [["dashboard", "Resumen general", "grid"], ["trips", "Viajes", "truck"], ["orders", "Pedidos", "clipboard"], ["costs", "Costos", "coin"], ["fuel", "Combustible", "fuel"], ["bonuses", "Bonificaciones", "coin"], ["results", "Resultados", "report"], ["fleet", "Flota", "vehicle"], ["documents", "Documentos", "report"], ["requests", "Chamados", "clipboard"], ["settings", "Configuración", "settings"]];
const invoiceTotal = (trip: Trip) => trip.orders.reduce((sum, order) => sum + order.amount, 0);
const freightValue = (trip: Trip, rates: FreightRates) => Math.round(trip.orders.reduce((sum, order) => sum + order.amount * rates[order.freightType] / 100, 0));

function calculateFuelCycles(entries: FuelEntry[], trips: Trip[]) {
  const cycles: FuelCycle[] = [];
  const openCycles: { vehicle: string; startOdometer: number; entries: FuelEntry[] }[] = [];
  Array.from(new Set(entries.map((entry) => entry.vehicle))).forEach((vehicle) => {
    const sorted = entries.filter((entry) => entry.vehicle === vehicle).sort((a, b) => a.odometer - b.odometer);
    const fullIndexes = sorted.map((entry, index) => entry.fullTank ? index : -1).filter((index) => index >= 0);
    for (let index = 0; index < fullIndexes.length - 1; index += 1) {
      const start = sorted[fullIndexes[index]];
      const end = sorted[fullIndexes[index + 1]];
      const cycleEntries = sorted.slice(fullIndexes[index] + 1, fullIndexes[index + 1] + 1);
      const distance = end.odometer - start.odometer;
      if (distance <= 0) continue;
      const cost = cycleEntries.reduce((sum, entry) => sum + entry.totalValue, 0);
      const liters = cycleEntries.reduce((sum, entry) => sum + entry.liters, 0);
      const allocations = trips.filter((trip) => trip.vehicle === vehicle && trip.kmFinal > trip.kmInitial).map((trip) => {
        const km = Math.max(0, Math.min(trip.kmFinal, end.odometer) - Math.max(trip.kmInitial, start.odometer));
        return { tripId: trip.id, km, value: Math.round(cost * km / distance) };
      }).filter((allocation) => allocation.km > 0);
      cycles.push({ id: `${vehicle}-${start.odometer}-${end.odometer}`, vehicle, startOdometer: start.odometer, endOdometer: end.odometer, distance, cost, liters, entryIds: cycleEntries.map((entry) => entry.id), allocations });
    }
    if (fullIndexes.length) {
      const lastFullIndex = fullIndexes.at(-1)!;
      openCycles.push({ vehicle, startOdometer: sorted[lastFullIndex].odometer, entries: sorted.slice(lastFullIndex + 1) });
    }
  });
  const allocationByTrip = new Map<number, number>();
  cycles.forEach((cycle) => cycle.allocations.forEach((allocation) => allocationByTrip.set(allocation.tripId, (allocationByTrip.get(allocation.tripId) ?? 0) + allocation.value)));
  return { cycles, openCycles, allocationByTrip };
}

function Icon({ name }: { name: string }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "grid") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  if (name === "truck" || name === "vehicle") return <svg {...common}><path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>;
  if (name === "clipboard") return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6"/></svg>;
  if (name === "coin") return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.8-.7-1.8-1-3-1-1.7 0-3 1-3 2.3 0 3.7 6 1.4 6 4.7 0 1.3-1.3 2.2-3 2.2-1.2 0-2.4-.4-3.2-1.2M12 5.5v13"/></svg>;
  if (name === "fuel") return <svg {...common}><path d="M5 21V4a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17M3 21h15M8 6h5v4H8zM16 7h2l2 3v7a1.5 1.5 0 0 0 3 0v-6l-2-2"/></svg>;
  if (name === "report") return <svg {...common}><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6M9 8h2"/></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>;
  return <svg {...common}><path d="M12 3v18M5 12h14"/></svg>;
}

export default function Home() {
  const [active, setActive] = useState("dashboard");
  const [trips, setTrips] = useState(initialTrips);
  const [modal, setModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [finishingTrip, setFinishingTrip] = useState<Trip | null>(null);
  const [invoiceRows, setInvoiceRows] = useState<{ id: number }[]>([]);
  const [tripCostRows, setTripCostRows] = useState([{ id: 1 }]);
  const [freightRates, setFreightRates] = useState<FreightRates>(initialRates);
  const [tripCosts, setTripCosts] = useState<TripCost[]>(initialCosts);
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>(initialFuelEntries);
  const [maintenance, setMaintenance] = useState<Maintenance[]>(initialMaintenance);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [documents, setDocuments] = useState<FleetDocument[]>([]);
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [users, setUsers] = useState<ErpUser[]>(initialUsers);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [bonusReviews, setBonusReviews] = useState<BonusReview[]>([]);
  const [helperAssignments, setHelperAssignments] = useState<HelperAssignment[]>([]);
  const [helperBonusReviews, setHelperBonusReviews] = useState<HelperBonusReview[]>([]);
  const [session, setSession] = useState<{ name: string; email: string; role: UserRole }>({ name: "Administrador", email: "admin@example.invalid", role: "Administrador" });
  const [costModal, setCostModal] = useState(false);
  const [fuelModal, setFuelModal] = useState(false);
  const [editingCost, setEditingCost] = useState<TripCost | null>(null);
  const [editingFuel, setEditingFuel] = useState<FuelEntry | null>(null);
  const [reportTrip, setReportTrip] = useState<Trip | null>(null);
  const [tripTab, setTripTab] = useState<"data" | "orders" | "costs" | "result">("data");
  const [kmInitialDraft, setKmInitialDraft] = useState(0);
  const [kmFinalDraft, setKmFinalDraft] = useState(0);
  const [driverDraft, setDriverDraft] = useState("");
  const [helperDraft, setHelperDraft] = useState("");
  const [toast, setToast] = useState("");
  const [tripFormError, setTripFormError] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"daily" | "monthly">("daily");
  const [filters, setFilters] = useState<Filters>({ dateFrom: "", dateTo: "", branch: "", vehicle: "", driver: "", status: "" });

  useEffect(() => {
    let activeRequest = true;
    fetch("/api/state")
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar la base de datos.");
        return response.json();
      })
      .then(({ state }) => {
        if (!activeRequest) return;
        if (state) {
          setTrips(state.trips ?? initialTrips);
          setTripCosts(state.tripCosts ?? initialCosts);
          setFuelEntries((state.fuelEntries ?? initialFuelEntries).map((entry: FuelEntry & { pricePerLiter?: number }) => ({
            ...entry,
            pricePerLiter: entry.pricePerLiter ?? (entry.liters > 0 ? entry.totalValue / entry.liters : 0),
          })));
          setMaintenance(state.maintenance ?? initialMaintenance);
          setServiceRequests(state.serviceRequests ?? []);
          const loadedVehicles: Vehicle[] = state.vehicles ?? initialVehicles;
          const loadedDocuments: FleetDocument[] = state.documents ?? [];
          const migratedDinatrans = loadedVehicles
            .filter((vehicle) => vehicle.inspectionExpiry && !loadedDocuments.some((document) => document.ownerType === "Vehículo" && document.owner === vehicle.plate && document.type.toUpperCase() === "DINATRAN"))
            .map((vehicle, index) => ({
              id: (loadedDocuments.length ? Math.max(...loadedDocuments.map((document) => document.id)) : 0) + index + 1,
              ownerType: "Vehículo" as DocumentOwner,
              owner: vehicle.plate,
              type: "DINATRAN",
              expiryDate: vehicle.inspectionExpiry,
              reminderDays: 30,
              notes: "Transferido automáticamente desde Flota.",
              createdAt: new Date().toISOString(),
            }));
          setDocuments([...migratedDinatrans, ...loadedDocuments]);
          setBranches(state.branches ?? initialBranches);
          setVehicles(loadedVehicles.map(({ inspectionExpiry: _legacyDinatrán, ...vehicle }) => vehicle));
          setDrivers(state.drivers ?? initialDrivers);
          setFreightRates(state.freightRates ?? initialRates);
          setUsers((state.users ?? initialUsers).map((user: ErpUser) => String(user.role) === "Financiero" ? { ...user, role: "Consulta" as UserRole } : user));
          setAuditLog(state.auditLog ?? []);
          setTrash(state.trash ?? []);
          setBonusReviews(state.bonusReviews ?? []);
          setHelperAssignments(state.helperAssignments ?? []);
          setHelperBonusReviews(state.helperBonusReviews ?? []);
        }
        if (state?.session) setSession(state.session.role === "Financiero" ? { ...state.session, role: "Consulta" } : state.session);
        setDataReady(true);
        setSaveStatus("saved");
      })
      .catch(() => {
        if (!activeRequest) return;
        setDataReady(true);
        setSaveStatus("error");
        setToast("No se pudo conectar con la base de datos. Verifique la conexión.");
      });
    return () => { activeRequest = false; };
  }, []);

  useEffect(() => {
    if (!dataReady) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus("saving");
      fetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trips, tripCosts, fuelEntries, maintenance, serviceRequests, documents, branches, vehicles, drivers, freightRates, users, auditLog, trash, bonusReviews, helperAssignments, helperBonusReviews }),
      })
        .then((response) => {
          if (!response.ok) throw new Error();
          setSaveStatus("saved");
        })
        .catch(() => setSaveStatus("error"));
    }, 650);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dataReady, trips, tripCosts, fuelEntries, maintenance, serviceRequests, documents, branches, vehicles, drivers, freightRates, users, auditLog, trash, bonusReviews, helperAssignments, helperBonusReviews]);
  useEffect(() => {
    if (active !== "requests" || !dataReady) return;
    const refresh = () => fetch("/api/chamados").then((response) => response.ok ? response.json() : Promise.reject()).then(({ requests }) => setServiceRequests(requests ?? [])).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [active, dataReady]);
  const filteredTrips = useMemo(() => trips.filter((trip) =>
    (!filters.dateFrom || trip.startDate >= filters.dateFrom) &&
    (!filters.dateTo || trip.startDate <= filters.dateTo) &&
    (!filters.branch || trip.branch === filters.branch) &&
    (!filters.vehicle || trip.vehicle === filters.vehicle) &&
    (!filters.driver || trip.driver === filters.driver) &&
    (!filters.status || trip.status === filters.status)
  ), [trips, filters]);
  const filteredTripIds = useMemo(() => new Set(filteredTrips.map((trip) => trip.id)), [filteredTrips]);
  const filteredCosts = useMemo(() => tripCosts.filter((cost) => filteredTripIds.has(cost.tripId) && (!filters.dateFrom || cost.date >= filters.dateFrom) && (!filters.dateTo || cost.date <= filters.dateTo)), [tripCosts, filteredTripIds, filters.dateFrom, filters.dateTo]);
  const filteredFuel = useMemo(() => fuelEntries.filter((entry) => (!filters.dateFrom || entry.date >= filters.dateFrom) && (!filters.dateTo || entry.date <= filters.dateTo) && (!filters.vehicle || entry.vehicle === filters.vehicle)), [fuelEntries, filters.dateFrom, filters.dateTo, filters.vehicle]);
  const fuelCycles = useMemo(() => calculateFuelCycles(fuelEntries, trips), [fuelEntries, trips]);
  const revenue = useMemo(() => filteredTrips.reduce((sum, trip) => sum + freightValue(trip, freightRates), 0), [filteredTrips, freightRates]);
  const invoiced = useMemo(() => filteredTrips.reduce((sum, trip) => sum + invoiceTotal(trip), 0), [filteredTrips]);
  const costs = useMemo(() => filteredCosts.reduce((sum, cost) => sum + cost.quantity * cost.unitValue, 0), [filteredCosts]);
  const fuelCost = useMemo(() => filteredTrips.reduce((sum, trip) => sum + (fuelCycles.allocationByTrip.get(trip.id) ?? 0), 0), [filteredTrips, fuelCycles]);
  const result = revenue - costs - fuelCost;
  const financialSeries = useMemo(() => {
    const periodKey = (date: string) => chartPeriod === "daily" ? date : date.slice(0, 7);
    const sourceDates = [...filteredTrips.map((trip) => trip.startDate), ...filteredCosts.map((cost) => cost.date)].filter(Boolean).sort();
    let keys: string[];
    if (chartPeriod === "daily" && sourceDates.length) {
      const lastDataDate = sourceDates[sourceDates.length - 1];
      const startDate = filters.dateFrom || `${lastDataDate.slice(0, 7)}-01`;
      const endDate = filters.dateTo || lastDataDate;
      const cursor = new Date(`${startDate}T12:00:00Z`);
      const end = new Date(`${endDate}T12:00:00Z`);
      keys = [];
      while (cursor <= end) {
        keys.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    } else {
      keys = Array.from(new Set(sourceDates.map(periodKey))).slice(-6);
    }
    return keys.map((key) => {
      const matches = (date: string) => periodKey(date) === key;
      const bucketTrips = filteredTrips.filter((trip) => matches(trip.startDate));
      const fletes = bucketTrips.reduce((sum, trip) => sum + freightValue(trip, freightRates), 0);
      const directCosts = filteredCosts.filter((cost) => matches(cost.date)).reduce((sum, cost) => sum + cost.quantity * cost.unitValue, 0);
      const fuel = bucketTrips.reduce((sum, trip) => sum + (fuelCycles.allocationByTrip.get(trip.id) ?? 0), 0);
      const totalCosts = directCosts + fuel;
      const label = chartPeriod === "daily"
        ? new Intl.DateTimeFormat("es-PY", { day: "2-digit", month: "2-digit" }).format(new Date(`${key}T12:00:00`))
        : new Intl.DateTimeFormat("es-PY", { month: "short", year: "2-digit" }).format(new Date(`${key}-01T12:00:00`)).replace(".", "");
      return { key, label, fletes, costs: totalCosts, result: fletes - totalCosts };
    });
  }, [chartPeriod, filteredTrips, filteredCosts, freightRates, fuelCycles]);
  const financialChartMax = Math.max(1, ...financialSeries.flatMap((item) => [item.fletes, item.costs, Math.max(0, item.result)]));
  const chartScaleMax = financialChartMax >= 1000000 ? Math.ceil(financialChartMax / 1000000) * 1000000 : Math.ceil(financialChartMax / 100000) * 100000;
  const chartX = (index: number) => financialSeries.length <= 1 ? 355 : 10 + index * 690 / (financialSeries.length - 1);
  const chartY = (value: number) => 138 - Math.max(0, value) / chartScaleMax * 118;
  const chartPoints = (key: "fletes" | "costs" | "result") => financialSeries.map((item, index) => `${chartX(index)},${chartY(item[key])}`).join(" ");
  const axisLabel = (value: number) => value === 0 ? "0" : value >= 1000000 ? `${(value / 1000000).toFixed(value % 1000000 ? 1 : 0).replace(".", ",")} M` : `${Math.round(value / 1000)} mil`;
  const isReadOnly = session.role === "Consulta";
  const visibleNavItems = navItems.filter(([key]) => session.role === "Administrador" ? true :
    session.role === "Consulta" ? key !== "settings" :
    ["dashboard", "trips", "orders", "costs", "fuel", "bonuses", "fleet", "documents", "requests"].includes(key));
  const activeFilterCount = [filters.dateFrom, filters.dateTo, filters.branch, filters.vehicle, filters.driver, filters.status].filter(Boolean).length;
  const activeBranches = branches.filter((branch) => branch.active);
  const activeVehicles = vehicles.filter((vehicle) => vehicle.active);
  const activeDrivers = drivers.filter((driver) => driver.active);
  const formatFilterDate = (value: string) => value ? new Intl.DateTimeFormat("es-PY").format(new Date(`${value}T12:00:00`)) : "Sin límite";
  const snapshot: ErpSnapshot = { version: 1, exportedAt: new Date().toISOString(), trips, tripCosts, fuelEntries, maintenance, serviceRequests, documents, branches, vehicles, drivers, freightRates, users, auditLog, trash, bonusReviews, helperAssignments, helperBonusReviews };

  function restoreSnapshot(restored: ErpSnapshot) {
    setTrips(restored.trips);
    setTripCosts(restored.tripCosts);
    setFuelEntries(restored.fuelEntries);
    setMaintenance(restored.maintenance ?? []);
    setServiceRequests(restored.serviceRequests ?? []);
    setDocuments(restored.documents ?? []);
    setBranches(restored.branches);
    setVehicles(restored.vehicles);
    setDrivers(restored.drivers);
    setFreightRates(restored.freightRates);
    setUsers((restored.users ?? initialUsers).map((user) => String(user.role) === "Financiero" ? { ...user, role: "Consulta" as UserRole } : user));
    setAuditLog(restored.auditLog ?? []);
    setTrash(restored.trash ?? []);
    setBonusReviews(restored.bonusReviews ?? []);
    setHelperAssignments(restored.helperAssignments ?? []);
    setHelperBonusReviews(restored.helperBonusReviews ?? []);
    setToast("Copia restaurada correctamente. Los datos se están guardando.");
    setTimeout(() => setToast(""), 4200);
  }

  function saveCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved: TripCost = {
      id: editingCost?.id ?? (tripCosts.length ? Math.max(...tripCosts.map((cost) => cost.id)) + 1 : 1),
      tripId: Number(form.get("tripId")),
      date: String(form.get("date")),
      type: String(form.get("type")) as CostType,
      description: String(form.get("description") || ""),
      quantity: Number(form.get("quantity") || 1),
      unitValue: Number(form.get("unitValue") || 0),
    };
    setTripCosts(editingCost ? tripCosts.map((cost) => cost.id === saved.id ? saved : cost) : [saved, ...tripCosts]);
    setCostModal(false);
    setEditingCost(null);
    setToast(`Costo ${editingCost ? "actualizado" : "registrado"}: ${money.format(saved.quantity * saved.unitValue)}.`);
    setTimeout(() => setToast(""), 3600);
  }

  function saveFuel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedTripId = Number(form.get("tripId")) || undefined;
    const selectedTrip = selectedTripId ? trips.find((trip) => trip.id === selectedTripId) : undefined;
    const liters = Number(form.get("liters") || 0);
    const pricePerLiter = Number(form.get("pricePerLiter") || 0);
    const saved: FuelEntry = {
      id: editingFuel?.id ?? (fuelEntries.length ? Math.max(...fuelEntries.map((entry) => entry.id)) + 1 : 1),
      tripId: selectedTripId,
      date: String(form.get("date")),
      vehicle: selectedTrip?.vehicle ?? String(form.get("vehicle")),
      station: String(form.get("station") || ""),
      liters,
      pricePerLiter,
      totalValue: Math.round(liters * pricePerLiter),
      odometer: Number(form.get("odometer") || 0),
      fullTank: form.get("fullTank") === "on",
    };
    setFuelEntries(editingFuel ? fuelEntries.map((entry) => entry.id === saved.id ? saved : entry) : [saved, ...fuelEntries]);
    setFuelModal(false);
    setEditingFuel(null);
    setToast(`Carga ${editingFuel ? "actualizada" : "registrada"}: ${number.format(saved.liters)} L — ${money.format(saved.totalValue)}.`);
    setTimeout(() => setToast(""), 3600);
  }

  function saveTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const orders = invoiceRows.map((row) => ({ invoice: String(form.get(`invoice-${row.id}`) || ""), order: String(form.get(`order-${row.id}`) || ""), client: String(form.get(`client-${row.id}`) || ""), amount: Number(form.get(`amount-${row.id}`) || 0), freightType: String(form.get(`freightType-${row.id}`) || "Local") as FreightType })).filter((order) => order.invoice && order.order && order.client && order.amount > 0);
    const saved: Trip = { id: editingTrip?.id ?? (trips.length ? Math.max(...trips.map((trip) => trip.id)) + 1 : 1), branch: String(form.get("branch") || ""), startDate: String(form.get("startDate") || ""), endDate: String(form.get("endDate") || "") || undefined, driver: String(form.get("driver") || "Por definir"), helper: String(form.get("helper") || "") || undefined, vehicle: String(form.get("vehicle") || "Por definir"), status: String(form.get("status") || "Pendiente") as TripStatus, kmInitial: Number(form.get("kmInitial") || 0), kmFinal: Number(form.get("kmFinal") || 0), orders };
    if (!saved.branch || !saved.startDate || !saved.driver || !saved.vehicle) {
      setTripTab("data");
      setTripFormError("Complete sucursal, chapa, chofer y fecha inicial.");
      return;
    }
    if (saved.endDate && saved.endDate < saved.startDate) {
      setTripTab("data");
      setTripFormError("La fecha final no puede ser anterior a la fecha inicial.");
      return;
    }
    if (saved.kmFinal > 0 && saved.kmFinal < saved.kmInitial) {
      setTripTab("data");
      setTripFormError("El kilometraje final no puede ser menor que el inicial.");
      return;
    }
    if (saved.status === "Finalizado" && (!saved.endDate || saved.kmFinal <= saved.kmInitial)) {
      setTripTab("data");
      setTripFormError("Para finalizar, informe la fecha final y un kilometraje final mayor que el inicial.");
      return;
    }
    setTripFormError("");
    const firstCostId = tripCosts.length ? Math.max(...tripCosts.map((cost) => cost.id)) + 1 : 1;
    const newCosts = tripCostRows.map((row, index) => ({ id: firstCostId + index, tripId: saved.id, date: String(form.get(`costDate-${row.id}`) || saved.startDate), type: String(form.get(`costType-${row.id}`) || "Consumición") as CostType, description: String(form.get(`costDescription-${row.id}`) || ""), quantity: Number(form.get(`costQuantity-${row.id}`) || 0), unitValue: Number(form.get(`costUnitValue-${row.id}`) || 0) })).filter((cost) => cost.quantity > 0 && cost.unitValue > 0);
    setTrips(editingTrip ? trips.map((trip) => trip.id === saved.id ? saved : trip) : [saved, ...trips]); setModal(false); setInvoiceRows([]);
    if (newCosts.length) setTripCosts([...newCosts, ...tripCosts]);
    setTripCostRows([{ id: 1 }]);
    if (!editingTrip) {
      setFilters({ dateFrom: "", dateTo: "", branch: "", vehicle: "", driver: "", status: "" });
      setActive("trips");
    }
    setToast(editingTrip ? `Viaje N.º ${saved.id} actualizado correctamente.` : `Viaje creado. Flete calculado: ${money.format(freightValue(saved, freightRates))}`);
    setEditingTrip(null);
    setTimeout(() => setToast(""), 3600);
  }

  function openTrip(trip?: Trip) {
    setTripFormError("");
    setEditingTrip(trip ?? null);
    setKmInitialDraft(trip?.kmInitial ?? 0);
    setKmFinalDraft(trip?.kmFinal ?? 0);
    setDriverDraft(trip?.driver ?? "");
    setHelperDraft(trip?.helper ?? helperAssignments.find((assignment) => assignment.driver === trip?.driver)?.helper ?? "");
    setTripTab("data");
    setInvoiceRows(trip ? trip.orders.map((_, index) => ({ id: index + 1 })) : []);
    setTripCostRows([{ id: 1 }]);
    setModal(true);
  }

  function finishTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!finishingTrip) return;
    const form = new FormData(event.currentTarget);
    const endDate = String(form.get("endDate") || "");
    const kmFinal = Number(form.get("kmFinal") || 0);
    if (endDate < finishingTrip.startDate || kmFinal <= finishingTrip.kmInitial) {
      setToast("Revise la fecha final y el kilometraje: deben ser posteriores al inicio del viaje.");
      setTimeout(() => setToast(""), 4200);
      return;
    }
    setTrips(trips.map((trip) => trip.id === finishingTrip.id ? { ...trip, endDate, kmFinal, status: "Finalizado" } : trip));
    setToast(`Viaje N.º ${finishingTrip.id} finalizado correctamente.`); setFinishingTrip(null);
    setTimeout(() => setToast(""), 3600);
  }

  function deleteTrip(trip: Trip) {
    const linkedCosts = tripCosts.filter((cost) => cost.tripId === trip.id);
    const costNotice = linkedCosts.length
      ? ` También se enviarán ${linkedCosts.length} costo(s) vinculado(s).`
      : "";
    if (!window.confirm(`¿Enviar el viaje N.º ${trip.id} a la papelera?${costNotice}\n\nPodrá restaurarlo después desde Configuración → Papelera.`)) return;
    setTrips(trips.filter((item) => item.id !== trip.id));
    if (linkedCosts.length) setTripCosts(tripCosts.filter((cost) => cost.tripId !== trip.id));
    setReportTrip((current) => current?.id === trip.id ? null : current);
    setToast(`Viaje N.º ${trip.id} enviado a la papelera.`);
    setTimeout(() => setToast(""), 4200);
  }

  const sectionTitle = navItems.find(([key]) => key === active)?.[1] || "Resumen general";
  const modalFreight = editingTrip ? freightValue(editingTrip, freightRates) : 0;
  const modalCosts = editingTrip ? tripCosts.filter((cost) => cost.tripId === editingTrip.id).reduce((sum, cost) => sum + cost.quantity * cost.unitValue, 0) : 0;
  const modalFuel = editingTrip ? fuelCycles.allocationByTrip.get(editingTrip.id) ?? 0 : 0;
  const modalResult = modalFreight - modalCosts - modalFuel;
  const modalMargin = modalFreight > 0 ? modalResult / modalFreight * 100 : 0;
  const today = new Date().toISOString().slice(0, 10);
  const latestVehicleKm = (plate: string) => Math.max(
    0,
    vehicles.find((vehicle) => vehicle.plate === plate)?.currentKm ?? 0,
    ...trips.filter((trip) => trip.vehicle === plate).flatMap((trip) => [trip.kmInitial, trip.kmFinal]),
    ...fuelEntries.filter((entry) => entry.vehicle === plate).map((entry) => entry.odometer),
  );
  const latestVehicleDriver = (plate: string) => trips
    .filter((trip) => trip.vehicle === plate && trip.driver)
    .sort((a, b) => b.id - a.id)[0]?.driver ?? "";
  const helperForDriver = (driver: string) => helperAssignments.find((assignment) => assignment.driver === driver)?.helper ?? "";
  const registeredHelpers = Array.from(new Set(helperAssignments.map((assignment) => assignment.helper).filter(Boolean)));
  const daysUntil = (date?: string) => date ? Math.ceil((new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000) : null;
  const operationalAlerts = [
    ...maintenance.flatMap((item) => {
      const kmRemaining = item.nextKm ? item.nextKm - latestVehicleKm(item.vehicle) : null;
      const daysRemaining = daysUntil(item.nextDate);
      const overdue = (kmRemaining !== null && kmRemaining <= 0) || (daysRemaining !== null && daysRemaining <= 0);
      const upcoming = (kmRemaining !== null && kmRemaining > 0 && kmRemaining <= 1000) || (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 30);
      if (!overdue && !upcoming) return [];
      const detail = [
        kmRemaining !== null ? kmRemaining <= 0 ? `${number.format(Math.abs(kmRemaining))} km vencidos` : `faltan ${number.format(kmRemaining)} km` : "",
        daysRemaining !== null ? daysRemaining <= 0 ? `${Math.abs(daysRemaining)} día(s) vencido` : `faltan ${daysRemaining} días` : "",
      ].filter(Boolean).join(" · ");
      return [{ id: `maintenance-${item.id}`, level: overdue ? "overdue" : "upcoming", module: "fleet", category: "Mantenimiento", title: `${item.vehicle} — ${item.description}`, detail }];
    }),
    ...documents.flatMap((item) => {
      const days = daysUntil(item.expiryDate);
      if (days === null || days > item.reminderDays) return [];
      return [{ id: `document-${item.id}`, level: days <= 0 ? "overdue" : "upcoming", module: "documents", category: "Documento", title: `${item.type} — ${item.owner}`, detail: days < 0 ? `${Math.abs(days)} día(s) vencido` : days === 0 ? "Vence hoy" : `Vence en ${days} días` }];
    }),
    ...serviceRequests.filter((item) => item.status !== "Concluido" && (item.priority === "Urgente" || item.status === "Nuevo")).map((item) => ({
      id: `request-${item.id}`, level: item.priority === "Urgente" ? "overdue" : "upcoming", module: "requests", category: "Chamado", title: `${item.protocol} — ${item.vehicle}`, detail: `${item.priority} · ${item.status}`,
    })),
  ].sort((a, b) => (a.level === b.level ? 0 : a.level === "overdue" ? -1 : 1));
  return <main className={`app-shell ${isReadOnly ? "read-only" : ""}`}>
    <aside className="sidebar">
      <div className="logo"><strong>Frete</strong><span>Control</span></div>
      <nav aria-label="Navegación principal">{visibleNavItems.map(([key, label, icon]) => <button key={key} className={active === key ? "nav-item active" : "nav-item"} onClick={() => setActive(key)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
      <div className="profile"><span className="avatar">{session.name.split(" ").map((part) => part[0]).slice(0,2).join("").toUpperCase()}</span><span><strong>{session.name}</strong><small>{session.role}</small></span><span>⌄</span></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><div><p className="eyebrow">FreteControl ERP</p><h1>{sectionTitle}</h1></div><div className="actions"><span className={`save-status ${saveStatus}`} aria-live="polite">{isReadOnly ? "Solo consulta" : saveStatus === "loading" ? "Cargando…" : saveStatus === "saving" ? "Guardando…" : saveStatus === "saved" ? "✓ Guardado" : "⚠ Sin conexión"}</span><button className="date-button" aria-label="Cambiar periodo" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>▣ <span>{formatFilterDate(filters.dateFrom)} – {formatFilterDate(filters.dateTo)}</span>⌄</button><button className={activeFilterCount ? "icon-button filter-active" : "icon-button"} aria-label="Abrir filtros" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>⌁{activeFilterCount > 0 && <b>{activeFilterCount}</b>}</button>{["Administrador", "Operador"].includes(session.role) && <button className="primary" onClick={() => openTrip()} disabled={!dataReady}><Icon name="plus"/>Nuevo viaje</button>}</div></header>
      {filtersOpen && <section className="filter-panel" aria-label="Filtros de viajes">
        <div className="filter-heading"><div><p className="eyebrow">Consulta</p><h2>Filtrar información</h2></div><button className="close-filter" onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">×</button></div>
        <div className="filter-grid">
          <label>Desde<input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })}/></label>
          <label>Hasta<input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })}/></label>
          <label>Sucursal<select value={filters.branch} onChange={(event) => setFilters({ ...filters, branch: event.target.value })}><option value="">Todas</option>{activeBranches.map((branch) => <option key={branch.id}>{branch.name}</option>)}</select></label>
          <label>Chapa<select value={filters.vehicle} onChange={(event) => setFilters({ ...filters, vehicle: event.target.value })}><option value="">Todas</option>{activeVehicles.map((vehicle) => <option key={vehicle.id}>{vehicle.plate}</option>)}</select></label>
          <label>Chofer<select value={filters.driver} onChange={(event) => setFilters({ ...filters, driver: event.target.value })}><option value="">Todos</option>{activeDrivers.map((driver) => <option key={driver.id}>{driver.name}</option>)}</select></label>
          <label>Estado<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos</option>{tripStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
        <div className="filter-footer"><span><strong>{filteredTrips.length}</strong> viaje(s) encontrado(s)</span><button onClick={() => setFilters({ dateFrom: "", dateTo: "", branch: "", vehicle: "", driver: "", status: "" })}>Limpiar filtros</button></div>
      </section>}
      {active === "dashboard" ? <>
        <section className="metrics" aria-label="Indicadores principales">
          <article><span className="metric-icon">₲</span><div><small>Fletes</small><strong>{money.format(revenue)}</strong><em>Calculados sobre facturas</em></div></article>
          <article><span className="metric-icon neutral">▤</span><div><small>Total facturado</small><strong>{money.format(invoiced)}</strong><em className="muted">{filteredTrips.reduce((s,t) => s + t.orders.length, 0)} pedidos registrados</em></div></article>
          <article><span className="metric-icon positive">↗</span><div><small>Resultado</small><strong className="green">{money.format(result)}</strong><em>Después de costos y combustible</em></div></article>
          <article><span className="metric-icon">▱</span><div><small>Viajes activos</small><strong>{filteredTrips.filter((trip) => trip.status !== "Finalizado").length}</strong><em>Control por kilometraje</em></div></article>
        </section>
        <section className="financial-card"><div className="summary"><div className="card-heading"><h2>Resumen financiero</h2><select className="chart-period-select" value={chartPeriod} onChange={(event) => setChartPeriod(event.target.value as "daily" | "monthly")} aria-label="Periodo del gráfico"><option value="daily">Diario</option><option value="monthly">Mensual</option></select></div><p><span><i className="dot revenue"/>Fletes</span><strong>{money.format(revenue)}</strong></p><p><span><i className="dot costs"/>Costos</span><strong>{money.format(costs + fuelCost)}</strong></p><p><span><i className="dot profit"/>Resultado</span><strong className={result >= 0 ? "green" : "negative-value"}>{money.format(result)}</strong></p></div><div className="chart" aria-label="Gráfico del resumen financiero"><div className="chart-grid"><span>{axisLabel(chartScaleMax)}</span><span>{axisLabel(chartScaleMax * 2 / 3)}</span><span>{axisLabel(chartScaleMax / 3)}</span><span>0</span></div>{financialSeries.length ? <div className="chart-series-scroll"><div className="chart-series" style={{ minWidth: `${Math.max(720, financialSeries.length * 48)}px` }}><svg viewBox="0 0 720 150" role="img" aria-label={chartPeriod === "daily" ? "Fletes, costos y resultado por día" : "Fletes, costos y resultado por mes"}><polyline className="line revenue-line" points={chartPoints("fletes")}/><polyline className="line costs-line" points={chartPoints("costs")}/><polyline className="line profit-line" points={chartPoints("result")}/>{financialSeries.map((item, index) => <g key={item.key}><circle className="chart-point revenue-point" cx={chartX(index)} cy={chartY(item.fletes)} r="3"/><circle className="chart-point costs-point" cx={chartX(index)} cy={chartY(item.costs)} r="3"/><circle className="chart-point profit-point" cx={chartX(index)} cy={chartY(item.result)} r="3"/></g>)}</svg><div className="days">{financialSeries.map((item) => <span key={item.key}>{item.label}</span>)}</div></div></div> : <div className="chart-empty">No hay datos para el periodo seleccionado.</div>}</div></section>
        <section className="alerts-center" aria-label="Central de alertas operacionales">
          <div className="card-heading"><div><p className="eyebrow">Atención requerida</p><h2>Central de alertas operacionales</h2></div><strong>{operationalAlerts.length} alerta(s)</strong></div>
          <div className="alert-summary">
            <span><strong>{operationalAlerts.filter((item) => item.level === "overdue").length}</strong><small>Vencidos o urgentes</small></span>
            <span><strong>{operationalAlerts.filter((item) => item.level === "upcoming").length}</strong><small>Próximos o nuevos</small></span>
            <span><strong>{serviceRequests.filter((item) => item.status === "Nuevo").length}</strong><small>Chamados nuevos</small></span>
          </div>
          <div className="alert-list">
            {operationalAlerts.length === 0 ? <div className="alerts-empty">✓ No hay alertas pendientes. La operación está al día.</div> : operationalAlerts.slice(0, 8).map((item) => <button key={item.id} className={`alert-row ${item.level}`} onClick={() => setActive(item.module)}>
              <span className="alert-indicator">{item.level === "overdue" ? "!" : "⌛"}</span>
              <span><small>{item.category}</small><strong>{item.title}</strong><em>{item.detail}</em></span>
              <b>Ver →</b>
            </button>)}
          </div>
          {operationalAlerts.length > 8 && <p className="alerts-more">Mostrando 8 de {operationalAlerts.length} alertas. Abra cada módulo para consultar todos.</p>}
        </section>
        <TripTable trips={filteredTrips.filter((trip) => trip.status !== "Finalizado")} rates={freightRates} onAll={() => setActive("trips")} onEdit={openTrip} onFinish={setFinishingTrip} onReport={setReportTrip}/>
      </> : active === "trips" ? <TripsModule trips={filteredTrips} allTrips={trips} setTrips={setTrips} rates={freightRates} branches={branches} vehicles={vehicles} drivers={drivers} onToast={setToast} onEdit={openTrip} onFinish={setFinishingTrip} onReport={setReportTrip} onDelete={deleteTrip}/> : active === "orders" ? <OrdersModule trips={filteredTrips} allTrips={trips} setTrips={setTrips} rates={freightRates} setRates={setFreightRates} onToast={setToast} onEdit={(trip) => { openTrip(trip); setTripTab("orders"); }}/> : active === "costs" ? <CostsModule costs={filteredCosts} allCosts={tripCosts} setCosts={setTripCosts} trips={trips} onToast={setToast} onNew={() => { setEditingCost(null); setCostModal(true); }} onEdit={(cost) => { setEditingCost(cost); setCostModal(true); }}/> : active === "fuel" ? <FuelModule entries={filteredFuel} trips={trips} cycles={fuelCycles.cycles} openCycles={fuelCycles.openCycles} onNew={() => { setEditingFuel(null); setFuelModal(true); }} onEdit={(entry) => { setEditingFuel(entry); setFuelModal(true); }}/> : active === "bonuses" ? <BonusesModule trips={trips} fuelEntries={fuelEntries} cycles={fuelCycles.cycles} reviews={bonusReviews} setReviews={setBonusReviews} helperAssignments={helperAssignments} helperReviews={helperBonusReviews} setHelperReviews={setHelperBonusReviews} readOnly={isReadOnly}/> : active === "results" ? <ResultsModule trips={filteredTrips} vehicleFilter={filters.vehicle} rates={freightRates} costs={filteredCosts} fuelByTrip={fuelCycles.allocationByTrip} onReport={setReportTrip}/> : active === "fleet" ? <FleetModule vehicles={vehicles} setVehicles={setVehicles} maintenance={maintenance} setMaintenance={setMaintenance} trips={trips} fuelEntries={fuelEntries} branches={branches} onToast={setToast}/> : active === "documents" ? <DocumentsModule documents={documents} setDocuments={setDocuments} vehicles={vehicles} drivers={drivers} onToast={setToast}/> : active === "requests" ? <RequestsModule requests={serviceRequests} setRequests={setServiceRequests} maintenance={maintenance} setMaintenance={setMaintenance} vehicles={vehicles} setVehicles={setVehicles} onToast={setToast}/> : active === "settings" ? <SettingsModule branches={branches} setBranches={setBranches} vehicles={vehicles} setVehicles={setVehicles} drivers={drivers} setDrivers={setDrivers} rates={freightRates} setRates={setFreightRates} trips={trips} snapshot={snapshot} onRestore={restoreSnapshot} onToast={setToast} users={users} setUsers={setUsers} auditLog={auditLog} trash={trash} setTrash={setTrash} currentEmail={session.email} helperAssignments={helperAssignments} setHelperAssignments={setHelperAssignments}/> : null}
    </section>
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(false)}><div className="modal trip-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.stopPropagation()}>
      <button className="close" onClick={() => { setModal(false); setEditingTrip(null); setTripFormError(""); }} aria-label="Cerrar">×</button><p className="eyebrow">Operación</p><h2 id="modal-title">{editingTrip ? `Editar viaje N.º ${editingTrip.id}` : "Nuevo viaje"}</h2><p className="modal-intro">Registre los datos del viaje. Los pedidos y costos son opcionales y pueden agregarse después.</p>
      {tripFormError && <p className="form-error" role="alert">{tripFormError}</p>}
      <div className="trip-tabs" role="tablist" aria-label="Secciones del viaje">
        {([["data", "Datos"], ["orders", "Pedidos"], ["costs", "Costos"], ["result", "Resultado"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tripTab === key} className={tripTab === key ? "active" : ""} onClick={() => setTripTab(key)}>{label}</button>)}
      </div>
      <form onSubmit={saveTrip}>
        <section className="trip-tab-panel data-panel" hidden={tripTab !== "data"}>
          <label>N.º de viaje<input value={editingTrip?.id ?? (trips.length ? Math.max(...trips.map((trip) => trip.id)) + 1 : 1)} readOnly aria-label="Número secuencial del viaje"/></label>
          <label>Sucursal<select name="branch" required defaultValue={editingTrip?.branch ?? ""}><option value="" disabled>Seleccione la sucursal</option>{activeBranches.map((branch) => <option key={branch.id} value={branch.name}>{branch.name}</option>)}</select></label>
          <label>Chapa<select name="vehicle" required defaultValue={editingTrip?.vehicle ?? ""} onChange={(event) => { if (!editingTrip) { const driver = latestVehicleDriver(event.target.value); setKmInitialDraft(latestVehicleKm(event.target.value)); setKmFinalDraft(0); setDriverDraft(driver); setHelperDraft(helperForDriver(driver)); } }}><option value="" disabled>Seleccione la chapa</option>{activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>)}</select></label>
          <label>Chofer<select name="driver" required value={driverDraft} onChange={(event) => { const driver = event.target.value; setDriverDraft(driver); setHelperDraft(helperForDriver(driver)); }}><option value="" disabled>Seleccione el chofer</option>{activeDrivers.map((driver) => <option key={driver.id} value={driver.name}>{driver.name}</option>)}</select></label>
          <label>Ayudante<select name="helper" value={helperDraft} onChange={(event) => setHelperDraft(event.target.value)}><option value="">Sin ayudante</option>{registeredHelpers.map((helper) => <option key={helper} value={helper}>{helper}</option>)}</select></label>
          <label>Fecha inicial<input name="startDate" type="date" defaultValue={editingTrip?.startDate ?? today} required/></label>
          <label>Fecha final<input name="endDate" type="date" min={editingTrip?.startDate} defaultValue={editingTrip?.endDate ?? ""}/></label>
          <label>Km inicial<input name="kmInitial" type="number" min="0" placeholder="0" value={kmInitialDraft || ""} onChange={(event) => setKmInitialDraft(Number(event.target.value))} required/></label>
          <label>Km final<input name="kmFinal" type="number" min={kmInitialDraft} placeholder="Opcional al iniciar" value={kmFinalDraft || ""} onChange={(event) => setKmFinalDraft(Number(event.target.value))}/></label>
          <label>Total recorrido<input value={kmFinalDraft >= kmInitialDraft && kmFinalDraft > 0 ? kmFinalDraft - kmInitialDraft : 0} readOnly aria-label="Total de kilómetros recorridos calculado automáticamente"/></label>
          <label>Estado<select name="status" defaultValue={editingTrip?.status ?? "Pendiente"}>{tripStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        </section>
        <section className="trip-tab-panel" hidden={tripTab !== "orders"}>
          <fieldset className="invoice-fieldset"><legend>Pedidos y facturas del viaje <span>— opcional</span></legend>{invoiceRows.length === 0 && <p className="existing-costs">Puede crear el viaje sin pedidos y agregarlos más adelante desde Viajes o Pedidos.</p>}{invoiceRows.map((row, index) => <div className="invoice-row order-entry" key={row.id}><label>Factura<input name={`invoice-${row.id}`} placeholder="001-001-0000001" defaultValue={editingTrip?.orders[index]?.invoice} required/></label><label>Pedido<input name={`order-${row.id}`} placeholder="PED-0001" defaultValue={editingTrip?.orders[index]?.order} required/></label><label>Cliente<input name={`client-${row.id}`} placeholder="Nombre del cliente" defaultValue={editingTrip?.orders[index]?.client} required/></label><label>Valor en guaraníes<input name={`amount-${row.id}`} type="number" min="1" step="1" placeholder="0" defaultValue={editingTrip?.orders[index]?.amount} required/></label><label>Tipo de flete<select name={`freightType-${row.id}`} defaultValue={editingTrip?.orders[index]?.freightType ?? "Local"}>{freightTypes.map((type) => <option key={type} value={type}>{type} — {freightRates[type]}%</option>)}</select></label><button type="button" className="remove-invoice" aria-label={`Eliminar pedido ${index + 1}`} onClick={() => setInvoiceRows(invoiceRows.filter((item) => item.id !== row.id))}>×</button></div>)}<button type="button" className="add-invoice" onClick={() => setInvoiceRows([...invoiceRows, { id: invoiceRows.length ? Math.max(...invoiceRows.map(r => r.id)) + 1 : 1 }])}>＋ Agregar pedido</button></fieldset>
        </section>
        <section className="trip-tab-panel" hidden={tripTab !== "costs"}>
          <fieldset className="invoice-fieldset cost-fieldset"><legend>Costos del viaje <span>— opcional</span></legend>{editingTrip && tripCosts.some((cost) => cost.tripId === editingTrip.id) && <p className="existing-costs">Este viaje ya tiene {tripCosts.filter((cost) => cost.tripId === editingTrip.id).length} costo(s) registrado(s). Los siguientes serán agregados como nuevos.</p>}{tripCostRows.map((row, index) => <div className="invoice-row trip-cost-entry" key={row.id}><label>Fecha<input name={`costDate-${row.id}`} type="date" defaultValue={editingTrip?.startDate ?? today}/></label><label>Tipo<select name={`costType-${row.id}`}>{costTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Descripción<input name={`costDescription-${row.id}`} placeholder="Detalle opcional"/></label><label>Cantidad<input name={`costQuantity-${row.id}`} type="number" min="0" step="0.01" placeholder="0"/></label><label>Valor unitario (₲)<input name={`costUnitValue-${row.id}`} type="number" min="0" step="1" placeholder="0"/></label>{tripCostRows.length > 1 && <button type="button" className="remove-invoice" aria-label={`Eliminar costo ${index + 1}`} onClick={() => setTripCostRows(tripCostRows.filter((item) => item.id !== row.id))}>×</button>}</div>)}<button type="button" className="add-invoice" onClick={() => setTripCostRows([...tripCostRows, { id: Math.max(...tripCostRows.map((row) => row.id)) + 1 }])}>＋ Agregar otro costo</button></fieldset>
        </section>
        <section className="trip-tab-panel result-panel" hidden={tripTab !== "result"}>
          <article className={modalResult >= 0 ? "trip-result-banner positive" : "trip-result-banner negative"}><small>GANANCIA / PÉRDIDA DEL VIAJE</small><strong>{money.format(modalResult)}</strong></article>
          <div className="trip-result-grid">
            <article><span>▧</span><div><strong>{money.format(modalFreight)}</strong><small>Flete total</small></div></article>
            <article><span>₲</span><div><strong>{money.format(modalCosts)}</strong><small>Costo total</small></div></article>
            <article><span>▥</span><div><strong>{money.format(modalFuel)}</strong><small>Combustible por ciclo</small></div></article>
            <article><span>◴</span><div><strong>{modalMargin.toFixed(1)}%</strong><small>Margen de ganancia</small></div></article>
          </div>
          {!editingTrip && <p className="result-note">El resultado estará disponible después de crear el viaje y registrar sus pedidos y costos.</p>}
        </section>
        <div className="form-actions"><button type="button" className="secondary" onClick={() => { setModal(false); setEditingTrip(null); setTripFormError(""); }}>Cancelar</button><button className="primary" type="submit">{editingTrip ? "Guardar cambios" : "Crear viaje"}</button></div>
      </form>
    </div></div>}
    {finishingTrip && <div className="modal-backdrop" onMouseDown={() => setFinishingTrip(null)}><div className="modal finish-modal" role="dialog" aria-modal="true" aria-labelledby="finish-title" onMouseDown={(e) => e.stopPropagation()}>
      <button className="close" onClick={() => setFinishingTrip(null)} aria-label="Cerrar">×</button><p className="eyebrow">Cierre de operación</p><h2 id="finish-title">Finalizar viaje N.º {finishingTrip.id}</h2><p className="modal-intro">Informe la fecha y el kilometraje final para cerrar el viaje.</p>
      <form onSubmit={finishTrip}><label>Fecha final<input name="endDate" type="date" defaultValue="2026-07-24" min={finishingTrip.startDate} required/></label><label>Km final<input name="kmFinal" type="number" min={finishingTrip.kmInitial} defaultValue={finishingTrip.kmFinal || undefined} required/></label><div className="finish-summary"><span>Km inicial<strong>{number.format(finishingTrip.kmInitial)}</strong></span><span>Flete calculado<strong>{money.format(freightValue(finishingTrip, freightRates))}</strong></span></div><div className="form-actions"><button type="button" className="secondary" onClick={() => setFinishingTrip(null)}>Cancelar</button><button className="primary" type="submit">Finalizar viaje</button></div></form>
    </div></div>}
    {costModal && <div className="modal-backdrop" onMouseDown={() => { setCostModal(false); setEditingCost(null); }}><div className="modal cost-modal" role="dialog" aria-modal="true" aria-labelledby="cost-title" onMouseDown={(e) => e.stopPropagation()}>
      <button className="close" onClick={() => { setCostModal(false); setEditingCost(null); }} aria-label="Cerrar">×</button><p className="eyebrow">Control de gastos</p><h2 id="cost-title">{editingCost ? "Editar costo" : "Nuevo costo"}</h2><p className="modal-intro">Vincule el gasto a un viaje. El total se calcula por cantidad y valor unitario.</p>
      <form onSubmit={saveCost}>
        <label>Viaje<select name="tripId" required autoFocus defaultValue={editingCost?.tripId ?? ""}><option value="">Seleccione el viaje</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>N.º {trip.id} — {trip.vehicle} — {trip.driver}</option>)}</select></label>
        <label>Fecha<input name="date" type="date" defaultValue={editingCost?.date ?? "2026-07-24"} required/></label>
        <label>Tipo de costo<select name="type" required defaultValue={editingCost?.type}>{costTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label>Descripción<input name="description" defaultValue={editingCost?.description} placeholder="Detalle opcional"/></label>
        <label>Cantidad<input name="quantity" type="number" min="0.01" step="0.01" defaultValue={editingCost?.quantity ?? 1} required/></label>
        <label>Valor unitario (₲)<input name="unitValue" type="number" min="1" step="1" defaultValue={editingCost?.unitValue} placeholder="0" required/></label>
        <div className="form-actions"><button type="button" className="secondary" onClick={() => { setCostModal(false); setEditingCost(null); }}>Cancelar</button><button className="primary" type="submit">{editingCost ? "Guardar cambios" : "Guardar costo"}</button></div>
      </form>
    </div></div>}
    {fuelModal && <div className="modal-backdrop" onMouseDown={() => { setFuelModal(false); setEditingFuel(null); }}><div className="modal cost-modal" role="dialog" aria-modal="true" aria-labelledby="fuel-title" onMouseDown={(e) => e.stopPropagation()}>
      <button className="close" onClick={() => { setFuelModal(false); setEditingFuel(null); }} aria-label="Cerrar">×</button><p className="eyebrow">Control de combustible</p><h2 id="fuel-title">{editingFuel ? "Editar carga" : "Nueva carga"}</h2><p className="modal-intro">El vínculo con el viaje sirve como referencia. El costo se calcula por ciclos completos y kilómetros recorridos, sin duplicidad.</p>
      <form onSubmit={saveFuel}>
        <label>Viaje (opcional)<select name="tripId" defaultValue={editingFuel?.tripId ?? ""}><option value="">Sin viaje específico</option>{trips.map((trip) => <option key={trip.id} value={trip.id}>N.º {trip.id} — {trip.vehicle} — {trip.driver}</option>)}</select></label>
        <label>Fecha<input name="date" type="date" defaultValue={editingFuel?.date ?? "2026-07-24"} required autoFocus/></label>
        <label>Chapa<select name="vehicle" required defaultValue={editingFuel?.vehicle ?? ""}><option value="">Seleccione la chapa</option>{activeVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>)}</select></label>
        <label>Estación de servicio<input name="station" defaultValue={editingFuel?.station} placeholder="Nombre o ubicación"/></label>
        <label>Hodómetro (km)<input name="odometer" type="number" min="0" step="1" defaultValue={editingFuel?.odometer} placeholder="0" required/></label>
        <label>Litros<input name="liters" type="number" min="0.01" step="0.01" defaultValue={editingFuel?.liters} placeholder="0,00" required/></label>
        <label>Precio por litro (₲/L)<input name="pricePerLiter" type="number" min="1" step="0.01" defaultValue={editingFuel?.pricePerLiter ?? (editingFuel && editingFuel.liters > 0 ? editingFuel.totalValue / editingFuel.liters : undefined)} placeholder="0" required/><small>El valor total se calcula automáticamente: litros × precio por litro.</small></label>
        <label className="check-field"><input name="fullTank" type="checkbox" defaultChecked={editingFuel?.fullTank}/> Tanque completo</label>
        <div className="form-actions"><button type="button" className="secondary" onClick={() => { setFuelModal(false); setEditingFuel(null); }}>Cancelar</button><button className="primary" type="submit">{editingFuel ? "Guardar cambios" : "Guardar carga"}</button></div>
      </form>
    </div></div>}
    {reportTrip && <TripReport trip={reportTrip} rates={freightRates} costs={tripCosts.filter((cost) => cost.tripId === reportTrip.id)} fuelCycles={fuelCycles.cycles} fuelValue={fuelCycles.allocationByTrip.get(reportTrip.id) ?? 0} onClose={() => setReportTrip(null)}/>}
    {toast && <div className="toast">✓ {toast}</div>}
  </main>;
}

function printWithBodyMode(mode: string) {
  const body = document.body;
  const cleanup = () => body.classList.remove(mode);

  body.classList.add(mode);
  window.addEventListener("afterprint", cleanup, { once: true });

  // Give the browser two paint cycles to apply the print-only layout before
  // opening the native print preview. Printing immediately can capture a blank
  // fixed backdrop in some browsers.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => window.print());
  });

  // Safety cleanup for browsers that do not dispatch `afterprint`.
  window.setTimeout(cleanup, 60_000);
}

function printFreightReport() {
  printWithBodyMode("printing-freight-report");
}

function TripReport({ trip, rates, costs, fuelCycles, fuelValue, onClose }: {
  trip: Trip;
  rates: FreightRates;
  costs: TripCost[];
  fuelCycles: FuelCycle[];
  fuelValue: number;
  onClose: () => void;
}) {
  const freight = freightValue(trip, rates);
  const totalCosts = costs.reduce((sum, cost) => sum + cost.quantity * cost.unitValue, 0);
  const result = freight - totalCosts - fuelValue;
  const margin = freight > 0 ? result / freight * 100 : 0;
  const km = trip.kmFinal > trip.kmInitial ? trip.kmFinal - trip.kmInitial : 0;
  const allocations = fuelCycles.flatMap((cycle) => cycle.allocations
    .filter((allocation) => allocation.tripId === trip.id)
    .map((allocation) => ({ cycle, allocation })));
  const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("es-PY").format(new Date(`${value}T12:00:00`)) : "—";

  return <div className="trip-report-backdrop" role="dialog" aria-modal="true" aria-label={`Informe del viaje ${trip.id}`}>
    <article className="trip-report">
      <div className="report-toolbar"><button className="secondary" onClick={onClose}>Cerrar</button><button className="primary" onClick={printFreightReport}><Icon name="report"/>Imprimir / Guardar PDF</button></div>
      <header className="report-header"><div><div className="logo"><strong>Frete</strong><span>Control</span></div><p>Informe interno de operación y rentabilidad</p></div><div className="report-number"><small>VIAJE</small><strong>N.º {trip.id}</strong><span className={`status ${trip.status.toLowerCase().replaceAll(" ", "-")}`}>● {trip.status}</span></div></header>

      <section className="report-section"><div className="report-section-title"><span>01</span><div><small>DATOS</small><h2>Datos del viaje</h2></div></div>
        <div className="report-data-grid">
          <div><small>Sucursal</small><strong>{trip.branch}</strong></div><div><small>Chapa</small><strong>{trip.vehicle}</strong></div><div><small>Chofer</small><strong>{trip.driver}</strong></div>
          <div><small>Fecha inicial</small><strong>{formatDate(trip.startDate)}</strong></div><div><small>Fecha final</small><strong>{formatDate(trip.endDate)}</strong></div><div><small>Estado</small><strong>{trip.status}</strong></div>
          <div><small>Km inicial</small><strong>{number.format(trip.kmInitial)} km</strong></div><div><small>Km final</small><strong>{trip.kmFinal ? `${number.format(trip.kmFinal)} km` : "—"}</strong></div><div><small>Total recorrido</small><strong>{km ? `${number.format(km)} km` : "Pendiente"}</strong></div>
        </div>
      </section>

      <section className="report-section"><div className="report-section-title"><span>02</span><div><small>FACTURACIÓN</small><h2>Pedidos y facturas</h2></div><strong>{trip.orders.length} pedido(s)</strong></div>
        <div className="report-table-wrap"><table><thead><tr><th>Factura</th><th>Pedido</th><th>Cliente</th><th>Tipo de flete</th><th>Valor</th><th>%</th><th>Flete</th></tr></thead><tbody>
          {trip.orders.map((order, index) => <tr key={`${order.order}-${index}`}><td>{order.invoice}</td><td><strong>{order.order}</strong></td><td>{order.client}</td><td>{order.freightType}</td><td>{money.format(order.amount)}</td><td>{rates[order.freightType]}%</td><td><strong>{money.format(Math.round(order.amount * rates[order.freightType] / 100))}</strong></td></tr>)}
        </tbody><tfoot><tr><td colSpan={4}>Totales</td><td>{money.format(invoiceTotal(trip))}</td><td></td><td>{money.format(freight)}</td></tr></tfoot></table></div>
      </section>

      <section className="report-section"><div className="report-section-title"><span>03</span><div><small>GASTOS</small><h2>Costos del viaje</h2></div><strong>{money.format(totalCosts)}</strong></div>
        <div className="report-table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Cantidad</th><th>Valor unitario</th><th>Total</th></tr></thead><tbody>
          {costs.length ? costs.map((cost) => <tr key={cost.id}><td>{formatDate(cost.date)}</td><td>{cost.type}</td><td>{cost.description || "—"}</td><td>{number.format(cost.quantity)}</td><td>{money.format(cost.unitValue)}</td><td><strong>{money.format(cost.quantity * cost.unitValue)}</strong></td></tr>) : <tr><td colSpan={6}>Sin costos registrados para este viaje.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="report-section"><div className="report-section-title"><span>04</span><div><small>COMBUSTIBLE</small><h2>Prorrateo por ciclos</h2></div><strong>{fuelValue ? money.format(fuelValue) : "Pendiente"}</strong></div>
        <div className="report-table-wrap"><table><thead><tr><th>Ciclo</th><th>Chapa</th><th>Km del ciclo</th><th>Km asignados</th><th>Participación</th><th>Valor asignado</th></tr></thead><tbody>
          {allocations.length ? allocations.map(({ cycle, allocation }) => <tr key={`${cycle.id}-${allocation.tripId}`}><td>{number.format(cycle.startOdometer)} → {number.format(cycle.endOdometer)}</td><td>{cycle.vehicle}</td><td>{number.format(cycle.distance)} km</td><td>{number.format(allocation.km)} km</td><td>{(allocation.km / cycle.distance * 100).toFixed(1)}%</td><td><strong>{money.format(allocation.value)}</strong></td></tr>) : <tr><td colSpan={6}>Ciclo abierto o sin combustible asignado definitivamente.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="report-section report-result-section"><div className="report-section-title"><span>05</span><div><small>CIERRE</small><h2>Resultado financiero</h2></div></div>
        <div className="report-result-grid"><div><small>Flete total</small><strong>{money.format(freight)}</strong></div><div><small>Costos operativos</small><strong>{money.format(totalCosts)}</strong></div><div><small>Combustible</small><strong>{money.format(fuelValue)}</strong></div><div className={result >= 0 ? "report-profit" : "report-loss"}><small>Ganancia / Pérdida</small><strong>{money.format(result)}</strong></div><div><small>Margen</small><strong>{margin.toFixed(1)}%</strong></div><div><small>Costo por km</small><strong>{km ? money.format((totalCosts + fuelValue) / km) : "—"}</strong></div></div>
      </section>
      <footer className="report-footer"><span>FreteControl ERP · Informe del viaje N.º {trip.id}</span><span>Valores expresados en guaraníes (PYG)</span></footer>
    </article>
  </div>;
}

function FuelModule({ entries, trips, cycles, openCycles, onNew, onEdit }: { entries: FuelEntry[]; trips: Trip[]; cycles: FuelCycle[]; openCycles: { vehicle: string; startOdometer: number; entries: FuelEntry[] }[]; onNew: () => void; onEdit: (entry: FuelEntry) => void }) {
  const [reportOpen, setReportOpen] = useState(false);
  const totalLiters = entries.reduce((sum, entry) => sum + entry.liters, 0);
  const totalValue = entries.reduce((sum, entry) => sum + entry.totalValue, 0);
  const consumptionByVehicle = Array.from(new Set(entries.map((entry) => entry.vehicle))).map((vehicle) => {
    const complete = entries.filter((entry) => entry.vehicle === vehicle && entry.fullTank).sort((a, b) => a.odometer - b.odometer);
    const distance = complete.length > 1 ? complete.at(-1)!.odometer - complete[0].odometer : 0;
    const consumed = complete.length > 1 ? complete.slice(1).reduce((sum, entry) => sum + entry.liters, 0) : 0;
    return { vehicle, average: consumed > 0 ? distance / consumed : 0, distance };
  });
  const closedDistance = cycles.reduce((sum, cycle) => sum + cycle.distance, 0);
  const closedLiters = cycles.reduce((sum, cycle) => sum + cycle.liters, 0);
  const averageConsumption = closedLiters > 0 && closedDistance > 0 ? closedDistance / closedLiters : 0;
  return <section className="fuel-layout">
    <div className="cost-summary fuel-summary">
      <div><p className="eyebrow">Control de consumo</p><h2>Cargas de combustible</h2><p>Registre las cargas y consulte el consumo general de la flota.</p></div>
      <div className="fuel-kpis"><span><small>Valor total</small><strong>{money.format(totalValue)}</strong></span><span><small>Litros</small><strong>{number.format(totalLiters)} L</strong></span><span><small>Promedio general</small><strong>{averageConsumption ? `${averageConsumption.toFixed(2)} km/L` : "—"}</strong></span></div>
      <div className="fuel-actions"><button className="secondary" onClick={() => setReportOpen(true)}><Icon name="report"/>Generar informe</button><button className="primary" onClick={onNew}><Icon name="plus"/>Nueva carga</button></div>
    </div>
    <div className="fuel-vehicle-grid">{consumptionByVehicle.map((item) => <article key={item.vehicle}><span className="fuel-pump"><Icon name="fuel"/></span><div><small>{item.vehicle}</small><strong>{item.average ? `${item.average.toFixed(2)} km/L` : "Aguardando otra carga completa"}</strong><em>{item.distance ? `${number.format(item.distance)} km medidos` : "Sin intervalo calculable"}</em></div></article>)}</div>
    <div className="table-card"><div className="card-heading"><div><p className="eyebrow">Historial</p><h2>Cargas registradas</h2></div><strong>{entries.length} registros</strong></div><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Viaje</th><th>Chapa</th><th>Estación</th><th>Hodómetro</th><th>Litros</th><th>Precio/L</th><th>Valor total</th><th>Tanque</th><th>Acciones</th></tr></thead><tbody>{entries.length === 0 ? <tr><td className="no-results" colSpan={10}>No hay cargas con los filtros seleccionados.</td></tr> : entries.map((entry) => <tr key={entry.id}><td>{new Intl.DateTimeFormat("es-PY").format(new Date(`${entry.date}T12:00:00`))}</td><td>{entry.tripId ? <strong>N.º {entry.tripId}</strong> : <span className="unlinked-badge">Por chapa</span>}<small>{entry.tripId ? trips.find((trip) => trip.id === entry.tripId)?.driver : "Sin viaje específico"}</small></td><td><strong>{entry.vehicle}</strong></td><td>{entry.station || "—"}</td><td>{number.format(entry.odometer)} km</td><td>{number.format(entry.liters)} L</td><td>{money.format(entry.pricePerLiter ?? (entry.liters > 0 ? entry.totalValue / entry.liters : 0))}</td><td><strong>{money.format(entry.totalValue)}</strong></td><td><span className={entry.fullTank ? "branch-status active" : "branch-status"}>{entry.fullTank ? "Completo" : "Parcial"}</span></td><td><button className="edit-action" onClick={() => onEdit(entry)}>Editar</button></td></tr>)}</tbody></table></div></div>
    {reportOpen && <FuelReport entries={entries} cycles={cycles} openCycles={openCycles} onClose={() => setReportOpen(false)}/>}
  </section>;
}

function FuelReport({ entries, cycles, openCycles, onClose }: { entries: FuelEntry[]; cycles: FuelCycle[]; openCycles: { vehicle: string; startOdometer: number; entries: FuelEntry[] }[]; onClose: () => void }) {
  const closedDistance = cycles.reduce((sum, cycle) => sum + cycle.distance, 0);
  const closedLiters = cycles.reduce((sum, cycle) => sum + cycle.liters, 0);
  const closedCost = cycles.reduce((sum, cycle) => sum + cycle.cost, 0);
  const allocated = cycles.reduce((sum, cycle) => sum + cycle.allocations.reduce((subtotal, item) => subtotal + item.value, 0), 0);
  const average = closedLiters > 0 ? closedDistance / closedLiters : 0;
  return <div className="trip-report-backdrop fuel-report-backdrop" role="dialog" aria-modal="true" aria-label="Informe de combustible">
    <article className="trip-report fuel-report">
      <div className="report-toolbar"><button className="secondary" onClick={onClose}>Cerrar</button><button className="primary" onClick={printFreightReport}><Icon name="report"/>Imprimir / Guardar PDF</button></div>
      <header className="report-header"><div><div className="logo"><strong>Frete</strong><span>Control</span></div><p>Informe de combustible, ciclos y prorrateo por viaje</p></div><div className="report-number"><small>COMBUSTIBLE</small><strong>{cycles.length} ciclo(s)</strong><span>{entries.length} carga(s) registrada(s)</span></div></header>
      <section className="report-section"><div className="report-section-title"><span>01</span><div><small>RESUMEN</small><h2>Ciclos cerrados</h2></div></div>
        <div className="report-result-grid"><div><small>Distancia medida</small><strong>{number.format(closedDistance)} km</strong></div><div><small>Litros consumidos</small><strong>{number.format(closedLiters)} L</strong></div><div><small>Promedio general</small><strong>{average ? `${average.toFixed(2)} km/L` : "—"}</strong></div><div><small>Costo de los ciclos</small><strong>{money.format(closedCost)}</strong></div><div><small>Asignado a viajes</small><strong>{money.format(allocated)}</strong></div><div><small>Ciclos abiertos</small><strong>{openCycles.filter((cycle) => cycle.entries.length > 0).length}</strong></div></div>
      </section>
      <section className="report-section"><div className="report-section-title"><span>02</span><div><small>DETALLE</small><h2>Ciclos y prorrateo por viaje</h2></div></div>
        <div className="cycle-explanation">Costo del ciclo × (km del viaje dentro del ciclo ÷ km total del ciclo). Los kilómetros sin viaje vinculado quedan sin asignar.</div>
        <div className="report-table-wrap"><table><thead><tr><th>Ciclo</th><th>Chapa</th><th>Km del ciclo</th><th>Costo</th><th>Viaje / Km</th><th>Valor asignado</th></tr></thead><tbody>
          {cycles.map((cycle) => cycle.allocations.length ? cycle.allocations.map((allocation, index) => <tr key={`${cycle.id}-${allocation.tripId}`}><td>{index === 0 ? `${number.format(cycle.startOdometer)} → ${number.format(cycle.endOdometer)}` : ""}</td><td>{index === 0 ? <strong>{cycle.vehicle}</strong> : ""}</td><td>{index === 0 ? `${number.format(cycle.distance)} km` : ""}</td><td>{index === 0 ? money.format(cycle.cost) : ""}</td><td><strong>Viaje N.º {allocation.tripId}</strong><br/>{number.format(allocation.km)} km</td><td><strong>{money.format(allocation.value)}</strong><br/>{(allocation.km / cycle.distance * 100).toFixed(1)}%</td></tr>) : <tr key={cycle.id}><td>{number.format(cycle.startOdometer)} → {number.format(cycle.endOdometer)}</td><td><strong>{cycle.vehicle}</strong></td><td>{number.format(cycle.distance)} km</td><td>{money.format(cycle.cost)}</td><td colSpan={2}>Sin viajes con km dentro del ciclo</td></tr>)}
          {openCycles.filter((cycle) => cycle.entries.length > 0).map((cycle) => <tr key={`open-${cycle.vehicle}`} className="open-cycle"><td>Desde {number.format(cycle.startOdometer)}</td><td><strong>{cycle.vehicle}</strong></td><td>En curso</td><td>{money.format(cycle.entries.reduce((sum, entry) => sum + entry.totalValue, 0))}</td><td colSpan={2}>Pendiente de la próxima carga completa</td></tr>)}
          {!cycles.length && !openCycles.some((cycle) => cycle.entries.length > 0) && <tr><td colSpan={6}>No hay ciclos de combustible para informar.</td></tr>}
        </tbody></table></div>
      </section>
      <footer className="report-footer"><span>FreteControl ERP · Informe de combustible</span><span>Valores expresados en guaraníes (PYG)</span></footer>
    </article>
  </div>;
}


function BonusesModule({ trips, fuelEntries, cycles, reviews, setReviews, helperAssignments, helperReviews, setHelperReviews, readOnly }: {
  trips: Trip[];
  fuelEntries: FuelEntry[];
  cycles: FuelCycle[];
  reviews: BonusReview[];
  setReviews: (reviews: BonusReview[]) => void;
  helperAssignments: HelperAssignment[];
  helperReviews: HelperBonusReview[];
  setHelperReviews: (reviews: HelperBonusReview[]) => void;
  readOnly: boolean;
}) {
  const pilotMonths = [
    { value: "2026-07", label: "Julio de 2026" },
    { value: "2026-08", label: "Agosto de 2026" },
    { value: "2026-09", label: "Septiembre de 2026" },
  ];
  const [month, setMonth] = useState("2026-07");
  const [reportDriver, setReportDriver] = useState("");
  const targets: Record<string, number> = { AAUC019: 7.38, AASN159: 6.42, ABAD083: 6.11, ABAD112: 9, ABBB263: 4.71 };
  const previousMonth = (() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 2, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  })();
  const cycleMonth = (cycle: FuelCycle) => fuelEntries.find((entry) => entry.id === cycle.entryIds[cycle.entryIds.length - 1])?.date.slice(0, 7);
  const monthTrips = trips.filter((trip) => trip.startDate.startsWith(month));
  const driverNames = Array.from(new Set(monthTrips.map((trip) => trip.driver).filter(Boolean))).sort();
  const rows = driverNames.map((driver) => {
    const driverTrips = monthTrips.filter((trip) => trip.driver === driver);
    const national = driverTrips.some((trip) => trip.orders.some((order) => order.freightType === "Nacional" || order.freightType === "Remisión"));
    const category = national ? "Nacional" : "Local";
    const vehicleList = Array.from(new Set(driverTrips.map((trip) => trip.vehicle)));
    const monthCycles = cycles.filter((cycle) => vehicleList.includes(cycle.vehicle) && cycleMonth(cycle) === month);
    const previousCycles = cycles.filter((cycle) => vehicleList.includes(cycle.vehicle) && cycleMonth(cycle) === previousMonth);
    const totalDistance = monthCycles.reduce((sum, cycle) => sum + cycle.distance, 0);
    const totalLiters = monthCycles.reduce((sum, cycle) => sum + cycle.liters, 0);
    const previousDistance = previousCycles.reduce((sum, cycle) => sum + cycle.distance, 0);
    const previousLiters = previousCycles.reduce((sum, cycle) => sum + cycle.liters, 0);
    const consumption = totalLiters > 0 ? totalDistance / totalLiters : 0;
    const previousConsumption = previousLiters > 0 ? previousDistance / previousLiters : 0;
    const targetedCycles = monthCycles.filter((cycle) => targets[cycle.vehicle]);
    const targetDistance = targetedCycles.reduce((sum, cycle) => sum + cycle.distance, 0);
    const target = targetDistance > 0
      ? targetedCycles.reduce((sum, cycle) => sum + targets[cycle.vehicle] * cycle.distance, 0) / targetDistance
      : vehicleList.map((vehicle) => targets[vehicle]).find(Boolean) ?? 0;
    const roundedConsumption = Math.round(consumption * 100) / 100;
    const roundedTarget = Math.round(target * 100) / 100;
    const ratio = roundedTarget > 0 ? roundedConsumption / roundedTarget : 0;
    const score = ratio >= 1 ? 1 : ratio >= .95 ? .75 : ratio >= .9 ? .5 : 0;
    const fuelMaximum = national ? 200000 : 150000;
    const fuelBonus = Math.round(fuelMaximum * score);
    const unloadingBonus = driverTrips.length ? (national ? 250000 : 200000) : 0;
    const review = reviews.find((item) => item.month === month && item.driver === driver);
    const damageBonus = review?.noDamageReturns ? (national ? 150000 : 100000) : 0;
    return { driver, category, trips: driverTrips.length, vehicles: vehicleList.join(", "), vehicleList, consumption, previousConsumption, totalDistance, totalLiters, target, score, fuelBonus, unloadingBonus, damageBonus, total: fuelBonus + unloadingBonus + damageBonus, reviewed: Boolean(review?.noDamageReturns) };
  });
  const helperRows = rows.flatMap((row) => {
    const assignment = helperAssignments.find((item) => item.driver === row.driver);
    if (!assignment) return [];
    const review = helperReviews.find((item) => item.month === month && item.driver === row.driver && item.helper === assignment.helper);
    const unloadingBonus = row.trips > 0 ? (row.category === "Nacional" ? 250000 : 200000) : 0;
    const damageBonus = review?.noDamageReturns ? (row.category === "Nacional" ? 200000 : 150000) : 0;
    return [{ driver: row.driver, helper: assignment.helper, category: row.category, trips: row.trips, unloadingBonus, damageBonus, total: unloadingBonus + damageBonus, reviewed: Boolean(review?.noDamageReturns) }];
  });
  const driverTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const helperTotal = helperRows.reduce((sum, row) => sum + row.total, 0);
  const updateDamageReview = (driver: string, checked: boolean) => {
    const next = reviews.filter((item) => !(item.month === month && item.driver === driver));
    setReviews([...next, { month, driver, noDamageReturns: checked }]);
  };
  const updateHelperReview = (driver: string, helper: string, checked: boolean) => {
    const next = helperReviews.filter((item) => !(item.month === month && item.driver === driver && item.helper === helper));
    setHelperReviews([...next, { month, driver, helper, noDamageReturns: checked }]);
  };
  const printTeam = (driver: string) => {
    setReportDriver(driver);
    window.setTimeout(() => printWithBodyMode("printing-bonus-report"), 120);
  };
  const reportRow = rows.find((row) => row.driver === reportDriver);
  const reportHelper = helperRows.find((row) => row.driver === reportDriver);
  const monthLabel = pilotMonths.find((item) => item.value === month)?.label ?? month;
  const gs = (value: number) => `Gs. ${number.format(value)}`;
  const improvement = reportRow?.previousConsumption ? (reportRow.consumption - reportRow.previousConsumption) / reportRow.previousConsumption * 100 : null;
  const improvementText = improvement === null ? "No hay datos de consumo del mes anterior disponibles para la comparación."
    : improvement > 0 ? `El consumo mejoró ${Math.abs(improvement).toFixed(1).replace(".", ",")}% con relación al mes anterior.`
    : improvement < 0 ? `El consumo disminuyó ${Math.abs(improvement).toFixed(1).replace(".", ",")}% con relación al mes anterior.`
    : "El consumo se mantuvo estable con relación al mes anterior.";
  const observation = reportRow ? (improvement === null
    ? `El vehículo registró un consumo promedio de ${reportRow.consumption.toFixed(1).replace(".", ",")} km/l en el periodo. No hay datos suficientes del mes anterior para calcular la variación.`
    : `El vehículo presentó ${improvement >= 0 ? "una mejora" : "una disminución"} en el consumo promedio, pasando de ${reportRow.previousConsumption.toFixed(1).replace(".", ",")} km/l a ${reportRow.consumption.toFixed(1).replace(".", ",")} km/l, una ${improvement >= 0 ? "mejora" : "variación negativa"} de ${Math.abs(improvement).toFixed(1).replace(".", ",")}%. El resultado ${improvement >= 0 ? "demuestra una mayor eficiencia en el uso de combustible durante el periodo." : "indica la necesidad de realizar un seguimiento de la eficiencia de combustible."}`) : "";
  return <div className="bonus-module">
    <section className="module-head bonus-screen-head">
      <div><p className="eyebrow">Piloto de 3 meses</p><h2>Bonificación de choferes y ayudantes</h2><p className="muted">Simulación mensual. Use “Imprimir equipo” para generar el informe individual aprobado.</p></div>
      <div className="bonus-head-actions"><label className="bonus-month">Periodo<select value={month} onChange={(event) => { setMonth(event.target.value); setReportDriver(""); }}>{pilotMonths.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
    </section>
    <section className="metrics bonus-metrics">
      <article><span className="metric-icon">₲</span><div><small>Total general</small><strong>{money.format(driverTotal + helperTotal)}</strong><em>Choferes y ayudantes</em></div></article>
      <article><span className="metric-icon positive">♙</span><div><small>Choferes</small><strong>{money.format(driverTotal)}</strong><em>{rows.length} evaluados</em></div></article>
      <article><span className="metric-icon neutral">♧</span><div><small>Ayudantes</small><strong>{money.format(helperTotal)}</strong><em>{helperRows.length} vinculados con actividad</em></div></article>
    </section>
    <section className="table-card bonus-card">
      <div className="bonus-section-title"><div><p className="eyebrow">Detalle</p><h3>Choferes</h3></div><strong>{money.format(driverTotal)}</strong></div>
      <div className="bonus-rules"><strong>Reglas:</strong> consumo paga 0%, 50%, 75% o 100% según alcance menos de 90%, 90%, 95% o 100% de la meta. Descarga se paga con al menos un viaje en el mes.</div>
      <div className="table-scroll"><table className="bonus-table"><thead><tr><th>Chofer</th><th>Categoría</th><th>Viajes</th><th>Consumo km/L</th><th>Promedio</th><th>Descarga</th><th>Sin devolución por averías</th><th>Total</th><th>Informe</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.driver}><td><strong>{row.driver}</strong><small>{row.vehicles}</small></td><td><span className="status-badge">{row.category}</span></td><td>{row.trips}</td><td><strong>{row.consumption ? row.consumption.toFixed(2) : "Sin ciclo"}</strong><small>Meta {row.target ? row.target.toFixed(2) : "pendiente"}</small></td><td><strong>{money.format(row.fuelBonus)}</strong><small>{Math.round(row.score * 100)}% del máximo</small></td><td><strong>{money.format(row.unloadingBonus)}</strong><small>Elegible</small></td><td><label className="bonus-check"><input type="checkbox" checked={row.reviewed} disabled={readOnly} onChange={(event) => updateDamageReview(row.driver, event.target.checked)}/><span>{row.reviewed ? money.format(row.damageBonus) : "Pendiente de confirmar"}</span></label></td><td><strong>{money.format(row.total)}</strong></td><td><button className="edit-action team-print-button" onClick={() => printTeam(row.driver)}>Imprimir equipo</button></td></tr>)}
        {!rows.length && <tr><td colSpan={9}>No hay viajes registrados para este periodo.</td></tr>}
      </tbody></table></div>
    </section>
    <section className="table-card bonus-card helper-bonus-card">
      <div className="bonus-section-title"><div><p className="eyebrow">Detalle</p><h3>Ayudantes</h3></div><strong>{money.format(helperTotal)}</strong></div>
      <div className="bonus-rules"><strong>Reglas:</strong> Local — descarga Gs 200.000 y sin averías Gs 150.000. Nacional — descarga Gs 250.000 y sin averías Gs 200.000.</div>
      <div className="table-scroll"><table className="bonus-table helper-bonus-table"><thead><tr><th>Ayudante</th><th>Chofer vinculado</th><th>Categoría</th><th>Viajes</th><th>Descarga</th><th>Sin devolución por averías</th><th>Total</th></tr></thead><tbody>
        {helperRows.map((row) => <tr key={`${row.driver}-${row.helper}`}><td><strong>{row.helper}</strong></td><td>{row.driver}</td><td><span className="status-badge">{row.category}</span></td><td>{row.trips}</td><td><strong>{money.format(row.unloadingBonus)}</strong></td><td><label className="bonus-check"><input type="checkbox" checked={row.reviewed} disabled={readOnly} onChange={(event) => updateHelperReview(row.driver, row.helper, event.target.checked)}/><span>{row.reviewed ? money.format(row.damageBonus) : "Pendiente de confirmar"}</span></label></td><td><strong>{money.format(row.total)}</strong></td></tr>)}
        {!helperRows.length && <tr><td colSpan={7}>No hay ayudantes vinculados a choferes con viajes en este periodo. Agréguelos en Configuración.</td></tr>}
      </tbody></table></div>
    </section>
    {reportRow && <article className="individual-bonus-report">
      <header className="ibr-header"><h1>INFORME MENSUAL DE BONIFICACIONES</h1><div><span><strong>Periodo:</strong> {monthLabel}</span><span><strong>Vehículo:</strong> {reportRow.vehicles || "Sin vehículo"}</span><span><strong>Categoría:</strong> Ruta {reportRow.category}</span></div></header>
      <section className="ibr-section"><h2><b>1</b> INDICADORES DEL VEHÍCULO</h2><div className="ibr-indicators"><table><tbody><tr><td>Cantidad de viajes</td><td>{number.format(reportRow.trips)}</td></tr><tr><td>Distancia recorrida</td><td>{number.format(Math.round(reportRow.totalDistance))} km</td></tr><tr><td>Combustible consumido</td><td>{reportRow.totalLiters.toFixed(1).replace(".", ",")} litros</td></tr><tr><td>Consumo del mes anterior</td><td>{reportRow.previousConsumption ? `${reportRow.previousConsumption.toFixed(1).replace(".", ",")} km/l` : "Sin datos"}</td></tr><tr><td>Consumo del mes actual</td><td>{reportRow.consumption ? `${reportRow.consumption.toFixed(1).replace(".", ",")} km/l` : "Sin datos"}</td></tr></tbody></table><div className={`ibr-highlight ${improvement !== null && improvement < 0 ? "negative" : ""}`}>{improvementText}</div></div></section>
      <section className="ibr-section"><h2><b>2</b> BONIFICACIÓN DEL CHOFER</h2><h3>{reportRow.driver} <span>— Chofer {reportRow.category.toLowerCase()}</span></h3><table className="ibr-bonus-table"><thead><tr><th>Criterio</th><th>Resultado</th><th>Bonificación</th></tr></thead><tbody><tr><td>Descarga de mercaderías</td><td><em>{reportRow.trips ? "Cumplido" : "No cumplido"}</em></td><td>{gs(reportRow.unloadingBonus)}</td></tr><tr><td>Sin devolución por averías</td><td><em>{reportRow.reviewed ? "Cumplido" : "Pendente"}</em></td><td>{gs(reportRow.damageBonus)}</td></tr><tr><td>Meta de consumo promedio</td><td><em>{reportRow.score === 1 ? "Cumplido" : reportRow.score ? "Parcial" : "No cumplido"} — {reportRow.consumption.toFixed(1).replace(".", ",")} km/l</em></td><td>{gs(reportRow.fuelBonus)}</td></tr><tr className="total"><td>Total do chofer</td><td></td><td>{gs(reportRow.total)}</td></tr></tbody></table></section>
      <section className="ibr-section"><h2><b>3</b> BONIFICACIÓN DEL AYUDANTE</h2>{reportHelper ? <><h3>{reportHelper.helper} <span>— Ayudante {reportHelper.category.toLowerCase()}</span></h3><table className="ibr-bonus-table"><thead><tr><th>Criterio</th><th>Resultado</th><th>Bonificación</th></tr></thead><tbody><tr><td>Descarga de mercaderías</td><td><em>{reportHelper.trips ? "Cumplido" : "No cumplido"}</em></td><td>{gs(reportHelper.unloadingBonus)}</td></tr><tr><td>Sin devolución por averías</td><td><em>{reportHelper.reviewed ? "Cumplido" : "Pendente"}</em></td><td>{gs(reportHelper.damageBonus)}</td></tr><tr className="total"><td>Total do ayudante</td><td></td><td>{gs(reportHelper.total)}</td></tr></tbody></table></> : <p className="ibr-empty">Nenhum ayudante vinculado a este chofer.</p>}</section>
      <section className="ibr-section"><h2><b>4</b> RESUMEN DEL PAGO</h2><table className="ibr-summary"><tbody><tr><td>Chofer</td><td>{gs(reportRow.total)}</td></tr><tr><td>Ayudante</td><td>{gs(reportHelper?.total ?? 0)}</td></tr><tr className="total"><td>Total general del equipo</td><td>{gs(reportRow.total + (reportHelper?.total ?? 0))}</td></tr></tbody></table></section>
      <section className="ibr-section"><h2><b>5</b> OBSERVACIÓN AUTOMÁTICA</h2><p className="ibr-observation">{observation}</p></section>
      <footer>FreteControl ERP · Informe mensual de bonificaciones</footer>
    </article>}
  </div>;
}

function ResultsModule({ trips, vehicleFilter, rates, costs, fuelByTrip, onReport }: {
  trips: Trip[];
  vehicleFilter: string;
  rates: FreightRates;
  costs: TripCost[];
  fuelByTrip: Map<number, number>;
  onReport: (trip: Trip) => void;
}) {
  type ReportView = "trips" | "branch" | "vehicle" | "driver" | "client";
  const [view, setView] = useState<ReportView>("trips");
  const [freightTypeFilter, setFreightTypeFilter] = useState<"" | FreightType>("Dobro");
  const reportTrips = vehicleFilter ? trips.filter((trip) => trip.vehicle === vehicleFilter) : trips;
  const rows = reportTrips.map((trip) => {
    const matchingOrders = freightTypeFilter
      ? trip.orders.filter((order) => order.freightType === freightTypeFilter)
      : trip.orders;
    const freight = Math.round(matchingOrders.reduce((sum, order) => sum + order.amount * rates[order.freightType] / 100, 0));
    const fullFreight = freightValue(trip, rates);
    const allocationShare = freightTypeFilter && fullFreight > 0 ? freight / fullFreight : 1;
    const fullCosts = costs.filter((cost) => cost.tripId === trip.id).reduce((sum, cost) => sum + cost.quantity * cost.unitValue, 0);
    const tripCostsTotal = Math.round(fullCosts * allocationShare);
    const fuel = Math.round((fuelByTrip.get(trip.id) ?? 0) * allocationShare);
    const profit = freight - tripCostsTotal - fuel;
    const fullKm = trip.kmFinal > trip.kmInitial ? trip.kmFinal - trip.kmInitial : 0;
    const km = fullKm * allocationShare;
    const invoiced = matchingOrders.reduce((sum, order) => sum + order.amount, 0);
    return { trip, matchingOrders, invoiced, freight, tripCostsTotal, fuel, profit, km, margin: freight > 0 ? profit / freight * 100 : 0 };
  }).filter((row) => !freightTypeFilter || row.matchingOrders.length > 0);
  const totals = rows.reduce((acc, row) => ({
    freight: acc.freight + row.freight,
    costs: acc.costs + row.tripCostsTotal,
    fuel: acc.fuel + row.fuel,
    profit: acc.profit + row.profit,
  }), { freight: 0, costs: 0, fuel: 0, profit: 0 });
  const totalMargin = totals.freight > 0 ? totals.profit / totals.freight * 100 : 0;
  const matchingOrderRows = rows.flatMap(({ trip, matchingOrders }) =>
    matchingOrders.map((order) => ({
      tripId: trip.id,
      order,
      freight: Math.round(order.amount * rates[order.freightType] / 100),
    })),
  );
  const reportLabels: Record<ReportView, string> = {
    trips: "Por viaje",
    branch: "Por sucursal",
    vehicle: "Por vehículo",
    driver: "Por chofer",
    client: "Por cliente",
  };
  const grouped = (() => {
    if (view === "trips") return [];
    const groups = new Map<string, { name: string; trips: Set<number>; orders: number; invoiced: number; freight: number; costs: number; fuel: number; profit: number; km: number }>();
    rows.forEach((row) => {
      const keys = view === "client"
        ? row.matchingOrders.map((order) => ({ name: order.client, order }))
        : [{ name: view === "branch" ? row.trip.branch : view === "vehicle" ? row.trip.vehicle : row.trip.driver, order: null }];
      keys.forEach(({ name, order }) => {
        const current = groups.get(name) ?? { name, trips: new Set<number>(), orders: 0, invoiced: 0, freight: 0, costs: 0, fuel: 0, profit: 0, km: 0 };
        if (view === "client" && order) {
          const orderFreight = Math.round(order.amount * rates[order.freightType] / 100);
          const tripFreight = row.freight || 1;
          const share = orderFreight / tripFreight;
          current.orders += 1;
          current.invoiced += order.amount;
          current.freight += orderFreight;
          current.costs += Math.round(row.tripCostsTotal * share);
          current.fuel += Math.round(row.fuel * share);
          current.profit += Math.round(row.profit * share);
          current.km += row.km * share;
        } else {
          current.orders += row.matchingOrders.length;
          current.invoiced += row.invoiced;
          current.freight += row.freight;
          current.costs += row.tripCostsTotal;
          current.fuel += row.fuel;
          current.profit += row.profit;
          current.km += row.km;
        }
        current.trips.add(row.trip.id);
        groups.set(name, current);
      });
    });
    return Array.from(groups.values()).sort((a, b) => b.profit - a.profit);
  })();
  const topPerformer = grouped[0];

  return <section className="results-layout">
    <div className="results-heading">
      <div><p className="eyebrow">Gestión operacional</p><h2>Relatorios gerenciales</h2><p>Rentabilidad consolidada sin duplicar el combustible distribuido por ciclos.</p>{vehicleFilter && <p className="results-vehicle-filter"><strong>Chapa:</strong> {vehicleFilter}</p>}</div>
      <button className="primary print-button" onClick={() => printWithBodyMode("printing-results-report")}><Icon name="report"/>Imprimir / Guardar PDF</button>
    </div>
    <div className="report-tabs" role="tablist" aria-label="Tipo de informe">
      {(Object.keys(reportLabels) as ReportView[]).map((key) => <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{reportLabels[key]}</button>)}
    </div>
    <div className="results-filter">
      <label htmlFor="results-freight-type">Tipo de flete
        <select id="results-freight-type" value={freightTypeFilter} onChange={(event) => setFreightTypeFilter(event.target.value as "" | FreightType)}>
          <option value="">Todos los tipos</option>
          {freightTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <div><small>Filtro aplicado</small><strong>{vehicleFilter ? `Chapa ${vehicleFilter}` : "Todas las chapas"} · {freightTypeFilter || "Todos los tipos de flete"}</strong><span>{rows.length} viaje(s) · {rows.reduce((sum, row) => sum + row.matchingOrders.length, 0)} pedido(s)</span></div>
    </div>
    {freightTypeFilter && <div className="table-card report-table">
      <div className="card-heading"><div><p className="eyebrow">Pedidos filtrados</p><h2>Todos los pedidos — {freightTypeFilter}</h2></div><strong>{matchingOrderRows.length} pedido(s)</strong></div>
      <div className="table-scroll"><table><thead><tr><th>Viaje</th><th>Factura</th><th>Pedido</th><th>Cliente</th><th>Valor</th><th>Tipo de flete</th><th>Flete calculado</th></tr></thead><tbody>
        {matchingOrderRows.length === 0 ? <tr><td className="no-results" colSpan={7}>No hay pedidos del tipo seleccionado.</td></tr> : matchingOrderRows.map(({ tripId, order, freight }, index) => <tr key={`${tripId}-${order.order}-${index}`}>
          <td><strong>N.º {tripId}</strong></td><td>{order.invoice}</td><td><strong>{order.order}</strong></td><td>{order.client}</td><td>{money.format(order.amount)}</td><td><span className="freight-badge">{order.freightType}</span></td><td><strong className="green">{money.format(freight)}</strong></td>
        </tr>)}
      </tbody></table></div>
    </div>}
    <div className="result-kpis">
      <article><small>Fletes calculados</small><strong>{money.format(totals.freight)}</strong><span>Según pedidos y tipo de flete</span></article>
      <article><small>Costos operativos</small><strong>{money.format(totals.costs)}</strong><span>Sin combustible duplicado</span></article>
      <article><small>Combustible</small><strong>{money.format(totals.fuel)}</strong><span>Rateado por ciclos cerrados</span></article>
      <article className={totals.profit >= 0 ? "profit-card" : "loss-card"}><small>Resultado neto</small><strong>{money.format(totals.profit)}</strong><span>Margen {totalMargin.toFixed(1)}%</span></article>
    </div>
    {view !== "trips" && topPerformer && <div className="management-highlight"><span className="metric-icon positive">↗</span><div><small>Mejor resultado — {reportLabels[view]}</small><strong>{topPerformer.name}</strong><p>{money.format(topPerformer.profit)} de resultado · {topPerformer.trips.size} viaje(s)</p></div></div>}
    {view === "trips" ? <div className="table-card report-table"><div className="card-heading"><div><p className="eyebrow">Detalle verificable</p><h2>Rentabilidad de los viajes</h2></div><strong>{rows.length} viajes</strong></div><div className="table-scroll"><table><thead><tr><th>Viaje</th><th>Sucursal</th><th>Chapa / Chofer</th><th>Flete</th><th>Costos</th><th>Combustible</th><th>Resultado</th><th>Margen</th><th>Km</th><th>Costo/km</th><th>Informe</th></tr></thead><tbody>
      {rows.length === 0 ? <tr><td className="no-results" colSpan={11}>No hay resultados con los filtros seleccionados.</td></tr> : rows.map(({ trip, matchingOrders, freight, tripCostsTotal, fuel, profit, margin, km }) => <tr key={trip.id}>
        <td><strong>N.º {trip.id}</strong><small>{matchingOrders.length} pedido(s) · {[...new Set(matchingOrders.map((order) => order.freightType))].join(", ")}</small></td>
        <td>{trip.branch}</td>
        <td><strong>{trip.vehicle}</strong><small>{trip.driver}</small></td>
        <td><strong>{money.format(freight)}</strong></td>
        <td>{money.format(tripCostsTotal)}</td>
        <td>{fuel > 0 ? money.format(fuel) : <span className="cycle-pending">Pendiente de ciclo</span>}</td>
        <td><strong className={profit >= 0 ? "positive-value" : "negative-value"}>{money.format(profit)}</strong></td>
        <td>{margin.toFixed(1)}%</td>
        <td>{km ? `${number.format(km)} km` : "—"}</td>
        <td>{km ? money.format((tripCostsTotal + fuel) / km) : "—"}</td>
        <td><button className="report-action" onClick={() => onReport(trip)}>Ver informe</button></td>
      </tr>)}
    </tbody></table></div></div>
    : <div className="table-card report-table management-table"><div className="card-heading"><div><p className="eyebrow">Consolidado</p><h2>{reportLabels[view]}</h2></div><strong>{grouped.length} registro(s)</strong></div><div className="table-scroll"><table><thead><tr><th>{view === "branch" ? "Sucursal" : view === "vehicle" ? "Vehículo" : view === "driver" ? "Chofer" : "Cliente"}</th><th>Viajes</th><th>Pedidos</th><th>Facturado</th><th>Flete</th><th>Costos</th><th>Combustible</th><th>Resultado</th><th>Margen</th><th>Km</th><th>Costo/km</th></tr></thead><tbody>
      {grouped.length === 0 ? <tr><td className="no-results" colSpan={11}>No hay datos con los filtros seleccionados.</td></tr> : grouped.map((item) => {
        const margin = item.freight > 0 ? item.profit / item.freight * 100 : 0;
        const costPerKm = item.km > 0 ? (item.costs + item.fuel) / item.km : 0;
        return <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.trips.size}</td><td>{item.orders}</td><td>{money.format(item.invoiced)}</td><td>{money.format(item.freight)}</td><td>{money.format(item.costs)}</td><td>{money.format(item.fuel)}</td><td><strong className={item.profit >= 0 ? "positive-value" : "negative-value"}>{money.format(item.profit)}</strong></td><td>{margin.toFixed(1)}%</td><td>{item.km ? `${number.format(Math.round(item.km))} km` : "—"}</td><td>{costPerKm ? money.format(costPerKm) : "—"}</td></tr>;
      })}
    </tbody></table></div></div>}
    <p className="results-note">Los ciclos abiertos permanecen pendientes y no se descuentan definitivamente hasta la próxima carga de tanque completo.</p>
  </section>;
}

function RequestsModule({ requests, setRequests, maintenance, setMaintenance, vehicles, setVehicles, onToast }: {
  requests: ServiceRequest[]; setRequests: (items: ServiceRequest[]) => void;
  maintenance: Maintenance[]; setMaintenance: (items: Maintenance[]) => void;
  vehicles: Vehicle[]; setVehicles: (items: Vehicle[]) => void; onToast: (message: string) => void;
}) {
  const statuses: ServiceRequestStatus[] = ["Nuevo", "En análisis", "Aprobado", "En mantenimiento", "Concluido"];
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [qrData, setQrData] = useState("");
  const shown = requests.filter((item) => !statusFilter || item.status === statusFilter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notify = (message: string) => { onToast(message); setTimeout(() => onToast(""), 3800); };
  const update = (saved: ServiceRequest) => {
    setRequests(requests.map((item) => item.id === saved.id ? saved : item));
    setSelected(saved);
  };
  const convertToMaintenance = (request: ServiceRequest) => {
    if (request.maintenanceId) return notify("Este llamado ya está vinculado a un mantenimiento.");
    const maintenanceId = maintenance.length ? Math.max(...maintenance.map((item) => item.id)) + 1 : 1;
    const saved: Maintenance = {
      id: maintenanceId, vehicle: request.vehicle, date: new Date().toISOString().slice(0, 10),
      type: request.type, description: `[${request.protocol}] ${request.description}`,
      km: request.odometer ?? vehicles.find((item) => item.plate === request.vehicle)?.currentKm ?? 0, value: 0,
    };
    setMaintenance([saved, ...maintenance]);
    setVehicles(vehicles.map((vehicle) => vehicle.plate === request.vehicle ? { ...vehicle, fleetStatus: "Taller" } : vehicle));
    update({ ...request, status: "En mantenimiento", maintenanceId });
    notify(`Llamado ${request.protocol} convertido en mantenimiento.`);
  };
  const showQr = async () => {
    const link = `${window.location.origin}/chamado`;
    setQrData(await QRCode.toDataURL(link, { width: 360, margin: 2, color: { dark: "#075249", light: "#ffffff" } }));
  };
  return <section className="requests-layout">
    <div className="requests-heading">
      <div><p className="eyebrow">Solicitudes de choferes</p><h2>Chamados de mantenimiento</h2><p>Reciba, evalúe y transforme solicitudes en servicios de la flota.</p></div>
      <div className="request-heading-actions"><button className="secondary" onClick={showQr}>Ver QR Code</button><a className="primary public-link" href="/chamado" target="_blank" rel="noreferrer"><Icon name="plus"/>Abrir enlace del chofer</a></div>
    </div>
    <div className="request-kpis">
      <article><small>Nuevos</small><strong>{requests.filter((item) => item.status === "Nuevo").length}</strong><span>Sin revisar</span></article>
      <article><small>Urgentes</small><strong className={requests.some((item) => item.priority === "Urgente" && item.status !== "Concluido") ? "negative-value" : ""}>{requests.filter((item) => item.priority === "Urgente" && item.status !== "Concluido").length}</strong><span>Requieren prioridad</span></article>
      <article><small>En mantenimiento</small><strong>{requests.filter((item) => item.status === "En mantenimiento").length}</strong><span>Servicio iniciado</span></article>
      <article><small>Concluidos</small><strong>{requests.filter((item) => item.status === "Concluido").length}</strong><span>Historial cerrado</span></article>
    </div>
    <div className="table-card">
      <div className="card-heading"><div><p className="eyebrow">Bandeja</p><h2>Solicitudes recibidas</h2></div><select className="request-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos los estados</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></div>
      <div className="table-scroll"><table><thead><tr><th>Protocolo</th><th>Fecha</th><th>Chofer</th><th>Chapa</th><th>Tipo</th><th>Prioridad</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {shown.length === 0 ? <tr><td className="no-results" colSpan={8}>Todavía no hay llamados con este estado.</td></tr> : shown.map((item) => <tr key={item.id}>
          <td><strong>{item.protocol}</strong></td><td>{new Intl.DateTimeFormat("es-PY", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</td><td><strong>{item.driver}</strong><small>{item.phone || "Sin teléfono"}</small></td><td>{item.vehicle}</td><td><span className="cost-badge">{item.type}</span></td><td><span className={`request-priority ${item.priority.toLowerCase()}`}>{item.priority}</span></td><td><span className="request-status">{item.status}</span></td><td><button className="edit-action" onClick={() => setSelected(item)}>Ver / gestionar</button></td>
        </tr>)}
      </tbody></table></div>
    </div>
    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><div className="modal request-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={() => setSelected(null)}>×</button><p className="eyebrow">Llamado {selected.protocol}</p><h2>{selected.vehicle} · {selected.type}</h2><div className="request-detail">
      <article><small>Chofer</small><strong>{selected.driver}</strong><span>{selected.phone || "Sin teléfono"}</span></article>
      <article><small>Prioridad</small><strong>{selected.priority}</strong><span>{selected.odometer ? `${number.format(selected.odometer)} km` : "Km no informado"}</span></article>
      <article className="request-description"><small>Descripción del problema</small><p>{selected.description}</p></article>
      {selected.photoKeys?.length ? <article className="request-description"><small>Fotos enviadas</small><div className="request-photos">{selected.photoKeys.map((key, index) => <a key={key} href={`/api/chamados/photo/${encodeURIComponent(key)}`} target="_blank" rel="noreferrer"><img src={`/api/chamados/photo/${encodeURIComponent(key)}`} alt={`Foto ${index + 1} del llamado ${selected.protocol}`}/></a>)}</div></article> : null}
    </div><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const saved = { ...selected, status: String(form.get("status")) as ServiceRequestStatus, notes: String(form.get("notes") || "") }; update(saved); if (saved.status === "Concluido") setVehicles(vehicles.map((vehicle) => vehicle.plate === saved.vehicle ? { ...vehicle, fleetStatus: "Activo" } : vehicle)); else if (saved.status === "En mantenimiento") setVehicles(vehicles.map((vehicle) => vehicle.plate === saved.vehicle ? { ...vehicle, fleetStatus: "Taller" } : vehicle)); setSelected(null); notify(`Llamado ${saved.protocol} actualizado.`); }}>
      <label>Estado<select name="status" defaultValue={selected.status}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label className="wide-field">Observación interna<input name="notes" defaultValue={selected.notes} placeholder="Diagnóstico, proveedor o acción tomada"/></label>
      <div className="form-actions"><button type="button" className="secondary" onClick={() => convertToMaintenance(selected)} disabled={Boolean(selected.maintenanceId)}>{selected.maintenanceId ? `Mantenimiento N.º ${selected.maintenanceId}` : "Convertir en mantenimiento"}</button><button className="primary">Guardar cambios</button></div>
    </form></div></div>}
    {qrData && <div className="modal-backdrop qr-backdrop" onMouseDown={() => setQrData("")}><div className="modal qr-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={() => setQrData("")}>×</button><p className="eyebrow">Acceso del chofer</p><h2>QR Code de llamados</h2><p className="modal-intro">Imprima o comparta este código. Abre solamente el formulario público del chofer.</p><img src={qrData} alt="QR Code para abrir el formulario de llamados"/><strong>{`${window.location.origin}/chamado`}</strong><div className="form-actions"><button className="secondary" onClick={() => window.print()}>Imprimir QR</button><button className="primary" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/chamado`).then(() => notify("Enlace copiado."))}>Copiar enlace</button></div></div></div>}
  </section>;
}

/*
function FinanceModule({ trips, rates, costs, maintenance, vehicles, branches, accounts, setAccounts, payments, setPayments, onToast }: {
  trips: Trip[]; rates: FreightRates; costs: TripCost[]; maintenance: Maintenance[]; vehicles: Vehicle[]; branches: Branch[];
  accounts: FinancialAccount[]; setAccounts: (items: FinancialAccount[]) => void;
  payments: FinancialPayment[]; setPayments: (items: FinancialPayment[]) => void; onToast: (message: string) => void;
}) {
  const [view, setView] = useState<"summary" | "receivable" | "payable" | "cash">("summary");
  const [accountModal, setAccountModal] = useState<FinancialAccountType | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<FinancialAccount | null>(null);
  const [month, setMonth] = useState("2026-07");
  const generated = useMemo<FinancialAccount[]>(() => {
    const receivables = trips.flatMap((trip) => trip.orders.map((order, index) => ({
      id: `trip-${trip.id}-${index}`, type: "Cobrar" as const,
      description: `Flete ${order.order} · Viaje N.º ${trip.id}`, party: order.client, branch: trip.branch,
      dueDate: trip.endDate || trip.startDate, amount: Math.round(order.amount * rates[order.freightType] / 100),
      source: "Viaje" as const, tripId: trip.id, createdAt: trip.startDate,
    })));
    const costPayables = costs.map((cost) => {
      const trip = trips.find((item) => item.id === cost.tripId);
      return { id: `cost-${cost.id}`, type: "Pagar" as const, description: `${cost.type}: ${cost.description || `Viaje N.º ${cost.tripId}`}`, party: "Proveedor / gasto operativo", branch: trip?.branch || "Sin sucursal", dueDate: cost.date, amount: cost.quantity * cost.unitValue, source: "Costo" as const, tripId: cost.tripId, sourceId: cost.id, createdAt: cost.date };
    });
    const maintenancePayables = maintenance.map((item) => {
      const vehicle = vehicles.find((vehicleItem) => vehicleItem.plate === item.vehicle);
      return { id: `maintenance-${item.id}`, type: "Pagar" as const, description: `${item.type}: ${item.description}`, party: "Taller / proveedor", branch: vehicle?.branch || "Sin sucursal", dueDate: item.date, amount: item.value, source: "Mantenimiento" as const, sourceId: item.id, createdAt: item.date };
    });
    return [...receivables, ...costPayables, ...maintenancePayables];
  }, [trips, rates, costs, maintenance, vehicles]);
  const allAccounts = useMemo(() => [...generated, ...accounts.filter((item) => !generated.some((generatedItem) => generatedItem.id === item.id))], [generated, accounts]);
  const paidByAccount = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((payment) => map.set(payment.accountId, (map.get(payment.accountId) ?? 0) + payment.amount));
    return map;
  }, [payments]);
  const balance = (account: FinancialAccount) => Math.max(0, account.amount - (paidByAccount.get(account.id) ?? 0));
  const status = (account: FinancialAccount) => {
    const pending = balance(account);
    if (pending <= 0) return "Pagado";
    if ((paidByAccount.get(account.id) ?? 0) > 0) return "Parcial";
    return account.dueDate < new Date().toISOString().slice(0, 10) ? "Vencido" : "Pendiente";
  };
  const monthAccounts = allAccounts.filter((item) => item.dueDate.startsWith(month));
  const receivable = monthAccounts.filter((item) => item.type === "Cobrar").reduce((sum, item) => sum + balance(item), 0);
  const payable = monthAccounts.filter((item) => item.type === "Pagar").reduce((sum, item) => sum + balance(item), 0);
  const monthPayments = payments.filter((item) => item.date.startsWith(month));
  const received = monthPayments.filter((payment) => allAccounts.find((account) => account.id === payment.accountId)?.type === "Cobrar").reduce((sum, item) => sum + item.amount, 0);
  const paid = monthPayments.filter((payment) => allAccounts.find((account) => account.id === payment.accountId)?.type === "Pagar").reduce((sum, item) => sum + item.amount, 0);
  const visible = view === "receivable" ? allAccounts.filter((item) => item.type === "Cobrar") : view === "payable" ? allAccounts.filter((item) => item.type === "Pagar") : allAccounts;

  function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountModal) return;
    const form = new FormData(event.currentTarget);
    const item: FinancialAccount = { id: crypto.randomUUID(), type: accountModal, description: String(form.get("description")), party: String(form.get("party")), branch: String(form.get("branch")), dueDate: String(form.get("dueDate")), amount: Number(form.get("amount")), source: "Manual", createdAt: new Date().toISOString().slice(0, 10) };
    setAccounts([item, ...accounts]); setAccountModal(null); onToast(accountModal === "Cobrar" ? "Cuenta a cobrar registrada." : "Cuenta a pagar registrada.");
  }
  function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentAccount) return;
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    if (amount <= 0 || amount > balance(paymentAccount)) return;
    const payment: FinancialPayment = { id: crypto.randomUUID(), accountId: paymentAccount.id, date: String(form.get("date")), amount, method: String(form.get("method")) as FinancialPayment["method"], branch: paymentAccount.branch, note: String(form.get("note") || "") };
    setPayments([payment, ...payments]); setPaymentAccount(null); onToast(paymentAccount.type === "Cobrar" ? "Cobro registrado correctamente." : "Pago registrado correctamente.");
  }

  return <section className="finance-layout">
    <div className="finance-heading"><div><p className="eyebrow">Tesorería y vencimientos</p><h2>Control financiero</h2><p>Cuentas integradas con viajes, costos y mantenimiento, sin duplicar registros.</p></div><div className="finance-actions"><label>Mes<input type="month" value={month} onChange={(event) => setMonth(event.target.value)}/></label><button className="secondary" onClick={() => setAccountModal("Pagar")}>＋ Cuenta a pagar</button><button className="primary" onClick={() => setAccountModal("Cobrar")}>＋ Cuenta a cobrar</button></div></div>
    <div className="finance-kpis">
      <article><small>Por cobrar</small><strong>{money.format(receivable)}</strong><span>{monthAccounts.filter((item) => item.type === "Cobrar" && balance(item) > 0).length} cuenta(s)</span></article>
      <article><small>Por pagar</small><strong className="warning-value">{money.format(payable)}</strong><span>{monthAccounts.filter((item) => item.type === "Pagar" && balance(item) > 0).length} obligación(es)</span></article>
      <article><small>Cobrado en el mes</small><strong className="positive-value">{money.format(received)}</strong><span>Ingresos confirmados</span></article>
      <article><small>Saldo de caja</small><strong className={received - paid >= 0 ? "positive-value" : "negative-value"}>{money.format(received - paid)}</strong><span>Entradas menos salidas</span></article>
    </div>
    <div className="finance-tabs">{([["summary","Todas"],["receivable","A cobrar"],["payable","A pagar"],["cash","Movimientos"]] as const).map(([key,label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => setView(key)}>{label}</button>)}</div>
    {view !== "cash" ? <div className="table-card finance-table"><div className="card-heading"><div><p className="eyebrow">Vencimientos</p><h2>{view === "receivable" ? "Cuentas a cobrar" : view === "payable" ? "Cuentas a pagar" : "Cuentas del periodo"}</h2></div><strong>{visible.length} registros</strong></div><div className="table-scroll"><table><thead><tr><th>Vencimiento</th><th>Descripción</th><th>Cliente / Proveedor</th><th>Sucursal</th><th>Origen</th><th>Total</th><th>Pagado</th><th>Saldo</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td>{new Intl.DateTimeFormat("es-PY").format(new Date(`${item.dueDate}T12:00:00`))}</td><td><strong>{item.description}</strong>{item.tripId && <small>Viaje N.º {item.tripId}</small>}</td><td>{item.party}</td><td>{item.branch}</td><td><span className="finance-source">{item.source}</span></td><td><strong>{money.format(item.amount)}</strong></td><td>{money.format(paidByAccount.get(item.id) ?? 0)}</td><td><strong>{money.format(balance(item))}</strong></td><td><span className={`finance-status ${status(item).toLowerCase()}`}>{status(item)}</span></td><td>{balance(item) > 0 ? <button className="edit-action" onClick={() => setPaymentAccount(item)}>{item.type === "Cobrar" ? "Registrar cobro" : "Registrar pago"}</button> : "—"}</td></tr>)}</tbody></table></div></div> :
      <div className="table-card finance-table"><div className="card-heading"><div><p className="eyebrow">Caja por sucursal</p><h2>Movimientos confirmados</h2></div><button className="print-button" onClick={() => window.print()}>Imprimir / Guardar PDF</button></div><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Sucursal</th><th>Tipo</th><th>Cuenta</th><th>Medio</th><th>Observación</th><th>Valor</th></tr></thead><tbody>{payments.map((item) => { const account = allAccounts.find((entry) => entry.id === item.accountId); return <tr key={item.id}><td>{new Intl.DateTimeFormat("es-PY").format(new Date(`${item.date}T12:00:00`))}</td><td>{item.branch}</td><td><span className={`finance-status ${account?.type === "Cobrar" ? "pagado" : "vencido"}`}>{account?.type === "Cobrar" ? "Entrada" : "Salida"}</span></td><td>{account?.description || "Registro anterior"}</td><td>{item.method}</td><td>{item.note || "—"}</td><td><strong className={account?.type === "Cobrar" ? "positive-value" : "negative-value"}>{account?.type === "Cobrar" ? "+" : "−"} {money.format(item.amount)}</strong></td></tr>; })}</tbody></table></div></div>}
    <p className="finance-note">Los fletes generan cuentas a cobrar; costos y mantenimientos generan cuentas a pagar. Los pagos parciales reducen el saldo sin modificar el resultado operativo del viaje.</p>
    {accountModal && <div className="modal-backdrop" onMouseDown={() => setAccountModal(null)}><div className="modal finance-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={() => setAccountModal(null)}>×</button><p className="eyebrow">Registro manual</p><h2>{accountModal === "Cobrar" ? "Nueva cuenta a cobrar" : "Nueva cuenta a pagar"}</h2><form onSubmit={saveAccount}><label>Descripción<input name="description" required autoFocus/></label><label>{accountModal === "Cobrar" ? "Cliente" : "Proveedor"}<input name="party" required/></label><label>Sucursal<select name="branch" required>{branches.filter((item) => item.active).map((item) => <option key={item.id}>{item.name}</option>)}</select></label><label>Vencimiento<input name="dueDate" type="date" required/></label><label>Valor (₲)<input name="amount" type="number" min="1" required/></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setAccountModal(null)}>Cancelar</button><button className="primary">Guardar cuenta</button></div></form></div></div>}
    {paymentAccount && <div className="modal-backdrop" onMouseDown={() => setPaymentAccount(null)}><div className="modal finance-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={() => setPaymentAccount(null)}>×</button><p className="eyebrow">{paymentAccount.type === "Cobrar" ? "Entrada de caja" : "Salida de caja"}</p><h2>{paymentAccount.type === "Cobrar" ? "Registrar cobro" : "Registrar pago"}</h2><p className="modal-intro">{paymentAccount.description}<br/>Saldo pendiente: <strong>{money.format(balance(paymentAccount))}</strong></p><form onSubmit={savePayment}><label>Fecha<input name="date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label><label>Valor (₲)<input name="amount" type="number" min="1" max={balance(paymentAccount)} defaultValue={balance(paymentAccount)} required/></label><label>Medio<select name="method">{["Efectivo","Transferencia","Cheque","Tarjeta","Otro"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Observación<input name="note" placeholder="Opcional"/></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setPaymentAccount(null)}>Cancelar</button><button className="primary">Confirmar</button></div></form></div></div>}
  </section>;
}
*/

function DocumentsModule({ documents, setDocuments, vehicles, drivers, onToast }: {
  documents: FleetDocument[]; setDocuments: (items: FleetDocument[]) => void;
  vehicles: Vehicle[]; drivers: Driver[]; onToast: (message: string) => void;
}) {
  const [modal, setModal] = useState<FleetDocument | "new" | null>(null);
  const [ownerType, setOwnerType] = useState<DocumentOwner>("Vehículo");
  const [filter, setFilter] = useState<"Todos" | "Vigente" | "Próximo" | "Vencido" | "Sin vencimiento">("Todos");
  const [uploading, setUploading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const daysUntil = (date?: string) => date ? Math.ceil((new Date(`${date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000) : null;
  const stateOf = (item: FleetDocument) => {
    const days = daysUntil(item.expiryDate);
    if (days === null) return "Sin vencimiento";
    if (days < 0) return "Vencido";
    if (days <= item.reminderDays) return "Próximo";
    return "Vigente";
  };
  const counts = {
    Vigente: documents.filter((item) => stateOf(item) === "Vigente").length,
    Próximo: documents.filter((item) => stateOf(item) === "Próximo").length,
    Vencido: documents.filter((item) => stateOf(item) === "Vencido").length,
    "Sin vencimiento": documents.filter((item) => stateOf(item) === "Sin vencimiento").length,
  };
  const shown = documents.filter((item) => filter === "Todos" || stateOf(item) === filter).sort((a, b) => (a.expiryDate || "9999").localeCompare(b.expiryDate || "9999"));
  const notify = (message: string) => { onToast(message); setTimeout(() => onToast(""), 3800); };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = modal !== "new" ? modal : null;
    let fileKey = editing?.fileKey;
    let fileName = editing?.fileName;
    const file = form.get("file");
    if (file instanceof File && file.size) {
      setUploading(true);
      const upload = new FormData();
      upload.set("file", file);
      const response = await fetch("/api/documentos", { method: "POST", body: upload });
      setUploading(false);
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "No se pudo adjuntar el archivo." }));
        return notify(body.error || "No se pudo adjuntar el archivo.");
      }
      ({ key: fileKey, name: fileName } = await response.json());
    }
    const saved: FleetDocument = {
      id: editing?.id ?? (documents.length ? Math.max(...documents.map((item) => item.id)) + 1 : 1),
      ownerType: String(form.get("ownerType")) as DocumentOwner,
      owner: String(form.get("owner")),
      type: String(form.get("type")),
      number: String(form.get("number") || "") || undefined,
      issueDate: String(form.get("issueDate") || "") || undefined,
      expiryDate: String(form.get("expiryDate") || "") || undefined,
      reminderDays: Number(form.get("reminderDays") || 30),
      notes: String(form.get("notes") || "") || undefined,
      fileKey, fileName,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    setDocuments(editing ? documents.map((item) => item.id === saved.id ? saved : item) : [saved, ...documents]);
    setModal(null);
    notify(`Documento ${editing ? "actualizado" : "registrado"} para ${saved.owner}.`);
  }

  return <section className="documents-layout">
    <div className="fleet-heading"><div><p className="eyebrow">Control documental</p><h2>Documentos y vencimientos</h2><p>Controle documentos de vehículos y choferes con avisos anticipados y archivos adjuntos.</p></div><button className="primary" onClick={() => { setOwnerType("Vehículo"); setModal("new"); }}><Icon name="plus"/>Nuevo documento</button></div>
    <div className="fleet-kpis document-kpis">
      <article><small>Documentos registrados</small><strong>{documents.length}</strong><span>Vehículos y choferes</span></article>
      <article><small>Vigentes</small><strong className="positive-value">{counts.Vigente}</strong><span>Sin acción pendiente</span></article>
      <article><small>Por vencer</small><strong className={counts.Próximo ? "warning-value" : ""}>{counts.Próximo}</strong><span>Según aviso configurado</span></article>
      <article><small>Vencidos</small><strong className={counts.Vencido ? "negative-value" : ""}>{counts.Vencido}</strong><span>Requieren renovación</span></article>
    </div>
    <div className="document-toolbar">
      {(["Todos", "Vigente", "Próximo", "Vencido", "Sin vencimiento"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}{item !== "Todos" && <span>{counts[item]}</span>}</button>)}
    </div>
    <div className="table-card"><div className="card-heading"><div><p className="eyebrow">Archivo documental</p><h2>Documentos registrados</h2></div><strong>{shown.length} registros</strong></div><div className="table-scroll"><table><thead><tr><th>Titular</th><th>Documento</th><th>Número</th><th>Emisión</th><th>Vencimiento</th><th>Estado</th><th>Archivo</th><th>Acciones</th></tr></thead><tbody>{shown.length ? shown.map((item) => {
      const status = stateOf(item);
      const days = daysUntil(item.expiryDate);
      return <tr key={item.id}><td><strong>{item.owner}</strong><small>{item.ownerType}</small></td><td><span className="cost-badge">{item.type}</span>{item.notes && <small>{item.notes}</small>}</td><td>{item.number || "—"}</td><td>{item.issueDate ? new Intl.DateTimeFormat("es-PY").format(new Date(`${item.issueDate}T12:00:00`)) : "—"}</td><td>{item.expiryDate ? <><strong>{new Intl.DateTimeFormat("es-PY").format(new Date(`${item.expiryDate}T12:00:00`))}</strong><small>{days === 0 ? "Vence hoy" : days! > 0 ? `Faltan ${days} días` : `${Math.abs(days!)} días vencido`}</small></> : "Sin vencimiento"}</td><td><span className={`maintenance-status ${status === "Vencido" ? "overdue" : status === "Próximo" ? "upcoming" : "scheduled"}`}>{status}</span></td><td>{item.fileKey ? <a className="document-link" href={`/api/documentos/${encodeURIComponent(item.fileKey)}`} target="_blank" rel="noreferrer">Abrir archivo</a> : <span className="muted-value">Sin archivo</span>}</td><td><div className="row-actions"><button className="edit-action" onClick={() => { setOwnerType(item.ownerType); setModal(item); }}>Editar</button><button className="delete-action" onClick={() => { if (window.confirm(`¿Enviar ${item.type} de ${item.owner} a la papelera?`)) { setDocuments(documents.filter((document) => document.id !== item.id)); notify("Documento enviado a la papelera."); } }}>Eliminar</button></div></td></tr>;
    }) : <tr><td colSpan={8} className="no-results">No hay documentos en este estado.</td></tr>}</tbody></table></div></div>
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><div className="modal document-modal" onMouseDown={(event) => event.stopPropagation()}><button className="close" onClick={() => setModal(null)}>×</button><p className="eyebrow">Control documental</p><h2>{modal === "new" ? "Nuevo documento" : "Editar documento"}</h2><form onSubmit={(event) => void save(event)}>
      <label>Titular<select name="ownerType" value={ownerType} onChange={(event) => setOwnerType(event.target.value as DocumentOwner)}><option>Vehículo</option><option>Chofer</option></select></label>
      <label>{ownerType}<select name="owner" required defaultValue={modal === "new" ? "" : modal.owner}><option value="" disabled>Seleccione</option>{ownerType === "Vehículo" ? vehicles.map((item) => <option key={item.id}>{item.plate}</option>) : drivers.map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
      <label>Tipo de documento<input name="type" list="document-types" required defaultValue={modal === "new" ? (ownerType === "Vehículo" ? "DINATRAN" : "Licencia de conducir") : modal.type}/><datalist id="document-types"><option value="DINATRAN"/><option value="Habilitación municipal"/><option value="Cédula verde"/><option value="Licencia de conducir"/><option value="Cédula de identidad"/><option value="Certificado médico"/></datalist></label>
      <label>Número<input name="number" defaultValue={modal === "new" ? "" : modal.number}/></label>
      <label>Fecha de emisión<input name="issueDate" type="date" defaultValue={modal === "new" ? "" : modal.issueDate}/></label>
      <label>Fecha de vencimiento<input name="expiryDate" type="date" defaultValue={modal === "new" ? "" : modal.expiryDate}/></label>
      <label>Avisar con anticipación<select name="reminderDays" defaultValue={modal === "new" ? 30 : modal.reminderDays}><option value="7">7 días</option><option value="15">15 días</option><option value="30">30 días</option><option value="60">60 días</option><option value="90">90 días</option></select></label>
      <label>Archivo PDF o imagen<input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"/><small>{modal !== "new" && modal.fileName ? `Actual: ${modal.fileName}` : "Máximo 8 MB"}</small></label>
      <label className="wide-field">Observaciones<input name="notes" defaultValue={modal === "new" ? "" : modal.notes}/></label>
      <div className="form-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>Cancelar</button><button className="primary" disabled={uploading}>{uploading ? "Adjuntando…" : "Guardar documento"}</button></div>
    </form></div></div>}
  </section>;
}

function FleetModule({ vehicles, setVehicles, maintenance, setMaintenance, trips, fuelEntries, branches, onToast }: {
  vehicles: Vehicle[]; setVehicles: (vehicles: Vehicle[]) => void;
  maintenance: Maintenance[]; setMaintenance: (items: Maintenance[]) => void;
  trips: Trip[]; fuelEntries: FuelEntry[]; branches: Branch[]; onToast: (message: string) => void;
}) {
  const [vehicleModal, setVehicleModal] = useState<Vehicle | null>(null);
  const [maintenanceModal, setMaintenanceModal] = useState<Maintenance | "new" | null>(null);
  const [selectedPlate, setSelectedPlate] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const latestKm = (plate: string) => Math.max(0, ...trips.filter((trip) => trip.vehicle === plate).flatMap((trip) => [trip.kmInitial, trip.kmFinal]), ...fuelEntries.filter((entry) => entry.vehicle === plate).map((entry) => entry.odometer));
  const vehicleKm = (vehicle: Vehicle) => Math.max(vehicle.currentKm ?? 0, latestKm(vehicle.plate));
  const maintenanceTotal = maintenance.reduce((sum, item) => sum + item.value, 0);
  const maintenanceAlert = (item: Maintenance) => {
    const kmRemaining = item.nextKm ? item.nextKm - latestKm(item.vehicle) : null;
    const daysRemaining = item.nextDate ? Math.ceil((new Date(`${item.nextDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000) : null;
    const overdueByKm = kmRemaining !== null && kmRemaining <= 0;
    const overdueByDate = daysRemaining !== null && daysRemaining <= 0;
    const upcomingByKm = kmRemaining !== null && kmRemaining > 0 && kmRemaining <= 1000;
    const upcomingByDate = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 30;
    const status = overdueByKm || overdueByDate ? "overdue" : upcomingByKm || upcomingByDate ? "upcoming" : "scheduled";
    const details = [
      item.nextKm ? `${number.format(item.nextKm)} km (${kmRemaining! > 0 ? `faltan ${number.format(kmRemaining!)}` : `${number.format(Math.abs(kmRemaining!))} vencidos`} km)` : "",
      item.nextDate ? `${new Intl.DateTimeFormat("es-PY").format(new Date(`${item.nextDate}T12:00:00`))} (${daysRemaining! > 0 ? `faltan ${daysRemaining} días` : daysRemaining === 0 ? "vence hoy" : `${Math.abs(daysRemaining!)} días vencido`})` : "",
    ].filter(Boolean);
    return { status, details };
  };
  const maintenanceAlerts = maintenance.filter((item) => item.nextKm || item.nextDate).map((item) => ({ item, ...maintenanceAlert(item) }));
  const attentionMaintenance = maintenanceAlerts.filter((alert) => alert.status !== "scheduled");

  function notify(message: string) { onToast(message); setTimeout(() => onToast(""), 3600); }
  function saveVehicleProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicleModal) return;
    const form = new FormData(event.currentTarget);
    const fleetStatus = String(form.get("fleetStatus") || "Activo") as FleetStatus;
    const { inspectionExpiry: _legacyDinatrán, ...vehicleProfile } = vehicleModal;
    const saved: Vehicle = { ...vehicleProfile, active: fleetStatus === "Activo", fleetStatus, brand: String(form.get("brand") || ""), model: String(form.get("model") || ""), year: Number(form.get("year") || 0) || undefined, type: String(form.get("type") || ""), branch: String(form.get("branch") || ""), currentKm: Number(form.get("currentKm") || 0) };
    setVehicles(vehicles.map((vehicle) => vehicle.id === saved.id ? saved : vehicle));
    setVehicleModal(null); notify(`Ficha de ${saved.plate} actualizada.`);
  }
  function saveMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editing = maintenanceModal !== "new" ? maintenanceModal : null;
    const saved: Maintenance = { id: editing?.id ?? (maintenance.length ? Math.max(...maintenance.map((item) => item.id)) + 1 : 1), vehicle: String(form.get("vehicle")), date: String(form.get("date")), type: String(form.get("type")) as MaintenanceType, description: String(form.get("description") || ""), km: Number(form.get("km") || 0), value: Number(form.get("value") || 0), nextDate: String(form.get("nextDate") || "") || undefined, nextKm: Number(form.get("nextKm") || 0) || undefined };
    setMaintenance(editing ? maintenance.map((item) => item.id === saved.id ? saved : item) : [saved, ...maintenance]);
    setMaintenanceModal(null); notify(`Mantenimiento ${editing ? "actualizado" : "registrado"} para ${saved.vehicle}.`);
  }
  function deleteMaintenance(item: Maintenance) {
    if (!window.confirm(
      `¿Enviar el mantenimiento N.º ${item.id} de ${item.vehicle} a la papelera?\n\nPodrá restaurarlo después desde Configuración → Papelera.`
    )) return;
    setMaintenance(maintenance.filter((record) => record.id !== item.id));
    notify(`Mantenimiento N.º ${item.id} enviado a la papelera.`);
  }

  return <section className="fleet-layout">
    <div className="fleet-heading"><div><p className="eyebrow">Control de activos</p><h2>Flota de vehículos</h2><p>Ficha técnica, kilometraje y mantenimiento en un solo lugar.</p></div><button className="primary" onClick={() => { setSelectedPlate(vehicles.find((v) => v.active)?.plate ?? ""); setMaintenanceModal("new"); }}><Icon name="plus"/>Nuevo mantenimiento</button></div>
    <div className="fleet-kpis">
      <article><small>Vehículos activos</small><strong>{vehicles.filter((v) => v.active).length}</strong><span>{vehicles.length} registrados</span></article>
      <article><small>Mantenimientos por atender</small><strong className={attentionMaintenance.length ? "warning-value" : ""}>{attentionMaintenance.length}</strong><span>{maintenanceAlerts.filter((alert) => alert.status === "overdue").length} vencidos · {maintenanceAlerts.filter((alert) => alert.status === "upcoming").length} próximos</span></article>
    </div>
    <div className="table-card fleet-list-card"><div className="card-heading"><div><p className="eyebrow">Vehículos registrados</p><h2>Lista de la flota</h2></div><strong>{vehicles.length} vehículos</strong></div><div className="table-scroll"><table className="fleet-list"><thead><tr><th>Chapa / vehículo</th><th>Sucursal</th><th>Kilometraje</th><th>Viajes</th><th>Próximo mantenimiento</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{vehicles.map((vehicle) => {
      const km = vehicleKm(vehicle);
      const last = maintenance.filter((item) => item.vehicle === vehicle.plate).sort((a,b) => b.date.localeCompare(a.date))[0];
      const priority = (status: string) => status === "overdue" ? 0 : status === "upcoming" ? 1 : 2;
      const nextMaintenance = maintenanceAlerts.filter((alert) => alert.item.vehicle === vehicle.plate).sort((a, b) => priority(a.status) - priority(b.status))[0];
      const fleetStatus: FleetStatus = vehicle.fleetStatus ?? (vehicle.active ? "Activo" : "Inactivo");
      return <tr key={vehicle.id} className={fleetStatus !== "Activo" ? "inactive-row" : ""}>
        <td><div className="fleet-vehicle-cell"><span className="fleet-truck"><Icon name="vehicle"/></span><div><strong>{vehicle.plate}</strong><small>{[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" · ") || vehicle.type || "Ficha técnica pendiente"}</small>{last && <small>Último: {last.description}</small>}</div></div></td>
        <td>{vehicle.branch || "Sin asignar"}</td>
        <td><strong>{number.format(km)} km</strong></td>
        <td>{trips.filter((trip) => trip.vehicle === vehicle.plate).length}</td>
        <td>{nextMaintenance ? <div className="fleet-maintenance-cell"><span className={`maintenance-status ${nextMaintenance.status}`}>{nextMaintenance.status === "overdue" ? "Vencido" : nextMaintenance.status === "upcoming" ? "Próximo" : "Programado"}</span><small>{nextMaintenance.item.description}</small><small>{nextMaintenance.details.join(" · ")}</small></div> : <span className="muted-value">Sin programación</span>}</td>
        <td><span className={`branch-status ${fleetStatus === "Activo" ? "active" : fleetStatus === "Taller" ? "workshop" : ""}`}>{fleetStatus}</span></td>
        <td><div className="fleet-actions"><button className="edit-action" onClick={() => setVehicleModal(vehicle)}>Editar</button><button className="secondary" onClick={() => { setSelectedPlate(vehicle.plate); setMaintenanceModal("new"); }}>Mantenimiento</button></div></td>
      </tr>;
    })}</tbody></table></div></div>
    <div className="table-card"><div className="card-heading"><div><p className="eyebrow">Historial</p><h2>Mantenimientos y servicios</h2></div><strong>{money.format(maintenanceTotal)} · {maintenance.length} registros</strong></div><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Chapa</th><th>Tipo</th><th>Descripción</th><th>Km</th><th>Valor</th><th>Próximo control</th><th>Alerta</th><th>Acciones</th></tr></thead><tbody>{maintenance.map((item) => { const alert = maintenanceAlert(item); return <tr key={item.id}><td>{new Intl.DateTimeFormat("es-PY").format(new Date(`${item.date}T12:00:00`))}</td><td><strong>{item.vehicle}</strong></td><td><span className="cost-badge">{item.type}</span></td><td style={{ width: 360, minWidth: 240, maxWidth: 360, whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.45 }}>{item.description}</td><td>{number.format(item.km)} km</td><td><strong>{money.format(item.value)}</strong></td><td>{alert.details.length ? alert.details.map((detail) => <small className="maintenance-control" key={detail}>{detail}</small>) : "—"}</td><td>{alert.details.length ? <span className={`maintenance-status ${alert.status}`}>{alert.status === "overdue" ? "Vencido" : alert.status === "upcoming" ? "Próximo" : "Programado"}</span> : "—"}</td><td><div className="row-actions"><button className="edit-action" onClick={() => setMaintenanceModal(item)}>Editar</button><button className="delete-action" onClick={() => deleteMaintenance(item)}>Eliminar</button></div></td></tr>; })}</tbody></table></div></div>
    {vehicleModal && <div className="modal-backdrop" onMouseDown={() => setVehicleModal(null)}><div className="modal fleet-modal" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setVehicleModal(null)}>×</button><p className="eyebrow">Ficha del vehículo</p><h2>{vehicleModal.plate}</h2><form onSubmit={saveVehicleProfile}><label>Marca<input name="brand" defaultValue={vehicleModal.brand}/></label><label>Modelo<input name="model" defaultValue={vehicleModal.model}/></label><label>Año<input name="year" type="number" min="1980" max="2100" defaultValue={vehicleModal.year}/></label><label>Tipo<select name="type" defaultValue={vehicleModal.type}><option value="">Seleccione</option><option>Camión</option><option>Tracto camión</option><option>Furgón</option><option>Utilitario</option><option>Otro</option></select></label><label>Sucursal<select name="branch" defaultValue={vehicleModal.branch}><option value="">Sin asignar</option>{branches.filter((b) => b.active).map((b) => <option key={b.id}>{b.name}</option>)}</select></label><label>Estado<select name="fleetStatus" defaultValue={vehicleModal.fleetStatus ?? (vehicleModal.active ? "Activo" : "Inactivo")}><option>Activo</option><option>Taller</option><option>Inactivo</option></select></label><label>Kilometraje actual<input name="currentKm" type="number" min="0" defaultValue={vehicleKm(vehicleModal)}/></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setVehicleModal(null)}>Cancelar</button><button className="primary">Guardar ficha</button></div></form></div></div>}
    {maintenanceModal && <div className="modal-backdrop" onMouseDown={() => setMaintenanceModal(null)}><div className="modal fleet-modal" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setMaintenanceModal(null)}>×</button><p className="eyebrow">Flota</p><h2>{maintenanceModal === "new" ? "Nuevo mantenimiento" : "Editar mantenimiento"}</h2><form onSubmit={saveMaintenance}><label>Chapa<select name="vehicle" required defaultValue={maintenanceModal === "new" ? selectedPlate : maintenanceModal.vehicle}>{vehicles.map((v) => <option key={v.id}>{v.plate}</option>)}</select></label><label>Fecha<input name="date" type="date" required defaultValue={maintenanceModal === "new" ? today : maintenanceModal.date}/></label><label>Tipo<select name="type" required defaultValue={maintenanceModal === "new" ? "Preventivo" : maintenanceModal.type}>{(["Preventivo","Correctivo","Neumáticos","Documentación","Otros"] as MaintenanceType[]).map((type) => <option key={type}>{type}</option>)}</select></label><label>Kilometraje<input name="km" type="number" min="0" required defaultValue={maintenanceModal === "new" ? latestKm(selectedPlate) : maintenanceModal.km}/></label><label className="wide-field">Descripción<input name="description" required defaultValue={maintenanceModal === "new" ? "" : maintenanceModal.description}/></label><label>Valor (₲)<input name="value" type="number" min="0" required defaultValue={maintenanceModal === "new" ? 0 : maintenanceModal.value}/></label><div className="maintenance-schedule wide-field"><strong>Aviso del próximo mantenimiento</strong><small>Puede programarlo por kilometraje, por fecha o por ambos. Si completa ambos, se avisará por el que venza primero.</small></div><label>Próxima fecha<input name="nextDate" type="date" defaultValue={maintenanceModal === "new" ? "" : maintenanceModal.nextDate}/></label><label>Próximo km<input name="nextKm" type="number" min="0" defaultValue={maintenanceModal === "new" ? "" : maintenanceModal.nextKm}/></label><div className="form-actions"><button type="button" className="secondary" onClick={() => setMaintenanceModal(null)}>Cancelar</button><button className="primary">Guardar mantenimiento</button></div></form></div></div>}
  </section>;
}

function SettingsModule({ branches, setBranches, vehicles, setVehicles, drivers, setDrivers, rates, setRates, trips, snapshot, onRestore, onToast, users, setUsers, auditLog, trash, setTrash, currentEmail, helperAssignments, setHelperAssignments }: {
  branches: Branch[]; setBranches: (branches: Branch[]) => void;
  vehicles: Vehicle[]; setVehicles: (vehicles: Vehicle[]) => void;
  drivers: Driver[]; setDrivers: (drivers: Driver[]) => void;
  rates: FreightRates; setRates: (rates: FreightRates) => void;
  trips: Trip[]; snapshot: ErpSnapshot; onRestore: (snapshot: ErpSnapshot) => void; onToast: (message: string) => void;
  users: ErpUser[]; setUsers: (users: ErpUser[]) => void; auditLog: AuditEntry[]; trash: TrashEntry[]; setTrash: (items: TrashEntry[]) => void; currentEmail: string;
  helperAssignments: HelperAssignment[]; setHelperAssignments: (items: HelperAssignment[]) => void;
}) {
  const [section, setSection] = useState<"branches" | "vehicles" | "drivers" | "helpers" | "rates" | "users" | "history" | "trash" | "backup">("branches");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [editingUser, setEditingUser] = useState<ErpUser | null>(null);
  const [helperDriver, setHelperDriver] = useState("");
  const [helperName, setHelperName] = useState("");
  const labels = {
    branches: ["Sucursales", "Locales operativos", "⌂"],
    vehicles: ["Vehículos", "Chapas disponibles", "▣"],
    drivers: ["Choferes", "Conductores habilitados", "♙"],
    helpers: ["Ayudantes", "Vínculo con choferes", "♧"],
    rates: ["Tipos de flete", "Porcentajes y reglas", "%"],
    users: ["Usuarios", "Accesos y perfiles", "♙"],
    history: ["Historial", "Registro de cambios", "↺"],
    trash: ["Papelera", "Registros recuperables", "♲"],
    backup: ["Seguridad de datos", "Copias y restauración", "⤓"],
  } as const;
  const resetDraft = () => { setEditingId(null); setDraftName(""); };
  const notify = (message: string, delay = 3600) => { onToast(message); setTimeout(() => onToast(""), delay); };

  function saveBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    const duplicate = branches.some((branch) => branch.name.toLocaleLowerCase("es-PY") === name.toLocaleLowerCase("es-PY") && branch.id !== editingId);
    if (duplicate) {
      notify("Ya existe una sucursal con este nombre.");
      return;
    }
    if (editingId !== null) {
      const previous = branches.find((branch) => branch.id === editingId);
      setBranches(branches.map((branch) => branch.id === editingId ? { ...branch, name } : branch));
      notify(`Sucursal ${previous?.name ?? ""} actualizada.`);
    } else {
      const id = branches.length ? Math.max(...branches.map((branch) => branch.id)) + 1 : 1;
      setBranches([...branches, { id, name, active: true }]);
      notify(`Sucursal ${name} registrada.`);
    }
    resetDraft();
  }

  function removeBranch(branch: Branch) {
    if (trips.some((trip) => trip.branch === branch.name)) {
      notify("No se puede eliminar: la sucursal tiene viajes vinculados. Puede desactivarla.", 4200);
      return;
    }
    setBranches(branches.filter((item) => item.id !== branch.id));
    notify(`Sucursal ${branch.name} eliminada.`);
  }

  function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const plate = draftName.trim().toUpperCase();
    if (!plate) return;
    if (vehicles.some((item) => item.plate === plate && item.id !== editingId)) return notify("Ya existe un vehículo con esta chapa.");
    if (editingId !== null) setVehicles(vehicles.map((item) => item.id === editingId ? { ...item, plate } : item));
    else setVehicles([...vehicles, { id: vehicles.length ? Math.max(...vehicles.map((item) => item.id)) + 1 : 1, plate, active: true, fleetStatus: "Activo" }]);
    notify(editingId !== null ? "Vehículo actualizado." : `Vehículo ${plate} registrado.`);
    resetDraft();
  }

  function saveDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    if (drivers.some((item) => item.name.toLocaleLowerCase("es-PY") === name.toLocaleLowerCase("es-PY") && item.id !== editingId)) return notify("Ya existe un chofer con este nombre.");
    if (editingId !== null) setDrivers(drivers.map((item) => item.id === editingId ? { ...item, name } : item));
    else setDrivers([...drivers, { id: drivers.length ? Math.max(...drivers.map((item) => item.id)) + 1 : 1, name, active: true }]);
    notify(editingId !== null ? "Chofer actualizado." : `Chofer ${name} registrado.`);
    resetDraft();
  }

  function switchSection(next: typeof section) {
    setSection(next);
    resetDraft();
  }

  function downloadBackup() {
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `fretecontrol-respaldo-${date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Copia de seguridad descargada.");
  }

  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const restored = JSON.parse(await file.text()) as Partial<ErpSnapshot>;
      const valid = restored.version === 1 && Array.isArray(restored.trips) && Array.isArray(restored.tripCosts) &&
        Array.isArray(restored.fuelEntries) && Array.isArray(restored.branches) && Array.isArray(restored.vehicles) &&
        Array.isArray(restored.drivers) && restored.freightRates && freightTypes.every((type) => typeof restored.freightRates?.[type] === "number");
      if (!valid) throw new Error();
      if (!window.confirm("Esta acción reemplazará los datos actuales por los de la copia seleccionada. ¿Desea continuar?")) return;
      onRestore(restored as ErpSnapshot);
    } catch {
      notify("El archivo no es una copia válida de FreteControl.", 4600);
    }
  }

  function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const name = String(form.get("name") || "").trim();
    const role = String(form.get("role") || "Consulta") as UserRole;
    if (!name || !email.includes("@")) return notify("Informe un nombre y correo electrónico válidos.");
    if (users.some((user) => user.email === email && user.id !== editingUser?.id)) return notify("Este correo ya está registrado.");
    const saved: ErpUser = { id: editingUser?.id ?? (users.length ? Math.max(...users.map((user) => user.id)) + 1 : 1), name, email, role, active: editingUser?.active ?? true };
    setUsers(editingUser ? users.map((user) => user.id === saved.id ? saved : user) : [...users, saved]);
    setEditingUser(null);
    notify(`Usuario ${name} ${editingUser ? "actualizado" : "autorizado"}.`);
    event.currentTarget.reset();
  }

  async function restoreTrash(item: TrashEntry) {
    const response = await fetch("/api/trash/restore", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id }) });
    if (!response.ok) return notify("No se pudo restaurar el registro.", 4200);
    setTrash(trash.filter((entry) => entry.id !== item.id));
    notify(`${item.label} restaurado. Actualizando datos…`);
    window.setTimeout(() => window.location.reload(), 700);
  }

  return <section className="settings-layout">
    <aside className="settings-menu">
      <p className="eyebrow">Administración</p>
      <h2>Configuración</h2>
      {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => <button key={key} className={section === key ? "active" : ""} onClick={() => switchSection(key)}><span>{labels[key][2]}</span><span><strong>{labels[key][0]}</strong><small>{labels[key][1]}</small></span></button>)}
    </aside>
    <div className="settings-content">
      {section === "branches" && <>
        <div className="settings-heading">
        <div><p className="eyebrow">Datos maestros</p><h2>Sucursales</h2><p>Administre las sucursales disponibles en viajes y filtros.</p></div>
        <div className="branch-count"><strong>{branches.filter((branch) => branch.active).length}</strong><span>activas</span></div>
        </div>
        <form className="branch-form" onSubmit={saveBranch}>
        <label>Nombre de la sucursal<input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Ej.: San Lorenzo" autoFocus={editingId !== null}/></label>
        <button className="primary" type="submit">{editingId !== null ? "Guardar cambios" : "Agregar sucursal"}</button>
        {editingId !== null && <button type="button" className="secondary" onClick={resetDraft}>Cancelar</button>}
        </form>
        <div className="branch-list" role="list">
        {branches.map((branch) => <article key={branch.id} role="listitem">
          <span className={branch.active ? "branch-mark" : "branch-mark inactive"}>⌂</span>
          <div><strong>{branch.name}</strong><small>{trips.filter((trip) => trip.branch === branch.name).length} viaje(s) vinculados</small></div>
          <span className={branch.active ? "branch-status active" : "branch-status"}>{branch.active ? "Activa" : "Inactiva"}</span>
          <div className="branch-actions">
            <button className="edit-action" onClick={() => { setEditingId(branch.id); setDraftName(branch.name); }}>Editar</button>
            <button className="toggle-action" onClick={() => setBranches(branches.map((item) => item.id === branch.id ? { ...item, active: !item.active } : item))}>{branch.active ? "Desactivar" : "Activar"}</button>
            <button className="delete-action" onClick={() => removeBranch(branch)}>Eliminar</button>
          </div>
        </article>)}
        </div>
        <p className="settings-note">Las sucursales inactivas dejan de aparecer en nuevos viajes y filtros, pero se conservan en el historial.</p>
      </>}
      {section === "vehicles" && <MasterList
        title="Vehículos" description="Administre las chapas disponibles para seleccionar en los viajes." icon="▣"
        count={vehicles.filter((item) => item.active).length} countLabel="activos" value={draftName} setValue={setDraftName}
        placeholder="Ej.: ABC-1234" editing={editingId !== null} onSubmit={saveVehicle} onCancel={resetDraft}
        items={vehicles.map((item) => ({ id: item.id, name: item.plate, active: item.active, linked: trips.filter((trip) => trip.vehicle === item.plate).length }))}
        onEdit={(id, name) => { setEditingId(id); setDraftName(name); }}
        onToggle={(id) => setVehicles(vehicles.map((item) => item.id === id ? { ...item, active: !item.active, fleetStatus: item.active ? "Inactivo" : "Activo" } : item))}
        onDelete={(id, name, linked) => linked ? notify("No se puede eliminar: el vehículo tiene viajes vinculados. Puede desactivarlo.", 4200) : (setVehicles(vehicles.filter((item) => item.id !== id)), notify(`Vehículo ${name} eliminado.`))}
      />}
      {section === "drivers" && <MasterList
        title="Choferes" description="Administre los conductores habilitados para seleccionar en los viajes." icon="♙"
        count={drivers.filter((item) => item.active).length} countLabel="activos" value={draftName} setValue={setDraftName}
        placeholder="Nombre completo del chofer" editing={editingId !== null} onSubmit={saveDriver} onCancel={resetDraft}
        items={drivers.map((item) => ({ id: item.id, name: item.name, active: item.active, linked: trips.filter((trip) => trip.driver === item.name).length }))}
        onEdit={(id, name) => { setEditingId(id); setDraftName(name); }}
        onToggle={(id) => setDrivers(drivers.map((item) => item.id === id ? { ...item, active: !item.active } : item))}
        onDelete={(id, name, linked) => linked ? notify("No se puede eliminar: el chofer tiene viajes vinculados. Puede desactivarlo.", 4200) : (setDrivers(drivers.filter((item) => item.id !== id)), notify(`Chofer ${name} eliminado.`))}
      />}
      {section === "helpers" && <div className="helper-settings">
        <div className="settings-heading"><div><p className="eyebrow">Equipo de entrega</p><h2>Ayudantes por chofer</h2><p>Vincule un ayudante a cada chofer para calcular su bonificación mensual.</p></div><div className="branch-count"><strong>{helperAssignments.length}</strong><span>vinculados</span></div></div>
        <form className="helper-form" onSubmit={(event) => {
          event.preventDefault();
          const helper = helperName.trim();
          if (!helperDriver || !helper) return notify("Seleccione el chofer e informe el nombre del ayudante.");
          if (helperAssignments.some((item) => item.helper.toLocaleLowerCase("es-PY") === helper.toLocaleLowerCase("es-PY") && item.driver !== helperDriver)) return notify("Este ayudante ya está vinculado a otro chofer.");
          setHelperAssignments([...helperAssignments.filter((item) => item.driver !== helperDriver), { driver: helperDriver, helper }]);
          notify(`Ayudante ${helper} vinculado a ${helperDriver}.`);
          setHelperDriver(""); setHelperName("");
        }}>
          <label>Chofer<select value={helperDriver} onChange={(event) => { const driver = event.target.value; setHelperDriver(driver); setHelperName(helperAssignments.find((item) => item.driver === driver)?.helper ?? ""); }} required><option value="">Seleccione</option>{drivers.filter((driver) => driver.active).map((driver) => <option key={driver.id} value={driver.name}>{driver.name}</option>)}</select></label>
          <label>Nombre del ayudante<input value={helperName} onChange={(event) => setHelperName(event.target.value)} placeholder="Nombre completo" required/></label>
          <button className="primary">Guardar vínculo</button>
        </form>
        <div className="helper-list">{drivers.map((driver) => {
          const assignment = helperAssignments.find((item) => item.driver === driver.name);
          return <article key={driver.id}><div><strong>{driver.name}</strong><small>Chofer</small></div><span>→</span><div><strong>{assignment?.helper ?? "Sin ayudante"}</strong><small>Ayudante</small></div>{assignment ? <button className="delete-action" onClick={() => { setHelperAssignments(helperAssignments.filter((item) => item.driver !== driver.name)); notify(`Vínculo de ${driver.name} eliminado.`); }}>Eliminar</button> : <button className="edit-action" onClick={() => { setHelperDriver(driver.name); setHelperName(""); }}>Agregar</button>}</article>;
        })}</div>
        <p className="settings-note">La categoría Local o Nacional del ayudante se determina automáticamente por las operaciones del chofer en cada mes.</p>
      </div>}
      {section === "rates" && <div className="rates-settings">
        <div className="settings-heading"><div><p className="eyebrow">Reglas de cálculo</p><h2>Tipos de flete</h2><p>Defina el porcentaje aplicado al valor de cada pedido.</p></div><div className="branch-count"><strong>{freightTypes.length}</strong><span>tipos</span></div></div>
        <div className="rate-grid settings-rate-grid">{freightTypes.map((type) => <label key={type}>{type}<span><input type="number" min="0" max="100" step="0.01" value={rates[type]} onChange={(event) => setRates({ ...rates, [type]: Number(event.target.value) })}/>%</span><small>{money.format(10000000 * rates[type] / 100)} por cada ₲ 10.000.000</small></label>)}</div>
        <p className="settings-note">Los nuevos porcentajes se aplican automáticamente a los pedidos y resultados de los viajes.</p>
      </div>}
      {section === "users" && <div className="security-settings">
        <div className="settings-heading"><div><p className="eyebrow">Control de acceso</p><h2>Usuarios y perfiles</h2><p>Autorice correos y defina lo que cada persona puede hacer.</p></div><div className="branch-count"><strong>{users.filter((user) => user.active).length}</strong><span>activos</span></div></div>
        <form className="user-form" onSubmit={saveUser}>
          <label>Nombre<input name="name" defaultValue={editingUser?.name} placeholder="Nombre completo" required/></label>
          <label>Correo<input name="email" type="email" defaultValue={editingUser?.email} placeholder="usuario@empresa.com" required/></label>
          <label>Perfil<select name="role" defaultValue={editingUser?.role ?? "Operador"}><option>Administrador</option><option>Operador</option><option>Consulta</option></select></label>
          <button className="primary">{editingUser ? "Guardar cambios" : "Autorizar usuario"}</button>
          {editingUser && <button type="button" className="secondary" onClick={() => setEditingUser(null)}>Cancelar</button>}
        </form>
        <div className="permissions-grid">
          <article><strong>Administrador</strong><small>Acceso total, usuarios, configuración y restauración.</small></article>
          <article><strong>Operador</strong><small>Viajes, pedidos, flota, combustible y chamados.</small></article>
          <article><strong>Consulta</strong><small>Visualización sin alterar registros.</small></article>
        </div>
        <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Perfil</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><span className="cost-badge">{user.role}</span></td><td><span className={`branch-status ${user.active ? "active" : ""}`}>{user.active ? "Activo" : "Inactivo"}</span></td><td><div className="row-actions"><button className="edit-action" onClick={() => setEditingUser(user)}>Editar</button><button className="toggle-action" disabled={user.email === currentEmail} onClick={() => setUsers(users.map((item) => item.id === user.id ? { ...item, active: !item.active } : item))}>{user.active ? "Desactivar" : "Activar"}</button></div></td></tr>)}</tbody></table></div></div>
        <p className="settings-note">Su propio acceso no puede ser desactivado durante la sesión.</p>
      </div>}
      {section === "history" && <div className="security-settings">
        <div className="settings-heading"><div><p className="eyebrow">Trazabilidad</p><h2>Historial de alteraciones</h2><p>Cada guardado registra usuario, fecha, módulo y resumen del cambio.</p></div><div className="branch-count"><strong>{auditLog.length}</strong><span>eventos</span></div></div>
        <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Detalle</th></tr></thead><tbody>{auditLog.length ? auditLog.slice(0, 200).map((entry) => <tr key={entry.id}><td>{new Intl.DateTimeFormat("es-PY", { dateStyle: "short", timeStyle: "short" }).format(new Date(entry.at))}</td><td><strong>{entry.user}</strong></td><td>{entry.action}</td><td><span className="cost-badge">{entry.module}</span></td><td>{entry.detail}</td></tr>) : <tr><td colSpan={5} className="no-results">El historial comenzará con las próximas alteraciones.</td></tr>}</tbody></table></div></div>
      </div>}
      {section === "trash" && <div className="security-settings">
        <div className="settings-heading"><div><p className="eyebrow">Recuperación</p><h2>Papelera</h2><p>Los registros eliminados quedan disponibles para restauración.</p></div><div className="branch-count"><strong>{trash.length}</strong><span>elementos</span></div></div>
        <div className="table-card"><div className="table-scroll"><table><thead><tr><th>Eliminado</th><th>Usuario</th><th>Módulo</th><th>Registro</th><th>Acción</th></tr></thead><tbody>{trash.length ? trash.map((item) => <tr key={item.id}><td>{new Intl.DateTimeFormat("es-PY", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.deletedAt))}</td><td>{item.deletedBy}</td><td><span className="cost-badge">{item.collection}</span></td><td><strong>{item.label}</strong></td><td><button className="edit-action" onClick={() => void restoreTrash(item)}>Restaurar</button></td></tr>) : <tr><td colSpan={5} className="no-results">La papelera está vacía.</td></tr>}</tbody></table></div></div>
      </div>}
      {section === "backup" && <div className="backup-settings">
        <div className="settings-heading"><div><p className="eyebrow">Protección de la información</p><h2>Seguridad de datos</h2><p>Descargue una copia completa o restaure una copia anterior.</p></div><div className="branch-count"><strong>{snapshot.trips.length}</strong><span>viajes</span></div></div>
        <div className="backup-grid">
          <article>
            <span className="backup-icon">⤓</span>
            <div><h3>Descargar copia completa</h3><p>Incluye viajes, pedidos, costos, combustible y todos los datos de configuración.</p></div>
            <button className="primary" type="button" onClick={downloadBackup}>Descargar respaldo</button>
          </article>
          <article>
            <span className="backup-icon restore">↺</span>
            <div><h3>Restaurar una copia</h3><p>Seleccione un archivo de respaldo de FreteControl. El sistema validará el contenido antes de reemplazar los datos.</p></div>
            <label className="secondary file-action">Seleccionar archivo<input type="file" accept="application/json,.json" onChange={(event) => { void importBackup(event.target.files?.[0]); event.target.value = ""; }}/></label>
          </article>
        </div>
        <div className="backup-summary">
          <div><small>Viajes</small><strong>{snapshot.trips.length}</strong></div>
          <div><small>Pedidos</small><strong>{snapshot.trips.reduce((sum, trip) => sum + trip.orders.length, 0)}</strong></div>
          <div><small>Costos</small><strong>{snapshot.tripCosts.length}</strong></div>
          <div><small>Cargas de combustible</small><strong>{snapshot.fuelEntries.length}</strong></div>
          <div><small>Datos maestros</small><strong>{snapshot.branches.length + snapshot.vehicles.length + snapshot.drivers.length}</strong></div>
        </div>
        <p className="settings-note">La restauración solicita confirmación y luego guarda automáticamente la información recuperada en la base permanente.</p>
      </div>}
    </div>
  </section>;
}

function MasterList({ title, description, icon, count, countLabel, value, setValue, placeholder, editing, onSubmit, onCancel, items, onEdit, onToggle, onDelete }: {
  title: string; description: string; icon: string; count: number; countLabel: string; value: string; setValue: (value: string) => void; placeholder: string; editing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void;
  items: { id: number; name: string; active: boolean; linked: number }[];
  onEdit: (id: number, name: string) => void; onToggle: (id: number) => void; onDelete: (id: number, name: string, linked: number) => void;
}) {
  return <>
    <div className="settings-heading"><div><p className="eyebrow">Datos maestros</p><h2>{title}</h2><p>{description}</p></div><div className="branch-count"><strong>{count}</strong><span>{countLabel}</span></div></div>
    <form className="branch-form" onSubmit={onSubmit}>
      <label>{title === "Vehículos" ? "Chapa del vehículo" : "Nombre del chofer"}<input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder}/></label>
      <button className="primary" type="submit">{editing ? "Guardar cambios" : `Agregar ${title === "Vehículos" ? "vehículo" : "chofer"}`}</button>
      {editing && <button type="button" className="secondary" onClick={onCancel}>Cancelar</button>}
    </form>
    <div className="branch-list" role="list">{items.map((item) => <article key={item.id} role="listitem">
      <span className={item.active ? "branch-mark" : "branch-mark inactive"}>{icon}</span>
      <div><strong>{item.name}</strong><small>{item.linked} viaje(s) vinculados</small></div>
      <span className={item.active ? "branch-status active" : "branch-status"}>{item.active ? "Activo" : "Inactivo"}</span>
      <div className="branch-actions">
        <button className="edit-action" onClick={() => onEdit(item.id, item.name)}>Editar</button>
        <button className="toggle-action" onClick={() => onToggle(item.id)}>{item.active ? "Desactivar" : "Activar"}</button>
        <button className="delete-action" onClick={() => onDelete(item.id, item.name, item.linked)}>Eliminar</button>
      </div>
    </article>)}</div>
    <p className="settings-note">Los registros inactivos se conservan en el historial y dejan de aparecer en nuevos viajes y filtros.</p>
  </>;
}

function TripTable({ trips, rates, onAll, onEdit, onFinish, onReport, onDelete }: { trips: Trip[]; rates: FreightRates; onAll?: () => void; onEdit: (trip: Trip) => void; onFinish: (trip: Trip) => void; onReport: (trip: Trip) => void; onDelete?: (trip: Trip) => void }) {
  return <section className="table-card"><div className="card-heading"><div><p className="eyebrow">Seguimiento</p><h2>Viajes registrados</h2></div>{onAll && <button onClick={onAll}>Ver todos los viajes →</button>}</div><div className="table-scroll"><table><thead><tr><th>Viaje</th><th>Sucursal</th><th>Fechas</th><th>Chapa / Chofer</th><th>Estado</th><th>Kilometraje</th><th>Pedidos</th><th>Base facturada</th><th>Flete</th><th>Acciones</th></tr></thead><tbody>{trips.length === 0 ? <tr><td className="no-results" colSpan={10}>No se encontraron viajes con los filtros seleccionados.</td></tr> : trips.map((trip) => <tr key={trip.id}><td><strong>N.º {trip.id}</strong></td><td><strong>{trip.branch}</strong></td><td>{new Intl.DateTimeFormat("es-PY").format(new Date(`${trip.startDate}T12:00:00`))}<small>{trip.endDate ? `Final: ${new Intl.DateTimeFormat("es-PY").format(new Date(`${trip.endDate}T12:00:00`))}` : "Sin fecha final"}</small></td><td><strong>{trip.vehicle}</strong><small>{trip.driver}</small></td><td><span className={`status ${trip.status.toLowerCase().replaceAll(" ", "-")}`}>● {trip.status}</span></td><td>{number.format(trip.kmInitial)} → {trip.kmFinal ? number.format(trip.kmFinal) : "—"}<small>{trip.kmFinal ? `${number.format(trip.kmFinal - trip.kmInitial)} km recorridos` : "Viaje no finalizado"}</small></td><td style={{ width: 250, minWidth: 180, maxWidth: 250, whiteSpace: "normal" }}><strong>{trip.orders.length}</strong><small style={{ display: "flex", flexWrap: "wrap", gap: "3px 0", lineHeight: 1.35 }}>{trip.orders.map((order, index) => <span key={`${order.order}-${index}`} style={{ display: "inline-flex", whiteSpace: "nowrap" }}>{order.order}{index < trip.orders.length - 1 ? " · " : ""}</span>)}</small></td><td><strong>{money.format(invoiceTotal(trip))}</strong></td><td><strong className="green">{money.format(freightValue(trip, rates))}</strong><small>Según el tipo de flete</small></td><td><div className="row-actions"><button className="report-action" onClick={() => onReport(trip)}>Ver informe</button><button className="edit-action" onClick={() => onEdit(trip)}>Editar</button>{trip.status !== "Finalizado" && <button className="finish-action" onClick={() => onFinish(trip)}>Finalizar</button>}{onDelete && <button className="delete-action" onClick={() => onDelete(trip)}>Eliminar</button>}</div></td></tr>)}</tbody></table></div></section>;
}

function TripsModule({ trips, allTrips, setTrips, rates, branches, vehicles, drivers, onToast, onEdit, onFinish, onReport, onDelete }: { trips: Trip[]; allTrips: Trip[]; setTrips: (trips: Trip[]) => void; rates: FreightRates; branches: Branch[]; vehicles: Vehicle[]; drivers: Driver[]; onToast: (message: string) => void; onEdit: (trip: Trip) => void; onFinish: (trip: Trip) => void; onReport: (trip: Trip) => void; onDelete: (trip: Trip) => void }) {
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState("");
  const [importRows, setImportRows] = useState<ImportedTrip[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const validRows = importRows.filter((row) => !row.error);
  const invalidRows = importRows.filter((row) => row.error);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const pick = (record: Record<string, unknown>, names: string[]) => Object.entries(record).find(([key]) => names.includes(normalize(key)))?.[1];
  const findCanonical = (value: unknown, options: string[]) => options.find((option) => normalize(option) === normalize(String(value ?? ""))) ?? "";
  const normalizeDate = (value: unknown) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "number") {
      const date = new Date(Date.UTC(1899, 11, 30));
      date.setUTCDate(date.getUTCDate() + value);
      return date.toISOString().slice(0, 10);
    }
    const raw = String(value ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
  };
  const parseKm = (value: unknown) => Math.round(Number(String(value ?? "").replace(/[.\s]/g, "").replace(",", "."))) || 0;

  async function readTripsFile(file?: File) {
    if (!file) return;
    setImportBusy(true);
    setImportFile(file.name);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: true });
      const existingIds = new Set(allTrips.map((trip) => trip.id));
      const seen = new Set<number>();
      setImportRows(records.map((record, index) => {
        const row = index + 2;
        const id = Number(pick(record, ["viaje", "numeroviaje", "nviaje", "id"]));
        const branch = findCanonical(pick(record, ["sucursal", "filial"]), branches.filter((item) => item.active).map((item) => item.name));
        const startDate = normalizeDate(pick(record, ["fechainicio", "fecha", "salida"]));
        const endDate = normalizeDate(pick(record, ["fechafinal", "fechafin", "llegada"])) || undefined;
        const driver = findCanonical(pick(record, ["chofer", "chofer", "conductor"]), drivers.filter((item) => item.active).map((item) => item.name));
        const vehicle = findCanonical(pick(record, ["chapa", "vehiculo", "placa"]), vehicles.filter((item) => item.active && (item.fleetStatus ?? "Activo") === "Activo").map((item) => item.plate));
        const status = findCanonical(pick(record, ["estado", "status"]), tripStatuses) as TripStatus;
        const kmInitial = parseKm(pick(record, ["kminicial", "kilometrajeinicial", "odometroinicial"]));
        const kmFinal = parseKm(pick(record, ["kmfinal", "kilometrajefinal", "odometrofinal"]));
        const errors: string[] = [];
        if (!Number.isInteger(id) || id <= 0) errors.push("Número de viaje inválido");
        if (existingIds.has(id) || seen.has(id)) errors.push("Viaje duplicado");
        if (!branch) errors.push("Sucursal no registrada");
        if (!startDate) errors.push("Fecha inicial inválida");
        if (endDate && endDate < startDate) errors.push("Fecha final anterior al inicio");
        if (!driver) errors.push("Chofer no disponible");
        if (!vehicle) errors.push("Vehículo no disponible");
        if (!status) errors.push("Estado inválido");
        if (kmInitial <= 0) errors.push("Km inicial inválido");
        if (kmFinal && kmFinal < kmInitial) errors.push("Km final menor al inicial");
        if (status === "Finalizado" && (!endDate || kmFinal <= kmInitial)) errors.push("Viaje finalizado incompleto");
        if (Number.isInteger(id) && id > 0) seen.add(id);
        return { row, id, branch, startDate, endDate, driver, vehicle, status: status || "Pendiente", kmInitial, kmFinal, orders: [], error: errors.join(" · ") || undefined };
      }));
    } catch {
      setImportRows([]);
      onToast("No se pudo leer el archivo de viajes. Use el modelo indicado.");
    } finally {
      setImportBusy(false);
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const nextId = allTrips.length ? Math.max(...allTrips.map((trip) => trip.id)) + 1 : 1;
    const sheet = XLSX.utils.json_to_sheet([{ Viaje: nextId, Sucursal: branches.find((item) => item.active)?.name ?? "", "Fecha inicio": new Date().toISOString().slice(0, 10), "Fecha final": "", Chofer: drivers.find((item) => item.active)?.name ?? "", Chapa: vehicles.find((item) => item.active && (item.fleetStatus ?? "Activo") === "Activo")?.plate ?? "", Estado: "Pendiente", "Km inicial": 100000, "Km final": "" }]);
    sheet["!cols"] = [{ wch: 10 }, { wch: 22 }, { wch: 15 }, { wch: 15 }, { wch: 24 }, { wch: 15 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Viajes");
    XLSX.writeFile(workbook, "modelo_importacion_viajes.xlsx");
  }

  function confirmImport() {
    if (!validRows.length || invalidRows.length) return;
    const imported = validRows.map(({ row: _row, error: _error, ...trip }) => trip);
    setTrips([...imported, ...allTrips].sort((a, b) => b.id - a.id));
    setImportOpen(false);
    setImportRows([]);
    setImportFile("");
    onToast(`${imported.length} viaje(s) importado(s) correctamente.`);
  }

  return <section className="trips-layout">
    <div className="orders-toolbar"><div><p className="eyebrow">Carga masiva</p><h2>Importar viajes desde Excel</h2><p>Cree varias viagens antes de cargar sus pedidos y costos.</p></div><div><button className="secondary" onClick={() => void downloadTemplate()}>↓ Descargar modelo</button><button className="primary" onClick={() => setImportOpen(true)}>▤ Importar Excel</button></div></div>
    <TripTable trips={trips} rates={rates} onEdit={onEdit} onFinish={onFinish} onReport={onReport} onDelete={onDelete}/>
    {importOpen && <div className="modal-backdrop" onMouseDown={() => setImportOpen(false)}><div className="modal orders-import-modal" role="dialog" aria-modal="true" aria-labelledby="import-trips-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => setImportOpen(false)} aria-label="Cerrar">×</button><p className="eyebrow">Carga masiva</p><h2 id="import-trips-title">Importar viajes</h2><p className="modal-intro">Columnas: Viaje, Sucursal, Fecha inicio, Fecha final, Chofer, Chapa, Estado, Km inicial y Km final.</p>
      <label className="excel-drop"><input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void readTripsFile(event.target.files?.[0])}/><span>▤</span><strong>{importBusy ? "Leyendo archivo…" : importFile || "Seleccionar archivo Excel"}</strong><small>Excel, XLS o CSV · primera hoja del archivo</small></label>
      {importRows.length > 0 && <><div className="import-summary"><span className="ok"><strong>{validRows.length}</strong><small>válidos</small></span><span className={invalidRows.length ? "error" : "ok"}><strong>{invalidRows.length}</strong><small>con error</small></span><span><strong>{new Set(validRows.map((row) => row.vehicle)).size}</strong><small>vehículos</small></span></div>
        <div className="import-preview"><table><thead><tr><th>Línea</th><th>Viaje</th><th>Sucursal</th><th>Inicio / fin</th><th>Chapa / chofer</th><th>Estado</th><th>Kilometraje</th><th>Validación</th></tr></thead><tbody>{importRows.map((row) => <tr key={row.row} className={row.error ? "invalid" : ""}><td>{row.row}</td><td>N.º {row.id || "—"}</td><td>{row.branch || "—"}</td><td>{row.startDate || "—"}<small>{row.endDate || "Sin fecha final"}</small></td><td>{row.vehicle || "—"}<small>{row.driver || "—"}</small></td><td>{row.status}</td><td>{row.kmInitial ? number.format(row.kmInitial) : "—"} → {row.kmFinal ? number.format(row.kmFinal) : "—"}</td><td>{row.error ? <span className="import-error">⚠ {row.error}</span> : <span className="import-ok">✓ Listo</span>}</td></tr>)}</tbody></table></div>
      </>}
      <p className="import-note">Sucursales, choferes y vehículos deben estar activos y previamente registrados. La importación solo se habilita cuando todas las líneas son válidas.</p>
      <div className="form-actions"><button className="secondary" type="button" onClick={() => setImportOpen(false)}>Cancelar</button><button className="primary" type="button" disabled={!validRows.length || invalidRows.length > 0 || importBusy} onClick={confirmImport}>Importar {validRows.length || ""} viaje(s)</button></div>
    </div></div>}
  </section>;
}

function OrdersModule({ trips, allTrips, setTrips, rates, setRates, onEdit, onToast }: { trips: Trip[]; allTrips: Trip[]; setTrips: (trips: Trip[]) => void; rates: FreightRates; setRates: (rates: FreightRates) => void; onEdit: (trip: Trip) => void; onToast: (message: string) => void }) {
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderError, setNewOrderError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState("");
  const [importRows, setImportRows] = useState<ImportedOrder[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const orders = trips.flatMap((trip) => trip.orders.map((order) => ({ ...order, tripId: trip.id, freight: Math.round(order.amount * rates[order.freightType] / 100) })));
  const validRows = importRows.filter((row) => !row.error);
  const invalidRows = importRows.filter((row) => row.error);

  const normalizeHeader = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const pick = (record: Record<string, unknown>, names: string[]) => {
    const entry = Object.entries(record).find(([key]) => names.includes(normalizeHeader(key)));
    return entry?.[1];
  };
  const parseAmount = (value: unknown) => {
    if (typeof value === "number") return Math.round(value);
    const raw = String(value ?? "").trim().replace(/[₲\s]/g, "");
    if (!raw) return 0;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) return Math.round(Number(raw.replace(/\./g, "").replace(",", ".")));
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return Math.round(Number(raw.replace(/,/g, "")));
    return Math.round(Number(raw.replace(",", "."))) || 0;
  };
  const normalizeFreightType = (value: unknown): FreightType | null => {
    const wanted = normalizeHeader(String(value ?? ""));
    if (!wanted) return null;

    const aliases: Record<string, FreightType> = {
      local: "Local",
      nacional: "Nacional",
      dobro: "Dobro",
      doble: "Dobro",
      duplo: "Dobro",
      devolucao: "Devolución",
      devolucion: "Devolución",
      remessa: "Remisión",
      remision: "Remisión",
    };

    const exactMatch = aliases[wanted] ?? freightTypes.find((type) => normalizeHeader(type) === wanted);
    if (exactMatch) return exactMatch;

    const embeddedMatch = Object.entries(aliases).find(([alias]) => wanted.includes(alias));
    return embeddedMatch?.[1] ?? null;
  };

  async function readOrdersFile(file?: File) {
    if (!file) return;
    setImportBusy(true);
    setImportFile(file.name);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = records.map((record, index): ImportedOrder => {
        const row = index + 2;
        const tripId = Number(pick(record, ["viaje", "numeroviaje", "nviaje", "viajeid"]));
        const invoice = String(pick(record, ["factura", "numerofactura", "nfactura"]) ?? "").trim();
        const order = String(pick(record, ["pedido", "numeropedido", "npedido"]) ?? "").trim();
        const client = String(pick(record, ["cliente", "razonsocial"]) ?? "").trim();
        const amount = parseAmount(pick(record, ["valor", "importe", "monto", "valorguaranies"]));
        const freightType = normalizeFreightType(pick(record, ["tipodeflete", "flete", "tipo"]));
        const errors: string[] = [];
        if (!Number.isInteger(tripId) || !allTrips.some((trip) => trip.id === tripId)) errors.push("Viaje inexistente");
        if (!invoice) errors.push("Falta factura");
        if (!order) errors.push("Falta pedido");
        if (!client) errors.push("Falta cliente");
        if (amount <= 0) errors.push("Valor inválido");
        if (!freightType) errors.push("Tipo de flete inválido");
        return { row, tripId, invoice, order, client, amount, freightType: freightType ?? "Local", error: errors.join(" · ") || undefined };
      });
      setImportRows(parsed);
    } catch {
      setImportRows([]);
      onToast("No se pudo leer el archivo. Use Excel, XLS o CSV con el modelo indicado.");
    } finally {
      setImportBusy(false);
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet([
      { Viaje: 6, Factura: "001-001-0000001", Pedido: "PED-0001", Cliente: "Nombre del cliente", Valor: 25000000, "Tipo de flete": "Nacional" },
    ]);
    sheet["!cols"] = [{ wch: 10 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 18 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Pedidos");
    XLSX.writeFile(workbook, "modelo_importacion_pedidos.xlsx");
  }

  function confirmImport() {
    if (!validRows.length || invalidRows.length) return;
    const rowsByTrip = new Map<number, Order[]>();
    validRows.forEach(({ tripId, row: _row, error: _error, ...order }) => rowsByTrip.set(tripId, [...(rowsByTrip.get(tripId) ?? []), order]));
    setTrips(allTrips.map((trip) => ({ ...trip, orders: [...trip.orders, ...(rowsByTrip.get(trip.id) ?? [])] })));
    setImportOpen(false);
    setImportRows([]);
    setImportFile("");
    onToast(`${validRows.length} pedido(s) importado(s) correctamente.`);
  }

  function saveNewOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tripId = Number(form.get("tripId"));
    const invoice = String(form.get("invoice") ?? "").trim();
    const order = String(form.get("order") ?? "").trim();
    const client = String(form.get("client") ?? "").trim();
    const amount = Number(form.get("amount"));
    const freightType = String(form.get("freightType") ?? "") as FreightType;
    const trip = allTrips.find((item) => item.id === tripId);
    if (!trip) return setNewOrderError("Seleccione un viaje válido.");
    if (!invoice || !order || !client) return setNewOrderError("Complete factura, pedido y cliente.");
    if (!Number.isFinite(amount) || amount <= 0) return setNewOrderError("Ingrese un valor mayor que cero.");
    if (!freightTypes.includes(freightType)) return setNewOrderError("Seleccione un tipo de flete válido.");
    setTrips(allTrips.map((item) => item.id === tripId ? { ...item, orders: [...item.orders, { invoice, order, client, amount: Math.round(amount), freightType }] } : item));
    setNewOrderOpen(false);
    setNewOrderError("");
    onToast(`Pedido ${order} creado correctamente.`);
  }

  return <section className="orders-layout">
    <div className="orders-toolbar"><div><p className="eyebrow">Gestión de pedidos</p><h2>Pedidos manuales o desde Excel</h2><p>Cree un pedido nuevo o agregue varios a una o más viagens.</p></div><div><button className="primary" onClick={() => { setNewOrderError(""); setNewOrderOpen(true); }}>＋ Nuevo pedido</button><button className="secondary" onClick={() => void downloadTemplate()}>↓ Descargar modelo</button><button className="secondary" onClick={() => setImportOpen(true)}>▤ Importar Excel</button></div></div>
    <div className="rate-card"><div className="card-heading"><div><p className="eyebrow">Configuración</p><h2>Porcentajes por tipo de flete</h2></div></div><p className="helper">El cálculo se aplica automáticamente sobre el valor de cada pedido.</p><div className="rate-grid">{freightTypes.map((type) => <label key={type}>{type}<span><input type="number" min="0" max="100" step="0.01" value={rates[type]} onChange={(event) => setRates({ ...rates, [type]: Number(event.target.value) })}/>%</span></label>)}</div></div>
    <div className="table-card"><div className="card-heading"><div><p className="eyebrow">Operación</p><h2>Pedidos registrados</h2></div><strong>{orders.length} pedidos</strong></div><div className="table-scroll"><table><thead><tr><th>Viaje</th><th>Factura</th><th>Pedido</th><th>Cliente</th><th>Valor</th><th>Tipo de flete</th><th>Porcentaje</th><th>Flete calculado</th><th>Acciones</th></tr></thead><tbody>{orders.map((order, index) => <tr key={`${order.tripId}-${order.order}-${index}`}><td><strong>N.º {order.tripId}</strong></td><td>{order.invoice}</td><td><strong>{order.order}</strong></td><td>{order.client}</td><td>{money.format(order.amount)}</td><td><span className="freight-badge">{order.freightType}</span></td><td>{rates[order.freightType]}%</td><td><strong className="green">{money.format(order.freight)}</strong></td><td><button className="edit-action" onClick={() => { const trip = trips.find((item) => item.id === order.tripId); if (trip) onEdit(trip); }}>Editar</button></td></tr>)}</tbody></table></div></div>
    {newOrderOpen && <div className="modal-backdrop" onMouseDown={() => setNewOrderOpen(false)}><div className="modal order-modal" role="dialog" aria-modal="true" aria-labelledby="new-order-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => setNewOrderOpen(false)} aria-label="Cerrar">×</button><p className="eyebrow">Operación</p><h2 id="new-order-title">Nuevo pedido</h2><p className="modal-intro">Registre el pedido y vincúlelo a una viaje existente.</p>
      {newOrderError && <p className="form-error" role="alert">{newOrderError}</p>}
      <form onSubmit={saveNewOrder}>
        <label className="wide-field">Viaje<select name="tripId" required autoFocus defaultValue=""><option value="">Seleccione el viaje</option>{allTrips.map((trip) => <option key={trip.id} value={trip.id}>N.º {trip.id} — {trip.vehicle} — {trip.driver}</option>)}</select></label>
        <label>Factura<input name="invoice" placeholder="001-001-0000001" required/></label>
        <label>Pedido<input name="order" placeholder="PED-0001" required/></label>
        <label className="wide-field">Cliente<input name="client" placeholder="Nombre del cliente" required/></label>
        <label>Valor en guaraníes<input name="amount" type="number" min="1" step="1" placeholder="0" required/></label>
        <label>Tipo de flete<select name="freightType" defaultValue="Local">{freightTypes.map((type) => <option key={type} value={type}>{type} — {rates[type]}%</option>)}</select></label>
        <div className="form-actions"><button className="secondary" type="button" onClick={() => setNewOrderOpen(false)}>Cancelar</button><button className="primary" type="submit">Guardar pedido</button></div>
      </form>
    </div></div>}
    {importOpen && <div className="modal-backdrop" onMouseDown={() => setImportOpen(false)}><div className="modal orders-import-modal" role="dialog" aria-modal="true" aria-labelledby="import-orders-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => setImportOpen(false)} aria-label="Cerrar">×</button><p className="eyebrow">Carga masiva</p><h2 id="import-orders-title">Importar pedidos</h2><p className="modal-intro">Columnas requeridas: Viaje, Factura, Pedido, Cliente, Valor y Tipo de flete.</p>
      <label className="excel-drop"><input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void readOrdersFile(event.target.files?.[0])}/><span>▤</span><strong>{importBusy ? "Leyendo archivo…" : importFile || "Seleccionar archivo Excel"}</strong><small>Excel, XLS o CSV · primera hoja del archivo</small></label>
      {importRows.length > 0 && <><div className="import-summary"><span className="ok"><strong>{validRows.length}</strong><small>válidos</small></span><span className={invalidRows.length ? "error" : "ok"}><strong>{invalidRows.length}</strong><small>con error</small></span><span><strong>{new Set(validRows.map((row) => row.tripId)).size}</strong><small>viajes</small></span></div>
        <div className="import-preview"><table><thead><tr><th>Línea</th><th>Viaje</th><th>Factura</th><th>Pedido</th><th>Cliente</th><th>Valor</th><th>Tipo</th><th>Validación</th></tr></thead><tbody>{importRows.map((row) => <tr key={row.row} className={row.error ? "invalid" : ""}><td>{row.row}</td><td>N.º {row.tripId || "—"}</td><td>{row.invoice || "—"}</td><td>{row.order || "—"}</td><td>{row.client || "—"}</td><td>{row.amount ? money.format(row.amount) : "—"}</td><td>{row.freightType}</td><td>{row.error ? <span className="import-error">⚠ {row.error}</span> : <span className="import-ok">✓ Listo</span>}</td></tr>)}</tbody></table></div>
      </>}
      <p className="import-note">Para proteger los datos, la importación solo se habilita cuando todas las líneas son válidas.</p>
      <div className="form-actions"><button className="secondary" type="button" onClick={() => setImportOpen(false)}>Cancelar</button><button className="primary" type="button" disabled={!validRows.length || invalidRows.length > 0 || importBusy} onClick={confirmImport}>Importar {validRows.length || ""} pedido(s)</button></div>
    </div></div>}
  </section>;
}

function CostsModule({ costs, allCosts, setCosts, trips, onToast, onNew, onEdit }: { costs: TripCost[]; allCosts: TripCost[]; setCosts: (costs: TripCost[]) => void; trips: Trip[]; onToast: (message: string) => void; onNew: () => void; onEdit: (cost: TripCost) => void }) {
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState("");
  const [importRows, setImportRows] = useState<ImportedCost[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const total = costs.reduce((sum, cost) => sum + cost.quantity * cost.unitValue, 0);
  const validRows = importRows.filter((row) => !row.error);
  const invalidRows = importRows.filter((row) => row.error);
  const tripLabel = (id: number) => {
    const trip = trips.find((item) => item.id === id);
    return trip ? `N.º ${id} — ${trip.vehicle}` : `N.º ${id}`;
  };
  const normalizeHeader = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const pick = (record: Record<string, unknown>, names: string[]) => Object.entries(record).find(([key]) => names.includes(normalizeHeader(key)))?.[1];
  const parseNumber = (value: unknown) => {
    if (typeof value === "number") return value;
    const raw = String(value ?? "").trim().replace(/[₲\s]/g, "");
    if (!raw) return 0;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) return Number(raw.replace(/\./g, "").replace(",", "."));
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) return Number(raw.replace(/,/g, ""));
    return Number(raw.replace(",", ".")) || 0;
  };
  const normalizeType = (value: unknown): CostType | null => {
    const wanted = normalizeHeader(String(value ?? ""));
    return costTypes.find((type) => normalizeHeader(type) === wanted) ?? null;
  };
  const normalizeDate = (value: unknown) => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (typeof value === "number") {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
      return excelEpoch.toISOString().slice(0, 10);
    }
    const raw = String(value ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
  };

  async function readCostsFile(file?: File) {
    if (!file) return;
    setImportBusy(true);
    setImportFile(file.name);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: true });
      const existing = new Set(allCosts.map((cost) => `${cost.tripId}|${cost.date}|${normalizeHeader(cost.type)}|${normalizeHeader(cost.description)}|${cost.quantity}|${cost.unitValue}`));
      const seen = new Set<string>();
      setImportRows(records.map((record, index) => {
        const row = index + 2;
        const tripId = Number(pick(record, ["viaje", "numeroviaje", "nviaje", "viajeid"]));
        const date = normalizeDate(pick(record, ["fecha", "data"]));
        const type = normalizeType(pick(record, ["tipo", "tipodecosto", "categoria"]));
        const description = String(pick(record, ["descripcion", "detalle", "concepto"]) ?? "").trim();
        const quantity = parseNumber(pick(record, ["cantidad", "quantidade", "qty"]));
        const unitValue = Math.round(parseNumber(pick(record, ["valorunitario", "valor", "importeunitario", "precio"])));
        const errors: string[] = [];
        if (!Number.isInteger(tripId) || !trips.some((trip) => trip.id === tripId)) errors.push("Viaje inexistente");
        if (!date || Number.isNaN(new Date(`${date}T12:00:00`).getTime())) errors.push("Fecha inválida");
        if (!type) errors.push("Tipo inválido");
        if (quantity <= 0) errors.push("Cantidad inválida");
        if (unitValue <= 0) errors.push("Valor inválido");
        const key = `${tripId}|${date}|${normalizeHeader(type ?? "")}|${normalizeHeader(description)}|${quantity}|${unitValue}`;
        if (existing.has(key) || seen.has(key)) errors.push("Costo duplicado");
        seen.add(key);
        return { row, tripId, date, type: type ?? "Otros", description, quantity, unitValue, error: errors.join(" · ") || undefined };
      }));
    } catch {
      setImportRows([]);
      onToast("No se pudo leer el archivo de costos. Use el modelo indicado.");
    } finally {
      setImportBusy(false);
    }
  }

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet([{ Viaje: trips[0]?.id ?? 1, Fecha: new Date().toISOString().slice(0, 10), Tipo: "Peaje", Descripción: "Peajes de ruta", Cantidad: 2, "Valor unitario": 18000 }]);
    sheet["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 32 }, { wch: 12 }, { wch: 18 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Costos");
    XLSX.writeFile(workbook, "modelo_importacion_costos.xlsx");
  }

  function confirmImport() {
    if (!validRows.length || invalidRows.length) return;
    const firstId = allCosts.length ? Math.max(...allCosts.map((cost) => cost.id)) + 1 : 1;
    const imported = validRows.map(({ row: _row, error: _error, ...cost }, index) => ({ ...cost, id: firstId + index }));
    setCosts([...imported, ...allCosts]);
    setImportOpen(false);
    setImportRows([]);
    setImportFile("");
    onToast(`${imported.length} costo(s) importado(s) correctamente.`);
  }

  return <section className="costs-layout">
    <div className="cost-summary">
      <div><p className="eyebrow">Control financiero</p><h2>Costos de viajes</h2><p>Combustible no se registra aquí para evitar duplicidad.</p></div>
      <div className="cost-total"><small>Total registrado</small><strong>{money.format(total)}</strong></div>
      <div className="cost-import-actions"><button className="secondary" onClick={() => void downloadTemplate()}>↓ Modelo Excel</button><button className="secondary" onClick={() => setImportOpen(true)}>▤ Importar Excel</button><button className="primary" onClick={onNew}><Icon name="plus"/>Nuevo costo</button></div>
    </div>
    <div className="category-grid">{costTypes.map((type) => {
      const categoryTotal = costs.filter((cost) => cost.type === type).reduce((sum, cost) => sum + cost.quantity * cost.unitValue, 0);
      return <article key={type}><small>{type}</small><strong>{money.format(categoryTotal)}</strong></article>;
    })}</div>
    <div className="table-card"><div className="card-heading"><div><p className="eyebrow">Detalle</p><h2>Gastos registrados</h2></div><strong>{costs.length} registros</strong></div><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Viaje</th><th>Tipo</th><th>Descripción</th><th>Cantidad</th><th>Valor unitario</th><th>Total</th><th>Acciones</th></tr></thead><tbody>{costs.map((cost) => <tr key={cost.id}><td>{new Intl.DateTimeFormat("es-PY").format(new Date(`${cost.date}T12:00:00`))}</td><td><strong>{tripLabel(cost.tripId)}</strong></td><td><span className="cost-badge">{cost.type}</span></td><td>{cost.description || "—"}</td><td>{number.format(cost.quantity)}</td><td>{money.format(cost.unitValue)}</td><td><strong>{money.format(cost.quantity * cost.unitValue)}</strong></td><td><button className="edit-action" onClick={() => onEdit(cost)}>Editar</button></td></tr>)}</tbody></table></div></div>
    {importOpen && <div className="modal-backdrop" onMouseDown={() => setImportOpen(false)}><div className="modal orders-import-modal" role="dialog" aria-modal="true" aria-labelledby="import-costs-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="close" onClick={() => setImportOpen(false)} aria-label="Cerrar">×</button><p className="eyebrow">Carga masiva</p><h2 id="import-costs-title">Importar costos</h2><p className="modal-intro">Columnas requeridas: Viaje, Fecha, Tipo, Descripción, Cantidad y Valor unitario.</p>
      <label className="excel-drop"><input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => void readCostsFile(event.target.files?.[0])}/><span>▤</span><strong>{importBusy ? "Leyendo archivo…" : importFile || "Seleccionar archivo Excel"}</strong><small>Excel, XLS o CSV · primera hoja del archivo</small></label>
      {importRows.length > 0 && <><div className="import-summary"><span className="ok"><strong>{validRows.length}</strong><small>válidos</small></span><span className={invalidRows.length ? "error" : "ok"}><strong>{invalidRows.length}</strong><small>con error</small></span><span><strong>{new Set(validRows.map((row) => row.tripId)).size}</strong><small>viajes</small></span></div>
        <div className="import-preview"><table><thead><tr><th>Línea</th><th>Viaje</th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Cantidad</th><th>Valor unitario</th><th>Total</th><th>Validación</th></tr></thead><tbody>{importRows.map((row) => <tr key={row.row} className={row.error ? "invalid" : ""}><td>{row.row}</td><td>N.º {row.tripId || "—"}</td><td>{row.date || "—"}</td><td>{row.type}</td><td>{row.description || "—"}</td><td>{number.format(row.quantity)}</td><td>{row.unitValue ? money.format(row.unitValue) : "—"}</td><td>{row.quantity && row.unitValue ? money.format(row.quantity * row.unitValue) : "—"}</td><td>{row.error ? <span className="import-error">⚠ {row.error}</span> : <span className="import-ok">✓ Listo</span>}</td></tr>)}</tbody></table></div>
      </>}
      <p className="import-note">Combustible no es una categoría válida aquí. Las líneas solo se guardan cuando todo el archivo pasa la validación.</p>
      <div className="form-actions"><button className="secondary" type="button" onClick={() => setImportOpen(false)}>Cancelar</button><button className="primary" type="button" disabled={!validRows.length || invalidRows.length > 0 || importBusy} onClick={confirmImport}>Importar {validRows.length || ""} costo(s)</button></div>
    </div></div>}
  </section>;
}
