import {
  NumericInput,
  parseNumber,
  validateNumber,
} from "@/components/NumericInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAmortissements,
  useEmprunts,
  useFraisFixes,
  useJoursOuvertureParSemaine,
  useMixProduitParCategorie,
  useParametres,
  useSaveJoursOuvertureParSemaine,
  useSaveMixProduitParCategorie,
  useSaveParametres,
} from "@/hooks/useQueries";
import type {
  LigneFraisFixes,
  ParametresRentabilite,
} from "@/hooks/useQueries";
import { fmtEur, fmtPct } from "@/utils/format";
import { BarChart3, Calculator, Info, Save, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

// ── Exported constant (canonical source for all imports) ──────────────────────
export const FOOD_COST_CATEGORIES = [
  "Boissons froides (hors alcool)",
  "Sandwichs froids et Wraps",
  "Plats chauds",
  "Desserts maison",
  "Accompagnements",
  "Les formules ou menus",
];

// ── Internal constants ────────────────────────────────────────────────────────
const DEFAULT_FOOD_COSTS: [string, number][] = [
  ["Boissons froides (hors alcool)", 25],
  ["Sandwichs froids et Wraps", 30],
  ["Plats chauds", 33],
  ["Desserts maison", 30],
  ["Accompagnements", 28],
  ["Les formules ou menus", 31],
];

const SHORT_LABELS: Record<string, string> = {
  "Boissons froides (hors alcool)": "Boissons froides",
  "Sandwichs froids et Wraps": "Sandwichs & Wraps",
  "Plats chauds": "Plats chauds",
  "Desserts maison": "Desserts maison",
  Accompagnements: "Accompagnements",
  "Les formules ou menus": "Formules / menus",
};

const YEARS = [
  "Année 1 (n+1)",
  "Année 2 (n+2)",
  "Année 3 (n+3)",
  "Année 4 (n+4)",
  "Année 5 (n+5)",
] as const;

const EMBALLAGES_KEY = "previsionnel_emballages_an1";

// Saisonnalité : coefficient mensuel (0=fermeture, 0.8=vacances, 1=normal)
// Juillet : fermeture mi-juillet→mi-août → coeff ~0.5 (demi-mois ouvert à 0.8)
// Août : pareil
const SEASONALITY: { month: string; coeff: number }[] = [
  { month: "Jan", coeff: 1.0 },
  { month: "Fév", coeff: 0.8 }, // vacances hiver
  { month: "Mar", coeff: 1.0 },
  { month: "Avr", coeff: 0.8 }, // vacances printemps
  { month: "Mai", coeff: 1.0 },
  { month: "Jun", coeff: 1.0 },
  { month: "Jul", coeff: 0.4 }, // fermeture 15 juil → 15 août = ~demi-mois @ 0.8
  { month: "Aoû", coeff: 0.0 }, // fermeture estivale
  { month: "Sep", coeff: 1.0 },
  { month: "Oct", coeff: 0.8 }, // vacances toussaint
  { month: "Nov", coeff: 1.0 },
  { month: "Déc", coeff: 0.8 }, // vacances noël
];

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

function compoundGrowth(base: number, rate: number): number[] {
  return [
    base,
    base * (1 + rate),
    base * (1 + rate) ** 2,
    base * (1 + rate) ** 3,
    base * (1 + rate) ** 4,
  ];
}

function findFraisAnnuel(
  fraisFixes: LigneFraisFixes[],
  keywords: string[],
): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]/g, "");
  const line = fraisFixes.find((l) =>
    keywords.some((kw) => norm(l.nom).includes(norm(kw))),
  );
  return (line?.montantMensuelAvecRemu ?? 0) * 12;
}

// ── Amortization interest calculator ─────────────────────────────────────────
function calculerInteretsSur5Ans(
  emprunts: {
    montant: number;
    tauxAnnuel: number;
    dureeMois: bigint | number;
  }[],
): number[] {
  const totaux = [0, 0, 0, 0, 0];

  for (const emprunt of emprunts) {
    const montant = Number(emprunt.montant) || 0;
    const tauxAnnuel = Number(emprunt.tauxAnnuel) || 0;
    const dureeMois = Number(emprunt.dureeMois) || 0;

    if (montant <= 0 || dureeMois <= 0) continue;

    const tauxMensuel = tauxAnnuel / 12 / 100;
    let mensualite: number;

    if (tauxMensuel === 0) {
      mensualite = montant / dureeMois;
    } else {
      mensualite =
        (montant * tauxMensuel) / (1 - (1 + tauxMensuel) ** -dureeMois);
    }

    let capitalRestant = montant;

    for (let mois = 1; mois <= 60; mois++) {
      if (mois <= dureeMois && capitalRestant > 0) {
        const interetDuMois = capitalRestant * tauxMensuel;
        const anneeIndex = Math.floor((mois - 1) / 12);
        totaux[anneeIndex] += interetDuMois;
        capitalRestant -= mensualite - interetDuMois;
        if (capitalRestant < 0) capitalRestant = 0;
      }
    }
  }

  return totaux;
}

function migrateCategories(saved: [string, number][]): [string, number][] {
  const savedMap = new Map(saved);
  return FOOD_COST_CATEGORIES.map((cat) => [
    cat,
    savedMap.get(cat) ?? DEFAULT_FOOD_COSTS.find(([c]) => c === cat)?.[1] ?? 30,
  ]);
}

const defaultParams = (): ParametresRentabilite => ({
  ticketMoyenHT: 0,
  nbClientsParSemaine: 0,
  nbSemainesSaison: 0,
  tauxFoodCostParCategorie: DEFAULT_FOOD_COSTS,
});

// ── Sub-components for 5-year table ──────────────────────────────────────────
import type React from "react";

function ColHeader({ label, live }: { label: string; live?: boolean }) {
  return (
    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wide whitespace-nowrap">
      {label}
      {live && (
        <span className="ml-1.5 inline-block bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none align-middle">
          LIVE
        </span>
      )}
    </th>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-slate-700">
      <td
        colSpan={6}
        className="px-4 py-2 text-sm font-bold text-white uppercase tracking-wide"
      >
        {label}
      </td>
    </tr>
  );
}

