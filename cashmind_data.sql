--
-- PostgreSQL database dump
--

-- Dumped from database version 15.7
-- Dumped by pg_dump version 15.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: Categoria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Categoria" (id, "clienteId", nombre, peso, color, icono, "esEsencial", orden) FROM stdin;
cat_vivienda	\N	Vivienda	10	\N	home	t	0
cat_servicios_b_sicos	\N	Servicios básicos	9	\N	zap	t	1
cat_alimentaci_n	\N	Alimentación	9	\N	shopping-cart	t	2
cat_transporte	\N	Transporte	8	\N	car	t	3
cat_salud	\N	Salud	10	\N	heart-pulse	t	4
cat_deudas	\N	Deudas	9	\N	credit-card	t	5
cat_educaci_n	\N	Educación	8	\N	book	t	6
cat_familia	\N	Familia	6	\N	users	f	7
cat_personal	\N	Personal	5	\N	user	f	8
cat_tecnolog_a	\N	Tecnología	4	\N	monitor	f	9
cat_ocio	\N	Ocio	3	\N	gamepad	f	10
cat_imprevistos	\N	Imprevistos	7	\N	alert-triangle	f	11
cat_impuestos_comisiones	\N	Impuestos/Comisiones	10	\N	landmark	t	12
cat_ingresos	\N	Ingresos	10	\N	trending-up	t	13
cat_transferencia	\N	Transferencia	5	\N	arrow-right-left	f	14
cmot9lzaq0000xtkqznnqttis	cliente_freddy	Compras Online	5	#ef4444	tabler:shopping-bag	f	0
\.


--
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Usuario" (id, email, "passwordHash", nombre, rol, "ultimoLogin", "intentosFallidos", "bloqueadoHasta", "createdAt", "updatedAt") FROM stdin;
cmot5p4fr0000shc8nlndpgf4	freddy@cashmind.local	$2b$12$boPbmoMFna4VBPfx8Qhgduqg2FAMILxe0TFCUFTFej3TfSiQA3eVu	Freddy Alejandro Aquino Portes	ADMIN	2026-05-12 17:48:27.133	0	\N	2026-05-05 21:44:35.511	2026-05-12 17:48:27.134
\.


--
-- Data for Name: Cliente; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Cliente" (id, "usuarioId", nombre, "monedaBase", "diaCorteCiclo", configuracion, "createdAt", "updatedAt") FROM stdin;
cliente_freddy	cmot5p4fr0000shc8nlndpgf4	Freddy Alejandro Aquino Portes	DOP	21	\N	2026-05-05 21:44:35.522	2026-05-05 21:44:35.522
\.


--
-- Data for Name: CuentaBancaria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CuentaBancaria" (id, "clienteId", banco, numero, alias, tipo, moneda, saldo, activa, "createdAt", "updatedAt") FROM stdin;
cuenta_banreservas	cliente_freddy	Banreservas	9603428852	Banreservas Principal	CORRIENTE	DOP	-4865.39	t	2026-05-05 21:44:35.53	2026-05-06 02:58:42.967
\.


--
-- Data for Name: Persona; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Persona" (id, "clienteId", nombre, relacion, telefono, email, notas, apellido, tipo) FROM stdin;
persona_banco_union	cliente_freddy	Banco Unión	banco	\N	\N	\N	\N	persona
persona_lissette	cliente_freddy	Ana Lissette Portes	madre	\N	\N	\N	\N	persona
cmotdt3fy0001cxb6fao77z72	cliente_freddy	Jhonniel	Amigo	+1 (809) 456-7890	ing.dev.aquino@gmail.com	hola	Garcia	persona
cmp2sq9ev00018imptqila4im	cliente_freddy	Yhadita	Compañera	+1 (809) 567-1567	frequipo2001@gmail.com	hola	Castillo	persona
\.


