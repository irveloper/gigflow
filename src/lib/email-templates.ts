export function verifyEmail(name: string, link: string): { subject: string; html: string } {
  return {
    subject: "Verify your email address",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">Welcome, ${escapeHtml(name)}!</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            Verify email address
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">
          This link expires in 24 hours. If you didn't create an account, you can ignore this email.
        </p>
        <p style="color:#64748b;font-size:13px">Or copy this URL: <br/>${link}</p>
      </div>
    `,
  }
}

export function resetPassword(name: string, link: string): { subject: string; html: string } {
  return {
    subject: "Reset your password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">Password reset request</h2>
        <p>Hi ${escapeHtml(name)}, we received a request to reset your password.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            Reset password
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">
          This link expires in 1 hour and can only be used once. If you didn't request a reset, you can ignore this email.
        </p>
        <p style="color:#64748b;font-size:13px">Or copy this URL: <br/>${link}</p>
      </div>
    `,
  }
}

export function trialExpiringSoon(
  name: string,
  daysLeft: number,
  link: string,
): { subject: string; html: string } {
  return {
    subject: `Your trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">Trial ending soon</h2>
        <p>Hi ${escapeHtml(name)}, your free trial ends in <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong>.</p>
        <p>To keep access to your organization and all your events, add a payment method before your trial ends.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            Add payment method
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">
          Your data is safe and will not be deleted if your trial expires.
        </p>
      </div>
    `,
  }
}

export function musicianInvite(
  name: string,
  orgName: string,
  link: string,
): { subject: string; html: string } {
  return {
    subject: "Te han invitado a Gigflow",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">¡Hola, ${escapeHtml(name)}!</h2>
        <p><strong>${escapeHtml(orgName)}</strong> te ha invitado a acceder al portal de músicos de <strong>Gigflow</strong>.</p>
        <p>Haz clic en el botón para crear tu contraseña y activar tu cuenta:</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            Activar mi cuenta
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">
          Este enlace expira en 72 horas y solo puede usarse una vez.
          Si no esperabas esta invitación, puedes ignorar este correo.
        </p>
        <p style="color:#64748b;font-size:13px">O copia esta URL:<br/>${link}</p>
      </div>
    `,
  }
}

export function inviteConfirmed(name: string, loginLink: string): { subject: string; html: string } {
  return {
    subject: "Tu cuenta en Gigflow está activa",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-top:0">¡Bienvenido, ${escapeHtml(name)}!</h2>
        <p>Tu cuenta ha sido activada correctamente. Ya puedes iniciar sesión en el portal de músicos.</p>
        <p style="margin:24px 0">
          <a href="${loginLink}" style="background:#0f172a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
            Iniciar sesión
          </a>
        </p>
        <p style="color:#64748b;font-size:13px">Si no creaste esta cuenta, contáctanos de inmediato.</p>
      </div>
    `,
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