function DataRow({
  label,
  values,
  indent = false,
  alt = false,
  badge,
}: {
  label: string;
  values: number[];
  indent?: boolean;
  alt?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <tr className={alt ? "bg-slate-50" : "bg-white"}>
      <td
        className={`px-4 py-2.5 text-sm text-slate-700 ${
          indent ? "pl-8" : "font-medium"
        }`}
      >
        {indent && <span className="text-slate-400 mr-2">▸</span>}
        {label}
        {badge}
      </td>
      {YEARS.map((y, i) => (
        <td
          key={y}
          className="px-4 py-2.5 text-sm text-right text-slate-700 tabular-nums"
        >
          {fmt(values[i] ?? 0)}
        </td>
      ))}
    </tr>
  );
}

function TotalRow({
  label,
  values,
  color = "bg-slate-100",
  textColor = "text-slate-800",
}: {
  label: string;
  values: number[];
  color?: string;
  textColor?: string;
}) {
  return (
    <tr className={color}>
      <td
        className={`px-4 py-3 text-sm font-bold ${textColor} uppercase tracking-wide`}
      >
        {label}
      </td>
      {YEARS.map((y, i) => (
        <td
          key={y}
          className={`px-4 py-3 text-sm text-right tabular-nums font-bold ${textColor}`}
        >
          {fmt(values[i] ?? 0)}
        </td>
      ))}
    </tr>
  );
}

function HighlightRow({
  label,
  values,
  totalCA,
  variant,
}: {
  label: string;
  values: number[];
  totalCA?: number[];
  variant: "green" | "blue" | "orange" | "red";
}) {
  const styles: Record<string, string> = {
    green: "bg-emerald-600 text-white",
    blue: "bg-blue-600 text-white",
    orange: "bg-amber-500 text-white",
    red: "bg-rose-600 text-white",
  };
  return (
    <tr className={styles[variant]}>
      <td className="px-4 py-3 text-sm font-black uppercase tracking-wide">
        {label}
      </td>
      {YEARS.map((y, i) => (
        <td
          key={y}
          className="px-4 py-3 text-sm text-right tabular-nums font-black"
        >
          <div>{fmt(values[i] ?? 0)}</div>
          {totalCA && (totalCA[i] ?? 0) !== 0 && (
            <div className="text-xs font-normal opacity-80">
              ({(((values[i] ?? 0) / (totalCA[i] ?? 1)) * 100).toFixed(1)} % CA)
            </div>
          )}
        </td>
      ))}
    </tr>
  );
}

