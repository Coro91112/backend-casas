const STOPWORDS = new Set(['de','del','la','las','los','y','e','el','da','do','dos','das']);

export function normalize(str='') {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // sin acentos
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeName(str='') {
  const n = normalize(str);
  return n.split(' ')
    .filter(Boolean)
    .filter(tok => !STOPWORDS.has(tok));
}

/**
 * Regla de validación:
 * - Todos los tokens del input deben existir como prefijo o match exacto en el nombre real.
 * - Requerimos al menos 2 tokens válidos (para evitar falsos positivos con un solo “Andres”).
 *   Si el nombre real tiene 1 token, entonces aceptamos 1.
 */
export function nameMatches(inputName, realFullName) {
  const inputTokens = tokenizeName(inputName);
  const realTokens  = tokenizeName(realFullName);

  if (realTokens.length === 0) return false;
  const minRequired = Math.min(2, realTokens.length);

  // Debe haber al menos minRequired tokens de input
  if (inputTokens.length < minRequired) return false;

  // Cada token del input debe aparecer como inicio de alguno de los tokens reales
  const okAll = inputTokens.every(it =>
    realTokens.some(rt => rt === it || rt.startsWith(it))
  );

  if (!okAll) return false;

  // Y además, que al menos minRequired tokens coincidan (ya está implícito por el every + length)
  return true;
}