--
-- Data for Name: Subcategoria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Subcategoria" (id, "categoriaId", nombre, peso, color, icono) FROM stdin;
sub_cat_vivienda_renta_hipoteca	cat_vivienda	Renta/Hipoteca	10	\N	\N
sub_cat_vivienda_mantenimiento	cat_vivienda	Mantenimiento	10	\N	\N
sub_cat_vivienda_mejoras	cat_vivienda	Mejoras	10	\N	\N
sub_cat_servicios_b_sicos_electricidad	cat_servicios_b_sicos	Electricidad	9	\N	\N
sub_cat_servicios_b_sicos_agua	cat_servicios_b_sicos	Agua	9	\N	\N
sub_cat_servicios_b_sicos_gas_dom_stico	cat_servicios_b_sicos	Gas doméstico	9	\N	\N
sub_cat_servicios_b_sicos_internet	cat_servicios_b_sicos	Internet	9	\N	\N
sub_cat_servicios_b_sicos_telefon_a	cat_servicios_b_sicos	Telefonía	9	\N	\N
sub_cat_servicios_b_sicos_streaming	cat_servicios_b_sicos	Streaming	9	\N	\N
sub_cat_alimentaci_n_supermercado	cat_alimentaci_n	Supermercado	9	\N	\N
sub_cat_alimentaci_n_comida_fuera	cat_alimentaci_n	Comida fuera	9	\N	\N
sub_cat_alimentaci_n_comida_r_pida	cat_alimentaci_n	Comida rápida	9	\N	\N
sub_cat_alimentaci_n_bebidas	cat_alimentaci_n	Bebidas	9	\N	\N
sub_cat_transporte_combustible	cat_transporte	Combustible	8	\N	\N
sub_cat_transporte_peaje	cat_transporte	Peaje	8	\N	\N
sub_cat_transporte_mantenimiento_veh_culo	cat_transporte	Mantenimiento vehículo	8	\N	\N
sub_cat_transporte_uber_taxi	cat_transporte	Uber/Taxi	8	\N	\N
sub_cat_transporte_seguro_veh_culo	cat_transporte	Seguro vehículo	8	\N	\N
sub_cat_salud_farmacia	cat_salud	Farmacia	10	\N	\N
sub_cat_salud_consultas	cat_salud	Consultas	10	\N	\N
sub_cat_salud_laboratorio	cat_salud	Laboratorio	10	\N	\N
sub_cat_salud_seguro_m_dico	cat_salud	Seguro médico	10	\N	\N
sub_cat_deudas_tarjeta_cr_dito	cat_deudas	Tarjeta crédito	9	\N	\N
sub_cat_deudas_pr_stamo_personal	cat_deudas	Préstamo personal	9	\N	\N
sub_cat_deudas_pr_stamo_bancario	cat_deudas	Préstamo bancario	9	\N	\N
sub_cat_deudas_deuda_familiar	cat_deudas	Deuda familiar	9	\N	\N
sub_cat_educaci_n_matr_cula	cat_educaci_n	Matrícula	8	\N	\N
sub_cat_educaci_n_material	cat_educaci_n	Material	8	\N	\N
sub_cat_educaci_n_cursos	cat_educaci_n	Cursos	8	\N	\N
sub_cat_familia_apoyo_familiar	cat_familia	Apoyo familiar	6	\N	\N
sub_cat_familia_cumplea_os	cat_familia	Cumpleaños	6	\N	\N
sub_cat_familia_d_a_especial	cat_familia	Día especial	6	\N	\N
sub_cat_personal_higiene	cat_personal	Higiene	5	\N	\N
sub_cat_personal_ropa	cat_personal	Ropa	5	\N	\N
sub_cat_personal_gimnasio	cat_personal	Gimnasio	5	\N	\N
sub_cat_tecnolog_a_suscripciones	cat_tecnolog_a	Suscripciones	4	\N	\N
sub_cat_tecnolog_a_hardware	cat_tecnolog_a	Hardware	4	\N	\N
sub_cat_tecnolog_a_software	cat_tecnolog_a	Software	4	\N	\N
sub_cat_ocio_entretenimiento	cat_ocio	Entretenimiento	3	\N	\N
sub_cat_ocio_salidas	cat_ocio	Salidas	3	\N	\N
sub_cat_ocio_compras_online	cat_ocio	Compras online	3	\N	\N
sub_cat_imprevistos_reserva_mensual	cat_imprevistos	Reserva mensual	7	\N	\N
sub_cat_imprevistos_emergencias	cat_imprevistos	Emergencias	7	\N	\N
sub_cat_impuestos_comisiones_dgii	cat_impuestos_comisiones	DGII	10	\N	\N
sub_cat_impuestos_comisiones_cargos_bancarios	cat_impuestos_comisiones	Cargos bancarios	10	\N	\N
sub_cat_impuestos_comisiones_comisiones	cat_impuestos_comisiones	Comisiones	10	\N	\N
sub_cat_ingresos_n_mina	cat_ingresos	Nómina	10	\N	\N
sub_cat_ingresos_apoyo_familiar_recibido	cat_ingresos	Apoyo familiar recibido	10	\N	\N
sub_cat_ingresos_trabajos_extra	cat_ingresos	Trabajos extra	10	\N	\N
sub_cat_ingresos_bonos	cat_ingresos	Bonos	10	\N	\N
sub_cat_ingresos_devoluciones	cat_ingresos	Devoluciones	10	\N	\N
sub_cat_transferencia_retiro_efectivo	cat_transferencia	Retiro efectivo	5	\N	\N
sub_cat_transferencia_env_o_transferencia	cat_transferencia	Envío transferencia	5	\N	\N
sub_cat_transferencia_recibir_transferencia	cat_transferencia	Recibir transferencia	5	\N	\N
cmot9uajv0002xtkqgcdygdqr	cmot9lzaq0000xtkqznnqttis	Amazon	5	#f59e0b	tabler:shopping-bag
\.


--
-- Data for Name: Evento; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Evento" (id, "clienteId", nombre, fecha, recurrente, "tipoRecurrencia", "presupuestoEstimado", "rangoMin", "rangoMax", prioridad, estado, "personaId", notas, moneda, tipo, "categoriaId", "subcategoriaId") FROM stdin;
cmp2tl1m7000362g2r3ssp3o6	cliente_freddy	Pago luz	2026-05-11 22:00:00	t	MENSUAL	2300.00	\N	\N	3	PLANIFICADO	\N	edeeste	DOP	PAGO_PROGRAMADO	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_electricidad
cmp2tt9jj000562g22kb66t1r	cliente_freddy	Pago Agua	2026-05-12 22:00:00	t	MENSUAL	657.00	\N	\N	3	PLANIFICADO	\N	Caasd	DOP	PAGO_PROGRAMADO	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_agua
cmp3080dm000187vvkqc32dgg	cliente_freddy	Pago Prestamo Union	2026-05-12 00:00:00	f	\N	3200.00	\N	\N	3	PLANIFICADO	\N	Generado desde presupuesto: Presupuesto mayo Abril - Mayo 2026	DOP	PAGO_PROGRAMADO	\N	\N
\.


--
-- Data for Name: TarjetaCredito; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TarjetaCredito" (id, "clienteId", banco, alias, "ultimosCuatro", limite, "saldoActual", "tasaInteres", "tasaMora", "diaCorte", "diaPago", "penalidadSobregiro", moneda, activa, "createdAt", "updatedAt", "categoriaTarjeta", franquicia, "tipoTarjeta") FROM stdin;
tc_banreservas	cliente_freddy	Banreservas	TC Banreservas	0000	15000.00	15779.29	3.50	5.00	11	20	550.00	DOP	t	2026-05-05 21:44:35.54	2026-05-05 21:44:35.54	\N	\N	\N
\.


