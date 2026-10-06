const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`PORT invalide : « ${process.env.PORT} ». Attendu : un entier entre 1 et 65535.`);
}

export const config = {
  port,
  /** Fichier SQLite (créé automatiquement). */
  fichierBase: process.env.DATABASE_FILE ?? "data/demandes.db",
} as const;
