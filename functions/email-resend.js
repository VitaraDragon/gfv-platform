/**
 * Invio email transazionali via Resend (mittente unico piattaforma).
 * HTML costruito lato server con escape per ridurre rischio XSS.
 */

const { HttpsError } = require("firebase-functions/v2/https");

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_FROM = "Global Farm View <no-reply@globalfarmview.net>";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeHttpsUrl(u) {
  if (!u || typeof u !== "string") return null;
  const t = u.trim();
  if (!/^https:\/\/.+/i.test(t)) return null;
  return t;
}

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Verifica membership tenant attiva e ruolo manager o amministratore (allineato a firestore.rules).
 */
async function assertManagerOrAdminForTenant(db, uid, tenantId) {
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Utente non trovato.");
  }
  const data = snap.data();
  const memberships = data.tenantMemberships || {};
  const m = memberships[tenantId];
  if (m && m.stato === "attivo" && Array.isArray(m.ruoli)) {
    if (m.ruoli.includes("manager") || m.ruoli.includes("amministratore")) {
      return;
    }
  }
  if (data.tenantId === tenantId && Array.isArray(data.ruoli)) {
    if (data.ruoli.includes("manager") || data.ruoli.includes("amministratore")) {
      return;
    }
  }
  throw new HttpsError("permission-denied", "Permessi insufficienti per inviare email per questo tenant.");
}

async function sendWithResend(apiKey, { to, subject, html }) {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      html,
    }),
  });
  let body = {};
  try {
    body = await res.json();
  } catch (e) {
    body = {};
  }
  if (!res.ok) {
    console.error("[sendWithResend]", res.status, body);
    const msg = body && body.message ? String(body.message) : `HTTP ${res.status}`;
    throw new HttpsError("internal", `Invio email non riuscito: ${msg}`);
  }
  return body;
}

