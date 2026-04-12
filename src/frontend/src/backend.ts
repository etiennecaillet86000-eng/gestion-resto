/* eslint-disable */

// @ts-nocheck

import { Actor, HttpAgent, type HttpAgentOptions, type ActorConfig, type Agent, type ActorSubclass } from "@icp-sdk/core/agent";
import type { Principal } from "@icp-sdk/core/principal";
import { idlFactory, type _SERVICE } from "./declarations/backend.did";

export interface Some<T> { __kind__: "Some"; value: T; }
export interface None { __kind__: "None"; }
export type Option<T> = Some<T> | None;

function candid_some<T>(value: T): [T] { return [value]; }
function candid_none<T>(): [] { return []; }

export class ExternalBlob {
  _blob?: Uint8Array<ArrayBuffer> | null;
  directURL: string;
  onProgress?: (percentage: number) => void = undefined;
  private constructor(directURL: string, blob: Uint8Array<ArrayBuffer> | null) {
    if (blob) { this._blob = blob; }
    this.directURL = directURL;
  }
  static fromURL(url: string): ExternalBlob { return new ExternalBlob(url, null); }
  static fromBytes(blob: Uint8Array<ArrayBuffer>): ExternalBlob {
    const url = URL.createObjectURL(new Blob([new Uint8Array(blob)], { type: 'application/octet-stream' }));
    return new ExternalBlob(url, blob);
  }
  public async getBytes(): Promise<Uint8Array<ArrayBuffer>> {
    if (this._blob) { return this._blob; }
    const response = await fetch(this.directURL);
    const blob = await response.blob();
    this._blob = new Uint8Array(await blob.arrayBuffer());
    return this._blob;
  }
  public getDirectURL(): string { return this.directURL; }
  public withUploadProgress(onProgress: (percentage: number) => void): ExternalBlob {
    this.onProgress = onProgress;
    return this;
  }
}

function fromNat(n: bigint): number { return Number(n); }
function toNat(n: number): bigint { return BigInt(Math.round(n)); }

function normalizeEmprunt(e: any) {
  return { ...e, dureeMois: fromNat(e.dureeMois), differeMois: fromNat(e.differeMois) };
}

function normalizeAmortissement(a: any) {
  return { ...a, dureeMois: fromNat(a.dureeMois) };
}

export interface RecetteIngredient { ingredientId: string; quantite: number; unite: string; }
export interface Ingredient { id: string; nom: string; unite: string; prixUnitaireHT: number; seuilSecurite: number; stockInitial: number; }
export interface Recette { id: string; nom: string; categorie: string; categorieTVA: string; tauxTVA: number; ingredients: RecetteIngredient[]; consommablesHT: number; prixVenteTTC: number; }
export interface LigneFraisFixes { nom: string; montantMensuelAvecRemu: number; montantMensuelHorsRemu: number; }
export interface ParametresRentabilite { ticketMoyenHT: number; nbClientsParSemaine: number; nbSemainesSaison: number; tauxFoodCostParCategorie: [string, number][]; }
export interface MouvementStock { id: string; ingredientId: string; date: string; typeOp: string; quantite: number; motif: string; }
export interface VenteRecette { id: string; recetteId: string; date: string; quantite: number; }
export interface Emprunt { id: string; nom: string; montant: number; tauxAnnuel: number; dureeMois: number; dateDebut: string; differeMois: number; }
export interface AssocieGerant { id: string; nom: string; statut: string; remunerationAnnuelle: number; }
export interface Salarie { id: string; nom: string; poste: string; salaireAnnuelBrut: number; }
export interface ParametresJuridiques { formeJuridique: string; regimeFiscal: string; regimeSocial: string; }
export interface LigneAmortissement { id: string; nom: string; coutTotal: number; dureeMois: number; }

