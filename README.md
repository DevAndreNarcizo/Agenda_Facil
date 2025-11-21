# Agenda Fácil - Sistema de Gestão e Agendamento Inteligente

> "A organização é o primeiro passo para a excelência operacional."

## 📖 Sobre o Projeto

O **Agenda Fácil** é uma solução SaaS (Software as a Service) robusta desenvolvida para modernizar e simplificar a gestão de agendamentos para pequenas e médias empresas (barbearias, clínicas, salões de beleza, consultórios).

Este projeto transcende uma simples agenda digital; ele atua como um painel de controle operacional, oferecendo aos gestores uma visão clara, orientada a dados e em tempo real sobre o desempenho do seu negócio. O objetivo é eliminar o atrito dos processos manuais (papel e caneta), centralizar o cadastro de clientes e funcionários, e fornecer métricas financeiras automáticas.

### 🎯 Objetivos Principais

- **Centralização Operacional:** Unificar gestão de clientes, colaboradores e serviços em um único ambiente seguro.
- **Visão Estratégica:** Prover dashboards com indicadores de performance (KPIs) como receita mensal, volume de agendamentos e taxa de conclusão.
- **Segurança e Privacidade:** Utilização de RLS (Row Level Security) para garantir que cada organização acesse estritamente seus próprios dados.
- **Experiência de Usuário (UX):** Interface limpa, responsiva e intuitiva, focada na produtividade do dia a dia.

---

## 🚀 Stack Tecnológica

O projeto foi construído sobre pilares de desenvolvimento moderno, garantindo performance, tipagem estática e escalabilidade.

### Frontend

- **Core:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) (Performance extrema de build e runtime).
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/) (Segurança de tipos e robustez no código).
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/) (Utility-first framework) + [Shadcn/ui](https://ui.shadcn.com/) (Componentes acessíveis e customizáveis).
- **Gerenciamento de Estado & Dados:** Hooks customizados (`useAppointments`, `useDashboardStats`).
- **Roteamento:** [React Router DOM](https://reactrouter.com/).
- **Visualização de Dados:** [Recharts](https://recharts.org/) (Gráficos responsivos) e [React Big Calendar](https://github.com/jquense/react-big-calendar).
- **Formulários & Validação:** [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/).

### Backend as a Service (BaaS)

- **Supabase:**
  - **Database:** PostgreSQL.
  - **Authentication:** Gestão completa de usuários e sessões.
  - **Realtime:** Atualizações de agendamentos em tempo real via WebSockets.
  - **Security:** Políticas de segurança a nível de linha (RLS).

---

## 🛠️ Funcionalidades Detalhadas

### 1. 📊 Dashboard Executivo

Uma visão macro do negócio assim que o usuário faz login.

- **Stats Cards:** Indicadores imediatos de agendamentos do dia, total do mês, receita acumulada e taxa de sucesso.
- **Gráficos:** Análise visual da distribuição de agendamentos nos últimos 7 dias e curva de receita.
- **Agendamentos Recentes:** Lista rápida dos próximos compromissos para ação imediata.

### 2. 📅 Gestão de Agenda (Calendário)

- Visualização completa (Mês, Semana, Dia) dos compromissos.
- Identificação visual por cores baseada no status (Pendente, Confirmado, Concluído, Cancelado).
- Interatividade para visualizar detalhes de cada slot de tempo.

### 3. 👥 Gestão de Stakeholders

- **Clientes:** Base de dados completa com histórico, contatos e busca rápida.
- **Colaboradores:** Controle de acesso e cadastro de equipe (com suporte a perfis de Administrador e Funcionário).

### 4. ⚙️ Configurações da Organização

- **Perfil da Empresa:** Gerenciamento de dados institucionais e "Slug" para links personalizados.
- **Catálogo de Serviços:** Cadastro dinâmico de serviços oferecidos, com definição de preço e duração (impactando diretamente na lógica da agenda).

---

## 🗄️ Estrutura do Banco de Dados (Supabase)

O sistema utiliza um modelo relacional robusto no PostgreSQL:

- **`organizations` / `companies`**: Entidade raiz. Todos os dados são segregados por este ID.
- **`profiles`**: Extensão da tabela de auth do Supabase, vinculando usuários às organizações e definindo roles (`admin`, `employee`).
- **`services`**: Catálogo de serviços vinculados à organização.
- **`customers`**: Clientes finais da organização.
- **`appointments`**: A tabela central que conecta _Cliente_, _Serviço_ e _Organização_, contendo data, hora e status.

---

## 👣 Guia de Instalação e Execução

Siga os passos abaixo para executar o ambiente de desenvolvimento localmente.

### Pré-requisitos

- Node.js (Versão LTS recomendada, v18+)
- Gerenciador de pacotes (NPM ou Yarn)

### Passo a Passo

1.  **Clone o repositório:**

    ```bash
    git clone [https://github.com/seu-usuario/agenda-facil.git](https://github.com/seu-usuario/agenda-facil.git)
    cd agenda-facil
    ```

2.  **Instale as dependências:**

    ```bash
    npm install
    ```

3.  **Configuração de Variáveis de Ambiente:**
    Crie um arquivo `.env` na raiz do projeto baseando-se nas chaves do seu projeto Supabase:

    ```env
    VITE_SUPABASE_URL=sua_url_do_supabase
    VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
    ```

4.  **Execute o projeto:**

    ```bash
    npm run dev
    ```

5.  **Acesse:**
    Abra o navegador em `http://localhost:5173` (ou a porta indicada no terminal).

---

## 🔮 Visão de Futuro (Roadmap)

Como todo software vivo, o Agenda Fácil tem um caminho de evolução traçado:

1.  **Agendamento Público:** Permitir que o cliente final agende seu próprio horário através de um link público (baseado no `orgSlug`).
2.  **Notificações Automatizadas:** Integração com WhatsApp/Email para lembretes de consulta (redução de _no-show_).
3.  **Gestão Financeira Avançada:** Controle de despesas e comissões de funcionários.
4.  **App Mobile:** Desenvolvimento de versão React Native para gestão na palma da mão.

---

## 📄 Licença

Este projeto é proprietário e desenvolvido para fins de portfólio e comercialização SaaS.

---

**Desenvolvido por André Narcizo com 💙 e código limpo.**
