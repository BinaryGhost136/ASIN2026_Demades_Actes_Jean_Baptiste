/**
 * Données de démonstration (facultatif) : `npm run seed`.
 * Crée 25 demandes pour l'usager 0123456789 (de quoi tester la pagination et les filtres).
 */
import { config } from "../src/config.js";
import { TYPES_ACTE } from "../src/domain/demande.js";
import { DemandeService } from "../src/domain/demande.service.js";
import { ouvrirBase } from "../src/infra/database.js";
import { SqliteDemandeRepository } from "../src/infra/sqlite-demande.repository.js";

const NPI_DEMO = "0123456789";
const NOMBRE_DEMANDES = 25;

const base = ouvrirBase(config.fichierBase);
const service = new DemandeService(new SqliteDemandeRepository(base));

for (let i = 0; i < NOMBRE_DEMANDES; i++) {
  const demande = service.deposer({
    npi: NPI_DEMO,
    typeActe: TYPES_ACTE[i % TYPES_ACTE.length]!,
    nombreCopies: (i % 5) + 1,
  });
  // Variété de statuts : 1/4 restent déposées, les autres avancent plus ou moins loin.
  if (i % 4 === 0) continue;
  service.changerStatut(demande.id, { statut: "EN_COURS", motifRejet: null });
  if (i % 4 === 1) continue;
  if (i % 4 === 2) service.changerStatut(demande.id, { statut: "VALIDEE", motifRejet: null });
  else service.changerStatut(demande.id, { statut: "REJETEE", motifRejet: "Pièce justificative manquante" });
}

console.log(`${NOMBRE_DEMANDES} demandes créées pour le NPI ${NPI_DEMO} (${config.fichierBase}).`);
base.close();
