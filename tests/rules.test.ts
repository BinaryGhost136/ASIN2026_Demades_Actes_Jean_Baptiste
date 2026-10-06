import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { STATUTS, TRANSITIONS, estStatutFinal, peutTransitionner } from "../src/domain/demande.js";
import { ValidationError } from "../src/domain/errors.js";
import { changerStatutSchema, deposerSchema, idSchema, listerSchema, valider } from "../src/domain/rules.js";
import { DEPOT_VALIDE } from "./helpers.js";

const messages = (action: () => unknown): string => {
  try {
    action();
  } catch (e) {
    if (e instanceof ValidationError) return e.message;
    throw e;
  }
  assert.fail("Une ValidationError était attendue");
};

describe("Règle : NPI de exactement 10 chiffres", () => {
  test("accepte 10 chiffres, y compris avec des zéros au début", () => {
    assert.equal(valider(deposerSchema, DEPOT_VALIDE).npi, "0123456789");
  });

  for (const [description, npi] of [
    ["9 chiffres", "012345678"],
    ["11 chiffres", "01234567890"],
    ["des lettres", "01234abcde"],
    ["des espaces", " 123456789"],
    ["vide", ""],
    ["un nombre JSON (perdrait les zéros initiaux)", 123456789],
  ] as const) {
    test(`refuse un NPI avec ${description}`, () => {
      assert.match(messages(() => valider(deposerSchema, { ...DEPOT_VALIDE, npi })), /NPI/);
    });
  }

  test("refuse un NPI absent", () => {
    const { npi: _npi, ...sansNpi } = DEPOT_VALIDE;
    assert.match(messages(() => valider(deposerSchema, sansNpi)), /NPI est obligatoire/);
  });
});

describe("Règle : type d'acte parmi les trois types", () => {
  for (const typeActe of ["ACTE_NAISSANCE", "CASIER_JUDICIAIRE", "CERTIFICAT_RESIDENCE"]) {
    test(`accepte ${typeActe}`, () => {
      assert.equal(valider(deposerSchema, { ...DEPOT_VALIDE, typeActe }).typeActe, typeActe);
    });
  }

  test("refuse un type inconnu en citant les valeurs possibles", () => {
    const message = messages(() => valider(deposerSchema, { ...DEPOT_VALIDE, typeActe: "PASSEPORT" }));
    assert.match(message, /ACTE_NAISSANCE, CASIER_JUDICIAIRE, CERTIFICAT_RESIDENCE/);
  });
});

describe("Règle : nombre de copies entre 1 et 5", () => {
  for (const nombreCopies of [1, 3, 5]) {
    test(`accepte ${nombreCopies}`, () => {
      assert.equal(valider(deposerSchema, { ...DEPOT_VALIDE, nombreCopies }).nombreCopies, nombreCopies);
    });
  }

  for (const nombreCopies of [0, 6, -1, 2.5, "2", null]) {
    test(`refuse ${JSON.stringify(nombreCopies)}`, () => {
      assert.match(
        messages(() => valider(deposerSchema, { ...DEPOT_VALIDE, nombreCopies })),
        /entier compris entre 1 et 5/,
      );
    });
  }
});

describe("Règle : un rejet doit toujours être motivé", () => {
  test("refuse un rejet sans motif", () => {
    assert.match(messages(() => valider(changerStatutSchema, { statut: "REJETEE" })), /motivé/);
  });

  test("refuse un rejet dont le motif est vide ou blanc", () => {
    assert.match(messages(() => valider(changerStatutSchema, { statut: "REJETEE", motifRejet: "   " })), /motivé/);
  });

  test("accepte un rejet motivé et nettoie les espaces", () => {
    const changement = valider(changerStatutSchema, { statut: "REJETEE", motifRejet: "  Dossier incomplet " });
    assert.deepEqual(changement, { statut: "REJETEE", motifRejet: "Dossier incomplet" });
  });

  test("ignore le motif pour un statut autre que le rejet", () => {
    const changement = valider(changerStatutSchema, { statut: "VALIDEE", motifRejet: "inutile" });
    assert.deepEqual(changement, { statut: "VALIDEE", motifRejet: null });
  });
});

describe("Cycle de vie : déposée → en cours → validée | rejetée", () => {
  const autorisees: [string, string][] = [
    ["DEPOSEE", "EN_COURS"],
    ["EN_COURS", "VALIDEE"],
    ["EN_COURS", "REJETEE"],
  ];

  test("seules trois transitions existent", () => {
    for (const de of STATUTS) {
      for (const vers of STATUTS) {
        const attendu = autorisees.some(([a, b]) => a === de && b === vers);
        assert.equal(peutTransitionner(de, vers), attendu, `${de} → ${vers}`);
      }
    }
  });

  test("VALIDEE et REJETEE sont des statuts finaux", () => {
    assert.ok(estStatutFinal("VALIDEE"));
    assert.ok(estStatutFinal("REJETEE"));
    assert.deepEqual(TRANSITIONS.VALIDEE, []);
    assert.deepEqual(TRANSITIONS.REJETEE, []);
  });
});

describe("Paramètres de liste et identifiants", () => {
  test("valeurs par défaut : page 1, 20 par page", () => {
    assert.deepEqual(valider(listerSchema, {}), { page: 1, taille: 20 });
  });

  test("plafonne la taille de page à 20", () => {
    assert.equal(valider(listerSchema, { taille: "500" }).taille, 20);
  });

  test("refuse page=0, taille=0 et un statut inconnu", () => {
    assert.match(messages(() => valider(listerSchema, { page: "0" })), /page/);
    assert.match(messages(() => valider(listerSchema, { taille: "0" })), /taille/);
    assert.match(messages(() => valider(listerSchema, { statut: "X" })), /statut/);
  });

  test("identifiant : entier positif uniquement", () => {
    assert.equal(valider(idSchema, "42"), 42);
    for (const id of ["0", "-1", "abc", "1.5", "01"]) {
      assert.throws(() => valider(idSchema, id), ValidationError, id);
    }
  });
});
