import {
  NumericInput,
  parseNumber,
  validateNumber,
} from "@/components/NumericInput";
import {
  useAmortissements,
  useEmprunts,
  useFraisFixes,
  useJoursOuvertureParSemaine,
  useMixProduitParCategorie,
  useParametres,
} from "@/hooks/useQueries";
import type { LigneFraisFixes } from "@/hooks/useQueries";
import { useMemo, useState } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

const FOOD_COST_CATEGORIES = [
  "Boissons froides (hors alcool)",
  "Sandwichs froids et Wraps",
  "Plats chauds",
  "Desserts maison",
  "Accompagnements",
  "Les formules ou menus",
];

const SHORT_LABELS: Record<string, string> = {
  "Boissons froides (hors alcool)": "Boissons froides",
  "Sandwichs froids et Wraps": "Sandwichs froids et Wraps",
  "Plats chauds": "Plats chauds",
  "Desserts maison": "Desserts maison",
  Accompagnements: "Accompagnements",
  "Les formules ou menus": "Les formules ou menus",
};

const YEARS = [
  "Année 1 (n+1)",
  "Année 2 (n+2)",
  "Année 3 (n+3)",
  "Année 4 (n+4)",
  "Année 5 (n+5)",
] as const;

const EMBALLAGES_KEY = "previsionnel_emballages_an1";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

/**
 * Compound growth projection.
 * [base, base*(1+r), base*(1+r)^2, base*(1+r)^3, base*(1+r)^4]
 */
function compoundGrowth(base: number, rate: number): number[] {
  return [
    base,
    base * (1 + rate),
    base * (1 + rate) ** 2,
    base * (1 + rate) ** 3,
    base * (1 + rate) ** 4,
  ];
}

