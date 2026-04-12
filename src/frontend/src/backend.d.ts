import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Emprunt {
    id: string;
    nom: string;
    tauxAnnuel: number;
    differeMois: bigint;
    dateDebut: string;
    montant: number;
    dureeMois: bigint;
}
export interface RecetteIngredient {
    unite: string;
    quantite: number;
    ingredientId: string;
}
export type Result = {
    __kind__: "ok";
    ok: VenteRecette;
} | {
    __kind__: "err";
    err: string;
};
export interface Recette {
    id: string;
    nom: string;
    categorie: string;
    tauxTVA: number;
    prixVenteTTC: number;
    consommablesHT: number;
    ingredients: Array<RecetteIngredient>;
    categorieTVA: string;
}
export interface VenteRecette {
    id: string;
    recetteId: string;
    date: string;
    caTtcCapture: number;
    quantite: number;
    coutMatiereTotalCapture: number;
}
export interface ParametresRentabilite {
    nbSemainesSaison: number;
    nbClientsParSemaine: number;
    ticketMoyenHT: number;
    tauxFoodCostParCategorie: Array<[string, number]>;
}
export interface Ingredient {
    id: string;
    nom: string;
    seuilSecurite: number;
    stockInitial: number;
    unite: string;
    prixUnitaireHT: number;
}
export interface ParametresJuridiques {
    regimeSocial: string;
    formeJuridique: string;
    regimeFiscal: string;
}
export interface LigneAmortissement {
    id: string;
    nom: string;
    coutTotal: number;
    dureeMois: bigint;
}
export interface AssocieGerant {
    id: string;
    nom: string;
    statut: string;
    remunerationAnnuelle: number;
}
export interface LigneFraisFixes {
    nom: string;
    montantMensuelHorsRemu: number;
    montantMensuelAvecRemu: number;
}
export interface Salarie {
    id: string;
    nom: string;
    salaireAnnuelBrut: number;
    poste: string;
}
export interface MouvementStock {
    id: string;
    motif: string;
    date: string;
    typeOp: string;
    quantite: number;
    ingredientId: string;
}
export interface backendInterface {
    createAmortissement(nom: string, coutTotal: number, dureeMois: bigint): Promise<LigneAmortissement>;
    createAssocieGerant(nom: string, statut: string, remunerationAnnuelle: number): Promise<AssocieGerant>;
    createEmprunt(nom: string, montant: number, tauxAnnuel: number, dureeMois: bigint, dateDebut: string, differeMois: bigint): Promise<Emprunt>;
    createIngredient(nom: string, unite: string, prixUnitaireHT: number, seuilSecurite: number, stockInitial: number): Promise<Ingredient>;
    createMouvement(ingredientId: string, date: string, typeOp: string, quantite: number, motif: string): Promise<MouvementStock>;
    createRecette(nom: string, categorie: string, categorieTVA: string, tauxTVA: number, ings: Array<RecetteIngredient>, consommablesHT: number, prixVenteTTC: number): Promise<Recette>;
    createSalarie(nom: string, poste: string, salaireAnnuelBrut: number): Promise<Salarie>;
    createVente(recetteId: string, date: string, quantite: number): Promise<Result>;
    deleteAmortissement(id: string): Promise<boolean>;
    deleteAssocieGerant(id: string): Promise<boolean>;
    deleteEmprunt(id: string): Promise<boolean>;
    deleteIngredient(id: string): Promise<boolean>;
    deleteMouvement(id: string): Promise<boolean>;
    deleteRecette(id: string): Promise<boolean>;
    deleteSalarie(id: string): Promise<boolean>;
    deleteVente(id: string): Promise<boolean>;
    getAmortissements(): Promise<Array<LigneAmortissement>>;
    getAssociesGerants(): Promise<Array<AssocieGerant>>;
    getEmprunts(): Promise<Array<Emprunt>>;
    getFraisFixes(): Promise<Array<LigneFraisFixes>>;
    getIngredients(): Promise<Array<Ingredient>>;
    getJoursOuvertureParSemaine(): Promise<number>;
    getMixProduitParCategorie(): Promise<Array<[string, number]>>;
    getMouvementsStock(): Promise<Array<MouvementStock>>;
    getParametres(): Promise<ParametresRentabilite>;
    getParametresJuridiques(): Promise<ParametresJuridiques>;
    getRecettes(): Promise<Array<Recette>>;
    getSalaries(): Promise<Array<Salarie>>;
    getVentesRecettes(): Promise<Array<VenteRecette>>;
    saveFraisFixes(lignes: Array<LigneFraisFixes>): Promise<boolean>;
    saveJoursOuvertureParSemaine(v: number): Promise<boolean>;
    saveMixProduitParCategorie(m: Array<[string, number]>): Promise<boolean>;
    saveParametres(p: ParametresRentabilite): Promise<boolean>;
    saveParametresJuridiques(p: ParametresJuridiques): Promise<boolean>;
    updateAmortissement(id: string, nom: string, coutTotal: number, dureeMois: bigint): Promise<boolean>;
    updateAssocieGerant(id: string, nom: string, statut: string, remunerationAnnuelle: number): Promise<boolean>;
    updateEmprunt(id: string, nom: string, montant: number, tauxAnnuel: number, dureeMois: bigint, dateDebut: string, differeMois: bigint): Promise<boolean>;
    updateIngredient(id: string, nom: string, unite: string, prixUnitaireHT: number, seuilSecurite: number, stockInitial: number): Promise<boolean>;
    updateRecette(id: string, nom: string, categorie: string, categorieTVA: string, tauxTVA: number, ings: Array<RecetteIngredient>, consommablesHT: number, prixVenteTTC: number): Promise<boolean>;
    updateSalarie(id: string, nom: string, poste: string, salaireAnnuelBrut: number): Promise<boolean>;
}
