import { create } from 'zustand';
import { persist } from 'zustand/middleware';
const DEFAULTS = {
    precisionDecimal: 'siempre',
    mostrarSimbolo: true,
    monedaVista: 'DOP',
    formatoFecha: 'dd/mm/yyyy',
    filasPorPagina: 25,
    animacionesGraficos: true,
    mostrarSaldoOculto: false,
};
export const usePreferenciasStore = create()(persist(set => ({
    ...DEFAULTS,
    set: (key, value) => set(state => ({ ...state, [key]: value })),
    reset: () => set(state => ({ ...state, ...DEFAULTS })),
}), { name: 'cashmind-preferencias' }));
