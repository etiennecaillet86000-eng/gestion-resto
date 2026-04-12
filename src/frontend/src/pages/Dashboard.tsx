import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useIngredients,
  useMouvementsStock,
  useRecettes,
  useVentesRecettes,
} from "@/hooks/useQueries";
import type {
  Ingredient,
  MouvementStock,
  VenteRecette,
} from "@/hooks/useQueries";
import { fmtEur, fmtPct } from "@/utils/format";
import {
  AlertTriangle,
  CalendarOff,
  Info,
  Package,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { Cell, Legend, Pie, PieChart, Tooltip } from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

type VenteAvecCapture = VenteRecette & {
  caTtcCapture: number;
  coutMatiereTotalCapture: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const PIE_DATA = [
  { name: "Snacking", value: 60 },
  { name: "Boutique", value: 30 },
  { name: "Traiteur", value: 10 },
];
const PIE_COLORS = ["#f59e0b", "#fb923c", "#fbbf24"];

function parseVenteDate(
  dateStr: string,
): { month: number; year: number } | null {
  // Try YYYY-MM-DD
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso)
    return {
      year: Number.parseInt(iso[1], 10),
      month: Number.parseInt(iso[2], 10) - 1,
    };
  // Try DD/MM/YYYY
  const fr = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fr)
    return {
      year: Number.parseInt(fr[3], 10),
      month: Number.parseInt(fr[2], 10) - 1,
    };
  return null;
}

function isCurrentMonth(dateStr: string): boolean {
  const parsed = parseVenteDate(dateStr);
  if (!parsed) return false;
  const now = new Date();
  return parsed.month === now.getMonth() && parsed.year === now.getFullYear();
}

function calcNiveauStock(
  ingredient: Ingredient,
  mouvements: MouvementStock[],
): number {
  return mouvements
    .filter((m) => m.ingredientId === ingredient.id)
    .reduce((acc, m) => {
      if (m.typeOp === "Entrée") return acc + m.quantite;
      if (m.typeOp === "Sortie") return acc - m.quantite;
      return acc;
    }, ingredient.stockInitial);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  colorClass: string;
}) {
  return (
    <Card className="border-amber-200">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-lg p-2 ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold font-display truncate">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StockAlertCard({
  ingredient,
  niveau,
}: {
  ingredient: Ingredient;
  niveau: number;
}) {
  const isRupture = niveau <= 0;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
        isRupture ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
      data-ocid="dashboard.stock_alert"
    >
      {isRupture ? (
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
      ) : (
        <Package className="h-5 w-5 shrink-0 text-amber-600" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`font-medium text-sm truncate ${
            isRupture ? "text-red-700" : "text-amber-700"
          }`}
        >
          {ingredient.nom}
        </p>
        <p className="text-xs text-muted-foreground">
          Niveau&nbsp;:{" "}
          <strong>
            {niveau.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}{" "}
            {ingredient.unite}
          </strong>{" "}
          / seuil&nbsp;:{" "}
          {ingredient.seuilSecurite.toLocaleString("fr-FR", {
            maximumFractionDigits: 2,
          })}{" "}
          {ingredient.unite}
        </p>
      </div>
      <Badge
        className={
          isRupture
            ? "bg-red-100 text-red-700 border-red-300"
            : "bg-amber-100 text-amber-700 border-amber-300"
        }
        variant="outline"
      >
        {isRupture ? "RUPTURE" : "FAIBLE"}
      </Badge>
    </div>
  );
}

function MargeAlertCard({
  venteName,
  marge,
}: {
  venteName: string;
  marge: number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
      data-ocid="dashboard.marge_alert"
    >
      <TrendingDown className="h-5 w-5 shrink-0 text-red-600" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-red-700 truncate">{venteName}</p>
        <p className="text-xs text-muted-foreground">
          Marge capturée&nbsp;: <strong>{fmtPct(marge)}</strong>
        </p>
      </div>
      <Badge
        className="bg-red-100 text-red-700 border-red-300"
        variant="outline"
      >
        &lt; 60 %
      </Badge>
    </div>
  );
}

