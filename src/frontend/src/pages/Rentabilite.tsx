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
  useFraisFixes,
  useJoursOuvertureParSemaine,
  useMixProduitParCategorie,
  useParametres,
  useSaveJoursOuvertureParSemaine,
  useSaveMixProduitParCategorie,
  useSaveParametres,
} from "@/hooks/useQueries";
import type { ParametresRentabilite } from "@/hooks/useQueries";
import { fmtEur, fmtPct } from "@/utils/format";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const FOOD_COST_CATEGORIES = [
  "Boissons froides (hors alcool)",
  "Sandwichs froids et Wraps",
  "Plats chauds",
  "Desserts maison",
  "Accompagnements",
  "Les formules ou menus",
];

const DEFAULT_FOOD_COSTS: [string, number][] = [
  ["Boissons froides (hors alcool)", 25],
  ["Sandwichs froids et Wraps", 30],
  ["Plats chauds", 33],
  ["Desserts maison", 30],
  ["Accompagnements", 28],
  ["Les formules ou menus", 31],
];

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

export default function Rentabilite() {
  const { data: saved, isLoading: loadingParams } = useParametres();
  const { data: fraisFixes = [] } = useFraisFixes();
  const saveMut = useSaveParametres();

  // ── Existing state ────────────────────────────────────────────────────────
  const [params, setParams] = useState<ParametresRentabilite>(defaultParams());
  const [ticketStr, setTicketStr] = useState("");
  const [clientsStr, setClientsStr] = useState("");
  const [semainesStr, setSemainesStr] = useState("");
  const [foodCostStrs, setFoodCostStrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(DEFAULT_FOOD_COSTS.map(([c, v]) => [c, String(v)])),
  );

  // ── New state: jours d'ouverture + Mix Produit ────────────────────────────
  const { data: savedJours } = useJoursOuvertureParSemaine();
  const { data: savedMix = [] } = useMixProduitParCategorie();
  const saveJoursMut = useSaveJoursOuvertureParSemaine();
  const saveMixMut = useSaveMixProduitParCategorie();

  const [joursStr, setJoursStr] = useState("6");
  const [mixProduitStrs, setMixProduitStrs] = useState<Record<string, string>>(
    () => Object.fromEntries(FOOD_COST_CATEGORIES.map((cat) => [cat, "0"])),
  );

  // ── Sync saved parametres ─────────────────────────────────────────────────
  useEffect(() => {
    if (saved) {
      const migrated = migrateCategories(saved.tauxFoodCostParCategorie);
      const p: ParametresRentabilite = {
        ...saved,
        tauxFoodCostParCategorie: migrated,
      };
      setParams(p);
      setTicketStr(
        saved.ticketMoyenHT === 0 ? "" : String(saved.ticketMoyenHT),
      );
      setClientsStr(
        saved.nbClientsParSemaine === 0
          ? ""
          : String(saved.nbClientsParSemaine),
      );
      setSemainesStr(
        saved.nbSemainesSaison === 0 ? "" : String(saved.nbSemainesSaison),
      );
      const strs: Record<string, string> = {};
      for (const [cat, val] of migrated) {
        strs[cat] = val === 0 ? "" : String(val);
      }
      setFoodCostStrs(strs);
    }
  }, [saved]);

  // ── Sync jours d'ouverture ────────────────────────────────────────────────
  useEffect(() => {
    if (savedJours !== undefined && savedJours !== null) {
      setJoursStr(savedJours === 0 ? "" : String(savedJours));
    }
  }, [savedJours]);

  // ── Sync mix produit ──────────────────────────────────────────────────────
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

  // ── Frais fixes totals ────────────────────────────────────────────────────
  const totalMensuelAvec = useMemo(
    () => fraisFixes.reduce((s, l) => s + l.montantMensuelAvecRemu, 0),
    [fraisFixes],
  );
  const totalMensuelHors = useMemo(
    () => fraisFixes.reduce((s, l) => s + l.montantMensuelHorsRemu, 0),
    [fraisFixes],
  );
  const totalHebdoAvec = totalMensuelAvec / 4.33;
  const totalHebdoHors = totalMensuelHors / 4.33;

  // ── CA formula: ticket × clients/jour × jours/semaine ─────────────────────
  const ticketMoyenHT = parseNumber(ticketStr);
  const clientsParJour = parseNumber(clientsStr);
  const nbSemainesSaison = parseNumber(semainesStr);
  const joursOuverture = parseNumber(joursStr);

  const caHebdo = ticketMoyenHT * clientsParJour * joursOuverture;
  const caMois = caHebdo * 4.33;
  const caSaison = caHebdo * nbSemainesSaison;

  const clientsParSemaine = clientsParJour * joursOuverture;
  const fraisParTicketAvec =
    clientsParSemaine > 0 ? totalHebdoAvec / clientsParSemaine : 0;
  const fraisParTicketHors =
    clientsParSemaine > 0 ? totalHebdoHors / clientsParSemaine : 0;

  const tauxFraisAvec = caMois > 0 ? (totalMensuelAvec / caMois) * 100 : 0;
  const tauxFraisHors = caMois > 0 ? (totalMensuelHors / caMois) * 100 : 0;

  // ── Mix total indicator ───────────────────────────────────────────────────
  const totalMix = FOOD_COST_CATEGORIES.reduce(
    (s, cat) => s + parseNumber(mixProduitStrs[cat] || "0"),
    0,
  );
  const mixOk = Math.abs(totalMix - 100) < 0.5;

  // ── Validation ───────────────────────────────────────────────────────────
  const allValid =
    validateNumber(ticketStr) &&
    validateNumber(clientsStr) &&
    validateNumber(semainesStr) &&
    validateNumber(joursStr) &&
    Object.values(foodCostStrs).every((v) => validateNumber(v)) &&
    Object.values(mixProduitStrs).every((v) => validateNumber(v));

  // ── Save handler ─────────────────────────────────────────────────────────
  async function handleSave() {
    if (!allValid) {
      toast.error("Corrigez les champs invalides avant de sauvegarder.");
      return;
    }
    const payload: ParametresRentabilite = {
      ...params,
      ticketMoyenHT: parseNumber(ticketStr),
      nbClientsParSemaine: parseNumber(clientsStr),
      nbSemainesSaison: parseNumber(semainesStr),
    };
    const joursVal = parseNumber(joursStr);
    const mixPayload: [string, number][] = FOOD_COST_CATEGORIES.map((cat) => [
      cat,
      parseNumber(mixProduitStrs[cat] || "0"),
    ]);
    console.log("[Rentabilite] handleSave payload:", JSON.stringify(payload));
    try {
      await Promise.all([
        saveMut.mutateAsync(payload),
        saveJoursMut.mutateAsync(joursVal),
        saveMixMut.mutateAsync(mixPayload),
      ]);
      toast.success("Paramètres sauvegardés");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleSave] error:", e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  const scenarios = [
    {
      label: "Avec rémunération",
      totalHebdo: totalHebdoAvec,
      totalMensuel: totalMensuelAvec,
      fraisParTicket: fraisParTicketAvec,
      tauxFrais: tauxFraisAvec,
    },
    {
      label: "Hors rémunération",
      totalHebdo: totalHebdoHors,
      totalMensuel: totalMensuelHors,
      fraisParTicket: fraisParTicketHors,
      tauxFrais: tauxFraisHors,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Rentabilité</h2>
          <p className="text-sm text-muted-foreground">
            Paramètres et calculs prévisionnels
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMut.isPending || !allValid}
          data-ocid="rentabilite.save_button"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMut.isPending ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Paramètres d'activité */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Paramètres d'activité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingParams ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label>Ticket moyen HT / personne (€)</Label>
                  <NumericInput
                    value={ticketStr}
                    onChange={setTicketStr}
                    placeholder="0.00"
                    data-ocid="rentabilite.input"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Clients par jour</Label>
                  <NumericInput
                    value={clientsStr}
                    onChange={setClientsStr}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Nombre de semaines / saison</Label>
                  <NumericInput
                    value={semainesStr}
                    onChange={setSemainesStr}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Jours d'ouverture par semaine</Label>
                  <NumericInput
                    value={joursStr}
                    onChange={setJoursStr}
                    placeholder="6"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Mix Produit & Food Cost */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Mix Produit (%) &amp; Food Cost cible (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {/* Column headers */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pb-1 border-b">
                <span className="flex-1">Catégorie</span>
                <span className="w-20 text-right">Mix (%)</span>
                <span className="w-20 text-right">Food Cost (%)</span>
              </div>
              {FOOD_COST_CATEGORIES.map((cat) => {
                const fcStr = foodCostStrs[cat] ?? "";
                const mxStr = mixProduitStrs[cat] ?? "";
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="flex-1 text-sm">{cat}</span>
                    <NumericInput
                      value={mxStr}
                      onChange={(v) => {
                        setMixProduitStrs((prev) => ({ ...prev, [cat]: v }));
                      }}
                      placeholder="0"
                      className="w-20 h-8 text-right"
                    />
                    <NumericInput
                      value={fcStr}
                      onChange={(v) => handleFoodCostChange(cat, v)}
                      placeholder="30"
                      className="w-20 h-8 text-right"
                    />
                  </div>
                );
              })}
              {/* Mix total indicator */}
              {totalMix > 0 && (
                <div
                  className={`text-xs text-right pt-1 border-t font-medium ${
                    mixOk ? "text-emerald-600" : "text-orange-500"
                  }`}
                >
                  Total Mix : {totalMix.toFixed(1)} %{" "}
                  {mixOk ? "✓" : "(idéalement 100 %)"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-3">Dashboard prévisionnel</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((sc) => (
            <Card key={sc.label} className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-primary">
                  {sc.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  {[
                    ["Total frais fixes hebdo", fmtEur(sc.totalHebdo)],
                    ["Frais fixes / ticket", fmtEur(sc.fraisParTicket)],
                    ["CA prévisionnel semaine", fmtEur(caHebdo)],
                    ["CA prévisionnel mois", fmtEur(caMois)],
                    ["CA prévisionnel saison", fmtEur(caSaison)],
                    ["Taux frais fixes", fmtPct(sc.tauxFrais)],
                    [
                      "Besoin CA saison (frais fixes)",
                      fmtEur(sc.totalHebdo * nbSemainesSaison),
                    ],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex justify-between items-center py-1 border-b border-border/50 last:border-0"
                    >
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