--
-- Data for Name: Transaccion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Transaccion" (id, "clienteId", concepto, monto, moneda, detalle, comercio, tipo, "categoriaId", "subcategoriaId", "cuentaId", "tarjetaId", fecha, frecuencia, "valorRecurrente", "diaRecurrencia", estado, notas, "eventoId", "pagadoPorId", "porcentajePropio", tags, "hashImportacion", "referenciaExterna", "createdAt", "updatedAt") FROM stdin;
cmot8rmhu001rc061dwlkhufp	cliente_freddy	NOM: PAGO NOMINA EMPRESA XYZ	45000.00	DOP	\N	\N	INGRESO	cat_ingresos	sub_cat_ingresos_n_mina	cuenta_banreservas	\N	2026-05-04 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.074	2026-05-05 23:10:31.074
cmot8rmi6001tc061nmv5am5w	cliente_freddy	SUPERMERCADOS BRAVO BANI	3850.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	cuenta_banreservas	\N	2026-05-03 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.087	2026-05-05 23:10:31.087
cmot8rmi8001vc0614ilfp0c6	cliente_freddy	SHELL GASOLINERA BANI	2100.00	DOP	\N	\N	GASTO	cat_transporte	sub_cat_transporte_combustible	cuenta_banreservas	\N	2026-05-02 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.089	2026-05-05 23:10:31.089
cmot8rmib001xc061swq18kja	cliente_freddy	UBER RIDES TRIP	320.00	DOP	\N	\N	GASTO	cat_transporte	sub_cat_transporte_uber_taxi	cuenta_banreservas	\N	2026-05-01 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.091	2026-05-05 23:10:31.091
cmot8rmid001zc06103s3y6k4	cliente_freddy	EDEESTE ELECTRICIDAD	4200.00	DOP	\N	\N	GASTO	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_electricidad	cuenta_banreservas	\N	2026-04-30 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.093	2026-05-05 23:10:31.093
cmot8rmif0021c061v2vhohum	cliente_freddy	CLARO TELEFONIA MOVIL	1200.00	DOP	\N	\N	GASTO	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_telefon_a	cuenta_banreservas	\N	2026-04-28 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.095	2026-05-05 23:10:31.095
cmot8rmih0023c061w1befyoj	cliente_freddy	NOM: PAGO NOMINA EMPRESA XYZ	45000.00	DOP	\N	\N	INGRESO	cat_ingresos	sub_cat_ingresos_n_mina	cuenta_banreservas	\N	2026-04-25 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.098	2026-05-05 23:10:31.098
cmot8rmik0025c061endp12cc	cliente_freddy	SUPERMERCADOS NACIONAL STO DGO	5600.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	cuenta_banreservas	\N	2026-04-22 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.1	2026-05-05 23:10:31.1
cmot8rmim0027c061ms1w1o3b	cliente_freddy	FARMACIA CAROL BANI	980.00	DOP	\N	\N	GASTO	cat_salud	sub_cat_salud_farmacia	cuenta_banreservas	\N	2026-04-20 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.102	2026-05-05 23:10:31.102
cmot8rmio0029c061uxq4o42t	cliente_freddy	NETFLIX SUBSCRIPTION	850.00	DOP	\N	\N	GASTO	cat_tecnolog_a	sub_cat_tecnolog_a_suscripciones	cuenta_banreservas	\N	2026-04-18 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.104	2026-05-05 23:10:31.104
cmot8rmiq002bc0613eeoid13	cliente_freddy	SHELL GASOLINERA CARRETERA	2300.00	DOP	\N	\N	GASTO	cat_transporte	sub_cat_transporte_combustible	cuenta_banreservas	\N	2026-04-15 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.106	2026-05-05 23:10:31.106
cmot8rmit002dc0619g2i7hh3	cliente_freddy	RESTAURANTE LA RESIDENCE BANI	1850.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_comida_fuera	cuenta_banreservas	\N	2026-04-12 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.109	2026-05-05 23:10:31.109
cmot8rmiw002fc061tgbvf8bw	cliente_freddy	SUPERMERCADOS BRAVO BANI	4200.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	cuenta_banreservas	\N	2026-04-10 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.112	2026-05-05 23:10:31.112
cmot8rmiy002hc061qg3x6be1	cliente_freddy	PAGO BANCO UNION PRESTAMO	3215.00	DOP	\N	\N	PAGO_DEUDA	cat_deudas	sub_cat_deudas_pr_stamo_bancario	cuenta_banreservas	\N	2026-04-08 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.114	2026-05-05 23:10:31.114
cmot8rmj8002jc061d167n7bt	cliente_freddy	UBER RIDES TRIP CAPITAL	550.00	DOP	\N	\N	GASTO	cat_transporte	sub_cat_transporte_uber_taxi	cuenta_banreservas	\N	2026-04-05 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.124	2026-05-05 23:10:31.124
cmot8rmjb002lc0610zxmn4hv	cliente_freddy	COLMADO EL BUEN GUSTO	750.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	cuenta_banreservas	\N	2026-04-03 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.127	2026-05-05 23:10:31.127
cmot8rmjd002nc061u6t947sf	cliente_freddy	FREELANCE PROYECTO WEB	15000.00	DOP	\N	\N	INGRESO	cat_ingresos	sub_cat_ingresos_trabajos_extra	cuenta_banreservas	\N	2026-04-01 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.129	2026-05-05 23:10:31.129
cmot8rmjf002pc061sgi8h2x1	cliente_freddy	EDEESTE ELECTRICIDAD MARZO	3900.00	DOP	\N	\N	GASTO	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_electricidad	cuenta_banreservas	\N	2026-03-31 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.131	2026-05-05 23:10:31.131
cmot8rmjh002rc061hdgrz3ll	cliente_freddy	CLARO INTERNET HOGAR	1800.00	DOP	\N	\N	GASTO	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_internet	cuenta_banreservas	\N	2026-03-28 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.133	2026-05-05 23:10:31.133
cmot8rmjj002tc06176b1zohn	cliente_freddy	NOM: PAGO NOMINA EMPRESA XYZ	45000.00	DOP	\N	\N	INGRESO	cat_ingresos	sub_cat_ingresos_n_mina	cuenta_banreservas	\N	2026-03-25 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.135	2026-05-05 23:10:31.135
cmot8rmjl002vc0611ga8vjqw	cliente_freddy	SUPERMERCADOS BRAVO BANI	6100.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	cuenta_banreservas	\N	2026-03-22 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.137	2026-05-05 23:10:31.137
cmot8rmjm002xc061klddlq69	cliente_freddy	SHELL GASOLINERA AUTOPISTA	2500.00	DOP	\N	\N	GASTO	cat_transporte	sub_cat_transporte_combustible	cuenta_banreservas	\N	2026-03-20 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.139	2026-05-05 23:10:31.139
cmot8rmjo002zc061ukx52ym6	cliente_freddy	PAGO BANCO UNION PRESTAMO	3215.00	DOP	\N	\N	PAGO_DEUDA	cat_deudas	sub_cat_deudas_pr_stamo_bancario	cuenta_banreservas	\N	2026-03-18 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.141	2026-05-05 23:10:31.141
cmot8rmjr0031c061jdpakq0d	cliente_freddy	RESTAURANTE MEDITERRANEO	2200.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_comida_fuera	cuenta_banreservas	\N	2026-03-15 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.143	2026-05-05 23:10:31.143
cmot8rmjs0033c0617t5m2e51	cliente_freddy	FARMACIA CAROL VITAMINAS	1200.00	DOP	\N	\N	GASTO	cat_salud	sub_cat_salud_farmacia	cuenta_banreservas	\N	2026-03-12 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.145	2026-05-05 23:10:31.145
cmot8rmju0035c061v7ublyrz	cliente_freddy	UBER RIDES AEROPUERTO	890.00	DOP	\N	\N	GASTO	cat_transporte	sub_cat_transporte_uber_taxi	cuenta_banreservas	\N	2026-03-10 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.146	2026-05-05 23:10:31.146
cmot8rmjw0037c061qs7f4ly2	cliente_freddy	SPOTIFY PREMIUM	450.00	DOP	\N	\N	GASTO	cat_tecnolog_a	sub_cat_tecnolog_a_suscripciones	cuenta_banreservas	\N	2026-03-08 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.148	2026-05-05 23:10:31.148
cmot8rmjy0039c061rmnr4tfk	cliente_freddy	AMAZON MARKETPLACE COMPRA	3200.00	DOP	\N	\N	GASTO	cat_ocio	sub_cat_ocio_compras_online	cuenta_banreservas	\N	2026-03-05 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.15	2026-05-05 23:10:31.15
cmot8rmk0003bc061cdw8bm6r	cliente_freddy	COLMADO BUEN PRECIO	620.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	cuenta_banreservas	\N	2026-03-03 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.152	2026-05-05 23:10:31.152
cmot8rmk1003dc061c7bf9sgo	cliente_freddy	BONO PRODUCTIVIDAD	8000.00	DOP	\N	\N	INGRESO	cat_ingresos	sub_cat_ingresos_bonos	cuenta_banreservas	\N	2026-03-01 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.154	2026-05-05 23:10:31.154
cmot8rmk3003fc061zzgc9rl0	cliente_freddy	EDEESTE ELECTRICIDAD FEBRERO	4100.00	DOP	\N	\N	GASTO	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_electricidad	cuenta_banreservas	\N	2026-02-28 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.156	2026-05-05 23:10:31.156
cmot8rmk5003hc061t0r0rinx	cliente_freddy	NOM: PAGO NOMINA EMPRESA XYZ	45000.00	DOP	\N	\N	INGRESO	cat_ingresos	sub_cat_ingresos_n_mina	cuenta_banreservas	\N	2026-02-25 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.157	2026-05-05 23:10:31.157
cmot8rmk7003jc061koojrhi5	cliente_freddy	SUPERMERCADOS NACIONAL	5300.00	DOP	\N	\N	GASTO	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	cuenta_banreservas	\N	2026-02-20 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.159	2026-05-05 23:10:31.159
cmot8rmk9003lc061tzr36yi6	cliente_freddy	PAGO BANCO UNION PRESTAMO	3215.00	DOP	\N	\N	PAGO_DEUDA	cat_deudas	sub_cat_deudas_pr_stamo_bancario	cuenta_banreservas	\N	2026-02-15 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.161	2026-05-05 23:10:31.161
cmot8rmkb003nc061iji78r44	cliente_freddy	SHELL GASOLINERA BANI	2200.00	DOP	\N	\N	GASTO	cat_transporte	sub_cat_transporte_combustible	cuenta_banreservas	\N	2026-02-10 00:00:00	UNICA	\N	\N	EJECUTADO	\N	\N	\N	100.00	\N	\N	\N	2026-05-05 23:10:31.163	2026-05-05 23:10:31.163
cmotgx37y000dxb1b6wf2auql	cliente_freddy	Pago deuda — Ana Lissette Portes	5500.00	DOP	\N	\N	PAGO_DEUDA	cat_vivienda	sub_cat_vivienda_mejoras	cuenta_banreservas	\N	2026-05-05 22:00:00	UNICA	\N	\N	EJECUTADO	hola	\N	\N	100.00	\N	\N	\N	2026-05-06 02:58:42.958	2026-05-06 02:58:42.958
cmp2u9xyq000b84jur7cs449m	cliente_freddy	Pago Nomina	41123.00	DOP	\N	\N	INGRESO	\N	\N	\N	\N	2026-04-21 00:00:00	UNICA	\N	\N	EJECUTADO	Ejecutado desde presupuesto: Presupuesto mayo Abril - Mayo 2026	\N	\N	100.00	\N	\N	\N	2026-05-12 16:22:33.266	2026-05-12 16:22:33.266
cmp2uagxf000f84juwkhi3zf2	cliente_freddy	Ayuda economica papi	15000.00	DOP	\N	\N	INGRESO	\N	\N	\N	\N	2026-05-01 00:00:00	UNICA	\N	\N	EJECUTADO	Ejecutado desde presupuesto: Presupuesto mayo Abril - Mayo 2026	\N	\N	100.00	\N	\N	\N	2026-05-12 16:22:57.843	2026-05-12 16:22:57.843
cmp314s0h000chcgp4sjlnuii	cliente_freddy	Extracredito BanReservas	15000.00	DOP	\N	\N	INGRESO	\N	\N	\N	\N	2026-05-12 00:00:00	UNICA	\N	\N	EJECUTADO	Ejecutado desde presupuesto: Presupuesto mayo Abril - Mayo 2026	\N	\N	100.00	\N	\N	\N	2026-05-12 19:34:29.584	2026-05-12 19:34:29.584
cmp31dxt70002gpk4dvkbiz83	cliente_freddy	Servidor Jomlia	30000.00	DOP	\N	\N	INGRESO	\N	\N	\N	\N	2026-05-12 00:00:00	UNICA	\N	\N	EJECUTADO	Ejecutado desde presupuesto: Presupuesto mayo Abril - Mayo 2026	\N	\N	100.00	\N	\N	\N	2026-05-12 19:41:37.003	2026-05-12 19:41:37.003
\.


