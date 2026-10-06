import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import {
  STATUTS,
  type ChangementStatut,
  type Demande,
  type NouvelleDemande,
  type StatutDemande,
} from "../domain/demande.js";

/** Contrat d'accès aux données : le service ne connaît pas SQLite. */
export interface DemandeRepository {
  creer(demande: NouvelleDemande, date: string): Demande;
  trouverParId(id: number): Demande | undefined;
  lister(
    npi: string,
    filtre: { statut?: StatutDemande; limite: number; decalage: number },
  ): { elements: Demande[]; total: number };
  changerStatut(id: number, changement: ChangementStatut, date: string): Demande | undefined;
  compterParStatut(npi?: string): Record<StatutDemande, number>;
}

// Les alias SQL renvoient directement des objets au format de l'API (pas de mapping manuel).
const COLONNES = `id, npi, type_acte AS typeActe, nombre_copies AS nombreCopies, statut,
                  motif_rejet AS motifRejet, cree_le AS creeLe, modifie_le AS modifieLe`;

const versDemande = (ligne: unknown): Demande => ({ ...(ligne as Demande) });

/**
 * Implémentation SQLite. Toutes les requêtes sont paramétrées (aucune concaténation
 * de saisie utilisateur dans le SQL : pas d'injection possible).
 */
export class SqliteDemandeRepository implements DemandeRepository {
  constructor(private readonly base: DatabaseSync) {}

  creer(demande: NouvelleDemande, date: string): Demande {
    const { lastInsertRowid } = this.base
      .prepare(
        `INSERT INTO demandes (npi, type_acte, nombre_copies, cree_le, modifie_le)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(demande.npi, demande.typeActe, demande.nombreCopies, date, date);
    return this.trouverParId(Number(lastInsertRowid))!;
  }

  trouverParId(id: number): Demande | undefined {
    const ligne = this.base.prepare(`SELECT ${COLONNES} FROM demandes WHERE id = ?`).get(id);
    return ligne ? versDemande(ligne) : undefined;
  }

  lister(
    npi: string,
    { statut, limite, decalage }: { statut?: StatutDemande; limite: number; decalage: number },
  ) {
    const conditions = ["npi = ?"];
    const parametres: SQLInputValue[] = [npi];
    if (statut) {
      conditions.push("statut = ?");
      parametres.push(statut);
    }
    const where = conditions.join(" AND ");

    const { total } = this.base
      .prepare(`SELECT COUNT(*) AS total FROM demandes WHERE ${where}`)
      .get(...parametres) as { total: number };

    // Du plus récent au plus ancien ; l'id départage deux dépôts à la même milliseconde.
    const lignes = this.base
      .prepare(
        `SELECT ${COLONNES} FROM demandes WHERE ${where}
         ORDER BY cree_le DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(...parametres, limite, decalage);

    return { elements: lignes.map(versDemande), total };
  }

  changerStatut(id: number, { statut, motifRejet }: ChangementStatut, date: string) {
    this.base
      .prepare("UPDATE demandes SET statut = ?, motif_rejet = ?, modifie_le = ? WHERE id = ?")
      .run(statut, motifRejet, date, id);
    return this.trouverParId(id);
  }

  compterParStatut(npi?: string): Record<StatutDemande, number> {
    const lignes = (
      npi
        ? this.base
            .prepare("SELECT statut, COUNT(*) AS nombre FROM demandes WHERE npi = ? GROUP BY statut")
            .all(npi)
        : this.base.prepare("SELECT statut, COUNT(*) AS nombre FROM demandes GROUP BY statut").all()
    ) as { statut: StatutDemande; nombre: number }[];

    // Tous les statuts sont présents dans la réponse, même à 0.
    const comptes = Object.fromEntries(STATUTS.map((s) => [s, 0])) as Record<StatutDemande, number>;
    for (const { statut, nombre } of lignes) comptes[statut] = nombre;
    return comptes;
  }
}
