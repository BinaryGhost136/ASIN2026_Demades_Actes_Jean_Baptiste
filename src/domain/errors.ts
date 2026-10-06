/** Erreurs applicatives : chacune porte son code HTTP et un message destiné à l'utilisateur. */

export interface DetailErreur {
  champ: string | null;
  message: string;
}

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: DetailErreur[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 400 : saisie invalide. */
export class ValidationError extends AppError {
  constructor(details: DetailErreur[]) {
    super(400, "VALIDATION_ERROR", details.map((d) => d.message).join(" "), details);
  }
}

/** 404 : ressource inexistante. */
export class NotFoundError extends AppError {
  constructor(message: string, code = "NOT_FOUND") {
    super(404, code, message);
  }
}

/** 409 : action interdite dans l'état actuel de la ressource. */
export class ConflictError extends AppError {
  constructor(message: string, code = "ACTION_INTERDITE") {
    super(409, code, message);
  }
}
