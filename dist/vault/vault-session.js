"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetInactivityTimer = resetInactivityTimer;
exports.clearInactivityTimer = clearInactivityTimer;
exports.setVaultKey = setVaultKey;
exports.getVaultKey = getVaultKey;
exports.isVaultUnlocked = isVaultUnlocked;
exports.lockVault = lockVault;
let activeKey = null;
let inactivityTimer = null;
// Tiempo de inactividad antes de bloquear automáticamente (5 minutos)
const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000;
/**
 * Reinicia el temporizador de inactividad.
 * Debe llamarse cada vez que se hace una operación autenticada.
 */
function resetInactivityTimer() {
    // Si no hay bóveda desbloqueada, no hay nada que reiniciar
    if (!activeKey)
        return;
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
function clearInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
}
function setVaultKey(key) {
    lockVault(); // Bloquea cualquier sesión previa
    activeKey = key;
    resetInactivityTimer(); // Inicia el temporizador al desbloquear
}
function getVaultKey() {
    if (!activeKey) {
        throw new Error("La bóveda está bloqueada.");
    }
    return activeKey;
}
function isVaultUnlocked() {
    return activeKey !== null;
}
function lockVault() {
    if (activeKey) {
        activeKey.fill(0);
        activeKey = null;
    }
    clearInactivityTimer(); // Cancela el temporizador al bloquear
}