function SpacerRow() {
  return (
    <tr>
      <td colSpan={6} className="py-1 bg-slate-200" />
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PilotageGlobal() {
  // ── Backend queries ───────────────────────────────────────────────────────
  const { data: saved, isLoading: loadingParams } = useParametres();
  const { data: fraisFixesData = [] } = useFraisFixes();
  const { data: empruntsData = [] } = useEmprunts();
  const { data: amortissementsData = [] } = useAmortissements();
  const { data: savedJours } = useJoursOuvertureParSemaine();
  const { data: savedMix = [] } = useMixProduitParCategorie();

  const saveMut = useSaveParametres();
  const saveJoursMut = useSaveJoursOuvertureParSemaine();
  const saveMixMut = useSaveMixProduitParCategorie();

  // ── Hypothèses de Ventes — state synchronisé avec le backend ─────────────
  const [nbClientsParSemaine, setNbClientsParSemaine] = useState(0);
  const [nbSemainesSaisonHyp, setNbSemainesSaisonHyp] = useState(0);
  const [hypothesesSaving, setHypothesesSaving] = useState(false);

  // ── Tableau des hypothèses par catégorie (local state only) ──────────────
  const DEFAULT_CATEGORIE_HYPOTHESES = [
    {
      nom: "Snacking",
      mixProduit: 60,
      ticketMoyenHT: 8,
      tauxFoodCost: 30,
      tauxTVA: 10,
    },
    {
      nom: "Boutique",
      mixProduit: 30,
      ticketMoyenHT: 15,
      tauxFoodCost: 25,
      tauxTVA: 20,
    },
    {
      nom: "Traiteur",
      mixProduit: 10,
      ticketMoyenHT: 25,
      tauxFoodCost: 35,
      tauxTVA: 10,
    },
  ];
  const [categorieHypotheses, setCategorieHypotheses] = useState(
    DEFAULT_CATEGORIE_HYPOTHESES,
  );

  // ── Simulator state ───────────────────────────────────────────────────────
  const [params, setParams] = useState<ParametresRentabilite>(defaultParams());
  const [clientsValue, setClientsValue] = useState(100);
  const [ticketValue, setTicketValue] = useState(12);
  const [semainesStr, setSemainesStr] = useState("");
  const [joursStr, setJoursStr] = useState("6");
  const [foodCostStrs, setFoodCostStrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(DEFAULT_FOOD_COSTS.map(([c, v]) => [c, String(v)])),
  );
  const [mixProduitStrs, setMixProduitStrs] = useState<Record<string, string>>(
    () => Object.fromEntries(FOOD_COST_CATEGORIES.map((cat) => [cat, "0"])),
  );

  // ── Growth rate state (localStorage) ─────────────────────────────────────
  const [emballagesStr, setEmballagesStr] = useState(
    () => localStorage.getItem(EMBALLAGES_KEY) || "",
  );
  const [evCAStr, setEvCAStr] = useState(
    () => localStorage.getItem("previsionnel_ev_ca") || "",
  );
  const [evAchatsStr, setEvAchatsStr] = useState(
    () => localStorage.getItem("previsionnel_ev_achats") || "",
  );
  const [evFraisStr, setEvFraisStr] = useState(
    () => localStorage.getItem("previsionnel_ev_frais") || "",
  );
  const [evSalairesStr, setEvSalairesStr] = useState(
    () => localStorage.getItem("previsionnel_ev_salaires") || "",
  );

  // ── Sync from backend ─────────────────────────────────────────────────────
  useEffect(() => {
    if (saved) {
      const migrated = migrateCategories(saved.tauxFoodCostParCategorie);
      const p: ParametresRentabilite = {
        ...saved,
        tauxFoodCostParCategorie: migrated,
      };
      setParams(p);
      // Sync hypothèses de ventes
      setNbClientsParSemaine(saved.nbClientsParSemaine ?? 0);
      setNbSemainesSaisonHyp(saved.nbSemainesSaison ?? 0);
      // Sync simulateur
      if (saved.ticketMoyenHT > 0) {
        setTicketValue(saved.ticketMoyenHT);
      }
      if (saved.nbClientsParSemaine > 0) {
        setClientsValue(saved.nbClientsParSemaine);
      }
      setSemainesStr(
        saved.nbSemainesSaison === 0 ? "" : String(saved.nbSemainesSaison),
      );
      const strs: Record<string, string> = {};
      for (const [cat, val] of migrated)
        strs[cat] = val === 0 ? "" : String(val);
      setFoodCostStrs(strs);
    }
  }, [saved]);

  useEffect(() => {
    if (savedJours !== undefined && savedJours !== null) {
      setJoursStr(savedJours === 0 ? "" : String(savedJours));
    }
  }, [savedJours]);

  useEffect(() => {
    if (savedMix.length > 0) {
      const mixMap = new Map(savedMix);
      const strs: Record<string, string> = {};
      for (const cat of FOOD_COST_CATEGORIES) {
        const v = mixMap.get(cat) ?? 0;
        strs[cat] = v === 0 ? "" : String(v);
      }
      setMixProduitStrs(strs);
    }
  }, [savedMix]);

  // ── Computed values ───────────────────────────────────────────────────────
  const nbSemainesSaison = parseNumber(semainesStr);

  // CA annuel = clients/semaine × ticket HT × nb semaines × (1 + TVA 10%)
  const caAnnuel = ticketValue * clientsValue * nbSemainesSaison * 1.1;
  const caMensuelMoyen = nbSemainesSaison > 0 ? caAnnuel / 12 : 0;

  const totalMensuelCharges = fraisFixesData.reduce(
    (s, l) => s + l.montantMensuelAvecRemu,
    0,
  );
  const totalAnnuelCharges = totalMensuelCharges * 12;

  // Food cost moyen pondéré
  const foodCostMixMap = useMemo(() => new Map(savedMix), [savedMix]);
  const totalMixPct = FOOD_COST_CATEGORIES.reduce(
    (s, cat) => s + parseNumber(mixProduitStrs[cat] || "0"),
    0,
  );
  const mixOk = Math.abs(totalMixPct - 100) < 0.5;

  const foodCostMoyen = useMemo(() => {
    let fc = 0;
    for (const cat of FOOD_COST_CATEGORIES) {
      const mix = parseNumber(mixProduitStrs[cat] || "0") / 100;
      const tfc = parseNumber(foodCostStrs[cat] || "0") / 100;
      fc += mix * tfc;
    }
    return fc * 100;
  }, [mixProduitStrs, foodCostStrs]);

  const margeBruteRate = 1 - foodCostMoyen / 100;
  const pointMort =
    margeBruteRate > 0 ? totalAnnuelCharges / margeBruteRate : 0;

  // ── Saisonnalité chart data ───────────────────────────────────────────────
  const seasonalityData = useMemo(
    () =>
      SEASONALITY.map(({ month, coeff }) => {
        const caMonth = caMensuelMoyen * coeff;
        const resultatNet = caMonth - totalMensuelCharges;
        return {
          month,
          coeff,
          caMonth: Math.round(caMonth),
          resultatNet: Math.round(resultatNet),
        };
      }),
    [caMensuelMoyen, totalMensuelCharges],
  );

  // ── 5-year projection ─────────────────────────────────────────────────────
  const evCA = parseNumber(evCAStr) / 100;
  const evAchats = parseNumber(evAchatsStr) / 100;
  const evFrais = parseNumber(evFraisStr) / 100;
  const evSalaires = parseNumber(evSalairesStr) / 100;

  // ── Per-category CA & cost calculations from hypothèses table ────────────
  const totalClientsAnnuels = nbClientsParSemaine * nbSemainesSaisonHyp;

  const caParCategorie = useMemo(
    () =>
      categorieHypotheses.map((cat) => ({
        nom: cat.nom,
        caHT: totalClientsAnnuels * (cat.mixProduit / 100) * cat.ticketMoyenHT,
        coutMatiere:
          totalClientsAnnuels *
          (cat.mixProduit / 100) *
          cat.ticketMoyenHT *
          (cat.tauxFoodCost / 100),
      })),
    [categorieHypotheses, totalClientsAnnuels],
  );

  const caHTGlobal = useMemo(
    () => caParCategorie.reduce((s, c) => s + c.caHT, 0),
    [caParCategorie],
  );

  const coutMatiereGlobal = useMemo(
    () => caParCategorie.reduce((s, c) => s + c.coutMatiere, 0),
    [caParCategorie],
  );

  // Weighted average ticket moyen (for simulator section & backward compat)
  const ticketMoyenHTPondere =
    totalClientsAnnuels > 0 ? caHTGlobal / totalClientsAnnuels : 0;

  // Weighted average food cost (for backend save)
  const tauxFoodCostPondere =
    caHTGlobal > 0 ? (coutMatiereGlobal / caHTGlobal) * 100 : 0;

  // Mix validation for the category table
  const totalMixCategories = categorieHypotheses.reduce(
    (s, c) => s + c.mixProduit,
    0,
  );
  const mixOkCategories = Math.round(totalMixCategories) === 100;

  // Handler for inline category table edits
  function handleCategorieChange(index: number, field: string, value: number) {
    setCategorieHypotheses((prev) =>
      prev.map((cat, i) => (i === index ? { ...cat, [field]: value } : cat)),
    );
  }

  // totalCAYear1 is caHTGlobal (per-category weighted sum)
  const totalCAYear1 = caHTGlobal;

  const caYear1ByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of FOOD_COST_CATEGORIES) {
      const mixPct =
        foodCostMixMap.get(cat) ?? parseNumber(mixProduitStrs[cat] || "0");
      map[cat] = totalCAYear1 * (mixPct / 100);
    }
    return map;
  }, [totalCAYear1, foodCostMixMap, mixProduitStrs]);

  const achatsMatieresYear1 = coutMatiereGlobal;

  const emballagesYear1 = parseNumber(emballagesStr);

  const loyerYear1 = findFraisAnnuel(fraisFixesData, ["location", "loyer"]);
  const energiesYear1 = findFraisAnnuel(fraisFixesData, ["energie", "eau"]);
  const assurancesYear1 = findFraisAnnuel(fraisFixesData, [
    "assurance",
    "licence",
  ]);
  const masseSalarialeYear1 = findFraisAnnuel(fraisFixesData, [
    "salaire",
    "cotisation",
  ]);
  const honorairesYear1 = findFraisAnnuel(fraisFixesData, [
    "communication",
    "marketing",
    "honoraire",
  ]);

  const amortissementsParAnnee = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((n) =>
        amortissementsData.reduce((sum, a) => {
          const dureeAns = Number(a.dureeMois);
          if (dureeAns <= 0) return sum;
          const dotation = a.coutTotal / dureeAns;
          return n <= dureeAns ? sum + dotation : sum;
        }, 0),
      ),
    [amortissementsData],
  );

  const interetsYears = useMemo(
    () => calculerInteretsSur5Ans(empruntsData || []),
    [empruntsData],
  );

  const caByYearAndCategory = useMemo(() => {
    const result: Record<string, number[]> = {};
    for (const cat of FOOD_COST_CATEGORIES) {
      result[cat] = compoundGrowth(caYear1ByCategory[cat] ?? 0, evCA);
    }
    return result;
  }, [caYear1ByCategory, evCA]);

  const totalCAByYear = useMemo(
    () =>
      YEARS.map((_, i) =>
        FOOD_COST_CATEGORIES.reduce(
          (s, cat) => s + (caByYearAndCategory[cat]?.[i] ?? 0),
          0,
        ),
      ),
    [caByYearAndCategory],
  );

  const achatsYears = useMemo(
    () => compoundGrowth(achatsMatieresYear1, evAchats),
    [achatsMatieresYear1, evAchats],
  );
  const emballagesYears = useMemo(
    () => compoundGrowth(emballagesYear1, evAchats),
    [emballagesYear1, evAchats],
  );
  const loyerYears = useMemo(
    () => compoundGrowth(loyerYear1, evFrais),
    [loyerYear1, evFrais],
  );
  const energiesYears = useMemo(
    () => compoundGrowth(energiesYear1, evFrais),
    [energiesYear1, evFrais],
  );
  const assurancesYears = useMemo(
    () => compoundGrowth(assurancesYear1, evFrais),
    [assurancesYear1, evFrais],
  );
  const honorairesYears = useMemo(
    () => compoundGrowth(honorairesYear1, evFrais),
    [honorairesYear1, evFrais],
  );
  const masseSalarialeYears = useMemo(
    () => compoundGrowth(masseSalarialeYear1, evSalaires),
    [masseSalarialeYear1, evSalaires],
  );

  const totalChargesYears = YEARS.map(
    (_, i) => (achatsYears[i] ?? 0) + (emballagesYears[i] ?? 0),
  );
  const margeBruteYears = YEARS.map(
    (_, i) => (totalCAByYear[i] ?? 0) - (totalChargesYears[i] ?? 0),
  );
  const totalFraisYears = YEARS.map(
    (_, i) =>
      (loyerYears[i] ?? 0) +
      (energiesYears[i] ?? 0) +
      (assurancesYears[i] ?? 0) +
      (masseSalarialeYears[i] ?? 0) +
      (honorairesYears[i] ?? 0),
  );
  const ebeYears = YEARS.map(
    (_, i) => (margeBruteYears[i] ?? 0) - (totalFraisYears[i] ?? 0),
  );
  const resultatYears = YEARS.map(
    (_, i) =>
      (ebeYears[i] ?? 0) -
      (amortissementsParAnnee[i] ?? 0) -
      (interetsYears[i] ?? 0),
  );

  // ── Food cost handler ─────────────────────────────────────────────────────
  function handleFoodCostChange(cat: string, val: string) {
    setFoodCostStrs((prev) => ({ ...prev, [cat]: val }));
    if (validateNumber(val)) {
      setParams((p) => ({
        ...p,
        tauxFoodCostParCategorie: p.tauxFoodCostParCategorie.map(([c, t]) =>
          c === cat ? [c, parseNumber(val)] : [c, t],
        ),
      }));
    }
  }

  // ── Validation & save ─────────────────────────────────────────────────────
  const allValid =
    validateNumber(semainesStr) &&
    validateNumber(joursStr) &&
    Object.values(foodCostStrs).every((v) => validateNumber(v)) &&
    Object.values(mixProduitStrs).every((v) => validateNumber(v));

  async function handleSaveHypotheses() {
    setHypothesesSaving(true);
    try {
      const payload: ParametresRentabilite = {
        ...params,
        ticketMoyenHT: ticketMoyenHTPondere,
        nbClientsParSemaine,
        nbSemainesSaison: nbSemainesSaisonHyp,
        tauxFoodCostParCategorie: params.tauxFoodCostParCategorie.map(
          ([cat, _]) => [cat, tauxFoodCostPondere] as [string, number],
        ),
      };
      await saveMut.mutateAsync(payload);
      // Keep simulateur in sync
      setTicketValue(ticketMoyenHTPondere);
      setClientsValue(nbClientsParSemaine);
      setSemainesStr(
        nbSemainesSaisonHyp === 0 ? "" : String(nbSemainesSaisonHyp),
      );
      toast.success("Hypothèses de ventes enregistrées");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    } finally {
      setHypothesesSaving(false);
    }
  }

  async function handleSave() {
    if (!allValid) {
      toast.error("Corrigez les champs invalides avant de sauvegarder.");
      return;
    }
    const payload: ParametresRentabilite = {
      ...params,
      ticketMoyenHT: ticketValue,
      nbClientsParSemaine: clientsValue,
      nbSemainesSaison: parseNumber(semainesStr),
    };
    const joursVal = parseNumber(joursStr);
    const mixPayload: [string, number][] = FOOD_COST_CATEGORIES.map((cat) => [
      cat,
      parseNumber(mixProduitStrs[cat] || "0"),
    ]);
    try {
      await Promise.all([
        saveMut.mutateAsync(payload),
        saveJoursMut.mutateAsync(joursVal),
        saveMixMut.mutateAsync(mixPayload),
      ]);
      toast.success("Paramètres sauvegardés");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  function handleEvChange(key: string, setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      localStorage.setItem(key, v);
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Pilotage Global
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Simulateur, saisonnalité, rentabilité et prévisionnel sur 5 ans
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMut.isPending || !allValid}
          data-ocid="pilotage.save_button"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMut.isPending ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>

      {/* ── SECTION 0 : SIMULATEUR DE CHIFFRE D'AFFAIRES ── */}
      <section>
        <Card className="rounded-2xl shadow-lg border border-slate-200 bg-white overflow-hidden">
          {/* Card top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
          <CardHeader className="pb-4 pt-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-emerald-600" />
                  Simulateur de Chiffre d&apos;Affaires
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Paramètres globaux et hypothèses par catégorie — pilotent
                  directement la ligne CA du tableau prévisionnel 5 ans
                </p>
              </div>
              <Button
                onClick={handleSaveHypotheses}
                disabled={
                  hypothesesSaving || saveMut.isPending || !mixOkCategories
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                data-ocid="pilotage.hypotheses_save_button"
              >
                <Save className="mr-2 h-4 w-4" />
                {hypothesesSaving ? "Enregistrement..." : "Sauvegarder"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            {loadingParams ? (
              <div className="flex gap-4">
                <Skeleton className="h-20 flex-1 rounded-xl" />
                <Skeleton className="h-20 flex-1 rounded-xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Clients par semaine */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 hover:border-emerald-300 transition-colors">
                  <Label
                    htmlFor="sim-clients"
                    className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    Clients par semaine
                  </Label>
                  <input
                    id="sim-clients"
                    type="number"
                    min={0}
                    step={1}
                    value={nbClientsParSemaine === 0 ? "" : nbClientsParSemaine}
                    onChange={(e) =>
                      setNbClientsParSemaine(
                        Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 placeholder:text-slate-300"
                    placeholder="100"
                    data-ocid="pilotage.hyp_clients_input"
                  />
                  <p className="text-xs text-slate-400">
                    Nb moyen de couverts / semaine
                  </p>
                </div>

                {/* Semaines d'ouverture */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 hover:border-emerald-300 transition-colors">
                  <Label
                    htmlFor="sim-semaines"
                    className="text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  >
                    Semaines d&apos;ouverture par an
                  </Label>
                  <input
                    id="sim-semaines"
                    type="number"
                    min={0}
                    max={52}
                    step={1}
                    value={nbSemainesSaisonHyp === 0 ? "" : nbSemainesSaisonHyp}
                    onChange={(e) =>
                      setNbSemainesSaisonHyp(
                        Math.min(52, Math.max(0, Number(e.target.value) || 0)),
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 placeholder:text-slate-300"
                    placeholder="48"
                    data-ocid="pilotage.hyp_semaines_input"
                  />
                  <p className="text-xs text-slate-400">
                    Semaines effectives d&apos;exploitation
                  </p>
                </div>
              </div>
            )}

            {/* ── Tableau Hypothèses par Catégorie ── */}
            <div className="mt-5 rounded-xl border border-amber-200 bg-white overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                <p className="text-sm font-bold text-amber-800">
                  Hypothèses par Catégorie
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Définissez le mix, le ticket moyen et les taux pour chaque
                  catégorie
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-amber-100 text-amber-900 text-xs font-semibold uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left">Catégorie</th>
                      <th className="px-3 py-2.5 text-center">
                        Mix Produit (%)
                      </th>
                      <th className="px-3 py-2.5 text-center">
                        Ticket Moyen HT (€)
                      </th>
                      <th className="px-3 py-2.5 text-center">Food Cost (%)</th>
                      <th className="px-3 py-2.5 text-center">TVA (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorieHypotheses.map((cat, idx) => (
                      <tr
                        key={cat.nom}
                        className={
                          idx % 2 === 0 ? "bg-white" : "bg-amber-50/40"
                        }
                      >
                        <td className="px-4 py-2.5 font-semibold text-slate-700">
                          {cat.nom}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={cat.mixProduit}
                            onChange={(e) =>
                              handleCategorieChange(
                                idx,
                                "mixProduit",
                                Math.max(
                                  0,
                                  Math.min(100, Number(e.target.value) || 0),
                                ),
                              )
                            }
                            className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            data-ocid={`pilotage.cat_mix_${idx}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={cat.ticketMoyenHT}
                            onChange={(e) =>
                              handleCategorieChange(
                                idx,
                                "ticketMoyenHT",
                                Math.max(0, Number(e.target.value) || 0),
                              )
                            }
                            className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            data-ocid={`pilotage.cat_ticket_${idx}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={cat.tauxFoodCost}
                            onChange={(e) =>
                              handleCategorieChange(
                                idx,
                                "tauxFoodCost",
                                Math.max(
                                  0,
                                  Math.min(100, Number(e.target.value) || 0),
                                ),
                              )
                            }
                            className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            data-ocid={`pilotage.cat_fc_${idx}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={cat.tauxTVA}
                            onChange={(e) =>
                              handleCategorieChange(
                                idx,
                                "tauxTVA",
                                Math.max(
                                  0,
                                  Math.min(100, Number(e.target.value) || 0),
                                ),
                              )
                            }
                            className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            data-ocid={`pilotage.cat_tva_${idx}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mix validation */}
              <div className="px-4 py-3 border-t border-amber-100 bg-slate-50 text-sm">
                {mixOkCategories ? (
                  <span className="text-green-600 font-semibold">
                    Total : 100 %
                  </span>
                ) : (
                  <span className="text-red-500 font-semibold">
                    Total : {totalMixCategories} % — Attention, le total doit
                    être exactement de 100 %
                  </span>
                )}
              </div>
            </div>

            {/* CA Année 1 result banner */}
            <div className="mt-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 flex items-center justify-between flex-wrap gap-3 shadow-sm">
              <div>
                <p className="text-xs font-semibold text-emerald-100 uppercase tracking-widest mb-0.5">
                  CA HT Année 1 estimé
                </p>
                <p className="text-3xl font-black text-white tabular-nums">
                  {fmt(caHTGlobal)}
                </p>
              </div>
              <div className="text-right space-y-1">
                {caParCategorie.map((c) => (
                  <p key={c.nom} className="text-xs text-emerald-100">
                    {c.nom} :{" "}
                    <span className="font-semibold">{fmt(c.caHT)}</span>
                  </p>
                ))}
                <p className="text-xs text-emerald-200 mt-1">
                  Pilote directement le tableau 5 ans ↓
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── SECTION A : SIMULATEUR ── */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold flex items-center gap-2 text-amber-700">
          <Calculator className="h-4 w-4" /> Simulateur interactif
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sliders */}
          <Card className="shadow-card border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-amber-800">
                Ajustement des paramètres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingParams ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  {/* Clients/semaine — champ numérique libre */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">
                      Nombre de clients / semaine
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={clientsValue}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setClientsValue(v);
                        }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="ex : 100"
                        data-ocid="pilotage.clients_input"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">
                        clients
                      </span>
                    </div>
                  </div>

                  {/* Ticket moyen HT — champ numérique libre */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Ticket moyen HT (€)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={ticketValue}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setTicketValue(v);
                        }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-400"
                        placeholder="ex : 12"
                        data-ocid="pilotage.ticket_input"
                      />
                      <span className="text-sm text-muted-foreground shrink-0">
                        €
                      </span>
                    </div>
                  </div>

                  {/* Semaines + jours */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Nb de semaines / saison</Label>
                      <NumericInput
                        value={semainesStr}
                        onChange={setSemainesStr}
                        placeholder="ex : 48"
                        data-ocid="pilotage.semaines_input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">
                        Jours ouverture / semaine
                      </Label>
                      <NumericInput
                        value={joursStr}
                        onChange={setJoursStr}
                        placeholder="6"
                        data-ocid="pilotage.jours_input"
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
            <Card className="shadow-card bg-amber-50 border-amber-200">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-amber-700 font-medium uppercase tracking-wide mb-1">
                  CA Annuel estimé
                </p>
                <p className="text-2xl font-black text-amber-900">
                  {fmt(caAnnuel)}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  {clientsValue} clients/sem × {ticketValue.toFixed(2)} € HT ×{" "}
                  {nbSemainesSaison} sem × 1,1 TVA
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-card bg-orange-50 border-orange-200">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-orange-700 font-medium uppercase tracking-wide mb-1">
                  Point Mort
                </p>
                <p className="text-2xl font-black text-orange-900">
                  {fmt(pointMort)}
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Charges annuelles / Taux marge brute (
                  {(margeBruteRate * 100).toFixed(1)} %)
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-card bg-emerald-50 border-emerald-200">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide mb-1">
                  Food Cost moyen pondéré
                </p>
                <p className="text-2xl font-black text-emerald-900">
                  {foodCostMoyen.toFixed(1)} %
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  Pondéré par le mix produit
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-card bg-blue-50 border-blue-200">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-blue-700 font-medium uppercase tracking-wide mb-1">
                  Charges fixes / mois
                </p>
                <p className="text-2xl font-black text-blue-900">
                  {fmt(totalMensuelCharges)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Source : onglet Frais Fixes
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── SECTION B : GRAPHIQUE SAISONNALITÉ ── */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2 text-amber-700">
          <TrendingUp className="h-4 w-4" /> Courbe de trésorerie mensuelle (12
          mois)
        </h3>
        <Card className="shadow-card">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-3 flex flex-wrap gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
                Résultat net mensuel (CA × coeff − charges fixes)
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                Fév, Avr, Oct, Déc : coeff 0,8 (−20 % vacances scolaires)
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                Juil–Aoû : fermeture estivale (15 juil → 15 août)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={seasonalityData}
                margin={{ top: 8, right: 16, left: 16, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k€`}
                />
                <Tooltip
                  formatter={(value: number) => [fmt(value), "Résultat net"]}
                  labelFormatter={(label: string) => `Mois : ${label}`}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #fbbf24",
                    fontSize: 13,
                  }}
                />
                <Bar
                  dataKey="resultatNet"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  name="Résultat net"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      {/* ── SECTION C : MIX PRODUIT & FOOD COST (tableau des marges) ── */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2 text-amber-700">
          <BarChart3 className="h-4 w-4" /> Analyse des marges par catégorie
        </h3>
        <Card className="shadow-card">
          <CardContent className="pt-4">
            <div className="space-y-2">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_80px_80px_100px_100px_90px] gap-2 text-xs text-muted-foreground font-medium pb-1 border-b">
                <span>Catégorie</span>
                <span className="text-right">Mix (%)</span>
                <span className="text-right">Food Cost (%)</span>
                <span className="text-right">CA Annuel</span>
                <span className="text-right">Achats</span>
                <span className="text-right">Marge</span>
              </div>
              {FOOD_COST_CATEGORIES.map((cat) => {
                const fcStr = foodCostStrs[cat] ?? "";
                const mxStr = mixProduitStrs[cat] ?? "";
                const mixPct = parseNumber(mxStr);
                const fcPct = parseNumber(fcStr);
                const caCategorie = totalCAYear1 * (mixPct / 100);
                const achatsCategorie = caCategorie * (fcPct / 100);
                const margeCategorie =
                  caCategorie > 0
                    ? ((caCategorie - achatsCategorie) / caCategorie) * 100
                    : 0;
                return (
                  <div
                    key={cat}
                    className="grid grid-cols-[1fr_80px_80px_100px_100px_90px] gap-2 items-center py-1 border-b border-border/30 last:border-0"
                  >
                    <span className="text-sm truncate" title={cat}>
                      {SHORT_LABELS[cat] || cat}
                    </span>
                    <NumericInput
                      value={mxStr}
                      onChange={(v) =>
                        setMixProduitStrs((prev) => ({ ...prev, [cat]: v }))
                      }
                      placeholder="0"
                      className="h-7 text-right text-xs"
                    />
                    <NumericInput
                      value={fcStr}
                      onChange={(v) => handleFoodCostChange(cat, v)}
                      placeholder="30"
                      className="h-7 text-right text-xs"
                    />
                    <span className="text-sm text-right tabular-nums">
                      {fmt(caCategorie)}
                    </span>
                    <span className="text-sm text-right tabular-nums text-rose-600">
                      {fmt(achatsCategorie)}
                    </span>
                    <span
                      className={`text-sm text-right tabular-nums font-medium ${
                        margeCategorie >= 65
                          ? "text-emerald-600"
                          : margeCategorie >= 50
                            ? "text-amber-600"
                            : "text-rose-600"
                      }`}
                    >
                      {fmtPct(margeCategorie)}
                    </span>
                  </div>
                );
              })}
              {/* Totaux */}
              <div className="grid grid-cols-[1fr_80px_80px_100px_100px_90px] gap-2 items-center pt-2 border-t font-semibold text-sm">
                <span>Total</span>
                <span
                  className={`text-right text-xs ${
                    mixOk ? "text-emerald-600" : "text-orange-500"
                  }`}
                >
                  {totalMixPct.toFixed(1)} %{mixOk ? " ✓" : ""}
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {foodCostMoyen.toFixed(1)} %
                </span>
                <span className="text-right tabular-nums">
                  {fmt(totalCAYear1)}
                </span>
                <span className="text-right tabular-nums text-rose-600">
                  {fmt(achatsMatieresYear1)}
                </span>
                <span className="text-right tabular-nums text-emerald-600">
                  {fmtPct(margeBruteRate * 100)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── SECTION D : TABLEAU PRÉVISIONNEL 5 ANS ── */}
      <section className="space-y-3">
        <h3 className="text-base font-semibold flex items-center gap-2 text-amber-700">
          <TrendingUp className="h-4 w-4" /> Prévisionnel Économique sur 5 ans
        </h3>

        {/* Growth rate inputs */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            Hypothèses de croissance (Années 2 → 5)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1.5">
                Évolution CA (%)
              </p>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={evCAStr}
                  onChange={(e) =>
                    handleEvChange(
                      "previsionnel_ev_ca",
                      setEvCAStr,
                    )(e.target.value)
                  }
                  placeholder="0"
                  className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-sm text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  data-ocid="previsionnel.ev_ca.input"
                />
                <span className="text-xs text-indigo-600 font-medium shrink-0">
                  %
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1.5">
                Évolution Achats (%)
              </p>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={evAchatsStr}
                  onChange={(e) =>
                    handleEvChange(
                      "previsionnel_ev_achats",
                      setEvAchatsStr,
                    )(e.target.value)
                  }
                  placeholder="0"
                  className="w-full rounded border border-orange-300 bg-white px-2 py-1.5 text-sm text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-orange-400"
                  data-ocid="previsionnel.ev_achats.input"
                />
                <span className="text-xs text-orange-600 font-medium shrink-0">
                  %
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-xs font-semibold text-rose-700 mb-1.5">
                Évolution Frais fixes (%)
              </p>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={evFraisStr}
                  onChange={(e) =>
                    handleEvChange(
                      "previsionnel_ev_frais",
                      setEvFraisStr,
                    )(e.target.value)
                  }
                  placeholder="0"
                  className="w-full rounded border border-rose-300 bg-white px-2 py-1.5 text-sm text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-rose-400"
                  data-ocid="previsionnel.ev_frais.input"
                />
                <span className="text-xs text-rose-600 font-medium shrink-0">
                  %
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <p className="text-xs font-semibold text-purple-700 mb-1.5">
                Évolution Masse salariale (%)
              </p>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  value={evSalairesStr}
                  onChange={(e) =>
                    handleEvChange(
                      "previsionnel_ev_salaires",
                      setEvSalairesStr,
                    )(e.target.value)
                  }
                  placeholder="0"
                  className="w-full rounded border border-purple-300 bg-white px-2 py-1.5 text-sm text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-purple-400"
                  data-ocid="previsionnel.ev_salaires.input"
                />
                <span className="text-xs text-purple-600 font-medium shrink-0">
                  %
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Exemple : saisir 5 pour +5 % par an. Les amortissements ne suivent
            pas ce taux — ils sont calculés exactement depuis le Plan
            d&apos;Amortissement.
          </p>
        </div>

        {/* 5-year table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wide w-64">
                    Catégories
                  </th>
                  {YEARS.map((y, i) => (
                    <ColHeader key={y} label={y} live={i === 0} />
                  ))}
                </tr>
              </thead>
              <tbody>
                <SectionHeader label="Produits d'exploitation" />
                {FOOD_COST_CATEGORIES.map((cat, i) => (
                  <DataRow
                    key={cat}
                    label={SHORT_LABELS[cat] || cat}
                    values={caByYearAndCategory[cat] ?? [0, 0, 0, 0, 0]}
                    indent
                    alt={i % 2 === 1}
                  />
                ))}
                <TotalRow
                  label="Total CA"
                  values={totalCAByYear}
                  color="bg-indigo-50"
                  textColor="text-indigo-800"
                />
                <SpacerRow />

                <SectionHeader label="Charges Opérationnelles" />
                <DataRow
                  label="Achats matières (Food Cost)"
                  values={achatsYears}
                  indent
                />
                <tr className="bg-slate-50">
                  <td className="px-4 py-2.5 text-sm pl-8 text-slate-700">
                    <span className="text-slate-400 mr-2">▸</span>
                    Emballages manuels
                    <span className="ml-1.5 text-[10px] text-blue-500 font-medium">
                      (saisie ici)
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <NumericInput
                        value={emballagesStr}
                        onChange={(v) => {
                          setEmballagesStr(v);
                          if (validateNumber(v))
                            localStorage.setItem(EMBALLAGES_KEY, v);
                        }}
                        placeholder="0"
                        className="w-28 h-8 text-right text-sm"
                      />
                      <span className="text-xs text-slate-400">€</span>
                    </div>
                  </td>
                  {([1, 2, 3, 4] as const).map((i) => (
                    <td
                      key={YEARS[i]}
                      className="px-4 py-2.5 text-sm text-right text-slate-700 tabular-nums"
                    >
                      {fmt(emballagesYears[i] ?? 0)}
                    </td>
                  ))}
                </tr>
                <TotalRow
                  label="Total Charges Opérationnelles"
                  values={totalChargesYears}
                />
                <SpacerRow />

                <HighlightRow
                  label="✦ Marge Brute Globale"
                  values={margeBruteYears}
                  totalCA={totalCAByYear}
                  variant="green"
                />
                <SpacerRow />

                <SectionHeader label="Frais de Structure (Charges Fixes)" />
                {(
                  [
                    { label: "Loyer", values: loyerYears },
                    { label: "Énergies", values: energiesYears },
                    { label: "Assurances", values: assurancesYears },
                    {
                      label: "Masse Salariale Globale",
                      values: masseSalarialeYears,
                    },
                    { label: "Honoraires", values: honorairesYears },
                  ] as { label: string; values: number[] }[]
                ).map((r, i) => (
                  <DataRow
                    key={r.label}
                    label={r.label}
                    values={r.values}
                    indent
                    alt={i % 2 === 1}
                  />
                ))}
                <TotalRow
                  label="Total Frais de Structure"
                  values={totalFraisYears}
                />
                <SpacerRow />

                <HighlightRow
                  label="★ Excédent Brut d'Exploitation (EBE)"
                  values={ebeYears}
                  totalCA={totalCAByYear}
                  variant="blue"
                />
                <SpacerRow />

                <SectionHeader label="Amortissements et Frais Financiers" />
                <DataRow
                  label="Dotations aux amortissements"
                  values={amortissementsParAnnee}
                  indent
                  badge={
                    <span className="ml-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5">
                      Plan d&apos;amort.
                    </span>
                  }
                />
                <DataRow
                  label="Intérêts d'emprunts"
                  values={interetsYears}
                  indent
                  badge={
                    <span className="ml-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5">
                      Calcul exact
                    </span>
                  }
                />
                <SpacerRow />

                <HighlightRow
                  label="◆ Résultat d'Exercice (Net)"
                  values={resultatYears}
                  totalCA={totalCAByYear}
                  variant={(resultatYears[0] ?? 0) >= 0 ? "orange" : "red"}
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-600" />
            Marge Brute Globale
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-600" />
            Excédent Brut d&apos;Exploitation
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
            Résultat d&apos;Exercice
          </span>
        </div>
      </section>

      {/* ── SECTION E : SOURCES DES DONNÉES ── */}
      <section>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" /> Sources des données
          </p>
          <p>
            <span className="text-emerald-600 font-bold">✓</span> CA Année 1 :
            Ticket moyen HT × Clients/semaine × Nb semaines (simulateur
            ci-dessus)
          </p>
          <p>
            <span className="text-emerald-600 font-bold">✓</span> CA par
            catégorie : Total CA × Mix Produit % (tableau des marges)
          </p>
          <p>
            <span className="text-emerald-600 font-bold">✓</span> Achats
            matières : CA catégorie × Taux Food Cost cible (tableau des marges)
          </p>
          <p>
            <span className="text-blue-600 font-bold">⚙</span> Emballages :
            Saisie manuelle dans le tableau 5 ans
          </p>
          <p>
            <span className="text-emerald-600 font-bold">✓</span> Frais de
            structure : Lignes Frais Fixes × 12 (onglet Frais)
          </p>
          <p>
            <span className="text-emerald-600 font-bold">✓</span>{" "}
            <strong>Dotations aux amortissements :</strong> Plan
            d&apos;Amortissement (onglet Investissements &amp; Emprunts) —
            logique stricte : 0 € dès la fin de durée. Pas de taux de croissance
            appliqué.
          </p>
          <p>
            <span className="text-emerald-600 font-bold">✓</span> Intérêts :
            Tableau d&apos;amortissement financier (mensualités constantes) —
            calcul exact année par année (Années 1-5) basé sur le capital
            restant dû. 0 € une fois l&apos;emprunt soldé (onglet
            Investissements &amp; Emprunts)
          </p>
          <p>
            <span className="text-amber-600 font-bold">★</span> Saisonnalité :
            Fermeture 15 juil → 15 août (coeff 0), vacances scolaires (coeff
            0,8), reste de l&apos;année (coeff 1,0)
          </p>
          <p className="pt-1 text-slate-400 italic">
            — Années 2 à 5 (CA, Achats, Frais, Masse salariale) : croissance
            composée selon les taux saisis ci-dessus
          </p>
        </div>
      </section>
    </div>
  );
}
