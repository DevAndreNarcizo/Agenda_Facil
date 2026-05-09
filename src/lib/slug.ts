export const normalizeSlug = (value: string, fallback = "") => {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || fallback;
};

export const isDuplicateSlugError = (error: unknown) => {
  const err = error as { code?: string; message?: string; details?: string };
  const message = `${err.message || ""} ${err.details || ""}`;

  return err.code === "23505" && message.includes("organizations_slug_key");
};

export const SLUG_UNAVAILABLE_MESSAGE = "Esta URL de agendamento já está em uso. Escolha outra.";
export const SLUG_VALIDATION_MESSAGE = "Não foi possível validar a URL agora. Tente novamente.";

export type OrganizationSlugLookupResult = {
  id: string;
} | null;

export type OrganizationSlugValidationResult =
  | { status: "invalid" }
  | { status: "available" }
  | { status: "unavailable" }
  | { status: "error"; error: unknown };

export const isValidOrganizationSlug = (slug: string) => /^[a-z0-9-]{3,}$/.test(slug);

export const validateOrganizationSlugAvailability = async (
  slug: string,
  findOrganizationBySlug: (slug: string) => Promise<OrganizationSlugLookupResult>,
  currentOrganizationId?: string | null,
): Promise<OrganizationSlugValidationResult> => {
  const normalizedSlug = normalizeSlug(slug);

  if (!isValidOrganizationSlug(normalizedSlug)) {
    return { status: "invalid" };
  }

  try {
    const existingOrganization = await findOrganizationBySlug(normalizedSlug);

    if (existingOrganization && existingOrganization.id !== currentOrganizationId) {
      return { status: "unavailable" };
    }

    return { status: "available" };
  } catch (error) {
    return { status: "error", error };
  }
};
