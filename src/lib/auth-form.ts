/**
 * Regras puras dos formulários de autenticação (força de senha, slug e mensagens de erro).
 * Ficam fora dos componentes para serem testadas sem DOM nem Supabase.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export const PASSWORD_STRENGTH_LABEL: Record<PasswordStrength, string> = {
  0: "Mínimo de 8 caracteres",
  1: "Senha fraca",
  2: "Senha razoável",
  3: "Senha boa",
  4: "Senha forte",
};

/**
 * Pontua a senha de 0 a 4: comprimento mínimo é pré-requisito; cada critério extra
 * (12+ caracteres, maiúsculas e minúsculas, dígito, símbolo) soma um ponto, limitado a 4.
 * É só um indicador visual; a política efetiva é a do Supabase Auth.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) return 0;
  const criteria = [
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  return Math.min(4, 1 + criteria) as PasswordStrength;
}

/**
 * Converte o nome do negócio no slug da página de reserva (/reservar/:slug).
 * Mesma regra da Edge Function complete-onboarding, para o resultado ser previsível.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Traduz os erros conhecidos do Supabase Auth para mensagens acionáveis em português.
 * Mensagens desconhecidas viram um texto genérico para não vazar detalhes internos.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function describeAuthError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  const rules: [RegExp, string][] = [
    [/invalid login credentials/i, "E-mail ou senha incorretos."],
    [/email not confirmed/i, "Confirme seu e-mail antes de entrar. O link foi enviado no cadastro."],
    [/user already registered|already been registered/i, "Já existe uma conta com esse e-mail. Entre ou recupere a senha."],
    // O trigger handle_new_user cria a organização; a falha típica é slug duplicado.
    [/database error saving new user/i, "Esse link de reserva já está em uso. Escolha outro."],
    [/password should be at least|weak password/i, "Senha fraca. Use ao menos 8 caracteres, misturando letras e números."],
    [/rate limit|too many requests|security purposes/i, "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."],
    [/failed to fetch|network/i, "Sem conexão com o servidor. Verifique sua internet."],
    [/provider is not enabled|unsupported provider/i, "Esse método de acesso ainda não está disponível. Use e-mail e senha."],
    [/unsupported phone provider|phone.*(not enabled|disabled)/i, "Login por WhatsApp ainda não está disponível. Use e-mail e senha."],
    [/token has expired or is invalid|otp.*(expired|invalid)/i, "Código inválido ou expirado. Peça um novo código."],
    [/invalid phone|phone number.*invalid/i, "Número de WhatsApp inválido. Confira o DDD."],
  ];
  return rules.find(([pattern]) => pattern.test(message))?.[1] ?? fallback;
}

export type BusinessSegment = "estetica" | "beleza" | "cabelo" | "pet";

/** Segmentos aceitos pelo banco (CHECK em organization_settings.segment), na ordem do protótipo. */
export const BUSINESS_SEGMENTS: { value: BusinessSegment; label: string; icon: string }[] = [
  { value: "estetica", label: "Estética", icon: "spa" },
  { value: "beleza", label: "Beleza", icon: "auto_awesome" },
  { value: "cabelo", label: "Cabelo", icon: "content_cut" },
  { value: "pet", label: "Pet", icon: "pets" },
];

/**
 * Mantém só os dígitos de um telefone brasileiro (DDD + número), no máximo 11.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/**
 * Aplica a máscara (11) 91234-5678 / (11) 1234-5678 progressivamente, enquanto o usuário digita.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function formatBrPhone(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  // Celular (9 dígitos) quebra em 5+4; fixo (8 dígitos) em 4+4.
  const split = rest.length > 8 ? 5 : 4;
  return rest.length > split ? `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}` : `(${ddd}) ${rest}`;
}

/**
 * Converte o telefone digitado para E.164 (+55...), formato exigido pelo Supabase Auth no login por telefone.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function toE164Br(value: string): string {
  return `+55${phoneDigits(value)}`;
}

export type AuthProviders = { google: boolean; whatsapp: boolean };

/**
 * Lê a resposta de GET /auth/v1/settings e diz quais métodos extras exibir.
 * WhatsApp exige login por telefone ativo com provedor Twilio (único com canal WhatsApp).
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
export function parseAuthProviders(settings: unknown): AuthProviders {
  const data = (settings ?? {}) as { external?: Record<string, unknown>; sms_provider?: unknown };
  const external = data.external ?? {};
  const smsProvider = typeof data.sms_provider === "string" ? data.sms_provider : "";
  return {
    google: external.google === true,
    whatsapp: external.phone === true && smsProvider.startsWith("twilio"),
  };
}
