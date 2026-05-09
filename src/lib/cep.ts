export const getCepDigits = (value: string) => value.replace(/\D/g, "").slice(0, 8);

export const formatCep = (value: string) => {
  const digits = getCepDigits(value);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};
