import { z } from "zod";
import { ValidationError } from "./errors.js";
import {
  COPIES_MAX,
  COPIES_MIN,
  MOTIF_REJET_MAX,
  NPI_LONGUEUR,
  NPI_REGEX,
  STATUTS,
  TAILLE_PAGE_MAX,
  TYPES_ACTE,
} from "./demande.js";

/**
 * Règles de validation des saisies. Les messages sont rédigés pour l'utilisateur final.
 */

/** Message « champ absent » si rien n'a été envoyé, sinon message « valeur invalide ». */
const erreur = (obligatoire: string, invalide: string) => ({
  error: (issue: { input?: unknown }) => (issue.input === undefined ? obligatoire : invalide),
});

const messageNpi = `Le NPI doit comporter exactement ${NPI_LONGUEUR} chiffres.`;

export const npiSchema = z
  .string(erreur("Le NPI est obligatoire.", messageNpi))
  .regex(NPI_REGEX, messageNpi);

const typeActeSchema = z.enum(
  TYPES_ACTE,
  erreur(
    "Le type d'acte est obligatoire.",
    `Le type d'acte doit être l'un des suivants : ${TYPES_ACTE.join(", ")}.`,
  ),
);

const statutSchema = z.enum(
  STATUTS,
  erreur("Le statut est obligatoire.", `Le statut doit être l'un des suivants : ${STATUTS.join(", ")}.`),
);

const messageCopies = `Le nombre de copies doit être un entier compris entre ${COPIES_MIN} et ${COPIES_MAX}.`;

const corpsJson = { error: "Le corps de la requête doit être un objet JSON." };

/** Dépôt d'une demande. */
export const deposerSchema = z.object(
  {
    npi: npiSchema,
    typeActe: typeActeSchema,
    nombreCopies: z
      .number(erreur("Le nombre de copies est obligatoire.", messageCopies))
      .int(messageCopies)
      .min(COPIES_MIN, messageCopies)
      .max(COPIES_MAX, messageCopies),
  },
  corpsJson,
);

/** Changement de statut : un rejet doit toujours être motivé. */
export const changerStatutSchema = z
  .object(
    {
      statut: statutSchema,
      motifRejet: z
        .string({ error: "Le motif de rejet doit être un texte." })
        .max(MOTIF_REJET_MAX, `Le motif de rejet ne doit pas dépasser ${MOTIF_REJET_MAX} caractères.`)
        .optional(),
    },
    corpsJson,
  )
  .refine((d) => d.statut !== "REJETEE" || (d.motifRejet ?? "").trim().length > 0, {
    path: ["motifRejet"],
    error: "Un rejet doit toujours être motivé : renseignez motifRejet.",
  })
  .transform((d) => ({
    statut: d.statut,
    // Le motif n'a de sens que pour un rejet : on ne le conserve pas sinon.
    motifRejet: d.statut === "REJETEE" ? (d.motifRejet ?? "").trim() : null,
  }));

/** Identifiant de demande passé dans l'URL. */
export const idSchema = z
  .string()
  .regex(/^[1-9]\d{0,14}$/, "L'identifiant de la demande doit être un entier positif.")
  .transform(Number);

const messagePage = "Le paramètre page doit être un entier supérieur ou égal à 1.";
const messageTaille = `Le paramètre taille doit être un entier compris entre 1 et ${TAILLE_PAGE_MAX}.`;

/** Paramètres de la liste : filtre facultatif par statut + pagination (20 par page au maximum). */
export const listerSchema = z.object({
  statut: statutSchema.optional(),
  page: z.coerce.number(messagePage).int(messagePage).min(1, messagePage).default(1),
  taille: z.coerce
    .number(messageTaille)
    .int(messageTaille)
    .min(1, messageTaille)
    .default(TAILLE_PAGE_MAX)
    .transform((t) => Math.min(t, TAILLE_PAGE_MAX)),
});

export const statistiquesSchema = z.object({ npi: npiSchema.optional() });

/**
 * Valide une saisie ; lève une ValidationError listant tous les problèmes détectés.
 * `champ` nomme la valeur lorsqu'on valide un simple paramètre d'URL (ex. « npi »).
 */
export function valider<S extends z.ZodType>(schema: S, saisie: unknown, champ?: string): z.output<S> {
  const resultat = schema.safeParse(saisie);
  if (resultat.success) return resultat.data;
  throw new ValidationError(
    resultat.error.issues.map((issue) => ({
      champ: issue.path.length > 0 ? issue.path.join(".") : (champ ?? null),
      message: issue.message,
    })),
  );
}