--
-- Data for Name: Adjunto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Adjunto" (id, "transaccionId", "nombreArchivo", "rutaArchivo", "mimeType", "tamanoBytes", hash, "createdAt") FROM stdin;
\.


--
-- Data for Name: ApiKey; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ApiKey" (id, "usuarioId", nombre, "keyHash", scopes, "ultimoUso", "expiraEn", revocada, "createdAt") FROM stdin;
\.


--
-- Data for Name: Presupuesto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Presupuesto" (id, "clienteId", nombre, "fechaInicio", "fechaFin", "createdAt", tipo, estado, notas, "updatedAt") FROM stdin;
cmp2u4m7x000184jun8xncnm1	cliente_freddy	Presupuesto mayo Abril - Mayo 2026	2026-04-21 00:00:00	2026-05-20 00:00:00	2026-05-12 16:18:24.763	NORMAL	ACTIVO	Presupuesto 	2026-05-12 16:23:13.395
cmp30y18e0001hcgp3fr7j47i	cliente_freddy	Compra del Supermercado	2026-05-01 00:00:00	2026-05-15 00:00:00	2026-05-12 19:29:14.942	ATOMICO	ACTIVO	\N	2026-05-12 19:31:35.687
\.


--
-- Data for Name: AsignacionPresupuesto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AsignacionPresupuesto" (id, "presupuestoId", "subcategoriaId", "montoAsignado") FROM stdin;
\.