function buildPreventivoHtml(p) {
  const logoUrl = safeHttpsUrl(p.logo_url);
  const nomeHeader = escapeHtml(p.nome_azienda || "");
  const nomeFooter = escapeHtml(p.nome_azienda_footer || p.nome_azienda || "");
  const logoBlock = logoUrl
    ? `<div style="margin-bottom:12px;"><img src="${escapeHtml(logoUrl)}" alt="" style="max-height:56px;max-width:200px;" /></div>`
    : "";
  const nomeHeaderBlock = nomeHeader
    ? `<p style="color:white;font-size:22px;font-weight:bold;margin:0;">${nomeHeader}</p>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;">
<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#1976D2 0%,#1565C0 100%);padding:30px;text-align:center;">
    ${logoBlock}
    ${nomeHeaderBlock}
    <h2 style="color:white;margin:15px 0 0 0;font-size:20px;font-weight:normal;">Preventivo Lavoro</h2>
  </div>
  <div style="padding:30px;background:#f8f9fa;">
    <p style="font-size:16px;color:#333;">Gentile <strong>${escapeHtml(p.ragione_sociale || "Cliente")}</strong>,</p>
    <p style="font-size:14px;color:#666;line-height:1.6;">Le inviamo il preventivo per il lavoro richiesto. Di seguito i dettagli:</p>
    <div style="background:white;border-radius:8px;padding:20px;margin:16px 0;box-shadow:0 2px 4px rgba(0,0,0,0.08);">
      <h2 style="color:#1976D2;margin:0 0 16px 0;font-size:20px;">Preventivo ${escapeHtml(p.numero_preventivo || "")}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#666;width:40%;">Tipo Lavoro:</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(p.tipo_lavoro || "")}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Coltura:</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(p.coltura || "")}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Tipo Campo:</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(p.tipo_campo || "")}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Superficie:</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(p.superficie || "")} ha</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Terreno:</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(p.terreno_nome || "")}</td></tr>
      </table>
      <div style="border-top:2px solid #1976D2;padding-top:12px;margin-top:12px;">
        <table style="width:100%;font-size:14px;">
          <tr><td style="padding:6px 0;color:#666;">Totale Imponibile:</td><td style="text-align:right;font-weight:600;">${escapeHtml(p.totale_imponibile || "")}</td></tr>
          <tr><td style="padding:6px 0;color:#666;">IVA (${escapeHtml(String(p.iva_percentuale != null ? p.iva_percentuale : ""))}%):</td><td style="text-align:right;font-weight:600;">${escapeHtml(p.totale_iva || "")}</td></tr>
          <tr style="background:#E3F2FD;"><td style="padding:10px 0;color:#1976D2;font-weight:bold;">TOTALE:</td><td style="text-align:right;color:#1976D2;font-size:18px;font-weight:bold;">${escapeHtml(p.totale_con_iva || "")}</td></tr>
        </table>
      </div>
      <div style="margin-top:12px;padding:12px;background:#f8f9fa;border-left:4px solid #1976D2;font-size:13px;color:#666;">
        <strong>Note:</strong> ${escapeHtml(p.note || "")}
      </div>
      <p style="margin-top:16px;font-size:14px;color:#666;">Scadenza: <strong>${escapeHtml(p.scadenza || "")}</strong></p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(p.link_accettazione || "#")}" style="display:inline-block;background:#28a745;color:white;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;">Accetta preventivo</a>
    </div>
    <p style="font-size:12px;color:#999;text-align:center;">Oppure copia questo link:<br/><a href="${escapeHtml(p.link_accettazione || "#")}" style="color:#1976D2;word-break:break-all;">${escapeHtml(p.link_accettazione || "")}</a></p>
    <div style="text-align:center;margin:20px 0;">
      <a href="${escapeHtml(p.link_rifiuto || "#")}" style="display:inline-block;background:#dc3545;color:white;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;">Rifiuta preventivo</a>
    </div>
  </div>
  <div style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #dee2e6;font-size:12px;color:#666;">
    <p style="margin:0 0 8px 0;font-weight:bold;">${nomeFooter}</p>
    ${p.indirizzo_azienda || p.citta_azienda || p.cap_azienda ? `<p style="margin:4px 0;">${escapeHtml([p.indirizzo_azienda, [p.citta_azienda, p.cap_azienda].filter(Boolean).join(" ")].filter(Boolean).join(", "))}</p>` : ""}
    ${p.telefono_azienda ? `<p style="margin:4px 0;">Tel: ${escapeHtml(p.telefono_azienda)}</p>` : ""}
    ${p.email_azienda ? `<p style="margin:4px 0;">Email: ${escapeHtml(p.email_azienda)}</p>` : ""}
    ${p.piva_azienda ? `<p style="margin:4px 0;">P.IVA: ${escapeHtml(p.piva_azienda)}</p>` : ""}
    <p style="margin:12px 0 0 0;color:#999;font-size:11px;border-top:1px solid #dee2e6;padding-top:10px;">Preventivo generato tramite GFV Platform</p>
  </div>
</div></body></html>`;
}