function SectionTitle({
  children,
  colorClass = "text-foreground",
}: {
  children: React.ReactNode;
  colorClass?: string;
}) {
  return (
    <h2 className={`text-base font-semibold mb-3 ${colorClass}`}>{children}</h2>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: ingredients = [], isLoading: loadIng } = useIngredients();
  const { data: mouvements = [], isLoading: loadMvt } = useMouvementsStock();
  const { data: ventesBrutes = [], isLoading: loadVentes } =
    useVentesRecettes();
  const { data: recettes = [], isLoading: loadRecettes } = useRecettes();

  const isLoading = loadIng || loadMvt || loadVentes || loadRecettes;

  // Map recetteId → nom pour les alertes marges
  const recetteNomMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of recettes) {
      m.set(r.id, r.nom);
    }
    return m;
  }, [recettes]);

  const ventes = ventesBrutes as VenteAvecCapture[];

  // ── Stock alerts ──────────────────────────────────────────────────────────
  const stockAlerts = useMemo(() => {
    return ingredients
      .map((ing) => ({
        ingredient: ing,
        niveau: calcNiveauStock(ing, mouvements),
      }))
      .filter(({ ingredient, niveau }) => niveau < ingredient.seuilSecurite);
  }, [ingredients, mouvements]);

  // ── Marge alerts (current month, marge < 60%) ─────────────────────────────
  const margeAlerts = useMemo(() => {
    return ventes
      .filter((v) => isCurrentMonth(v.date) && v.caTtcCapture > 0)
      .map((v) => {
        const marge =
          ((v.caTtcCapture - v.coutMatiereTotalCapture) / v.caTtcCapture) * 100;
        return { vente: v, marge };
      })
      .filter(({ marge }) => marge < 60);
  }, [ventes]);

  // ── KPIs mois en cours ────────────────────────────────────────────────────
  const { caTotalMois, margeMoyenneMois, hasVentesMois } = useMemo(() => {
    const ventesMonth = ventes.filter(
      (v) => isCurrentMonth(v.date) && v.caTtcCapture > 0,
    );
    if (ventesMonth.length === 0) {
      return { caTotalMois: 0, margeMoyenneMois: 0, hasVentesMois: false };
    }
    const ca = ventesMonth.reduce((s, v) => s + v.caTtcCapture, 0);
    const marges = ventesMonth.map(
      (v) =>
        ((v.caTtcCapture - v.coutMatiereTotalCapture) / v.caTtcCapture) * 100,
    );
    const avg = marges.reduce((s, m) => s + m, 0) / marges.length;
    return { caTotalMois: ca, margeMoyenneMois: avg, hasVentesMois: true };
  }, [ventes]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" data-ocid="dashboard.root">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="h-1 w-6 rounded-full bg-amber-500" />
        <h1 className="text-2xl font-display font-bold text-foreground">
          Tableau de Bord
        </h1>
      </div>

      {/* KPI row */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hasVentesMois ? (
            <>
              <StatCard
                icon={TrendingUp}
                label="CA Total — mois en cours"
                value={fmtEur(caTotalMois)}
                colorClass="bg-amber-50 text-amber-600"
              />
              <StatCard
                icon={TrendingUp}
                label="Marge Moyenne — mois en cours"
                value={fmtPct(margeMoyenneMois)}
                colorClass="bg-amber-50 text-amber-600"
              />
            </>
          ) : (
            <div className="col-span-2">
              <Card className="border-amber-200 bg-amber-50/40">
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm text-amber-700 text-center">
                    Aucune vente ce mois — saisissez des ventes dans l'onglet{" "}
                    <strong>Ventes du jour</strong>.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Main grid: alerts + pie chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stock alerts */}
          <section data-ocid="dashboard.stock_alerts_section">
            <SectionTitle
              colorClass={
                stockAlerts.length > 0 ? "text-amber-600" : "text-green-600"
              }
            >
              {stockAlerts.length > 0 ? (
                <>
                  <AlertTriangle className="inline h-4 w-4 mr-1.5 align-text-top" />
                  Alertes Stock ({stockAlerts.length})
                </>
              ) : (
                "✓ Stock — Aucune alerte"
              )}
            </SectionTitle>

            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : stockAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                Tous les ingrédients sont au-dessus de leur seuil de sécurité.
              </p>
            ) : (
              <div className="space-y-2">
                {stockAlerts.map(({ ingredient, niveau }) => (
                  <StockAlertCard
                    key={ingredient.id}
                    ingredient={ingredient}
                    niveau={niveau}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Marge alerts */}
          <section data-ocid="dashboard.marge_alerts_section">
            <SectionTitle
              colorClass={
                margeAlerts.length > 0 ? "text-red-600" : "text-green-600"
              }
            >
              {margeAlerts.length > 0 ? (
                <>
                  <TrendingDown className="inline h-4 w-4 mr-1.5 align-text-top" />
                  Alertes Marges ({margeAlerts.length})
                </>
              ) : (
                "✓ Marges — Aucune alerte ce mois"
              )}
            </SectionTitle>

            {isLoading ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : margeAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                Toutes les marges capturées ce mois dépassent 60 %.
              </p>
            ) : (
              <div className="space-y-2">
                {margeAlerts.map(({ vente, marge }) => (
                  <MargeAlertCard
                    key={vente.id}
                    venteName={
                      recetteNomMap.get(vente.recetteId) ?? vente.recetteId
                    }
                    marge={marge}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Pie chart column */}
        <div className="space-y-5">
          <Card className="border-amber-200" data-ocid="dashboard.pie_chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-amber-700">
                Répartition Mix Produit
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center pt-0 pb-4">
              <PieChart width={260} height={260}>
                <Pie
                  data={PIE_DATA}
                  cx="50%"
                  cy="45%"
                  outerRadius={90}
                  dataKey="value"
                  labelLine={false}
                >
                  {PIE_DATA.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={
                        PIE_COLORS[PIE_DATA.indexOf(entry) % PIE_COLORS.length]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value} %`, ""]}
                  contentStyle={{
                    borderRadius: "8px",
                    fontSize: "12px",
                    border: "1px solid #fde68a",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={{ fontSize: "12px" }}
                />
              </PieChart>
            </CardContent>
          </Card>

          {/* Informational note */}
          <Card
            className="border-amber-200 bg-amber-50/60"
            data-ocid="dashboard.info_note"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" />
                Informations saisonnières
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 pb-4">
              <div className="flex items-start gap-2">
                <CalendarOff className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <strong>Fermeture annuelle</strong> : 15 juillet au 15 août
                </p>
              </div>
              <div className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Baisse d'activité de <strong>20 % estimée</strong> pendant les
                  vacances scolaires
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
