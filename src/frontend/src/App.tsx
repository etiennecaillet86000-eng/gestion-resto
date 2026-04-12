import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Emprunts from "@/pages/Emprunts";
import FraisFixes from "@/pages/FraisFixes";
import Ingredients from "@/pages/Ingredients";
import Marges from "@/pages/Marges";
import ParametresJuridiques from "@/pages/ParametresJuridiques";
import Recettes from "@/pages/Recettes";
import Rentabilite from "@/pages/Rentabilite";
import SalairesCotisations from "@/pages/SalairesCotisations";
import Stock from "@/pages/Stock";
import VentesDuJour from "@/pages/VentesDuJour";
import {
  BarChart3,
  BookOpen,
  ChefHat,
  Landmark,
  LogOut,
  Package,
  Receipt,
  Settings2,
  ShoppingBasket,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

const CREDS = { user: "admin", pass: "admin123" };

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (user === CREDS.user && pass === CREDS.pass) {
      localStorage.setItem("auth", "1");
      onLogin();
    } else {
      setError("Identifiants incorrects");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <ChefHat className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-sidebar-foreground">
            Gestion Resto
          </h1>
          <p className="text-sidebar-foreground/60 text-sm mt-1">
            Restauration & Hôtellerie
          </p>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-base">Connexion</CardTitle>
            <CardDescription>Accès réservé aux gestionnaires</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="username">Identifiant</Label>
                <Input
                  id="username"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  autoComplete="username"
                  data-ocid="login.input"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p
                  className="text-sm text-destructive"
                  data-ocid="login.error_state"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                data-ocid="login.submit_button"
              >
                Se connecter
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-sidebar-foreground/40 mt-6">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}

const TABS = [
  {
    id: "parametres",
    label: "Paramètres",
    icon: Settings2,
    component: ParametresJuridiques,
  },
  {
    id: "ingredients",
    label: "Ingrédients",
    icon: ShoppingBasket,
    component: Ingredients,
  },
  { id: "recettes", label: "Recettes", icon: BookOpen, component: Recettes },
  { id: "frais", label: "Frais Fixes", icon: Receipt, component: FraisFixes },
  {
    id: "emprunts",
    label: "Investissements & Emprunts",
    icon: Landmark,
    component: Emprunts,
  },
  {
    id: "salaires",
    label: "Salaires",
    icon: Users,
    component: SalairesCotisations,
  },
  {
    id: "rentabilite",
    label: "Rentabilité",
    icon: TrendingUp,
    component: Rentabilite,
  },
  { id: "stock", label: "Stock", icon: Package, component: Stock },
  {
    id: "ventes",
    label: "Ventes du jour",
    icon: ShoppingCart,
    component: VentesDuJour,
  },
  {
    id: "marges",
    label: "Prévisionnel Économique",
    icon: BarChart3,
    component: Marges,
  },
];

export default function App() {
  const [authed, setAuthed] = useState(
    () => localStorage.getItem("auth") === "1",
  );

  function logout() {
    localStorage.removeItem("auth");
    setAuthed(false);
  }

  if (!authed) {
    return (
      <>
        <LoginPage onLogin={() => setAuthed(true)} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-sidebar text-sidebar-foreground sticky top-0 z-50 shadow-md no-print">
        <div className="container max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <ChefHat className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <span className="font-display font-bold text-base">
                Gestion Resto
              </span>
              <span className="hidden sm:block text-xs text-sidebar-foreground/60">
                Restauration & Hôtellerie
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            data-ocid="nav.button"
          >
            <LogOut className="h-4 w-4 mr-2" /> Déconnexion
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="parametres">
          <TabsList
            className="h-auto flex-wrap gap-1 bg-card border shadow-xs mb-6 p-1 rounded-lg"
            data-ocid="nav.tab"
          >
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="flex items-center gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded"
                data-ocid={`nav.${t.id}.tab`}
              >
                <t.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden text-xs">
                  {t.label.split(" ")[0]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id}>
              <t.component />
            </TabsContent>
          ))}
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-auto no-print">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()}. Built with ❤️ using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-primary"
          >
            caffeine.ai
          </a>
        </p>
      </footer>

      <Toaster />
    </div>
  );
}
