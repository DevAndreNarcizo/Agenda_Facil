#!/bin/bash

# Script para deploy da Edge Function send-whatsapp no Supabase
# Execute este script após configurar as credenciais do Twilio

echo "🚀 Deploy da Edge Function: send-whatsapp"
echo ""

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado"
    echo "Instale com: npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI encontrado"
echo ""

# Verificar se está logado
echo "Verificando autenticação..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Não autenticado no Supabase"
    echo "Execute: supabase login"
    exit 1
fi

echo "✅ Autenticado"
echo ""

# Solicitar credenciais do Twilio
echo "📝 Configure as credenciais do Twilio:"
echo ""

read -p "TWILIO_ACCOUNT_SID: " ACCOUNT_SID
read -p "TWILIO_AUTH_TOKEN: " AUTH_TOKEN
read -p "TWILIO_WHATSAPP_FROM (ex: whatsapp:+14155238886): " WHATSAPP_FROM

echo ""
echo "Configurando secrets..."

# Configurar secrets
supabase secrets set TWILIO_ACCOUNT_SID="$ACCOUNT_SID"
supabase secrets set TWILIO_AUTH_TOKEN="$AUTH_TOKEN"
supabase secrets set TWILIO_WHATSAPP_FROM="$WHATSAPP_FROM"

echo ""
echo "✅ Secrets configurados"
echo ""

# Deploy da função
echo "Fazendo deploy da Edge Function..."
supabase functions deploy send-whatsapp

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📱 Teste a função acessando /portal/login"
echo ""
echo "Para ver logs em tempo real:"
echo "  supabase functions logs send-whatsapp --follow"
