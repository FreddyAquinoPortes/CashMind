/**
 * IdleWarning — modal que aparece cuando el usuario está inactivo
 * y le quedan menos de 2 minutos para el logout automático.
 */
import { Clock } from 'lucide-react'

interface IdleWarningProps {
  secondsRemaining: number
  onContinue: () => void
  onLogout: () => void
}

export function IdleWarning({ secondsRemaining, onContinue, onLogout }: IdleWarningProps) {
  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warning/10 border border-warning/20 mx-auto mb-4">
          <Clock size={24} className="text-warning" />
        </div>

        <h2 className="text-lg font-semibold text-text-primary text-center mb-2">
          ¿Sigues ahí?
        </h2>
        <p className="text-sm text-text-muted text-center mb-4">
          Tu sesión cerrará automáticamente por inactividad.
        </p>

        {/* Countdown */}
        <div className="bg-background border border-border rounded-lg py-3 text-center mb-5">
          <span className="text-2xl font-bold tabular-nums text-text-primary">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-text-secondary border border-border hover:border-danger/50 hover:text-danger transition-colors"
          >
            Cerrar sesión
          </button>
          <button
            onClick={onContinue}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
          >
            Seguir usando
          </button>
        </div>
      </div>
    </div>
  )
}
