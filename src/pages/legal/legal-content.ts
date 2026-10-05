/**
 * Conteúdo dos Termos de uso e da Política de privacidade (LGPD, Lei 13.709/2018).
 * Separado do layout para que revisões jurídicas alterem só texto, sem tocar em componentes.
 * Ao mudar o conteúdo, atualize LEGAL_UPDATED_AT.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

export const LEGAL_UPDATED_AT = "5 de outubro de 2026";

/**
 * Canal oficial de contato do controlador/encarregado (LGPD art. 41). Configurável por ambiente
 * para não fixar no código um e-mail que pode mudar.
 */
export const LEGAL_CONTACT_EMAIL: string | undefined = import.meta.env.VITE_LEGAL_CONTACT_EMAIL || undefined;

export type LegalSection = { title: string; paragraphs: string[]; items?: string[] };

export type LegalDocument = { title: string; summary: string; sections: LegalSection[] };

const CONTACT = LEGAL_CONTACT_EMAIL
  ? `pelo e-mail ${LEGAL_CONTACT_EMAIL}`
  : "pelo canal de suporte disponível no painel do AgendaFácil";

export const TERMS: LegalDocument = {
  title: "Termos de uso",
  summary:
    "Regras para usar o AgendaFácil, a plataforma de agendamento on-line para negócios de beleza, estética, cabelo e pet.",
  sections: [
    {
      title: "1. Aceitação",
      paragraphs: [
        "Ao criar uma conta ou usar o AgendaFácil você declara ter lido e aceitado estes Termos e a Política de privacidade. Se usar a plataforma em nome de uma empresa, declara ter poderes para aceitá-los por ela.",
      ],
    },
    {
      title: "2. O serviço",
      paragraphs: [
        "O AgendaFácil oferece agenda on-line, página pública de reservas, cadastro de clientes, serviços e profissionais, lembretes e relatórios. Funcionalidades podem variar conforme o plano contratado e evoluir ao longo do tempo.",
      ],
    },
    {
      title: "3. Conta e segurança",
      paragraphs: [
        "Você deve informar dados verdadeiros e mantê-los atualizados. É responsável pela guarda da sua senha e pelos acessos que conceder a profissionais da sua equipe, que agem em nome do seu negócio.",
        `Avise-nos imediatamente ${CONTACT} se suspeitar de uso não autorizado da conta.`,
      ],
    },
    {
      title: "4. Teste grátis, planos e pagamento",
      paragraphs: [
        "Novas contas recebem 14 dias de teste do plano Pro. Ao final, o uso continua mediante assinatura de um plano pago, cobrado de forma recorrente pelo processador de pagamentos (Stripe).",
        "Você pode cancelar a qualquer momento pelo painel; o acesso permanece até o fim do período já pago. Valores pagos não são reembolsados proporcionalmente, salvo quando exigido pelo Código de Defesa do Consumidor.",
      ],
    },
    {
      title: "5. Uso aceitável",
      paragraphs: ["Não é permitido usar o AgendaFácil para:"],
      items: [
        "enviar mensagens não solicitadas (spam) ou conteúdo ilícito, ofensivo ou enganoso;",
        "cadastrar dados de pessoas sem base legal ou sem informá-las adequadamente;",
        "tentar acessar dados de outras empresas, contornar limites técnicos ou prejudicar a disponibilidade do serviço;",
        "revender ou sublicenciar a plataforma sem autorização.",
      ],
    },
    {
      title: "6. Dados dos seus clientes",
      paragraphs: [
        "Os dados dos clientes que você cadastra ou que agendam pela sua página pertencem ao seu negócio. Nessa relação, você é o controlador e o AgendaFácil atua como operador, tratando esses dados apenas para prestar o serviço, conforme suas instruções e a LGPD.",
        "Cabe a você informar seus clientes sobre o tratamento e atender aos pedidos deles; nós ajudaremos no que depender da plataforma.",
      ],
    },
    {
      title: "7. Disponibilidade",
      paragraphs: [
        "Trabalhamos para manter o serviço disponível continuamente, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. Manutenções programadas serão comunicadas com antecedência sempre que possível.",
      ],
    },
    {
      title: "8. Propriedade intelectual",
      paragraphs: [
        "O software, a marca e o design do AgendaFácil são protegidos por lei. Você mantém os direitos sobre o conteúdo que inserir (logo, fotos, descrições) e nos autoriza a exibi-lo na sua página de reservas.",
      ],
    },
    {
      title: "9. Responsabilidade",
      paragraphs: [
        "O AgendaFácil é uma ferramenta de gestão: a prestação dos serviços agendados, preços, cancelamentos e atendimento aos clientes são de responsabilidade do seu negócio. Não respondemos por lucros cessantes ou danos indiretos decorrentes do uso da plataforma, nos limites permitidos pela lei.",
      ],
    },
    {
      title: "10. Encerramento",
      paragraphs: [
        "Você pode encerrar a conta quando quiser. Podemos suspender ou encerrar contas que violem estes Termos, com aviso prévio quando a violação permitir correção. Após o encerramento, você pode solicitar a exportação dos seus dados em até 30 dias; depois disso eles são excluídos, exceto o que a lei obrigar a guardar.",
      ],
    },
    {
      title: "11. Alterações",
      paragraphs: [
        "Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas no painel ou por e-mail com pelo menos 15 dias de antecedência. O uso continuado após a vigência indica concordância.",
      ],
    },
    {
      title: "12. Lei aplicável",
      paragraphs: [
        "Estes Termos seguem a legislação brasileira. Fica eleito o foro do domicílio do consumidor, quando aplicável, ou o da sede do AgendaFácil nos demais casos.",
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Política de privacidade",
  summary:
    "Como o AgendaFácil coleta, usa, compartilha e protege dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD).",
  sections: [
    {
      title: "1. Quem somos",
      paragraphs: [
        "O AgendaFácil é o controlador dos dados das contas de quem usa o painel (donos e equipes) e operador dos dados dos clientes finais cadastrados por cada negócio.",
      ],
    },
    {
      title: "2. Dados que coletamos",
      paragraphs: ["Coletamos apenas o necessário para o serviço funcionar:"],
      items: [
        "Conta: nome, e-mail, WhatsApp, nome e segmento do negócio, senha (armazenada de forma criptografada) e, se usar login social, identificadores do Google.",
        "Negócio: endereço, horários, serviços, preços, logo e cores da página de reservas.",
        "Clientes do negócio: nome, telefone, e-mail opcional e histórico de agendamentos.",
        "Pagamentos: status da assinatura. Dados de cartão são tratados diretamente pela Stripe e não passam pelos nossos servidores.",
        "Uso técnico: endereço IP, navegador, registros de acesso e erros, para segurança e diagnóstico.",
      ],
    },
    {
      title: "3. Para que usamos e com qual base legal",
      paragraphs: [],
      items: [
        "Prestar o serviço contratado (agenda, reservas, lembretes): execução de contrato (art. 7º, V).",
        "Cobrança e emissão de documentos fiscais: cumprimento de obrigação legal (art. 7º, II).",
        "Segurança, prevenção a fraudes e melhoria do produto: legítimo interesse (art. 7º, IX), sempre com o mínimo de dados.",
        "Comunicações sobre a conta e mudanças nestes documentos: execução de contrato.",
      ],
    },
    {
      title: "4. Com quem compartilhamos",
      paragraphs: [
        "Não vendemos dados pessoais. Compartilhamos somente com fornecedores essenciais, sob contrato e obrigações de confidencialidade:",
      ],
      items: [
        "Supabase: banco de dados, autenticação e hospedagem das funções do servidor.",
        "Stripe: processamento de pagamentos da assinatura.",
        "Provedores de mensagens (Twilio/WhatsApp): envio de lembretes e códigos de acesso.",
        "Google: apenas se você optar por entrar com sua conta Google.",
        "Autoridades: quando exigido por lei ou ordem judicial.",
      ],
    },
    {
      title: "5. Transferência internacional",
      paragraphs: [
        "Alguns fornecedores processam dados fora do Brasil. Nesses casos adotamos as salvaguardas previstas no art. 33 da LGPD, como cláusulas contratuais de proteção de dados.",
      ],
    },
    {
      title: "6. Por quanto tempo guardamos",
      paragraphs: [
        "Mantemos os dados enquanto a conta estiver ativa. Após o encerramento, excluímos ou anonimizamos em até 30 dias, exceto registros que a lei exige guardar (por exemplo, dados fiscais por 5 anos e registros de acesso por 6 meses, conforme o Marco Civil da Internet).",
      ],
    },
    {
      title: "7. Seus direitos",
      paragraphs: [`Você pode, a qualquer momento e gratuitamente, solicitar ${CONTACT}:`],
      items: [
        "confirmação e acesso aos seus dados;",
        "correção de dados incompletos ou desatualizados;",
        "anonimização, bloqueio ou eliminação de dados desnecessários;",
        "portabilidade e informação sobre compartilhamentos;",
        "revisão de decisões automatizadas e revogação de consentimentos.",
      ],
    },
    {
      title: "8. Clientes dos negócios",
      paragraphs: [
        "Se você agendou em um estabelecimento que usa o AgendaFácil, o responsável pelos seus dados é esse estabelecimento. Encaminhe pedidos a ele; se não obtiver resposta, fale conosco e ajudaremos a direcioná-lo.",
      ],
    },
    {
      title: "9. Segurança",
      paragraphs: [
        "Usamos conexão criptografada (HTTPS), senhas com hash, isolamento de dados por empresa no banco (Row Level Security), controle de acesso por papel e monitoramento de acessos. Em caso de incidente relevante, comunicaremos os afetados e a ANPD conforme a lei.",
      ],
    },
    {
      title: "10. Cookies e armazenamento local",
      paragraphs: [
        "Usamos apenas armazenamento essencial no navegador: a sessão de login (que some ao fechar o navegador se você desmarcar \"Manter conectado\") e preferências como o tema claro/escuro. Não usamos cookies de publicidade.",
      ],
    },
    {
      title: "11. Alterações e contato",
      paragraphs: [
        `Esta política pode ser atualizada; a data no topo indica a versão vigente e mudanças relevantes serão avisadas no painel. Dúvidas ou pedidos sobre privacidade podem ser enviados ${CONTACT}.`,
      ],
    },
  ],
};