export interface backendInterface {
  getIngredients(): Promise<Ingredient[]>;
  createIngredient(nom: string, unite: string, prixUnitaireHT: number, seuilSecurite: number, stockInitial: number): Promise<Ingredient>;
  updateIngredient(id: string, nom: string, unite: string, prixUnitaireHT: number, seuilSecurite: number, stockInitial: number): Promise<boolean>;
  deleteIngredient(id: string): Promise<boolean>;
  getRecettes(): Promise<Recette[]>;
  createRecette(nom: string, categorie: string, categorieTVA: string, tauxTVA: number, ingredients: RecetteIngredient[], consommablesHT: number, prixVenteTTC: number): Promise<Recette>;
  updateRecette(id: string, nom: string, categorie: string, categorieTVA: string, tauxTVA: number, ingredients: RecetteIngredient[], consommablesHT: number, prixVenteTTC: number): Promise<boolean>;
  deleteRecette(id: string): Promise<boolean>;
  getFraisFixes(): Promise<LigneFraisFixes[]>;
  saveFraisFixes(lignes: LigneFraisFixes[]): Promise<boolean>;
  getParametres(): Promise<ParametresRentabilite>;
  saveParametres(p: ParametresRentabilite): Promise<boolean>;
  getJoursOuvertureParSemaine(): Promise<number>;
  saveJoursOuvertureParSemaine(v: number): Promise<boolean>;
  getMixProduitParCategorie(): Promise<[string, number][]>;
  saveMixProduitParCategorie(m: [string, number][]): Promise<boolean>;
  getMouvementsStock(): Promise<MouvementStock[]>;
  createMouvement(ingredientId: string, date: string, typeOp: string, quantite: number, motif: string): Promise<MouvementStock>;
  deleteMouvement(id: string): Promise<boolean>;
  getVentesRecettes(): Promise<VenteRecette[]>;
  createVente(recetteId: string, date: string, quantite: number): Promise<VenteRecette>;
  deleteVente(id: string): Promise<boolean>;
  getEmprunts(): Promise<Emprunt[]>;
  createEmprunt(nom: string, montant: number, tauxAnnuel: number, dureeMois: number, dateDebut: string, differeMois: number): Promise<Emprunt>;
  updateEmprunt(id: string, nom: string, montant: number, tauxAnnuel: number, dureeMois: number, dateDebut: string, differeMois: number): Promise<boolean>;
  deleteEmprunt(id: string): Promise<boolean>;
  getAssociesGerants(): Promise<AssocieGerant[]>;
  createAssocieGerant(nom: string, statut: string, remunerationAnnuelle: number): Promise<AssocieGerant>;
  updateAssocieGerant(id: string, nom: string, statut: string, remunerationAnnuelle: number): Promise<boolean>;
  deleteAssocieGerant(id: string): Promise<boolean>;
  getSalaries(): Promise<Salarie[]>;
  createSalarie(nom: string, poste: string, salaireAnnuelBrut: number): Promise<Salarie>;
  updateSalarie(id: string, nom: string, poste: string, salaireAnnuelBrut: number): Promise<boolean>;
  deleteSalarie(id: string): Promise<boolean>;
  getParametresJuridiques(): Promise<ParametresJuridiques>;
  saveParametresJuridiques(p: ParametresJuridiques): Promise<boolean>;
  getAmortissements(): Promise<LigneAmortissement[]>;
  createAmortissement(nom: string, coutTotal: number, dureeMois: number): Promise<LigneAmortissement>;
  updateAmortissement(id: string, nom: string, coutTotal: number, dureeMois: number): Promise<boolean>;
  deleteAmortissement(id: string): Promise<boolean>;
}