function calcMensualite(
  montant: number,
  tauxAnnuel: number,
  dureeMois: number,
): number {
  if (dureeMois <= 0 || montant <= 0) return 0;
  if (tauxAnnuel === 0) return montant / dureeMois;
  const tm = tauxAnnuel / 100 / 12;
  return (montant * tm) / (1 - (1 + tm) ** -dureeMois);
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

// ── Sub-components ───────────────────────────────────────────────────────────────

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

// Import React for JSX
import type React from "react";

// ── Main component ────────────────────────────────────────────────────────────────

export default function Marges() {
  // ── Data queries ─────────────────────────────────────────────────────────────────
  const { data: params } = useParametres();
  const { data: savedJours } = useJoursOuvertureParSemaine();
  const { data: savedMix = [] } = useMixProduitParCategorie();
  const { data: fraisFixesData = [] } = useFraisFixes();
  const { data: empruntsData = [] } = useEmprunts();
  // dureeMois field now stores YEARS (standardized)
  const { data: amortissementsData = [] } = useAmortissements();

  // ── Emballages state (manual, persisted in localStorage) ──────────────────────
  const [emballagesStr, setEmballagesStr] = useState(
    () => localStorage.getItem(EMBALLAGES_KEY) || "",
  );

  function handleEmballagesChange(v: string) {
    setEmballagesStr(v);
    if (validateNumber(v)) {
      localStorage.setItem(EMBALLAGES_KEY, v);
    }
  }

  // ── Growth rate states (persisted in localStorage) ────────────────────────────
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

  function handleEvCAChange(v: string) {
    setEvCAStr(v);
    localStorage.setItem("previsionnel_ev_ca", v);
  }
  function handleEvAchatsChange(v: string) {
    setEvAchatsStr(v);
    localStorage.setItem("previsionnel_ev_achats", v);
  }
  function handleEvFraisChange(v: string) {
    setEvFraisStr(v);
    localStorage.setItem("previsionnel_ev_frais", v);
  }
  function handleEvSalairesChange(v: string) {
    setEvSalairesStr(v);
    localStorage.setItem("previsionnel_ev_salaires", v);
  }

  const evCA = parseNumber(evCAStr) / 100;
  const evAchats = parseNumber(evAchatsStr) / 100;
  const evFrais = parseNumber(evFraisStr) / 100;
  const evSalaires = parseNumber(evSalairesStr) / 100;

  // ── Year 1 base values ──────────────────────────────────────────────────────────────

  const ticketMoyenHT = params?.ticketMoyenHT ?? 0;
  const clientsParJour = params?.nbClientsParSemaine ?? 0;
  const nbSemaines = params?.nbSemainesSaison ?? 0;
  const joursParSemaine = savedJours ?? 6;

  const foodCostMap = useMemo(
    () => new Map(params?.tauxFoodCostParCategorie ?? []),
    [params],
  );
  const mixMap = useMemo(() => new Map(savedMix), [savedMix]);

  // Total CA Year 1 = ticket × clients/jour × jours/semaine × nb semaines
  const totalCAYear1 =
    ticketMoyenHT * clientsParJour * joursParSemaine * nbSemaines;

  // CA par catégorie Year 1
  const caYear1ByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of FOOD_COST_CATEGORIES) {
      const mixPct = mixMap.get(cat) ?? 0;
      map[cat] = totalCAYear1 * (mixPct / 100);
    }
    return map;
  }, [totalCAYear1, mixMap]);

  // Achats matières Year 1 = Σ(CA[cat] × foodCost[cat] / 100)
  const achatsMatieresYear1 = useMemo(
    () =>
      FOOD_COST_CATEGORIES.reduce((s, cat) => {
        const fc = foodCostMap.get(cat) ?? 0;
        return s + (caYear1ByCategory[cat] ?? 0) * (fc / 100);
      }, 0),
    [caYear1ByCategory, foodCostMap],
  );

  const emballagesYear1 = parseNumber(emballagesStr);

  // Frais de structure Year 1 (annualisés)
  const loyerYear1 = findFraisAnnuel(fraisFixesData, ["location", "loyer"]);
  const energiesYear1 = findFraisAnnuel(fraisFixesData, ["energie", "eau"]);
  const assurancesYear1 = findFraisAnnuel(fraisFixesData, [
    "assurance",
    "licence",
  ]);
  const salairesYear1 = findFraisAnnuel(fraisFixesData, [
    "salaire",
    "cotisation",
  ]);
  const honorairesYear1 = findFraisAnnuel(fraisFixesData, [
    "communication",
    "marketing",
    "honoraire",
  ]);

  // ── Amortissements : per-year EXACT totals from Plan d'Amortissement ───────────────
  //
  // IMPORTANT: dureeMois field now stores YEARS (standardized in V17).
  // For each asset:
  //   - Annual dotation = coutTotal / dureeAns
  //   - Year N dotation = dureeAns > 0 && N <= dureeAns ? dotation : 0
  //   (strict 0€ after the depreciation period)
  //
  // This row does NOT use growth rate % — it reads exact values from the
  // Plan d'Amortissement table in the "Investissements & Emprunts" tab.
  const amortissementsParAnnee = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((n) =>
        amortissementsData.reduce((sum, a) => {
          const dureeAns = Number(a.dureeMois); // stored as YEARS
          if (dureeAns <= 0) return sum; // non-amortissable
          const dotation = a.coutTotal / dureeAns;
          return n <= dureeAns ? sum + dotation : sum;
        }, 0),
      ),
    [amortissementsData],
  );

  // Intérêts première année (12 premiers mois de chaque emprunt)
  const interetsYear1 = useMemo(
    () =>
      empruntsData.reduce((s, e) => {
        const duree = Number(e.dureeMois);
        if (duree <= 0 || e.montant <= 0 || e.tauxAnnuel === 0) return s;
        const tm = e.tauxAnnuel / 100 / 12;
        let capital = e.montant;
        let totalI = 0;
        const mensualite = calcMensualite(e.montant, e.tauxAnnuel, duree);
        for (let m = 0; m < Math.min(12, duree); m++) {
          const interet = capital * tm;
          totalI += interet;
          capital -= mensualite - interet;
        }
        return s + totalI;
      }, 0),
    [empruntsData],
  );

  // Intérêts : années 2-5 flat (même logique qu'avant)
  const interetsYears = useMemo(
    () => Array(5).fill(interetsYear1) as number[],
    [interetsYear1],
  );

  // ── 5-year arrays via compound growth ────────────────────────────────────────────

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
  const salairesYears = useMemo(
    () => compoundGrowth(salairesYear1, evSalaires),
    [salairesYear1, evSalaires],
  );

  // ── Cascade totals ───────────────────────────────────────────────────────────────

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
      (salairesYears[i] ?? 0) +
      (honorairesYears[i] ?? 0),
  );

  const ebeYears = YEARS.map(
    (_, i) => (margeBruteYears[i] ?? 0) - (totalFraisYears[i] ?? 0),
  );

  // Amortissements per year: exact values from Plan d'Amortissement (no growth rate)
  // Intérêts per year: flat (Year 1 value repeated)
  const resultatYears = YEARS.map(
    (_, i) =>
      (ebeYears[i] ?? 0) -
      (amortissementsParAnnee[i] ?? 0) -
      (interetsYears[i] ?? 0),
  );

  // ── Render ──────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Prévisionnel Économique
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Projection financière sur 5 ans — Année 1 connectée aux données
          réelles
        </p>
      </div>

      {/* Growth rate inputs — Années 2 à 5 */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">
          Hypothèses de croissance (Années 2 → 5)
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* CA */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs font-semibold text-indigo-700 mb-1.5">
              Évolution CA (%)
            </p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                value={evCAStr}
                onChange={(e) => handleEvCAChange(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-sm text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-indigo-400"
                data-ocid="previsionnel.ev_ca.input"
              />
              <span className="text-xs text-indigo-600 font-medium shrink-0">
                %
              </span>
            </div>
          </div>
          {/* Achats */}
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs font-semibold text-orange-700 mb-1.5">
              Évolution Achats (%)
            </p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                value={evAchatsStr}
                onChange={(e) => handleEvAchatsChange(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-orange-300 bg-white px-2 py-1.5 text-sm text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-orange-400"
                data-ocid="previsionnel.ev_achats.input"
              />
              <span className="text-xs text-orange-600 font-medium shrink-0">
                %
              </span>
            </div>
          </div>
          {/* Frais fixes */}
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold text-rose-700 mb-1.5">
              Évolution Frais fixes (%)
            </p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                value={evFraisStr}
                onChange={(e) => handleEvFraisChange(e.target.value)}
                placeholder="0"
                className="w-full rounded border border-rose-300 bg-white px-2 py-1.5 text-sm text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-rose-400"
                data-ocid="previsionnel.ev_frais.input"
              />
              <span className="text-xs text-rose-600 font-medium shrink-0">
                %
              </span>
            </div>
          </div>
          {/* Masse salariale */}
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <p className="text-xs font-semibold text-purple-700 mb-1.5">
              Évolution Masse salariale (%)
            </p>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                value={evSalairesStr}
                onChange={(e) => handleEvSalairesChange(e.target.value)}
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
          Exemple : saisir 5 pour +5 % par an. Chaque année se calcule sur la
          précédente. Les amortissements ne suivent pas ce taux — ils sont
          calculés exactement depuis le Plan d&apos;Amortissement.
        </p>
      </div>

      {/* Table */}
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
              {/* ── Produits d'exploitation ── */}
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

              {/* ── Charges opérationnelles ── */}
              <SectionHeader label="Charges Opérationnelles" />
              <DataRow
                label="Achats matières (Food Cost)"
                values={achatsYears}
                indent
              />
              {/* Emballages : Year 1 editable, Years 2-5 calculated */}
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
                      onChange={handleEmballagesChange}
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

              {/* ── Marge brute ── */}
              <HighlightRow
                label="✦ Marge Brute Globale"
                values={margeBruteYears}
                totalCA={totalCAByYear}
                variant="green"
              />
              <SpacerRow />

              {/* ── Frais de structure ── */}
              <SectionHeader label="Frais de Structure (Charges Fixes)" />
              {(
                [
                  { label: "Loyer", values: loyerYears },
                  { label: "Énergies", values: energiesYears },
                  { label: "Assurances", values: assurancesYears },
                  { label: "Salaires", values: salairesYears },
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

              {/* ── EBE ── */}
              <HighlightRow
                label="★ Excédent Brut d'Exploitation (EBE)"
                values={ebeYears}
                totalCA={totalCAByYear}
                variant="blue"
              />
              <SpacerRow />

              {/* ── Amortissements et Frais Financiers ── */}
              <SectionHeader label="Amortissements et Frais Financiers" />
              {/*
                Amortissements : liaisons dynamiques exactes depuis le Plan
                d'Amortissement (onglet Investissements & Emprunts).
                Logique stricte : 0€ après la fin de la durée de chaque bien.
                Ce calcul ne dépend d'AUCUN taux de croissance.
              */}
              <DataRow
                label="Dotations aux amortissements"
                values={amortissementsParAnnee}
                indent
                badge={
                  <span className="ml-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5">
                    Plan d’amort.
                  </span>
                }
              />
              <DataRow
                label="Intérêts d’emprunts"
                values={interetsYears}
                indent
              />
              <SpacerRow />

              {/* ── Résultat ── */}
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
          Excédent Brut d&apos;Éexploitation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-amber-500" />
          Résultat d&apos;Exercice
        </span>
      </div>

      {/* Data sources info */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700 mb-2">Sources des données</p>
        <p>
          <span className="text-emerald-600 font-bold">✓</span> Total CA :
          Ticket moyen × Clients/jour × Jours/semaine × Nb semaines (onglet
          Rentabilité)
        </p>
        <p>
          <span className="text-emerald-600 font-bold">✓</span> CA par
          catégorie : Total CA × Mix Produit % (onglet Rentabilité)
        </p>
        <p>
          <span className="text-emerald-600 font-bold">✓</span> Achats
          matières : CA catégorie × Taux Food Cost cible (onglet Rentabilité)
        </p>
        <p>
          <span className="text-blue-600 font-bold">⚙</span> Emballages : Saisie
          manuelle dans ce tableau
        </p>
        <p>
          <span className="text-emerald-600 font-bold">✓</span> Frais de
          structure : Lignes Frais Fixes × 12 (onglet Frais)
        </p>
        <p>
          <span className="text-emerald-600 font-bold">✓</span>{" "}
          <strong>Dotations aux amortissements :</strong> Totaux année par année
          depuis le Plan d’Amortissement (onglet Investissements &amp;
          Emprunts). Logique stricte : 0€ dès que la durée est écoulée. Pas de
          taux de croissance appliqué.
        </p>
        <p>
          <span className="text-emerald-600 font-bold">✓</span> Intérêts :
          Calcul exact des 12 premiers mois (onglet Investissements &amp;
          Emprunts)
        </p>
        <p className="pt-1 text-slate-400 italic">
          — Années 2 à 5 (CA, Achats, Frais, Salaires) : croissance composée
          appliquée aux taux saisis ci-dessus
        </p>
      </div>
    </div>
  );
}