--
-- Data for Name: CicloTarjeta; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CicloTarjeta" (id, "tarjetaId", "fechaCorte", "fechaPago", "saldoCorte", sobregiro, penalidades, "pagoMinimo", "pagoTotal", pagado, estado) FROM stdin;
\.


--
-- Data for Name: Deuda; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Deuda" (id, "clienteId", "acreedorTexto", "personaId", tipo, "montoOriginal", "saldoActual", moneda, "fechaInicio", "fechaFin", "tasaInteres", "tipoPlazo", "numeroCuotas", "diaCobro", estado, notas, "createdAt", concepto) FROM stdin;
deuda_lissette	cliente_freddy	\N	persona_lissette	PERSONAL	6000.00	0.00	DOP	2026-04-01 00:00:00	\N	\N	FLEXIBLE	\N	\N	SALDADA	Compra Bravo pagada por mamá	2026-05-05 21:44:35.574	\N
deuda_banco_union	cliente_freddy	Banco Unión	persona_banco_union	BANCARIA	27593.70	27593.70	DOP	2026-01-01 00:00:00	\N	\N	FIJO	10	21	ACTIVA	DOP 3,215 por cuota	2026-05-05 21:44:35.562	Prestamo TV
cmotije6300016nz6jlkbtmd3	cliente_freddy	\N	persona_lissette	PERSONAL	3799.96	3799.96	DOP	2026-05-06 00:00:00	2028-06-30 00:00:00	\N	FIJO	25	\N	ACTIVA	todo bien	2026-05-06 03:44:03.191	Leche Charlotte
cmp2tk0ug000162g27vtglopo	cliente_freddy	\N	cmp2sq9ev00018imptqila4im	PERSONAL	30000.00	30000.00	DOP	2026-05-12 00:00:00	2027-04-30 00:00:00	\N	FIJO	11	\N	ACTIVA	\N	2026-05-12 16:02:23.939	Pestamo Personal
\.


--
-- Data for Name: LineaPresupuesto; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."LineaPresupuesto" (id, "presupuestoId", tipo, concepto, "categoriaId", "subcategoriaId", "montoPlaneado", notas, orden, incluido, "eventoId", "deudaId", "rutaId", "createdAt") FROM stdin;
cmp2u6t3g000384juxo15rjt0	cmp2u4m7x000184jun8xncnm1	INGRESO	Pago Nomina	\N	\N	41123.00	Pago abril Nomina	0	t	\N	\N	\N	2026-05-12 16:20:06.988
cmp2u7u87000584juiyllwazo	cmp2u4m7x000184jun8xncnm1	INGRESO	Ayuda economica papi	\N	\N	15000.00	Mensualidad papi	1	t	\N	\N	\N	2026-05-12 16:20:55.112
cmp2u88b9000784jufi0zs78q	cmp2u4m7x000184jun8xncnm1	INGRESO	Extracredito BanReservas	\N	\N	15000.00	\N	2	t	\N	\N	\N	2026-05-12 16:21:13.366
cmp2u97yt000984judcud436t	cmp2u4m7x000184jun8xncnm1	INGRESO	Servidor Jomlia	\N	\N	30000.00	Server jomlia	3	t	\N	\N	\N	2026-05-12 16:21:59.573
cmp2uc50j000j84juggty4zth	cmp2u4m7x000184jun8xncnm1	GASTO	Pago Prestamo Union	\N	\N	3200.00	\N	4	t	\N	\N	\N	2026-05-12 16:24:15.715
cmp2uljoq000l84juniq3indv	cmp2u4m7x000184jun8xncnm1	GASTO	Compra de credito extra en claude	\N	\N	616.07	anthropic	5	t	\N	\N	\N	2026-05-12 16:31:34.635
cmp30yvdk0003hcgp5rwgoqar	cmp30y18e0001hcgp3fr7j47i	GASTO	Pan	\N	\N	150.00	\N	0	t	\N	\N	\N	2026-05-12 19:29:54.009
cmp30zcyu0005hcgp8l7pibj4	cmp30y18e0001hcgp3fr7j47i	GASTO	Jamon	\N	\N	250.00	\N	1	t	\N	\N	\N	2026-05-12 19:30:16.806
cmp30zjk00007hcgprkowl1g9	cmp30y18e0001hcgp3fr7j47i	GASTO	queso	\N	\N	266.00	\N	2	t	\N	\N	\N	2026-05-12 19:30:25.344
cmp310wxo0009hcgpar10ardz	cmp30y18e0001hcgp3fr7j47i	GASTO	Arroz	\N	\N	365.00	\N	3	t	\N	\N	\N	2026-05-12 19:31:29.34
\.


--
-- Data for Name: EjecucionLinea; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."EjecucionLinea" (id, "lineaId", "montoEjecutado", fecha, notas, "eventoId", "transaccionId", "createdAt") FROM stdin;
cmp2u9xza000d84ju2oox2efa	cmp2u6t3g000384juxo15rjt0	41123.00	2026-04-21 00:00:00	\N	\N	cmp2u9xyq000b84jur7cs449m	2026-05-12 16:22:33.286
cmp2uagxk000h84jujydj4cww	cmp2u7u87000584juiyllwazo	15000.00	2026-05-01 00:00:00	\N	\N	cmp2uagxf000f84juwkhi3zf2	2026-05-12 16:22:57.848
cmp3080e2000387vvkk9517vd	cmp2uc50j000j84juggty4zth	3200.00	2026-05-12 00:00:00	\N	cmp3080dm000187vvkqc32dgg	\N	2026-05-12 19:09:00.795
cmp314s0w000ehcgpvsbw39ir	cmp2u88b9000784jufi0zs78q	15000.00	2026-05-12 00:00:00	\N	\N	cmp314s0h000chcgp4sjlnuii	2026-05-12 19:34:29.6
cmp31dxti0004gpk42pcmfplz	cmp2u97yt000984judcud436t	30000.00	2026-05-12 00:00:00	\N	\N	cmp31dxt70002gpk4dvkbiz83	2026-05-12 19:41:37.015
\.


--
-- Data for Name: Notificacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notificacion" (id, "clienteId", tipo, titulo, mensaje, leida, metadata, "createdAt") FROM stdin;
\.


