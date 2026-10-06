import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  COPIES_MAX,
  COPIES_MIN,
  NPI_LONGUEUR,
  STATUT_INITIAL,
  STATUTS,
  TYPES_ACTE,
} from "../domain/demande.js";

const enumSql = (valeurs: readonly string[]) => valeurs.map((v) => `'${v}'`).join(", ");

/**
 * Schéma généré à partir des constantes du domaine : la base applique les mêmes règles
 * que le code (dernière ligne de défense si une donnée contournait la validation).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS demandes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  npi           TEXT    NOT NULL
                CHECK (length(npi) = ${NPI_LONGUEUR} AND npi NOT GLOB '*[^0-9]*'),
  type_acte     TEXT    NOT NULL CHECK (type_acte IN (${enumSql(TYPES_ACTE)})),
  nombre_copies INTEGER NOT NULL CHECK (nombre_copies BETWEEN ${COPIES_MIN} AND ${COPIES_MAX}),
  statut        TEXT    NOT NULL DEFAULT '${STATUT_INITIAL}'
                CHECK (statut IN (${enumSql(STATUTS)})),
  motif_rejet   TEXT,
  cree_le       TEXT    NOT NULL,
  modifie_le    TEXT    NOT NULL,
  -- Un motif est présent si et seulement si la demande est rejetée.
  CHECK ((statut = 'REJETEE') = (motif_rejet IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_demandes_npi_date ON demandes (npi, cree_le DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_demandes_npi_statut ON demandes (npi, statut);
`;

export const BASE_EN_MEMOIRE = ":memory:";

/** Ouvre (et crée si besoin) la base SQLite, puis applique le schéma. */
export function ouvrirBase(fichier: string): DatabaseSync {
  if (fichier !== BASE_EN_MEMOIRE) {
    mkdirSync(dirname(fichier), { recursive: true });
  }
  const base = new DatabaseSync(fichier);
  base.exec(SCHEMA_SQL);
  return base;
}
