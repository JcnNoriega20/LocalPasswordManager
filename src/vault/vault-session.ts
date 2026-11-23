let activeKey: Buffer | null = null;
let inactivityTimer: NodeJS.Timeout | null = null;

// Tiempo de inactividad antes de bloquear automáticamente (5 minutos)
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Reinicia el temporizador de inactividad.
 * Debe llamarse cada vez que se hace una operación autenticada.
 */
export function resetInactivityTimer(): void {
  // Si no hay bóveda desbloqueada, no hay nada que reiniciar
  if (!activeKey) return;

  // Cancelar temporizador anterior
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }

  // Crear nuevo temporizador
  inactivityTimer = setTimeout(() => {
    console.log("⏱️  Auto-bloqueo por inactividad activado.");
    lockVault();
  }, INACTIVITY_TIMEOUT_MS);
}

/**
 * Cancela el temporizador de inactividad (útil al bloquear manualmente).
 */
export function clearInactivityTimer(): void {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

export function setVaultKey(key: Buffer): void {
  lockVault(); // Bloquea cualquier sesión previa
  activeKey = key;
  resetInactivityTimer(); // Inicia el temporizador al desbloquear
}

export function getVaultKey(): Buffer {
  if (!activeKey) {
    throw new Error("La bóveda está bloqueada.");
  }
  return activeKey;
}

export function isVaultUnlocked(): boolean {
  return activeKey !== null;
}

export function lockVault(): void {
  if (activeKey) {
    activeKey.fill(0);
    activeKey = null;
  }
  clearInactivityTimer(); // Cancela el temporizador al bloquear
}