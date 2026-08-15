import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createPublicBooking,
  getPublicAvailableSlots,
  getPublicBookingContext,
  type PublicBookingContext,
  type PublicBookingService,
} from '@/lib/public-booking-api';
import { resolveBookingSource } from '@/lib/public-booking-source';
import { getPortalSession } from '@/lib/portal-api';
import { toast } from 'sonner';

/**
 * Converte um slot ISO em horário brasileiro para a primeira versão do portal público.
 *
 * @author André Narcizo
 */
function formatSlotTime(slot: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(slot));
}

/**
 * Exibe o fluxo público de reserva, sem receber organização diretamente do visitante.
 *
 * @author André Narcizo
 */
export default function PublicBookingPage() {
  const { slug = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const source = useMemo(() => resolveBookingSource(location.search), [location.search]);
  const [context, setContext] = useState<PublicBookingContext | null>(null);
  const [selectedService, setSelectedService] = useState<PublicBookingService | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    /**
     * Busca somente os dados autorizados para o slug da rota.
     *
     * @author André Narcizo
     */
    const loadContext = async (): Promise<void> => {
      try {
        const response = await getPublicBookingContext(slug);
        if (!active) return;
        setContext(response);
        if (response.employees.length === 1) setEmployeeId(response.employees[0].id);
      } catch {
        if (active) setContext(null);
      } finally {
        if (active) setIsLoadingContext(false);
      }
    };

    void loadContext();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    const needsEmployee = (context?.employees.length ?? 0) > 0;
    if (!selectedService || !date || (needsEmployee && !employeeId)) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    /**
     * Atualiza slots que foram calculados no servidor para a combinação atual.
     *
     * @author André Narcizo
     */
    const loadSlots = async (): Promise<void> => {
      setIsLoadingSlots(true);
      setSelectedSlot(null);
      try {
        const response = await getPublicAvailableSlots({ date, employeeId, serviceId: selectedService.id, slug });
        if (active) setSlots(response);
      } catch {
        if (active) {
          setSlots([]);
          toast.error('Não foi possível consultar os horários disponíveis.');
        }
      } finally {
        if (active) setIsLoadingSlots(false);
      }
    };

    void loadSlots();
    return () => {
      active = false;
    };
  }, [context?.employees.length, date, employeeId, selectedService, slug]);

  /**
   * Redireciona para o OTP preservando exclusivamente a rota pública solicitada.
   *
   * @author André Narcizo
   */
  const redirectToPortalLogin = (): void => {
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`/portal/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  /**
   * Confirma a reserva apenas depois de validar a sessão opaca atual.
   *
   * @author André Narcizo
   */
  const handleBooking = async (): Promise<void> => {
    if (!selectedService || !selectedSlot) return;

    setIsSubmitting(true);
    try {
      await getPortalSession();
      await createPublicBooking({
        employeeId,
        serviceId: selectedService.id,
        slug,
        source,
        startTime: selectedSlot,
      });
      toast.success('Reserva solicitada com sucesso.');
      setSelectedSlot(null);
      setSlots([]);
    } catch (error: unknown) {
      const status = error && typeof error === 'object' && 'status' in error
        ? (error as { status?: unknown }).status
        : undefined;
      if (status === 401) {
        redirectToPortalLogin();
      } else if (status === 409) {
        toast.error('Esse horário acabou de ficar indisponível. Escolha outro.');
        setSelectedSlot(null);
      } else {
        toast.error('Não foi possível concluir a reserva. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingContext) {
    return <main className="min-h-screen grid place-items-center bg-stitch-surface"><span className="text-sm font-bold">Carregando reserva...</span></main>;
  }

  if (!context) {
    return (
      <main className="min-h-screen grid place-items-center bg-stitch-surface p-6 text-center">
        <section className="max-w-md space-y-4">
          <h1 className="font-headline text-3xl font-black">Reserva indisponível</h1>
          <p className="text-stitch-on-surface-variant">Confira o link recebido ou entre em contato com o estabelecimento.</p>
        </section>
      </main>
    );
  }

  const minDate = format(new Date(), 'yyyy-MM-dd');
  const requiresEmployee = context.employees.length > 0;

  return (
    <main className="min-h-screen bg-stitch-surface py-8 px-4 text-stitch-on-surface">
      <section className="mx-auto max-w-2xl space-y-8">
        <header className="rounded-[2rem] bg-white p-7 shadow-xl shadow-stitch-primary/5">
          <p className="text-xs font-black uppercase tracking-widest text-stitch-primary">Reserva online</p>
          <h1 className="mt-2 font-headline text-3xl font-black">{context.organization.name}</h1>
          <p className="mt-2 text-stitch-on-surface-variant">Escolha um serviço e um horário disponível.</p>
        </header>

        <section className="space-y-6 rounded-[2rem] bg-white p-7 shadow-xl shadow-stitch-primary/5">
          <div className="space-y-3">
            <Label htmlFor="public-service">Serviço</Label>
            <select
              id="public-service"
              className="h-12 w-full rounded-xl border border-stitch-outline-variant/30 bg-white px-3 font-medium"
              value={selectedService?.id ?? ''}
              onChange={(event) => setSelectedService(context.services.find((service) => service.id === event.target.value) ?? null)}
            >
              <option value="">Selecione um serviço</option>
              {context.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.durationMinutes} min · R$ {service.price.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {requiresEmployee && (
            <div className="space-y-3">
              <Label htmlFor="public-employee">Profissional</Label>
              <select
                id="public-employee"
                className="h-12 w-full rounded-xl border border-stitch-outline-variant/30 bg-white px-3 font-medium"
                value={employeeId ?? ''}
                onChange={(event) => setEmployeeId(event.target.value || null)}
              >
                <option value="">Selecione um profissional</option>
                {context.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="public-date">Data</Label>
            <Input id="public-date" type="date" min={minDate} value={date} onChange={(event) => setDate(event.target.value)} />
          </div>

          <div className="space-y-3">
            <Label>Horários disponíveis</Label>
            {isLoadingSlots && <p className="text-sm text-stitch-on-surface-variant">Consultando disponibilidade...</p>}
            {!isLoadingSlots && date && slots.length === 0 && <p className="text-sm text-stitch-on-surface-variant">Nenhum horário disponível para esta combinação.</p>}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {slots.map((slot) => (
                <Button
                  key={slot}
                  type="button"
                  variant={selectedSlot === slot ? 'default' : 'outline'}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {formatSlotTime(slot)}
                </Button>
              ))}
            </div>
          </div>

          <Button className="w-full" disabled={!selectedSlot || isSubmitting} onClick={() => void handleBooking()}>
            {isSubmitting ? 'Confirmando...' : 'Continuar para reservar'}
          </Button>
          <p className="text-center text-xs text-stitch-on-surface-variant">Você confirmará sua identidade pelo Portal do Cliente antes da reserva.</p>
        </section>
      </section>
    </main>
  );
}