--
-- Data for Name: PagoDeuda; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PagoDeuda" (id, "deudaId", monto, fecha, estado, notas, "transaccionId") FROM stdin;
cmotev7ya0001xb1b5uz3d79q	deuda_lissette	500.00	2026-05-06 02:01:16.537	EJECUTADO	cuota mayo	\N
cmotgx38f000fxb1b48auvj8j	deuda_lissette	5500.00	2026-05-05 22:00:00	EJECUTADO	Pago desde transacción: Pago deuda — Ana Lissette Portes	cmotgx37y000dxb1b6wf2auql
\.


--
-- Data for Name: PlanFinanciero; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PlanFinanciero" (id, "clienteId", nombre, version, "fechaInicio", "fechaFin", "proyeccionJson", estado, "scoreAdherencia", "createdAt", "cerradoEn") FROM stdin;
\.


--
-- Data for Name: PrecioCombustible; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."PrecioCombustible" (id, tipo, precio, moneda, unidad, fecha, fuente) FROM stdin;
cmot5p4i40001shc8jstch5fn	Regular	294.50	DOP	galon	2026-04-21 00:00:00	DGCP
cmot8qfn10001ci95popttjrk	Regular	294.50	DOP	galon	2026-04-21 00:00:00	DGCP
cmot8rmgi0001c061r5h0z057	Regular	294.50	DOP	galon	2026-04-21 00:00:00	DGCP
\.


