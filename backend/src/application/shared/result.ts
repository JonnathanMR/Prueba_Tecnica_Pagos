export interface Success<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Failure<E extends string> {
  readonly ok: false;
  readonly error: {
    readonly code: E;
    readonly message: string;
  };
}

export type Result<T, E extends string> = Success<T> | Failure<E>;

export function success<T>(value: T): Success<T> {
  return { ok: true, value };
}

export function failure<E extends string>(code: E, message: string): Failure<E> {
  return { ok: false, error: { code, message } };
}
