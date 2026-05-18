-- Seed DR fuel prices (week of May 19, 2026) from prestocombustibles.com
-- Source: https://www.prestocombustibles.com/precios-combustibles/

INSERT INTO "PrecioCombustible" ("id", "tipo", "precio", "moneda", "unidad", "fecha", "fuente")
VALUES
  (gen_random_uuid()::text, 'Gasolina Premium',      314.40, 'DOP', 'galon', '2026-05-19T00:00:00Z', 'prestocombustibles.com'),
  (gen_random_uuid()::text, 'Gasolina Regular',      293.50, 'DOP', 'galon', '2026-05-19T00:00:00Z', 'prestocombustibles.com'),
  (gen_random_uuid()::text, 'Gasoil Premium',        261.00, 'DOP', 'galon', '2026-05-19T00:00:00Z', 'prestocombustibles.com'),
  (gen_random_uuid()::text, 'Gasoil Regular',        239.10, 'DOP', 'galon', '2026-05-19T00:00:00Z', 'prestocombustibles.com'),
  (gen_random_uuid()::text, 'Kerosene / Jet Fuel',   219.50, 'DOP', 'galon', '2026-05-19T00:00:00Z', 'prestocombustibles.com'),
  (gen_random_uuid()::text, 'Gas Licuado (GLP)',     160.10, 'DOP', 'galon', '2026-05-19T00:00:00Z', 'prestocombustibles.com'),
  (gen_random_uuid()::text, 'Gas Natural (GNC)',      28.87, 'DOP', 'm3',    '2026-05-19T00:00:00Z', 'prestocombustibles.com')
ON CONFLICT DO NOTHING;

-- Seed VehiculoCatalogo for popular DR vehicles
INSERT INTO "VehiculoCatalogo" ("id", "marca", "modelo", "anoDesde", "anoHasta", "motor", "transmision", "combustible", "mpgCiudad", "mpgCarretera", "mpgCombinado", "fuente")
VALUES
  -- Nissan Note
  (gen_random_uuid()::text, 'Nissan', 'Note', 2013, 2020, '1.2L NA', 'CVT',       'Gasolina Regular', 36, 42, 38, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Nissan', 'Note', 2021, NULL, '1.2L NA', 'CVT',       'Gasolina Regular', 37, 44, 40, 'fueleconomy.gov'),
  -- Toyota Corolla
  (gen_random_uuid()::text, 'Toyota', 'Corolla', 2014, 2018, '1.8L', 'CVT',       'Gasolina Regular', 28, 37, 32, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Toyota', 'Corolla', 2019, NULL, '2.0L', 'CVT',       'Gasolina Regular', 30, 38, 33, 'fueleconomy.gov'),
  -- Kia Picanto
  (gen_random_uuid()::text, 'Kia', 'Picanto', 2012, 2017, '1.0L', 'MANUAL',      'Gasolina Regular', 35, 45, 38, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Kia', 'Picanto', 2018, NULL, '1.0L/1.2L', 'MANUAL', 'Gasolina Regular', 36, 46, 40, 'fueleconomy.gov'),
  -- Daihatsu Mira
  (gen_random_uuid()::text, 'Daihatsu', 'Mira', 2006, 2013, '0.66L', 'AUTOMATICO', 'Gasolina Regular', 43, 54, 47, 'jc08'),
  (gen_random_uuid()::text, 'Daihatsu', 'Mira', 2014, NULL, '0.66L', 'CVT',        'Gasolina Regular', 46, 57, 50, 'jc08'),
  -- Honda Civic
  (gen_random_uuid()::text, 'Honda', 'Civic', 2016, 2021, '1.5L Turbo', 'CVT',    'Gasolina Regular', 30, 38, 33, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Honda', 'Civic', 2022, NULL, '1.5L Turbo', 'CVT',    'Gasolina Regular', 31, 40, 35, 'fueleconomy.gov'),
  -- Hyundai Accent
  (gen_random_uuid()::text, 'Hyundai', 'Accent', 2012, 2017, '1.6L', 'AUTOMATICO', 'Gasolina Regular', 27, 37, 31, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Hyundai', 'Accent', 2018, NULL, '1.4L/1.6L', 'CVT',  'Gasolina Regular', 29, 38, 33, 'fueleconomy.gov'),
  -- Toyota RAV4
  (gen_random_uuid()::text, 'Toyota', 'RAV4', 2013, 2018, '2.5L', 'AUTOMATICO',   'Gasolina Regular', 23, 30, 26, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Toyota', 'RAV4', 2019, NULL, '2.5L', 'AUTOMATICO',   'Gasolina Regular', 27, 35, 30, 'fueleconomy.gov'),
  -- Toyota Yaris
  (gen_random_uuid()::text, 'Toyota', 'Yaris', 2012, 2018, '1.5L', 'AUTOMATICO',  'Gasolina Regular', 30, 36, 32, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Toyota', 'Yaris', 2019, NULL, '1.5L', 'CVT',         'Gasolina Regular', 32, 40, 35, 'fueleconomy.gov'),
  -- Suzuki Swift
  (gen_random_uuid()::text, 'Suzuki', 'Swift', 2013, 2017, '1.2L', 'AUTOMATICO',  'Gasolina Regular', 32, 40, 35, 'jc08'),
  (gen_random_uuid()::text, 'Suzuki', 'Swift', 2018, NULL, '1.2L', 'AUTOMATICO',  'Gasolina Regular', 34, 43, 37, 'jc08'),
  -- Mitsubishi Mirage
  (gen_random_uuid()::text, 'Mitsubishi', 'Mirage', 2013, 2018, '1.2L', 'CVT',    'Gasolina Regular', 35, 42, 37, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Mitsubishi', 'Mirage', 2019, NULL, '1.2L', 'CVT',    'Gasolina Regular', 36, 43, 39, 'fueleconomy.gov'),
  -- Honda CR-V
  (gen_random_uuid()::text, 'Honda', 'CR-V', 2015, 2022, '1.5L Turbo', 'CVT',     'Gasolina Regular', 28, 34, 30, 'fueleconomy.gov'),
  -- Nissan Sentra
  (gen_random_uuid()::text, 'Nissan', 'Sentra', 2013, 2019, '1.8L', 'CVT',        'Gasolina Regular', 27, 36, 30, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Nissan', 'Sentra', 2020, NULL, '2.0L', 'CVT',        'Gasolina Regular', 29, 39, 33, 'fueleconomy.gov'),
  -- Hyundai Tucson
  (gen_random_uuid()::text, 'Hyundai', 'Tucson', 2016, 2020, '2.0L', 'AUTOMATICO','Gasolina Regular', 23, 30, 26, 'fueleconomy.gov'),
  (gen_random_uuid()::text, 'Hyundai', 'Tucson', 2021, NULL, '2.5L', 'AUTOMATICO','Gasolina Regular', 26, 33, 29, 'fueleconomy.gov')
ON CONFLICT DO NOTHING;