--
-- Data for Name: ReglaCategorizacion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ReglaCategorizacion" (id, "clienteId", patron, "esRegex", "categoriaId", "subcategoriaId", prioridad, activa) FROM stdin;
cmot5p4ib0003shc8k05hrbje	cliente_freddy	UBER RIDES	f	cat_transporte	sub_cat_transporte_uber_taxi	30	t
cmot5p4ie0005shc88x5gchwl	cliente_freddy	UBER EATS	f	cat_alimentaci_n	sub_cat_alimentaci_n_comida_r_pida	29	t
cmot5p4ij0007shc8cu72y920	cliente_freddy	RD VIAL	f	cat_transporte	sub_cat_transporte_peaje	28	t
cmot5p4im0009shc8kj7yn55f	cliente_freddy	SHELL	f	cat_transporte	sub_cat_transporte_combustible	27	t
cmot5p4ip000bshc88qhuhgdu	cliente_freddy	TEXACO	f	cat_transporte	sub_cat_transporte_combustible	26	t
cmot5p4is000dshc809q85etp	cliente_freddy	ECO PETROLEO	f	cat_transporte	sub_cat_transporte_combustible	25	t
cmot5p4iu000fshc865xxfc1o	cliente_freddy	TOTAL 	f	cat_transporte	sub_cat_transporte_combustible	24	t
cmot5p4iw000hshc8hilkbxfc	cliente_freddy	SIGMA PETROLEUM	f	cat_transporte	sub_cat_transporte_combustible	23	t
cmot5p4iz000jshc8ms1jqhve	cliente_freddy	PLAZA LAMA	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	22	t
cmot5p4j2000lshc8uv0tsw07	cliente_freddy	BRAVO	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	21	t
cmot5p4j4000nshc8plvr48b3	cliente_freddy	LA SIRENA	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	20	t
cmot5p4j6000pshc8ksw5cun0	cliente_freddy	JUMBO	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	19	t
cmot5p4j8000rshc81qctpl6f	cliente_freddy	PRICESMART	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	18	t
cmot5p4j9000tshc8y7qibg6l	cliente_freddy	EDEESTE	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_electricidad	17	t
cmot5p4jb000vshc8va1b2btm	cliente_freddy	ALTICE	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_internet	16	t
cmot5p4jc000xshc8med8gp68	cliente_freddy	CLARO	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_telefon_a	15	t
cmot5p4jd000zshc8sqrdimxj	cliente_freddy	CAASD	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_agua	14	t
cmot5p4jg0011shc8031stqnw	cliente_freddy	PROPAGAS	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_gas_dom_stico	13	t
cmot5p4jj0013shc8m1876xlq	cliente_freddy	CLAUDE.AI	f	cat_tecnolog_a	sub_cat_tecnolog_a_suscripciones	12	t
cmot5p4jl0015shc8zlqv8woo	cliente_freddy	GOOGLE	f	cat_tecnolog_a	sub_cat_tecnolog_a_suscripciones	11	t
cmot5p4jn0017shc8vf69btpx	cliente_freddy	FARMACIA	f	cat_salud	sub_cat_salud_farmacia	10	t
cmot5p4jp0019shc8dhbyriw0	cliente_freddy	FARM CAROL	f	cat_salud	sub_cat_salud_farmacia	9	t
cmot5p4jr001bshc8ttetk6py	cliente_freddy	LAB AMADITA	f	cat_salud	sub_cat_salud_laboratorio	8	t
cmot5p4jt001dshc8366pttox	cliente_freddy	NOM: PAGO NOMINA	f	cat_ingresos	sub_cat_ingresos_n_mina	7	t
cmot5p4jw001fshc8k4ypuvxj	cliente_freddy	COBRO IMP DGII	f	cat_impuestos_comisiones	sub_cat_impuestos_comisiones_dgii	6	t
cmot5p4jy001hshc80lyaifp6	cliente_freddy	CARGO MENSUAL	f	cat_impuestos_comisiones	sub_cat_impuestos_comisiones_cargos_bancarios	5	t
cmot5p4k1001jshc84q527g6y	cliente_freddy	PAGO TARJETA	f	cat_deudas	sub_cat_deudas_tarjeta_cr_dito	4	t
cmot5p4k4001lshc8b45q69dh	cliente_freddy	SMART FIT	f	cat_personal	sub_cat_personal_gimnasio	3	t
cmot5p4k6001nshc83e5dy2fn	cliente_freddy	PAYPAL	f	cat_ocio	sub_cat_ocio_compras_online	2	t
cmot5p4k8001pshc80b2u3ed3	cliente_freddy	RETIRO ATM	f	cat_transferencia	sub_cat_transferencia_retiro_efectivo	1	t
cmot8qfnl0003ci95jygysrmg	cliente_freddy	UBER RIDES	f	cat_transporte	sub_cat_transporte_uber_taxi	30	t
cmot8qfnr0005ci95aroi5ti4	cliente_freddy	UBER EATS	f	cat_alimentaci_n	sub_cat_alimentaci_n_comida_r_pida	29	t
cmot8qfns0007ci95e3hpxqgm	cliente_freddy	RD VIAL	f	cat_transporte	sub_cat_transporte_peaje	28	t
cmot8qfnu0009ci95fzvezecw	cliente_freddy	SHELL	f	cat_transporte	sub_cat_transporte_combustible	27	t
cmot8qfnw000bci95lj3hmph1	cliente_freddy	TEXACO	f	cat_transporte	sub_cat_transporte_combustible	26	t
cmot8qfnx000dci95c3syxlru	cliente_freddy	ECO PETROLEO	f	cat_transporte	sub_cat_transporte_combustible	25	t
cmot8qfny000fci958a5b26x6	cliente_freddy	TOTAL 	f	cat_transporte	sub_cat_transporte_combustible	24	t
cmot8qfo0000hci956bhqvcil	cliente_freddy	SIGMA PETROLEUM	f	cat_transporte	sub_cat_transporte_combustible	23	t
cmot8qfo1000jci95ccurb361	cliente_freddy	PLAZA LAMA	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	22	t
cmot8qfo3000lci95ryarjj5j	cliente_freddy	BRAVO	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	21	t
cmot8qfo5000nci95yhxpepq3	cliente_freddy	LA SIRENA	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	20	t
cmot8qfo6000pci950rq9sd3g	cliente_freddy	JUMBO	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	19	t
cmot8qfo7000rci951qf7ec5n	cliente_freddy	PRICESMART	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	18	t
cmot8qfo8000tci95y7hut44q	cliente_freddy	EDEESTE	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_electricidad	17	t
cmot8qfoa000vci95m3beixtt	cliente_freddy	ALTICE	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_internet	16	t
cmot8qfob000xci95ynn7te3k	cliente_freddy	CLARO	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_telefon_a	15	t
cmot8qfoc000zci95uuyvfa0m	cliente_freddy	CAASD	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_agua	14	t
cmot8qfoe0011ci95vazukodx	cliente_freddy	PROPAGAS	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_gas_dom_stico	13	t
cmot8qfof0013ci95wxwauvys	cliente_freddy	CLAUDE.AI	f	cat_tecnolog_a	sub_cat_tecnolog_a_suscripciones	12	t
cmot8qfog0015ci95uj8muqqw	cliente_freddy	GOOGLE	f	cat_tecnolog_a	sub_cat_tecnolog_a_suscripciones	11	t
cmot8qfoh0017ci952kv96bmf	cliente_freddy	FARMACIA	f	cat_salud	sub_cat_salud_farmacia	10	t
cmot8qfok0019ci95gal5myao	cliente_freddy	FARM CAROL	f	cat_salud	sub_cat_salud_farmacia	9	t
cmot8qfom001bci95xa3oyr2b	cliente_freddy	LAB AMADITA	f	cat_salud	sub_cat_salud_laboratorio	8	t
cmot8qfon001dci95osjy1giv	cliente_freddy	NOM: PAGO NOMINA	f	cat_ingresos	sub_cat_ingresos_n_mina	7	t
cmot8qfop001fci95q0mogvmb	cliente_freddy	COBRO IMP DGII	f	cat_impuestos_comisiones	sub_cat_impuestos_comisiones_dgii	6	t
cmot8qfoq001hci95sjudlt9p	cliente_freddy	CARGO MENSUAL	f	cat_impuestos_comisiones	sub_cat_impuestos_comisiones_cargos_bancarios	5	t
cmot8qfor001jci95wxe16in5	cliente_freddy	PAGO TARJETA	f	cat_deudas	sub_cat_deudas_tarjeta_cr_dito	4	t
cmot8qfos001lci95hdb24ywq	cliente_freddy	SMART FIT	f	cat_personal	sub_cat_personal_gimnasio	3	t
cmot8qfou001nci95ra42hmax	cliente_freddy	PAYPAL	f	cat_ocio	sub_cat_ocio_compras_online	2	t
cmot8qfox001pci95sqoa0hpe	cliente_freddy	RETIRO ATM	f	cat_transferencia	sub_cat_transferencia_retiro_efectivo	1	t
cmot8rmgl0003c061zslalrko	cliente_freddy	UBER RIDES	f	cat_transporte	sub_cat_transporte_uber_taxi	30	t
cmot8rmgo0005c0615y0v5ixk	cliente_freddy	UBER EATS	f	cat_alimentaci_n	sub_cat_alimentaci_n_comida_r_pida	29	t
cmot8rmgq0007c061hfzt79f9	cliente_freddy	RD VIAL	f	cat_transporte	sub_cat_transporte_peaje	28	t
cmot8rmgr0009c0614tqqv5yf	cliente_freddy	SHELL	f	cat_transporte	sub_cat_transporte_combustible	27	t
cmot8rmgs000bc0613lczvh7p	cliente_freddy	TEXACO	f	cat_transporte	sub_cat_transporte_combustible	26	t
cmot8rmgu000dc061pbjg84a7	cliente_freddy	ECO PETROLEO	f	cat_transporte	sub_cat_transporte_combustible	25	t
cmot8rmgv000fc0613ttn687y	cliente_freddy	TOTAL 	f	cat_transporte	sub_cat_transporte_combustible	24	t
cmot8rmgw000hc0613lmqw954	cliente_freddy	SIGMA PETROLEUM	f	cat_transporte	sub_cat_transporte_combustible	23	t
cmot8rmgy000jc061mmf23ryr	cliente_freddy	PLAZA LAMA	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	22	t
cmot8rmgz000lc061ho0qeobz	cliente_freddy	BRAVO	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	21	t
cmot8rmh0000nc0613sdjfd6n	cliente_freddy	LA SIRENA	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	20	t
cmot8rmh2000pc061fg0flsvu	cliente_freddy	JUMBO	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	19	t
cmot8rmh3000rc061rgb4khb4	cliente_freddy	PRICESMART	f	cat_alimentaci_n	sub_cat_alimentaci_n_supermercado	18	t
cmot8rmh4000tc061wnp7ccja	cliente_freddy	EDEESTE	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_electricidad	17	t
cmot8rmh5000vc0616yf2ghw1	cliente_freddy	ALTICE	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_internet	16	t
cmot8rmh7000xc06194wxxdx3	cliente_freddy	CLARO	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_telefon_a	15	t
cmot8rmh8000zc0611pz91cx6	cliente_freddy	CAASD	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_agua	14	t
cmot8rmh90011c061b0wy1htz	cliente_freddy	PROPAGAS	f	cat_servicios_b_sicos	sub_cat_servicios_b_sicos_gas_dom_stico	13	t
cmot8rmhb0013c061hbk107fi	cliente_freddy	CLAUDE.AI	f	cat_tecnolog_a	sub_cat_tecnolog_a_suscripciones	12	t
cmot8rmhc0015c061r2c1kt9k	cliente_freddy	GOOGLE	f	cat_tecnolog_a	sub_cat_tecnolog_a_suscripciones	11	t
cmot8rmhd0017c06186vbb0j3	cliente_freddy	FARMACIA	f	cat_salud	sub_cat_salud_farmacia	10	t
cmot8rmhe0019c0619k4e6dq0	cliente_freddy	FARM CAROL	f	cat_salud	sub_cat_salud_farmacia	9	t
cmot8rmhg001bc061x5s8hew5	cliente_freddy	LAB AMADITA	f	cat_salud	sub_cat_salud_laboratorio	8	t
cmot8rmhh001dc061l610sz2a	cliente_freddy	NOM: PAGO NOMINA	f	cat_ingresos	sub_cat_ingresos_n_mina	7	t
cmot8rmhi001fc061ojvp9362	cliente_freddy	COBRO IMP DGII	f	cat_impuestos_comisiones	sub_cat_impuestos_comisiones_dgii	6	t
cmot8rmhk001hc061r2f0furu	cliente_freddy	CARGO MENSUAL	f	cat_impuestos_comisiones	sub_cat_impuestos_comisiones_cargos_bancarios	5	t
cmot8rmhl001jc061chprk523	cliente_freddy	PAGO TARJETA	f	cat_deudas	sub_cat_deudas_tarjeta_cr_dito	4	t
cmot8rmhm001lc061hqgt4ppk	cliente_freddy	SMART FIT	f	cat_personal	sub_cat_personal_gimnasio	3	t
cmot8rmho001nc061i24p885f	cliente_freddy	PAYPAL	f	cat_ocio	sub_cat_ocio_compras_online	2	t
cmot8rmhp001pc061efgejr80	cliente_freddy	RETIRO ATM	f	cat_transferencia	sub_cat_transferencia_retiro_efectivo	1	t
\.


