-- Insert Provider Config for Organization
-- Run this in PostgreSQL (Supabase)

INSERT INTO provider_configs (
  id,
  "organizationId",
  "apiUrl",
  "apiKey",
  "isActive",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid(),
  '5b28d9b0-a01f-4a7f-aee8-168adc646dd4',
  'https://typsnetapi.azure-api.net/api',
  'SUA_API_KEY_AQUI', -- Substitui pela tua API Key da TypsForYou
  true,
  NOW(),
  NOW()
);
