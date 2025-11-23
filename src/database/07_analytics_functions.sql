-- Analytics Functions for Advanced Reports

-- Faturamento Mensal (últimos 6 meses)
CREATE OR REPLACE FUNCTION get_monthly_revenue(org_id UUID)
RETURNS TABLE (
  month TEXT,
  revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(a.start_time, 'YYYY-MM') as month,
    COALESCE(SUM(s.price), 0)::NUMERIC as revenue
  FROM appointments a
  JOIN services s ON a.service_id = s.id
  WHERE a.organization_id = org_id
    AND a.status = 'completed'
    AND a.start_time >= NOW() - INTERVAL '6 months'
  GROUP BY TO_CHAR(a.start_time, 'YYYY-MM')
  ORDER BY month DESC;
END;
$$;

-- Serviços Mais Vendidos
-- Primeiro, remover a função antiga se existir
DROP FUNCTION IF EXISTS get_top_services(UUID);

CREATE OR REPLACE FUNCTION get_top_services(org_id UUID)
RETURNS TABLE (
  service_name TEXT,
  count BIGINT,
  revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.name as service_name,
    COUNT(*)::BIGINT as count,
    SUM(s.price)::NUMERIC as revenue
  FROM appointments a
  JOIN services s ON a.service_id = s.id
  WHERE a.organization_id = org_id
    AND a.status IN ('completed', 'confirmed')
  GROUP BY s.name
  ORDER BY count DESC
  LIMIT 5;
END;
$$;

-- Horários de Pico
CREATE OR REPLACE FUNCTION get_peak_hours(org_id UUID)
RETURNS TABLE (
  hour TEXT,
  appointments BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(start_time, 'HH24:00') as hour,
    COUNT(*)::BIGINT as appointments
  FROM appointments
  WHERE organization_id = org_id
    AND status IN ('completed', 'confirmed')
  GROUP BY TO_CHAR(start_time, 'HH24:00')
  ORDER BY hour;
END;
$$;

-- Estatísticas Gerais
CREATE OR REPLACE FUNCTION get_dashboard_stats(org_id UUID)
RETURNS TABLE (
  total_appointments BIGINT,
  total_customers BIGINT,
  total_revenue NUMERIC,
  avg_ticket NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM appointments WHERE organization_id = org_id AND status = 'completed')::BIGINT,
    (SELECT COUNT(DISTINCT customer_id) FROM appointments WHERE organization_id = org_id)::BIGINT,
    (SELECT COALESCE(SUM(s.price), 0) FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.organization_id = org_id AND a.status = 'completed')::NUMERIC,
    (SELECT COALESCE(AVG(s.price), 0) FROM appointments a JOIN services s ON a.service_id = s.id WHERE a.organization_id = org_id AND a.status = 'completed')::NUMERIC;
END;
$$;

-- Add comments
COMMENT ON FUNCTION get_monthly_revenue IS 'Returns monthly revenue for the last 6 months';
COMMENT ON FUNCTION get_top_services IS 'Returns top 5 most sold services';
COMMENT ON FUNCTION get_peak_hours IS 'Returns appointment distribution by hour';
COMMENT ON FUNCTION get_dashboard_stats IS 'Returns general dashboard statistics';