export class Backend implements backendInterface {
  constructor(
    private actor: ActorSubclass<_SERVICE>,
    private _uploadFile: (file: ExternalBlob) => Promise<Uint8Array>,
    private _downloadFile: (file: Uint8Array) => Promise<ExternalBlob>,
    private processError?: (error: unknown) => never
  ) {}

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn(); }
    catch (e) { if (this.processError) this.processError(e); throw e; }
  }

  getIngredients() { return this.call(() => this.actor.getIngredients()); }
  createIngredient(nom, unite, prixUnitaireHT, seuilSecurite, stockInitial) {
    return this.call(() => this.actor.createIngredient(nom, unite, prixUnitaireHT, seuilSecurite, stockInitial));
  }
  updateIngredient(id, nom, unite, prixUnitaireHT, seuilSecurite, stockInitial) {
    return this.call(() => this.actor.updateIngredient(id, nom, unite, prixUnitaireHT, seuilSecurite, stockInitial));
  }
  deleteIngredient(id) { return this.call(() => this.actor.deleteIngredient(id)); }

  getRecettes() { return this.call(() => this.actor.getRecettes()); }
  createRecette(nom, categorie, categorieTVA, tauxTVA, ingredients, consommablesHT, prixVenteTTC) {
    return this.call(() => this.actor.createRecette(nom, categorie, categorieTVA, tauxTVA, ingredients, consommablesHT, prixVenteTTC));
  }
  updateRecette(id, nom, categorie, categorieTVA, tauxTVA, ingredients, consommablesHT, prixVenteTTC) {
    return this.call(() => this.actor.updateRecette(id, nom, categorie, categorieTVA, tauxTVA, ingredients, consommablesHT, prixVenteTTC));
  }
  deleteRecette(id) { return this.call(() => this.actor.deleteRecette(id)); }

  getFraisFixes() { return this.call(() => this.actor.getFraisFixes()); }
  saveFraisFixes(lignes) { return this.call(() => this.actor.saveFraisFixes(lignes)); }

  getParametres() { return this.call(() => this.actor.getParametres()); }
  saveParametres(p) { return this.call(() => this.actor.saveParametres(p)); }

  // ── JOURS OUVERTURE + MIX PRODUIT ────────────────────────────────────────
  getJoursOuvertureParSemaine() { return this.call(() => this.actor.getJoursOuvertureParSemaine()); }
  saveJoursOuvertureParSemaine(v) { return this.call(() => this.actor.saveJoursOuvertureParSemaine(v)); }
  getMixProduitParCategorie() { return this.call(() => this.actor.getMixProduitParCategorie()); }
  saveMixProduitParCategorie(m) { return this.call(() => this.actor.saveMixProduitParCategorie(m)); }

  getMouvementsStock() { return this.call(() => this.actor.getMouvementsStock()); }
  createMouvement(ingredientId, date, typeOp, quantite, motif) {
    return this.call(() => this.actor.createMouvement(ingredientId, date, typeOp, quantite, motif));
  }
  deleteMouvement(id) { return this.call(() => this.actor.deleteMouvement(id)); }

  getVentesRecettes() { return this.call(() => this.actor.getVentesRecettes()); }
  createVente(recetteId, date, quantite) {
    return this.call(() => this.actor.createVente(recetteId, date, quantite));
  }
  deleteVente(id) { return this.call(() => this.actor.deleteVente(id)); }

  async getEmprunts() {
    const result = await this.call(() => this.actor.getEmprunts());
    return result.map(normalizeEmprunt);
  }
  async createEmprunt(nom, montant, tauxAnnuel, dureeMois, dateDebut, differeMois) {
    const result = await this.call(() => this.actor.createEmprunt(nom, montant, tauxAnnuel, toNat(dureeMois), dateDebut, toNat(differeMois)));
    return normalizeEmprunt(result);
  }
  updateEmprunt(id, nom, montant, tauxAnnuel, dureeMois, dateDebut, differeMois) {
    return this.call(() => this.actor.updateEmprunt(id, nom, montant, tauxAnnuel, toNat(dureeMois), dateDebut, toNat(differeMois)));
  }
  deleteEmprunt(id) { return this.call(() => this.actor.deleteEmprunt(id)); }

  getAssociesGerants() { return this.call(() => this.actor.getAssociesGerants()); }
  createAssocieGerant(nom, statut, remunerationAnnuelle) {
    return this.call(() => this.actor.createAssocieGerant(nom, statut, remunerationAnnuelle));
  }
  updateAssocieGerant(id, nom, statut, remunerationAnnuelle) {
    return this.call(() => this.actor.updateAssocieGerant(id, nom, statut, remunerationAnnuelle));
  }
  deleteAssocieGerant(id) { return this.call(() => this.actor.deleteAssocieGerant(id)); }

  getSalaries() { return this.call(() => this.actor.getSalaries()); }
  createSalarie(nom, poste, salaireAnnuelBrut) {
    return this.call(() => this.actor.createSalarie(nom, poste, salaireAnnuelBrut));
  }
  updateSalarie(id, nom, poste, salaireAnnuelBrut) {
    return this.call(() => this.actor.updateSalarie(id, nom, poste, salaireAnnuelBrut));
  }
  deleteSalarie(id) { return this.call(() => this.actor.deleteSalarie(id)); }

  getParametresJuridiques() { return this.call(() => this.actor.getParametresJuridiques()); }
  saveParametresJuridiques(p) { return this.call(() => this.actor.saveParametresJuridiques(p)); }

  async getAmortissements() {
    const result = await this.call(() => this.actor.getAmortissements());
    return result.map(normalizeAmortissement);
  }
  async createAmortissement(nom, coutTotal, dureeMois) {
    const result = await this.call(() => this.actor.createAmortissement(nom, coutTotal, toNat(dureeMois)));
    return normalizeAmortissement(result);
  }
  updateAmortissement(id, nom, coutTotal, dureeMois) {
    return this.call(() => this.actor.updateAmortissement(id, nom, coutTotal, toNat(dureeMois)));
  }
  deleteAmortissement(id) { return this.call(() => this.actor.deleteAmortissement(id)); }
}

export interface CreateActorOptions {
  agent?: Agent;
  agentOptions?: HttpAgentOptions;
  actorOptions?: ActorConfig;
  processError?: (error: unknown) => never;
}

export function createActor(
  canisterId: string,
  _uploadFile: (file: ExternalBlob) => Promise<Uint8Array>,
  _downloadFile: (file: Uint8Array) => Promise<ExternalBlob>,
  options: CreateActorOptions = {}
): Backend {
  const agent = options.agent || HttpAgent.createSync({ ...options.agentOptions });
  if (options.agent && options.agentOptions) {
    console.warn("Detected both agent and agentOptions passed to createActor. Ignoring agentOptions and proceeding with the provided agent.");
  }
  const actor = Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId: canisterId,
    ...options.actorOptions,
  });
  return new Backend(actor, _uploadFile, _downloadFile, options.processError);
}
