import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useParametresJuridiques,
  useSaveParametresJuridiques,
} from "@/hooks/useQueries";
import type { ParametresJuridiques } from "@/hooks/useQueries";
import { Info, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const FORMES = [
  { value: "EI", label: "EI — Entreprise Individuelle" },
  {
    value: "EIRL",
    label: "EIRL — Entreprise Individuelle à Responsabilité Limitée",
  },
  {
    value: "EURL",
    label: "EURL — Entreprise Unipersonnelle à Responsabilité Limitée",
  },
  { value: "SARL", label: "SARL — Société à Responsabilité Limitée" },
  { value: "SAS", label: "SAS — Société par Actions Simplifiée" },
  {
    value: "SASU",
    label: "SASU — Société par Actions Simplifiée Unipersonnelle",
  },
  { value: "SA", label: "SA — Société Anonyme" },
];

const REGIMES_FISCAUX = [
  { value: "IR", label: "IR — Impôt sur le Revenu" },
  { value: "IS", label: "IS — Impôt sur les Sociétés" },
];

const REGIMES_SOCIAUX = [
  { value: "TNS", label: "TNS — Travailleur Non Salarié" },
  { value: "assimile", label: "Assimilé salarié" },
];

function suggestRegimeSocial(forme: string): string {
  if (["SAS", "SASU", "SA"].includes(forme)) return "assimile";
  return "TNS";
}

const DEFAULT_PARAMS: ParametresJuridiques = {
  formeJuridique: "EI",
  regimeFiscal: "IR",
  regimeSocial: "TNS",
};

export default function ParametresJuridiquesPage() {
  const { data, isLoading } = useParametresJuridiques();
  const saveMut = useSaveParametresJuridiques();
  const [form, setForm] = useState<ParametresJuridiques>(DEFAULT_PARAMS);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function handleFormeChange(forme: string) {
    setForm((f) => ({
      ...f,
      formeJuridique: forme,
      regimeSocial: suggestRegimeSocial(forme),
    }));
  }

  async function handleSave() {
    console.log(
      "[ParametresJuridiques] handleSave called, form:",
      JSON.stringify(form),
    );
    try {
      await saveMut.mutateAsync(form);
      toast.success("Paramètres juridiques sauvegardés");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[handleSave] error:", e);
      toast.error(`Erreur lors de la sauvegarde : ${msg}`);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Paramètres juridiques</h2>
        <p className="text-sm text-muted-foreground">
          Ces paramètres ajustent automatiquement les calculs de cotisations
          sociales dans les onglets Emprunts et Salaires.
        </p>
      </div>

      <Card data-ocid="parametres.card">
        <CardHeader>
          <CardTitle className="text-base">Structure juridique</CardTitle>
          <CardDescription>
            La forme juridique détermine le régime social du dirigeant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-1.5">
            <Label htmlFor="forme-juridique">Forme juridique</Label>
            <Select
              value={form.formeJuridique}
              onValueChange={handleFormeChange}
              disabled={isLoading}
            >
              <SelectTrigger id="forme-juridique" data-ocid="parametres.select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="regime-fiscal">Régime fiscal</Label>
            <Select
              value={form.regimeFiscal}
              onValueChange={(v) => setForm((f) => ({ ...f, regimeFiscal: v }))}
              disabled={isLoading}
            >
              <SelectTrigger id="regime-fiscal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIMES_FISCAUX.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="regime-social">
              Régime social des dirigeants
              <span className="ml-2 text-xs text-muted-foreground">
                (suggéré d&apos;après la forme juridique, modifiable)
              </span>
            </Label>
            <Select
              value={form.regimeSocial}
              onValueChange={(v) => setForm((f) => ({ ...f, regimeSocial: v }))}
              disabled={isLoading}
            >
              <SelectTrigger id="regime-social">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIMES_SOCIAUX.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={saveMut.isPending || isLoading}
            data-ocid="parametres.save_button"
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMut.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </CardContent>
      </Card>

      {/* Info box */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300">
                Impact sur les calculs de charges sociales
              </p>
              <div className="space-y-1 text-blue-700 dark:text-blue-400">
                <p>
                  <strong>TNS (Travailleur Non Salarié)</strong> — EI, EIRL,
                  EURL, Gérant majoritaire SARL : cotisations sociales ≈ 45 % de
                  la rémunération nette. Coût total = net × 1,45.
                </p>
                <p>
                  <strong>Assimilé salarié</strong> — Président SAS/SASU, DG SA,
                  Gérant minoritaire SARL : charges patronales ≈ 42 % + charges
                  salariales ≈ 22 % sur le brut. Net = brut × 78 %. Coût
                  employeur = brut × 142 %.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Régime fiscal — IR vs IS
              </p>
              <p>
                <strong>IR</strong> : les bénéfices sont imposés directement
                entre les mains de l&apos;exploitant (tranches marginales 0–45
                %). Adapté aux petites structures ou démarrage.
              </p>
              <p>
                <strong>IS</strong> : l&apos;entreprise est imposée à taux fixe
                (15 % jusqu&apos;à 42 500 € de bénéfice, puis 25 %). La
                rémunération du dirigeant est déductible du résultat imposable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
