type PublicBookingQrCodeProps = {
  size?: number;
  value: string;
};

/**
 * Cria a URL da imagem QR a partir do link público, sem incluir dados de clientes.
 *
 * @author André Narcizo
 */
function createPublicBookingQrCodeUrl(value: string): string {
  const params = new URLSearchParams({
    data: value,
    ecc: 'M',
    format: 'svg',
    margin: '0',
    size: '256x256',
  });

  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

/**
 * Exibe um QR Code escaneável para um link de reserva já público.
 *
 * @author André Narcizo
 */
export function PublicBookingQrCode({ size = 208, value }: PublicBookingQrCodeProps) {
  return (
    <img
      alt="QR Code para abrir a página de reserva online"
      className="rounded-[10px] border border-af-line bg-white p-1.5"
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      src={createPublicBookingQrCodeUrl(value)}
      width={size}
    />
  );
}