--
-- Data for Name: Vehiculo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Vehiculo" (id, "clienteId", marca, modelo, ano, "mpgRealWorld", "margenConsumo", "fuenteMpg", activo) FROM stdin;
vehiculo_nissan_note	cliente_freddy	Nissan	Note	2016	34.30	15.00	fuelly.com	t
\.


--
-- Data for Name: Ruta; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Ruta" (id, "clienteId", "vehiculoId", nombre, "distanciaKm", "vecesPorSemana", "porcentajePropio", activa, "tipoCombustible") FROM stdin;
ruta_bani_capital	cliente_freddy	vehiculo_nissan_note	Baní - Capital (ida y vuelta)	125.00	4	50.00	t	Regular
\.


--
-- Data for Name: TipoCambio; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TipoCambio" (id, "monedaBase", "monedaDestino", tasa, fecha, fuente) FROM stdin;
\.


--
-- Data for Name: VehiculoRendimiento; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."VehiculoRendimiento" (id, "vehiculoId", "tipoCombustible", rendimiento, unidad, "margenConsumo", fuente, "createdAt") FROM stdin;
\.


--
-- Data for Name: Webhook; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Webhook" (id, "clienteId", url, eventos, secret, activo, "createdAt") FROM stdin;
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
6846bfcd-5657-4bf6-9ad9-68788e1fd46d	4935d1d0222b406ccb11470fccfad1cf5da2ffb83d12f7d8061e4060591a7d34	2026-05-05 23:43:50.571565+02	20260505214350_initial_schema	\N	\N	2026-05-05 23:43:50.23293+02	1
0e92520b-a3de-4ee6-be80-a49cb4dea938	b5310b843f002a21fa74acc6284348a33bd70b1cc0fdba8ca20a8d99a5f0c2a4	2026-05-06 02:41:51.714401+02	20260506004151_add_tarjeta_franquicia_persona_tipo	\N	\N	2026-05-06 02:41:51.701969+02	1
7b9fcc28-1497-4c9b-b0db-896d375e7c24	ace2c56036e363d67fc6ad212d8ed0473cab3a90ceaa39d78805af28fae2ee1a	2026-05-06 03:57:09.316999+02	20260506015709_make_transaccion_fields_optional	\N	\N	2026-05-06 03:57:09.217784+02	1
3adc6987-257d-478f-8f5e-c04858b11693	01998c7e21dafbc3e76ae808a4c40de821e3435cd0f6774c8efc784681cc4fc6	2026-05-06 05:06:31.041608+02	20260506030631_add_deuda_concepto	\N	\N	2026-05-06 05:06:31.03577+02	1
455c3e72-7c87-448c-9eac-4c91bb20eba4	84ca5ac6ba023a2f63532d165dd9d9527d52df6585232d9d7b79ef9e9641bdaf	\N	20260510043554_schema_sync	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260510043554_schema_sync\n\nDatabase error code: 42701\n\nDatabase error:\nERROR: column "moneda" of relation "Evento" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42701), message: "column \\"moneda\\" of relation \\"Evento\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(7180), routine: Some("check_for_column_name_collision") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260510043554_schema_sync"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:106\n   1: schema_core::commands::apply_migrations::Applying migration\n           with migration_name="20260510043554_schema_sync"\n             at schema-engine\\core\\src\\commands\\apply_migrations.rs:91\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:226	2026-05-12 17:33:53.636339+02	2026-05-12 17:33:38.948174+02	0
10561559-2fd9-4845-9f64-36d6ae42690b	84ca5ac6ba023a2f63532d165dd9d9527d52df6585232d9d7b79ef9e9641bdaf	2026-05-12 17:33:53.639507+02	20260510043554_schema_sync		\N	2026-05-12 17:33:53.639507+02	0
5b405514-4b8e-4dc3-b97d-788d9f0dea9c	25a05b146263f56109e16d0e305c278fbb48481b667cde8139eb9f2f26982e92	2026-05-12 17:34:05.477416+02	20260510180909_add_vehiculo_rendimiento	\N	\N	2026-05-12 17:34:05.410272+02	1
0ee32b50-ade4-42e8-bc53-388114512ad3	b3774f152230fb71b4922c6721855f82f937684c9e4c39792a5f3eb9a40b9ad9	2026-05-12 17:34:05.496707+02	20260510191059_add_categoria_to_evento	\N	\N	2026-05-12 17:34:05.488862+02	1
172b7b01-be45-42c1-891d-b0fbccd1c6e8	1ce09b7229baa539742750446a331e8e0e5f20893eae4fff49489f32a6999415	2026-05-12 17:34:05.536962+02	20260510231531_presupuesto_lineas_ejecucion	\N	\N	2026-05-12 17:34:05.508232+02	1
\.


--
-- PostgreSQL database dump complete
--

