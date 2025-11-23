# Script PowerShell para deploy da Edge Function send-whatsapp no Supabase
# Execute este script após configurar as credenciais do Twilio

Write-Host "🚀 Deploy da Edge Function: send-whatsapp" -ForegroundColor Cyan
Write-Host ""

# Verificar se Supabase CLI está instalado
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Supabase CLI não encontrado" -ForegroundColor Red
    Write-Host "Instale com: npm install -g supabase"
    exit 1
}

Write-Host "✅ Supabase CLI encontrado" -ForegroundColor Green
Write-Host ""

# Verificar se está logado
Write-Host "Verificando autenticação..."
$projectsList = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Não autenticado no Supabase" -ForegroundColor Red
    Write-Host "Execute: supabase login"
    exit 1
}

Write-Host "✅ Autenticado" -ForegroundColor Green
Write-Host ""

# Solicitar credenciais do Twilio
Write-Host "📝 Configure as credenciais do Twilio:" -ForegroundColor Yellow
Write-Host ""

$ACCOUNT_SID = Read-Host "TWILIO_ACCOUNT_SID"
$AUTH_TOKEN = Read-Host "TWILIO_AUTH_TOKEN"
$WHATSAPP_FROM = Read-Host "TWILIO_WHATSAPP_FROM (ex: whatsapp:+14155238886)"

Write-Host ""
Write-Host "Configurando secrets..."

# Configurar secrets
supabase secrets set "TWILIO_ACCOUNT_SID=$ACCOUNT_SID"
supabase secrets set "TWILIO_AUTH_TOKEN=$AUTH_TOKEN"
supabase secrets set "TWILIO_WHATSAPP_FROM=$WHATSAPP_FROM"

Write-Host ""
Write-Host "✅ Secrets configurados" -ForegroundColor Green
Write-Host ""

# Deploy da função
Write-Host "Fazendo deploy da Edge Function..."
supabase functions deploy send-whatsapp

Write-Host ""
Write-Host "✅ Deploy concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Teste a função acessando /portal/login" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para ver logs em tempo real:"
Write-Host "  supabase functions logs send-whatsapp --follow" -ForegroundColor Gray