function buildInviteHtml(p) {
  const logoUrl = safeHttpsUrl(p.logo_url);
  const nomeHeader = escapeHtml(p.nome_azienda || "");
  const nomeFooter = escapeHtml(p.nome_azienda_footer || p.nome_azienda || "");
  const logoBlock = logoUrl
    ? `<div style="margin-bottom:12px;"><img src="${escapeHtml(logoUrl)}" alt="" style="max-height:56px;max-width:200px;" /></div>`
    : "";
  const nomeHeaderBlock = nomeHeader
    ? `<p style="color:white;font-size:22px;font-weight:bold;margin:0;">${nomeHeader}</p>`
    : "";

  const linkLoginSafe = safeHttpsUrl(p.linkLogin);
  const loginSection = linkLoginSafe
    ? `<div style="border-top:1px solid #dee2e6;margin:28px 0 0 0;padding-top:22px;">
    <p style="font-size:13px;color:#666;line-height:1.6;margin:0 0 12px 0;">
      <strong>Hai già completato la registrazione?</strong> Accedi con email e password. Per accettare l’invito e unirti al team usa il pulsante verde <strong>Completa registrazione</strong> sopra — questo link è solo per il login.
    </p>
    <div style="text-align:center;margin:18px 0;">
      <a href="${escapeHtml(linkLoginSafe)}" style="display:inline-block;background:#ffffff;color:#1976D2;border:2px solid #1976D2;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;">Accedi alla piattaforma</a>
    </div>
    <p style="font-size:12px;color:#888;line-height:1.5;margin:0;">Dopo l’accesso puoi aggiungere l’app alla schermata home dal browser (menu ⋮ → Installa app). Su iPhone/iPad: Condividi → Aggiungi alla schermata Home.</p>
  </div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;">
<div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#1976D2 0%,#1565C0 100%);padding:30px;text-align:center;">
    ${logoBlock}
    ${nomeHeaderBlock}
    <h2 style="color:white;margin:15px 0 0 0;font-size:20px;font-weight:normal;">Invito</h2>
  </div>
  <div style="padding:30px;background:#f8f9fa;">
    <p style="font-size:16px;color:#333;">Ciao <strong>${escapeHtml(p.nome || "")} ${escapeHtml(p.cognome || "")}</strong>,</p>
    <p style="font-size:14px;color:#666;line-height:1.6;">Sei stato invitato a unirti alla piattaforma con i seguenti ruoli:</p>
    <p style="font-size:15px;font-weight:600;color:#1976D2;">${escapeHtml(p.ruoli || "")}</p>
    <p style="font-size:14px;color:#666;">Completa la registrazione entro il <strong>${escapeHtml(p.scadeIl || "")}</strong> cliccando il pulsante qui sotto.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${escapeHtml(p.linkRegistrazione || "#")}" style="display:inline-block;background:#28a745;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;">Completa registrazione</a>
    </div>
    <p style="font-size:12px;color:#999;word-break:break-all;">${escapeHtml(p.linkRegistrazione || "")}</p>
    ${loginSection}
  </div>
  <div style="background:#f8f9fa;padding:20px;text-align:center;border-top:1px solid #dee2e6;font-size:12px;color:#666;">
    <p style="margin:0 0 8px 0;font-weight:bold;">${nomeFooter}</p>
    ${p.indirizzo_azienda ? `<p style="margin:4px 0;">${escapeHtml(p.indirizzo_azienda)}</p>` : ""}
    ${p.telefono_azienda ? `<p style="margin:4px 0;">Tel: ${escapeHtml(p.telefono_azienda)}</p>` : ""}
    ${p.email_azienda ? `<p style="margin:4px 0;">Email: ${escapeHtml(p.email_azienda)}</p>` : ""}
    ${p.piva_azienda ? `<p style="margin:4px 0;">P.IVA: ${escapeHtml(p.piva_azienda)}</p>` : ""}
    <p style="margin:12px 0 0 0;color:#999;font-size:11px;border-top:1px solid #dee2e6;padding-top:10px;">Messaggio inviato tramite GFV Platform</p>
  </div>
</div></body></html>`;
}

/**
 * Handler per callable Firebase: invia preventivo o invito.
 */
async function handleSendTransactionalEmail(db, apiKey, request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  if (!apiKey || typeof apiKey !== "string") {
    throw new HttpsError("failed-precondition", "RESEND_API_KEY non configurata sul server.");
  }

  const data = request.data || {};
  const type = data.type;
  const tenantId = data.tenantId;

  await assertManagerOrAdminForTenant(db, request.auth.uid, tenantId);

  if (type === "preventivo") {
    const to = typeof data.to === "string" ? data.to.trim() : "";
    if (!isValidEmail(to)) {
      throw new HttpsError("invalid-argument", "Email destinatario non valida.");
    }
    const subject =
      data.subject ||
      `Preventivo ${data.numero_preventivo || ""} — ${data.nome_azienda || "GFV Platform"}`.trim();
    const html = buildPreventivoHtml(data);
    return sendWithResend(apiKey, { to, subject, html });
  }

  if (type === "invite") {
    const to = typeof data.to === "string" ? data.to.trim() : "";
    if (!isValidEmail(to)) {
      throw new HttpsError("invalid-argument", "Email destinatario non valida.");
    }
    const subject = data.subject || `Invito a registrarti — ${data.nome_azienda || "GFV Platform"}`.trim();
    const html = buildInviteHtml(data);
    return sendWithResend(apiKey, { to, subject, html });
  }

  throw new HttpsError("invalid-argument", "type deve essere 'preventivo' o 'invite'.");
}

module.exports = {
  RESEND_FROM,
  handleSendTransactionalEmail,
};
