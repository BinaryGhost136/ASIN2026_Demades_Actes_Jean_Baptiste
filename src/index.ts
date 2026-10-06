import { config } from "./config.js";
import { DemandeService } from "./domain/demande.service.js";
import { creerApp } from "./http/app.js";
import { ouvrirBase } from "./infra/database.js";
import { SqliteDemandeRepository } from "./infra/sqlite-demande.repository.js";

const base = ouvrirBase(config.fichierBase);
const service = new DemandeService(new SqliteDemandeRepository(base));

const serveur = creerApp(service).listen(config.port, () => {
  console.log(`API démarrée : http://localhost:${config.port}`);
  console.log(`Base de données : ${config.fichierBase}`);
});

serveur.on("error", (err: NodeJS.ErrnoException) => {
  console.error(
    err.code === "EADDRINUSE"
      ? `Le port ${config.port} est déjà utilisé. Relancez avec un autre port (variable PORT).`
      : err,
  );
  process.exit(1);
});

// Arrêt propre (Ctrl+C) : on ferme le serveur puis la base.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    serveur.close(() => {
      base.close();
      process.exit(0);
    });
  });
}
