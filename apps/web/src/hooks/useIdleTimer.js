/**
 * useIdleTimer — detecta inactividad del usuario y ejecuta callback después de timeoutMs.
 * También expone estado para mostrar un aviso 2 minutos antes del timeout.
 *
 * Eventos monitoreados: mousemove, keydown, click, scroll, touchstart
 * El countdown se actualiza cada segundo una vez activo el aviso.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
const WARN_BEFORE_MS = 2 * 60 * 1000; // Mostrar aviso 2 minutos antes
export function useIdleTimer(timeoutMs, onIdle) {
    const timerRef = useRef(null);
    const warnTimerRef = useRef(null);
    const countdownRef = useRef(null);
    const startTimeRef = useRef(0);
    const [isWarning, setIsWarning] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const clearAll = useCallback(() => {
        if (timerRef.current)
            clearTimeout(timerRef.current);
        if (warnTimerRef.current)
            clearTimeout(warnTimerRef.current);
        if (countdownRef.current)
            clearInterval(countdownRef.current);
    }, []);
    const startCountdown = useCallback(() => {
        setIsWarning(true);
        const endTime = startTimeRef.current + timeoutMs;
        if (countdownRef.current)
            clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setSecondsRemaining(remaining);
            if (remaining <= 0) {
                if (countdownRef.current)
                    clearInterval(countdownRef.current);
            }
        }, 1000);
    }, [timeoutMs]);
    const resetTimer = useCallback(() => {
        clearAll();
        setIsWarning(false);
        setSecondsRemaining(0);
        startTimeRef.current = Date.now();
        // Programar aviso
        const warnDelay = timeoutMs - WARN_BEFORE_MS;
        if (warnDelay > 0) {
            warnTimerRef.current = setTimeout(() => {
                startCountdown();
            }, warnDelay);
        }
        else {
            // Si el timeout total es menor al tiempo de aviso, mostrar aviso inmediatamente
            startCountdown();
        }
        // Programar logout
        timerRef.current = setTimeout(() => {
            clearAll();
            setIsWarning(false);
            onIdle();
        }, timeoutMs);
    }, [timeoutMs, onIdle, clearAll, startCountdown]);
    useEffect(() => {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        const handleActivity = () => {
            resetTimer();
        };
        events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
        // Iniciar el timer al montar
        resetTimer();
        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            clearAll();
        };
    }, [resetTimer, clearAll]);
    return { isWarning, secondsRemaining, resetTimer };
}
