/**
 * Email Service — CashMind
 * Usa nodemailer con SMTP para enviar correos transaccionales.
 * Si SMTP no está configurado, cae en modo consola (desarrollo).
 */
import nodemailer from 'nodemailer'

function createTransporter() {
  const host = process.env['SMTP_HOST']
  const port = Number(process.env['SMTP_PORT'] ?? 587)
  const user = process.env['SMTP_USER']
  const pass = process.env['SMTP_PASS']

  if (!host || !user || !pass) {
    // Modo dev: sin transporter real
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

const FROM = process.env['SMTP_FROM'] ?? 'CashMind <noreply@cashmind.getwavely.online>'
const APP_URL = process.env['APP_URL'] ?? 'http://localhost:5173'

/**
 * Envía un código de verificación de 6 dígitos por email.
 * Si SMTP no está configurado, imprime el código en consola (modo dev).
 */
export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const transporter = createTransporter()

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="background:#0f1117;margin:0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#1a1d27;border:1px solid #2a2d3e;border-radius:16px;overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
      <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <span style="font-size:28px;">💲</span>
      </div>
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">CashMind</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Verificación de correo electrónico</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="color:#a0a3b1;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Usa el siguiente código para verificar tu cuenta de CashMind. Expira en <strong style="color:#e2e4ed;">10 minutos</strong>.
      </p>

      <!-- Code box -->
      <div style="background:#0f1117;border:2px solid #6366f1;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
        <p style="color:#a0a3b1;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Tu código</p>
        <p style="color:#fff;font-size:40px;font-weight:800;letter-spacing:12px;margin:0;font-variant-numeric:tabular-nums;">${code}</p>
      </div>

      <p style="color:#6b6f82;font-size:13px;margin:0 0 8px;">
        Si no creaste una cuenta en CashMind, ignora este correo.
      </p>
      <p style="color:#6b6f82;font-size:13px;margin:0;">
        Por seguridad, nunca compartas este código con nadie.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #2a2d3e;padding:20px 32px;text-align:center;">
      <a href="${APP_URL}" style="color:#6366f1;font-size:13px;text-decoration:none;">${APP_URL}</a>
    </div>
  </div>
</body>
</html>
  `.trim()

  if (!transporter) {
    // Fallback de desarrollo: mostrar código en consola
    console.log('\n╔══════════════════════════════════════╗')
    console.log('║  [DEV] Código de verificación de email  ║')
    console.log(`║  Para: ${email.padEnd(30)} ║`)
    console.log(`║  Código: ${code.padEnd(28)} ║`)
    console.log('╚══════════════════════════════════════╝\n')
    return
  }

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `${code} — Tu código de verificación de CashMind`,
    html,
    text: `Tu código de verificación de CashMind es: ${code}\nExpira en 10 minutos.`,
  })
}

/**
 * Envía notificación de nueva sesión iniciada.
 * Solo disponible cuando SMTP está configurado.
 */
export async function sendNewSessionAlert(email: string, ip: string, dispositivo: string): Promise<void> {
  const transporter = createTransporter()
  if (!transporter) return

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'CashMind — Nueva sesión iniciada',
    text: `Se inició sesión en tu cuenta desde IP ${ip} con dispositivo: ${dispositivo}.\nSi no fuiste tú, cambia tu contraseña inmediatamente.`,
    html: `<p>Se inició sesión en tu cuenta desde IP <strong>${ip}</strong> con dispositivo: <strong>${dispositivo}</strong>.</p><p>Si no fuiste tú, cambia tu contraseña inmediatamente.</p>`,
  })
}
