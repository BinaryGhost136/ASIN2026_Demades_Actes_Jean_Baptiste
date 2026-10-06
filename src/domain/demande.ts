/**
 * Modèle métier d'une demande d'acte.
 * Toutes les constantes du domaine sont définies ICI, une seule fois : la validation,
 * le schéma SQL, l'API et l'interface en dérivent (principe DRY).
 */

export const TYPES_ACTE = [
  "ACTE_NAISSANCE",
  "CASIER_JUDICIAIRE",
  "CERTIFICAT_RESIDENCE",
] as const;

export const STATUTS = ["DEPOSEE", "EN_COURS", "VALIDEE", "REJETEE"] as const;

export type TypeActe = (typeof TYPES_ACTE)[number];
export type StatutDemande = (typeof STATUTS)[number];

export const LIBELLES_TYPE_ACTE: Record<TypeActe, string> = {
  ACTE_NAISSANCE: "Acte de naissance",
  CASIER_JUDICIAIRE: "Casier judiciaire",
  CERTIFICAT_RESIDENCE: "Certificat de résidence",
};

export const LIBELLES_STATUT: Record<StatutDemande, string> = {
  DEPOSEE: "Déposée",
  EN_COURS: "En cours de traitement",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
};

// --- Règles de gestion chiffrées ---
export const NPI_LONGUEUR = 10;
export const NPI_REGEX = new RegExp(`^\\d{${NPI_LONGUEUR}}$`);
export const COPIES_MIN = 1;
export const COPIES_MAX = 5;
export const TAILLE_PAGE_MAX = 20;
export const MOTIF_REJET_MAX = 500;

export const STATUT_INITIAL: StatutDemande = "DEPOSEE";

/**
 * Cycle de vie : déposée → en cours de traitement → validée | rejetée.
 * Un statut sans transition sortante est final : la demande ne change plus.
 */
export const TRANSITIONS: Record<StatutDemande, readonly StatutDemande[]> = {
  DEPOSEE: ["EN_COURS"],
  EN_COURS: ["VALIDEE", "REJETEE"],
  VALIDEE: [],
  REJETEE: [],
};

export const peutTransitionner = (de: StatutDemande, vers: StatutDemande): boolean =>
  TRANSITIONS[de].includes(vers);

export const estStatutFinal = (statut: StatutDemande): boolean =>
  TRANSITIONS[statut].length === 0;

export interface Demande {
  id: number;
  npi: string;
  typeActe: TypeActe;
  nombreCopies: number;
  statut: StatutDemande;
  /** Renseigné si et seulement si la demande est rejetée. */
  motifRejet: string | null;
  creeLe: string;
  modifieLe: string;
}

export type NouvelleDemande = Pick<Demande, "npi" | "typeActe" | "nombreCopies">;

export interface ChangementStatut {
  statut: StatutDemande;
  motifRejet: string | null;
}

export interface CritereListe {
  statut?: StatutDemande;
  page: number;
  taille: number;
}
