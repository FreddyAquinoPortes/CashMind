# Prompt para Claude Code: Sistema de Finanzas Personales Multi-Cliente "FinanzApp"

## 🎯 Objetivo del Proyecto

Construye una **aplicación de escritorio para Windows** que gestione las finanzas personales de **múltiples clientes**, con capacidad de generar proyecciones financieras inteligentes, manejar deudas (bancarias y personales), presupuestos, eventos especiales y reportes detallados con escenarios comparativos.

La arquitectura debe permitir migrar a una **aplicación web** en el futuro con mínimo esfuerzo. La interfaz debe usar una **paleta inspirada en Excel / Google Sheets (verde corporativo)** con **tema oscuro como predeterminado** y modo claro disponible.

> 📎 **Contexto real**: el usuario principal de referencia maneja su contabilidad en República Dominicana (DOP), con cuenta Banreservas como principal, una tarjeta de crédito con límite de DOP 15,000, préstamo al consumo con Banco Unión, un Nissan Note 2016 con costo de combustible compartido al 50% con un familiar, deudas personales con familia, pagos recurrentes de servicios (Claro, Altice, EDEESTE, Propagas) y eventos especiales (cumpleaños, Día de las Madres). El sistema debe modelar todos estos escenarios reales.

---

## 🎨 Sistema de Diseño

### Paleta de Colores (Tema Oscuro — predeterminado)

```css
/* Inspirado en Excel / Google Sheets — verde corporativo */
--background:        #0F1A14;   /* fondo principal — verde casi negro */
--surface:           #162821;   /* cards, modales */
--surface-elevated:  #1E3329;   /* hover, dropdowns */
--border:            #2A4A3C;
--border-strong:     #3A6650;

--primary:           #1E8E5A;   /* verde Sheets/Excel */
--primary-hover:     #25A86B;
--primary-active:    #1A7A4D;
--primary-foreground: #FFFFFF;

--success:           #34C759;
--warning:           #F5A524;
--danger:            #E5484D;   /* déficits, gastos críticos */
--info:              #4A9EFF;

--text-primary:      #E8F0EB;
--text-secondary:    #A8BBB1;
--text-muted:        #6B8076;

/* Acentos por categoría (consistentes con los PDF de referencia) */
--cat-deuda:         #E5484D;   /* rojo — deudas personales */
--cat-combustible:   #4A9EFF;   /* azul — gasolina */
--cat-evento-esposa: #F5A524;   /* amarillo — cumpleaños esposa */
--cat-evento-padre:  #FF8A4C;   /* naranja — cumpleaños padre */
--cat-evento-madres: #EC4899;   /* rosa — Día de las Madres */
--cat-tarjeta:       #A855F7;   /* morado — pago tarjeta */

/* Gráficos */
--chart-1: #1E8E5A;
--chart-2: #4A9EFF;
--chart-3: #F5A524;
--chart-4: #A855F7;
--chart-5: #EC4899;
--chart-6: #34C759;
```

### Tema Claro (modo alterno)
```css
--background:  #FFFFFF;
--surface:     #F6F8F6;
--primary:     #0F8B4A;   /* verde Sheets clásico */
--text-primary:#0F1A14;
/* Mismos acentos */
```

### Tipografía
- **UI**: Inter o Manrope (variable).
- **Tabular / montos**: JetBrains Mono o `font-variant-numeric: tabular-nums` para alineación contable perfecta.
- **Tamaños**: escala 12 / 14 / 16 / 20 / 24 / 32.

### Principios visuales
- **Densidad informativa tipo hoja de cálculo** — pero con respiración (padding 12-16px).
- Tablas con **filas alternas sutiles** (`zebra striping`) y línea de separación de 1px.
- **Montos siempre alineados a la derecha** con separador de miles y 2 decimales.
- Negativos en `--danger`, positivos en `--success` (cuando sea balance).
- **Iconografía**: Lucide Icons.
- **Animaciones discretas**: 150-200ms ease-out.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Razón |
|------|-----------|-------|
| **Shell escritorio** | Electron + electron-builder | Empaquetado Windows + futura web |
| **Frontend** | React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui | Reutilizable, moderno |
| **Backend** | Node.js + Express + TypeScript | Mismo backend para web futura |
| **Base de datos** | PostgreSQL 15+ | Robusta, escalable, JSONB |
| **ORM** | Prisma | Type-safety, migraciones |
| **Estado cliente** | Zustand + TanStack Query | Ligero |
| **Validación** | Zod (compartido front/back) | Una sola fuente de verdad |
| **Charts** | Recharts | Integración React natural |
| **PDF** | `pdf-lib` + `pdfjs-dist` | Generación + parsing de PDFs bancarios |
| **DOCX** | `docx` (npm) | Reportes Word |
| **Excel** | `exceljs` | Importación e exportación |
| **Auth** | JWT + bcrypt + refresh tokens | Estándar |
| **Testing** | Vitest + Playwright | Unit + E2E |
| **i18n** | i18next | ES (default), EN |
| **Logs** | Pino | Estructurados |

> ⚠️ **Principio arquitectónico clave**: Backend Express **separado** de Electron, comunicación **solo HTTP REST**. Día de mañana se reemplaza Electron por servidor web sin tocar lógica.

---

## 📋 Requisitos Funcionales (RF)

### RF-1. Gestión Multi-Cliente, Multi-Cuenta y Multi-Banco
- **RF-1.1** Múltiples clientes desde una misma instalación, datos completamente aislados.
- **RF-1.2** Cada cliente puede tener:
  - Múltiples **cuentas bancarias** de diferentes bancos (ej: Banreservas + BHDLeón). Cada cuenta con: banco, número, alias, tipo (corriente/ahorro/inversión), moneda, saldo actual.
  - Múltiples **tarjetas de crédito**: banco, últimos 4 dígitos, alias, límite, saldo, tasa, día de corte, día de pago, moneda.
  - Múltiples **deudas** (bancarias o personales).
  - Múltiples **personas/entidades vinculadas** (familiares que apoyan, acreedores, beneficiarios).

### RF-2. Autenticación y Autorización
- **RF-2.1** Login email/password + JWT (access 15 min + refresh 7 días).
- **RF-2.2** Roles: `admin` (gestiona varios clientes), `cliente` (solo sus datos).
- **RF-2.3** Bloqueo tras 5 intentos fallidos.
- **RF-2.4** Recuperación por email (interfaz lista, implementación pluggable).

### RF-3. Categorías y Subcategorías con Ponderación
- **RF-3.1** Estructura jerárquica de **2 niveles**: `Categoría → Subcategoría`.
- **RF-3.2** Cada categoría/subcategoría tiene:
  - `peso` (1–10): 10 = imprescindible (medicamentos, hipoteca), 1 = totalmente prescindible.
  - `color` y `icono` para visualización.
  - `es_esencial` (booleano calculado: `peso >= 8`).
- **RF-3.3** **Catálogo base precargado** (basado en patrones reales detectados):

| Categoría | Subcategorías | Peso ref. |
|-----------|---------------|-----------|
| **Vivienda** | Renta/Hipoteca, Mantenimiento, Mejoras | 10 |
| **Servicios básicos** | Electricidad (EDEESTE/Edenorte), Agua (CAASD), Gas doméstico (Propagas), Internet (Altice), Telefonía (Claro), TV/Streaming | 9 |
| **Alimentación** | Supermercado, Comida fuera (restaurantes), Comida rápida (Uber Eats), Bebidas | 8-9 |
| **Transporte** | Combustible, Peaje, Mantenimiento vehículo, Uber/Taxi, Seguro vehículo | 8 |
| **Salud** | Farmacia, Consultas, Laboratorio, Seguro médico | 10 |
| **Deudas** | Tarjeta crédito, Préstamo personal, Préstamo bancario, Deuda familiar | 9 |
| **Educación** | Matrícula, Material, Cursos | 8 |
| **Familia** | Apoyo familiar (transferencias), Cumpleaños, Día de las Madres/Padres | 6 |
| **Personal** | Higiene, Ropa, Gimnasio (Smart Fit) | 5 |
| **Tecnología** | Suscripciones (Claude.ai, Google One), Hardware, Software | 4 |
| **Ocio** | Entretenimiento, Salidas, Compras online (eBay, AliExpress) | 3 |
| **Imprevistos** | Reserva mensual, Emergencias | 7 |
| **Impuestos/Comisiones** | DGII, Cargos bancarios, Comisiones | 10 |
| **Ingresos** | Nómina, Apoyo familiar, Trabajos extra, Bonos, Devoluciones | — |

- **RF-3.4** Cada cliente puede personalizar (agregar, ocultar, ajustar pesos).

### RF-4. Registros de Transacciones
- **RF-4.1** Campos del registro:

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-:|-------------|
| `concepto` | string | ✅ | Nombre breve |
| `monto` | decimal(15,2) | ✅ | |
| `moneda` | enum | ✅ | DOP, USD, EUR, etc. Default: moneda base del cliente |
| `tipo` | enum | ✅ | `gasto`, `ingreso`, `transferencia`, `pago_deuda`, `ajuste` |
| `categoria_id` | FK | ✅ | |
| `subcategoria_id` | FK | ✅ | |
| `cuenta_id` o `tarjeta_id` | FK | ✅ | Origen del pago (uno u otro). **Excepción**: pagado por terceros (ver RF-4.6) |
| `fecha` | date | ✅ | |
| `frecuencia` | enum | ✅ | `unica`, `diaria`, `semanal`, `quincenal`, `mensual`, `bimestral`, `trimestral`, `semestral`, `anual` |
| `valor_recurrente` | decimal | ❌ | Solo si frecuencia ≠ única. Si es null y frecuencia ≠ única, usa `monto`. |
| `dia_recurrencia` | int | ❌ | Día del mes para recurrentes mensuales (ej: día 21 = nómina) |
| `estado` | enum | ✅ | `pendiente`, `ejecutado`, `cancelado`, `proyectado`, `programado` |
| `detalle` | text | ❌ | |
| `notas` | text | ❌ | |
| `evento_id` | FK | ❌ | Vincula a un evento (cumpleaños, fiesta) |
| `comercio` | string | ❌ | Texto libre del comercio (ej: "PLAZA LAMA", "UBER RIDES") |
| `pagado_por_id` | FK | ❌ | ID de persona/entidad que pagó (RF-4.6) |
| `porcentaje_propio` | decimal | ❌ | % del monto que el usuario asume (default 100). Para gastos compartidos. |
| `tags` | string[] | ❌ | Etiquetas libres |
| `hash_importacion` | string | ❌ | Para detectar duplicados al importar |
| `referencia_externa` | string | ❌ | ID/folio del banco si vino de import |

- **RF-4.2 Recurrencia**: al crear un registro recurrente, se generan automáticamente instancias futuras como `proyectado` hasta horizonte configurable (default 12 meses). Modificar el "padre" propaga cambios opcionalmente a futuras.
- **RF-4.3 Edición masiva**: seleccionar varios registros y cambiar categoría/cuenta/estado en bloque.
- **RF-4.4 Duplicación rápida**: clonar un registro con todos sus datos.
- **RF-4.5 Búsqueda y filtros**: por fecha, categoría, monto, comercio, estado, tags.
- **RF-4.6 Gastos pagados por terceros** ⭐ (caso real detectado: compra Bravo pagada por madre):
  - Permitir registrar un gasto como "pagado por X" (familiar/persona).
  - El gasto **no afecta** el balance bancario del cliente.
  - Genera automáticamente una **deuda personal** con esa persona por el monto correspondiente.
  - Caso uso: "Compra Bravo $6,000 pagada por mamá" → se registra el gasto en categoría supermercado + se crea/incrementa deuda personal con mamá.

### RF-5. Gestión de Deudas (Bancarias y Personales)
- **RF-5.1** Tipos de deuda:
  - **Bancaria** (préstamo formal con tabla de amortización).
  - **Tarjeta de crédito** (revolvente, manejado en RF-6).
  - **Personal** (con familiar, amigo, sin contrato formal).
  - **Comercial** (con proveedor, plazo determinado).
- **RF-5.2** Campos:
  - `acreedor` (FK a `Persona` o texto libre).
  - `monto_original`, `saldo_actual`, `moneda`.
  - `fecha_inicio`, `tasa_interes` (opcional).
  - `tipo_plazo`: `fijo` o `flexible`.
  - **Plazo fijo**: `numero_cuotas` → cuotas iguales calculadas.
  - **Plazo flexible**: usuario registra pagos; sistema calcula promedio histórico (`AVG`) y proyecta hasta saldar.
  - `estado`: `activa`, `saldada`, `en_mora`, `renegociada`.
  - `notas`.
- **RF-5.3** **Tabla de amortización** automática para plazo fijo. Para flexible, **historial de pagos** + proyección.
- **RF-5.4** Las cuotas/pagos proyectados se incluyen automáticamente en proyecciones financieras (RF-8).
- **RF-5.5** **Caso real soportado** — Préstamo Banco Unión:
  - Capital DOP 27,593.70 / 10 cuotas / DOP 3,215 c/u → genera tabla con saldo pendiente por cuota.
- **RF-5.6** **Caso real soportado** — Deuda con familiar (madre Lissette):
  - Saldo pendiente acumulable: cada gasto pagado por ella incrementa la deuda.
  - Permitir pagos parciales sin plazo definido.

### RF-6. Tarjetas de Crédito (Modelo Realista)
- **RF-6.1** Campos: `banco`, `alias`, `ultimos_4`, `limite`, `saldo_actual`, `tasa_interes`, `dia_corte`, `dia_pago`, `moneda`, `penalidad_sobregiro` (configurable), `tasa_mora`.
- **RF-6.2** **Cálculos automáticos**:
  - `disponible = limite - saldo_actual` (puede ser negativo si hay sobregiro).
  - `sobregiro = max(0, saldo_actual - limite)`.
  - `proximo_corte` y `proximo_pago` (fechas calculadas a partir del día configurado).
- **RF-6.3** **Ciclo del estado de cuenta**:
  - Al llegar día de corte → "cierre" del ciclo: se registra balance de corte.
  - El usuario debe pagar antes del día de pago (ej: corte 11 abr → pago 20 may).
  - Sistema avisa con anticipación (notificación 5 días antes y 1 día antes).
- **RF-6.4** **Manejo de sobregiro y penalidades**:
  - Si al cierre `saldo > limite`, registrar automáticamente penalidad como gasto pendiente.
  - Caso real: límite 15,000 + sobregiro 779.29 + penalidad 550 → opciones de pago:
    - **Mínimo**: solo sobregiro + penalidad.
    - **Total**: balance completo + penalidad.
    - **Personalizado**: monto definido por usuario.
- **RF-6.5** El disponible de la tarjeta se usa como **fuente de financiamiento sugerido** en optimización de proyecciones (RF-9).

### RF-7. Personas y Entidades
- **RF-7.1** Modelo de **personas** vinculadas al cliente: familia, amigos, acreedores, beneficiarios.
- **RF-7.2** Campos: `nombre`, `relacion` (madre, padre, esposa, amigo, etc.), `telefono`, `email`, `notas`.
- **RF-7.3** Permitir tener **balance neto** con cada persona: cuánto le debes y cuánto te debe.
- **RF-7.4** Historial de transacciones por persona.

### RF-8. Eventos Especiales y Compromisos Puntuales ⭐
- **RF-8.1** El usuario puede crear **eventos** con fecha y presupuesto estimado:
  - Cumpleaños familiares (con fecha recurrente anual).
  - Días especiales (Día de las Madres, Padres, San Valentín, Navidad).
  - Compromisos no recurrentes (reparación auto, cambio aceite, compra celular, viaje).
  - Vacaciones, mudanza, bodas.
- **RF-8.2** Cada evento tiene:
  - `nombre`, `fecha`, `recurrente` (anual/única), `presupuesto_estimado`, `rango_min`, `rango_max`, `persona_id` (opcional).
  - `prioridad` (1-5), `estado` (`planificado`, `apartado`, `ejecutado`, `cancelado`).
- **RF-8.3** El sistema **inserta automáticamente** estos compromisos en las proyecciones del período correspondiente.
- **RF-8.4** Sugerencia de **apartado anticipado** (ej: "Aparta DOP 4,500 el 21 abril para cumpleaños esposa 11 may + padre 20 may").

### RF-9. Gastos Compartidos / Subsidiados ⭐ (Caso real: gasolina 50/50)
- **RF-9.1** Permitir registrar gastos donde **otra persona cubre un %**.
- **RF-9.2** Modelo: `gasto_compartido`:
  - `monto_total`, `porcentaje_propio`, `porcentaje_terceros`, `persona_id_subsidio`.
  - El sistema calcula `monto_neto_usuario = monto_total × (porcentaje_propio / 100)`.
- **RF-9.3** **Calculadora de combustible** (módulo dedicado):
  - Configurar vehículos: marca, modelo, año, MPG real-world (link a fuelly.com como referencia), margen de consumo (%).
  - Definir rutas recurrentes: nombre, distancia (km), frecuencia/semana.
  - Ingresar precio actual de gasolina (DOP/galón, configurable por tipo: Regular, Premium, Gasoil).
  - Sistema calcula:
    - `km_semanal = Σ(distancia × frecuencia)`.
    - `km_mensual = km_semanal × 4.33`.
    - `millas_mes = km_mensual ÷ 1.60934`.
    - `mpg_efectivo = mpg_real ÷ (1 + margen)`.
    - `galones_mes = millas_mes ÷ mpg_efectivo`.
    - `costo_total = galones_mes × precio_galon`.
    - `costo_neto_usuario = costo_total × (% propio)`.
  - Caso real soportado: Nissan Note 2016 / 34.3 MPG / 500 km semanales / DOP 294.50/gal → ~DOP 13,283 total / DOP 6,641 al usuario (50%).
- **RF-9.4** Estos cálculos se incorporan automáticamente a la proyección mensual.

### RF-10. Presupuestos
- **RF-10.1** Crear presupuestos por **período personalizable**:
  - Estándar: mensual (1°-fin), quincenal.
  - **Períodos no calendario**: ej. 21-abr a 21-may (alineado al ciclo de nómina del usuario).
- **RF-10.2** Asignaciones por categoría/subcategoría con monto en moneda base.
- **RF-10.3** **Reporte de ejecución**: comparar presupuestado vs ejecutado, agrupado por categoría → subcategoría, con totales y % de uso.
- **RF-10.4** Indicadores visuales: barra de progreso por categoría (verde <70%, amarillo 70-90%, rojo >90%).
- **RF-10.5** Exportable a PDF y DOCX con formato similar al ejemplo de referencia.

### RF-11. Proyecciones Financieras (núcleo del sistema) ⭐⭐⭐
- **RF-11.1** Generar proyección de un período definiendo:
  - Fecha inicio y fin (puede ser ciclo personalizado).
  - Cliente.
  - Cuentas y tarjetas a incluir.
  - Eventos a considerar.
- **RF-11.2** Una proyección debe incluir:
  - **Sección 1 — Situación inicial**: balance al inicio + ingresos confirmados/esperados (con marca de "no garantizado" si aplica).
  - **Sección 2 — Tarjetas de crédito**: ciclos vigentes, montos a pagar, opciones (mínimo/total).
  - **Sección 3 — Deudas**: cuotas del período, deudas personales (sin afectar liquidez si no hay fecha).
  - **Sección 4 — Cálculos especiales**: combustible, gastos compartidos.
  - **Sección 5 — Préstamos**: cuotas activas con detalle.
  - **Sección 6 — Proyección de gastos**: tabla detallada con `% disponible` por línea.
  - **Sección 7 — Resumen ejecutivo**: comparativa de escenarios (ej: pago mínimo vs pago total TC).
  - **Sección 8 — Línea de tiempo**: eventos cronológicos con impacto en balance.
  - **Sección 9 — Recomendaciones**: lenguaje natural, accionables.
- **RF-11.3** Cada proyección lleva **versión** (v1, v2, v2.1, etc.) y permite duplicar para iterar.
- **RF-11.4** Exportable a PDF replicando el formato de los ejemplos de referencia.

### RF-12. Optimización de Proyecciones con Déficit ⭐⭐
Cuando el balance final < 0, el sistema genera **3-5 proyecciones alternativas** ordenadas por menor déficit + menor costo financiero:

1. **Reducción de gastos prescindibles** (peso ≤ 5): sugerir recortes con monto exacto.
2. **Diferimiento al siguiente período**: mover gastos no críticos.
3. **Pago mínimo de tarjetas** en lugar de total (recordando costo de intereses).
4. **Uso de tarjeta con disponible** para financiar (calcular costo financiero real).
5. **Pagos mínimos en deudas flexibles**.
6. **Reducción de eventos opcionales** (regalos a rangos mínimos).
7. **Combinaciones óptimas** (algoritmo greedy/backtracking).

Cada alternativa retorna estructura:
```typescript
interface AlternativaProyeccion {
  nombre: string;
  descripcion: string;            // explicación humana clara
  cambios: CambioSugerido[];      // qué se modificó
  deficit_final: number;
  costo_financiero: number;       // intereses si se usa TC
  ahorro_logrado: number;
  viable: boolean;
  impacto_calidad_vida: 1 | 2 | 3; // 1=bajo, 3=alto
}
```

Ordenamiento final:
```
score = (deficit_final + costo_financiero) + (impacto_calidad_vida × peso_calidad)
```

Donde `peso_calidad` es configurable (default: balance entre finanzas y bienestar).

### RF-13. Plan Financiero Guardado
- **RF-13.1** Usuario selecciona una proyección (original u alternativa), la edita manualmente, la guarda como **"Plan del período"**.
- **RF-13.2** Estados: `borrador`, `activo`, `cerrado`, `archivado`.
- **RF-13.3** Al cerrar el período: generar **reporte comparativo "Plan vs Real"**:
  - % cumplimiento por categoría.
  - Categorías sobreejecutadas / subejecutadas.
  - **Score de adherencia** (0-100): `100 - Σ |desviación|/total_planificado × 100`.
  - Insights automáticos ("gastaste 25% más en comida fuera de lo planeado").

### RF-14. Reportes Profesionales
- **RF-14.1** Reportes disponibles:
  - Ejecución de presupuesto por período.
  - Proyección financiera completa (formato del ejemplo).
  - Plan vs Real (comparativo).
  - Estado de deudas y amortización.
  - Estado de cuentas y tarjetas.
  - Resumen anual.
  - Análisis por categoría/subcategoría.
- **RF-14.2** Formatos: **PDF, DOCX, XLSX**.
- **RF-14.3** Personalización:
  - Logo / branding del cliente.
  - Colores configurables.
  - Selección de secciones a incluir.
- **RF-14.4** Tablas siempre agrupadas por categoría → subcategoría con totales.

### RF-15. Dashboard Visual
- **RF-15.1** Dashboard principal con:
  - **KPIs superiores**: balance consolidado, ingresos del mes, gastos del mes, deudas activas, próximos pagos (7 días).
  - **Gráfico de gastos por categoría** (donut con leyenda).
  - **Tendencia mensual** (line chart 6-12 meses) — ingresos vs gastos.
  - **Top 5 categorías** del mes en curso.
  - **Próximos eventos / pagos** (timeline 30 días).
  - **Alertas activas**.
  - **Salud financiera**: indicador 0-100 (basado en cobertura de gastos esenciales, ratio deuda/ingreso, ahorro).
- **RF-15.2** Filtros globales: cliente activo, período, moneda de visualización.
- **RF-15.3** Widgets reordenables (drag-drop) y opcionales.

### RF-16. Multi-Moneda
- **RF-16.1** Soporte DOP, USD, EUR (extensible).
- **RF-16.2** Tabla de tipos de cambio:
  - Manual (usuario ingresa tasa).
  - API automática (`exchangerate.host`, BCRD para tasa oficial DOP).
  - Histórico mantenido para reportes precisos.
- **RF-16.3** Reportes consolidados convierten a la **moneda base** del cliente.

### RF-17. Importación de Datos ⭐
- **RF-17.1** **Importación CSV/Excel**:
  - Mapeo de columnas configurable y guardable como plantilla por banco.
  - Vista previa antes de importar.
  - Detección de duplicados por hash (`fecha + monto + concepto + cuenta`).
- **RF-17.2** **Importación de PDF de estados de cuenta** ⭐⭐:
  - Parser específico para Banreservas (formato real detectado).
  - Plantillas extensibles para otros bancos (BHDLeón, BPD, Popular, Scotiabank).
  - Extracción: fecha, descripción, débito, crédito, balance.
  - **Categorización automática** por reglas (machine pattern matching):
    - Reglas precargadas: `UBER RIDES → Transporte/Uber`, `PLAZA LAMA → Alimentación/Supermercado`, `SHELL → Combustible`, `EDEESTE → Servicios/Electricidad`, `CLAUDE.AI → Tecnología/Suscripciones`, `NOM: PAGO NOMINA → Ingresos/Nómina`, etc.
    - Reglas personalizables por usuario (regex o texto contenido).
    - Aprendizaje: si usuario re-categoriza, sugerir crear regla automática.
- **RF-17.3** **Estado inicial** de importadas: `pendiente_revision` para validación manual.
- **RF-17.4** Compatibilidad futura con APIs bancarias (open banking) — interfaz preparada.

### RF-18. Notificaciones y Alertas
- **RF-18.1** Centro de notificaciones in-app.
- **RF-18.2** Tipos de alerta:
  - Presupuesto excedido (>80%, >100%).
  - Pago de tarjeta próximo (5 días, 1 día antes del corte/pago).
  - Cuota de préstamo vencida o próxima.
  - Deuda con persona pendiente de coordinar.
  - Proyección con déficit detectada al cerrar el mes.
  - Saldo bancario por debajo de umbral configurable.
  - Evento especial próximo (recordatorio de aparte).
- **RF-18.3** Integración con notificaciones nativas Windows (Toast).
- **RF-18.4** Email opcional (vía SendGrid/SMTP configurable).

### RF-19. Backup y Sincronización en la Nube
- **RF-19.1** **Backup local**:
  - Manual a archivo `.zip` encriptado (AES-256, password opcional).
  - Programado (diario/semanal/mensual).
  - Retención configurable (últimos N).
- **RF-19.2** **Sincronización en la nube** (opcional, configurable):
  - Servidor propio del usuario (URL + API key).
  - S3 / Google Drive / Dropbox vía OAuth.
  - Cifrado en tránsito y en reposo.
- **RF-19.3** **Restauración** con verificación de integridad (hash SHA-256).
- **RF-19.4** Exportación completa a JSON portable (formato propietario versionado).

### RF-20. API e Integraciones
- **RF-20.1** **API REST** documentada con OpenAPI 3.1 + Swagger UI en `/api/docs`.
- **RF-20.2** **API keys** generables por el usuario, con scopes (`read:transactions`, `write:transactions`, `read:reports`, etc.).
- **RF-20.3** **Webhooks** para eventos:
  - `transaccion.creada`, `presupuesto.excedido`, `proyeccion.deficit`, `plan.cerrado`, `tarjeta.corte_proximo`.
- **RF-20.4** Compatibilidad documentada con **n8n, Zapier, Make.com, Claude Code**.
- **RF-20.5** **Endpoint de bulk import** para automatizaciones.

### RF-21. Vault y Documentos Adjuntos
- **RF-21.1** Adjuntar documentos a transacciones, deudas, eventos:
  - Recibos (foto, PDF).
  - Contratos.
  - Estados de cuenta originales.
- **RF-21.2** Almacenamiento local cifrado o cloud configurado.
- **RF-21.3** Búsqueda dentro de adjuntos (OCR opcional).

---

## 🛡️ Requisitos No Funcionales (RNF)

### RNF-1. Rendimiento
- Arranque < 3 segundos.
- Reportes con 10,000+ transacciones < 2 segundos.
- Importación de PDF de estado de cuenta de 200+ líneas < 5 segundos.
- Índices DB en `(cliente_id, fecha)`, `(categoria_id)`, `(estado)`, `(cuenta_id, fecha)`.

### RNF-2. Escalabilidad
- Arquitectura cliente-servidor desacoplada.
- Backend stateless (JWT).
- Listo para multi-tenancy SaaS.

### RNF-3. Seguridad
- Passwords con bcrypt (cost ≥ 12).
- JWT corto + refresh.
- Datos sensibles encriptados en reposo (AES-256-GCM).
- Validación Zod en todos los endpoints.
- Protección SQL injection (Prisma) + XSS (sanitización + CSP).
- Logs de auditoría para acciones críticas.
- Rate limiting en API (100 req/min por API key).
- HTTPS obligatorio si se expone API a red.

### RNF-4. Usabilidad
- Diseño limpio con shadcn/ui, **tema oscuro por defecto**.
- Atajos de teclado (`Ctrl+N` nueva transacción, `Ctrl+R` reporte, etc.).
- Navegación con teclado completa (a11y AA).
- Mensajes de error claros y accionables.
- i18n: ES (default), EN.
- Onboarding guiado para clientes nuevos.

### RNF-5. Mantenibilidad
- TypeScript estricto (`strict: true`, `noUncheckedIndexedAccess: true`).
- ESLint + Prettier + Husky pre-commit.
- Estructura modular por dominio.
- Cobertura ≥ 75% en lógica de negocio (`proyecciones`, `deudas`, `optimizacion`, `combustible`).

### RNF-6. Portabilidad
- Capa `/api` funciona sin Electron.
- Sin dependencias específicas de Windows en lógica.
- Empaquetado: `.exe` (NSIS) y `.msi`.
- Soporte planificado: macOS y Linux (futuro).

### RNF-7. Confiabilidad
- Transacciones DB atómicas para operaciones multi-tabla.
- Retry policy para APIs externas.
- Error boundaries en React.
- Modo offline funcional (al menos lectura) con sync diferido.

### RNF-8. Privacidad
- **Datos siempre locales por defecto**. Nube es opt-in.
- Nunca enviar datos a servidores de Anthropic / terceros sin consentimiento explícito.
- Exportación completa siempre disponible (derecho a portabilidad).
- Eliminación completa por solicitud.

---

## 🗄️ Esquema de Base de Datos (PostgreSQL / Prisma)

```prisma
// =================== USUARIOS Y CLIENTES ===================
model Usuario {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  nombre        String
  rol           Rol      @default(CLIENTE)
  twoFactorSecret String?
  ultimoLogin   DateTime?
  intentosFallidos Int   @default(0)
  bloqueadoHasta DateTime?
  clientes      Cliente[]
  apiKeys       ApiKey[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum Rol { ADMIN CLIENTE }

model Cliente {
  id              String   @id @default(cuid())
  usuarioId       String
  usuario         Usuario  @relation(fields: [usuarioId], references: [id])
  nombre          String
  monedaBase      String   @default("DOP")
  diaCorteCiclo   Int?     // ej: 21 (para usuarios con ciclo no calendario)
  configuracion   Json?    // umbrales, preferencias
  cuentas         CuentaBancaria[]
  tarjetas        TarjetaCredito[]
  deudas          Deuda[]
  transacciones   Transaccion[]
  presupuestos    Presupuesto[]
  planes          PlanFinanciero[]
  personas        Persona[]
  eventos         Evento[]
  vehiculos       Vehiculo[]
  rutas           Ruta[]
  reglasCategorizacion ReglaCategorizacion[]
  createdAt       DateTime @default(now())
}

// =================== CUENTAS Y TARJETAS ===================
model CuentaBancaria {
  id            String  @id @default(cuid())
  clienteId     String
  cliente       Cliente @relation(fields: [clienteId], references: [id])
  banco         String
  numero        String
  alias         String?
  tipo          TipoCuenta
  moneda        String  @default("DOP")
  saldo         Decimal @db.Decimal(15,2) @default(0)
  activa        Boolean @default(true)
  transacciones Transaccion[]
  createdAt     DateTime @default(now())
}

enum TipoCuenta { CORRIENTE AHORRO INVERSION OTRO }

model TarjetaCredito {
  id                 String  @id @default(cuid())
  clienteId          String
  cliente            Cliente @relation(fields: [clienteId], references: [id])
  banco              String
  alias              String?
  ultimosCuatro      String
  limite             Decimal @db.Decimal(15,2)
  saldoActual        Decimal @db.Decimal(15,2) @default(0)
  tasaInteres        Decimal @db.Decimal(5,2)  @default(0)
  tasaMora           Decimal @db.Decimal(5,2)  @default(0)
  diaCorte           Int     // 1-31
  diaPago            Int     // 1-31
  penalidadSobregiro Decimal @db.Decimal(15,2) @default(0)
  moneda             String  @default("DOP")
  activa             Boolean @default(true)
  transacciones      Transaccion[]
  ciclos             CicloTarjeta[]
}

model CicloTarjeta {
  id           String  @id @default(cuid())
  tarjetaId    String
  tarjeta      TarjetaCredito @relation(fields: [tarjetaId], references: [id])
  fechaCorte   DateTime
  fechaPago    DateTime
  saldoCorte   Decimal @db.Decimal(15,2)
  sobregiro    Decimal @db.Decimal(15,2) @default(0)
  penalidades  Decimal @db.Decimal(15,2) @default(0)
  pagoMinimo   Decimal @db.Decimal(15,2)
  pagoTotal    Decimal @db.Decimal(15,2)
  pagado       Decimal @db.Decimal(15,2) @default(0)
  estado       EstadoCiclo @default(VIGENTE)
}

enum EstadoCiclo { VIGENTE PAGADO_MIN PAGADO_TOTAL EN_MORA }

// =================== CATEGORÍAS ===================
model Categoria {
  id            String        @id @default(cuid())
  clienteId     String?       // null = catálogo global
  nombre        String
  peso          Int           @default(5)  // 1-10
  color         String?
  icono         String?
  esEsencial    Boolean       @default(false)
  orden         Int           @default(0)
  subcategorias Subcategoria[]
}

model Subcategoria {
  id           String   @id @default(cuid())
  categoriaId  String
  categoria    Categoria @relation(fields: [categoriaId], references: [id])
  nombre       String
  peso         Int      @default(5)
  color        String?
  icono        String?
  transacciones Transaccion[]
  asignaciones AsignacionPresupuesto[]
}

// =================== PERSONAS ===================
model Persona {
  id          String   @id @default(cuid())
  clienteId   String
  cliente     Cliente  @relation(fields: [clienteId], references: [id])
  nombre      String
  relacion    String?  // madre, padre, esposa, amigo, etc.
  telefono    String?
  email       String?
  notas       String?
  transaccionesPagadas Transaccion[]    @relation("PagadoPor")
  deudas      Deuda[]
  eventos     Evento[]
}

// =================== TRANSACCIONES ===================
model Transaccion {
  id                  String   @id @default(cuid())
  clienteId           String
  cliente             Cliente  @relation(fields: [clienteId], references: [id])
  concepto            String
  monto               Decimal  @db.Decimal(15,2)
  moneda              String   @default("DOP")
  detalle             String?
  comercio            String?
  tipo                TipoTransaccion
  categoriaId         String
  subcategoriaId      String
  subcategoria        Subcategoria @relation(fields: [subcategoriaId], references: [id])
  cuentaId            String?
  tarjetaId           String?
  cuenta              CuentaBancaria? @relation(fields: [cuentaId], references: [id])
  tarjeta             TarjetaCredito? @relation(fields: [tarjetaId], references: [id])
  fecha               DateTime
  frecuencia          Frecuencia
  valorRecurrente     Decimal? @db.Decimal(15,2)
  diaRecurrencia      Int?
  estado              EstadoTransaccion
  notas               String?
  porcentajeDisponible Decimal? @db.Decimal(5,2)
  eventoId            String?
  evento              Evento?  @relation(fields: [eventoId], references: [id])
  pagadoPorId         String?
  pagadoPor           Persona? @relation("PagadoPor", fields: [pagadoPorId], references: [id])
  porcentajePropio    Decimal  @db.Decimal(5,2) @default(100)
  tags                String[]
  hashImportacion     String?  @unique
  referenciaExterna   String?
  archivosAdjuntos    Adjunto[]
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([clienteId, fecha])
  @@index([estado])
  @@index([categoriaId])
}

enum Frecuencia { UNICA DIARIA SEMANAL QUINCENAL MENSUAL BIMESTRAL TRIMESTRAL SEMESTRAL ANUAL }
enum EstadoTransaccion { PENDIENTE EJECUTADO CANCELADO PROYECTADO PROGRAMADO }
enum TipoTransaccion { GASTO INGRESO TRANSFERENCIA PAGO_DEUDA AJUSTE }

// =================== DEUDAS ===================
model Deuda {
  id              String   @id @default(cuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  acreedorTexto   String?
  personaId       String?
  persona         Persona? @relation(fields: [personaId], references: [id])
  tipo            TipoDeuda
  montoOriginal   Decimal  @db.Decimal(15,2)
  saldoActual     Decimal  @db.Decimal(15,2)
  moneda          String   @default("DOP")
  fechaInicio     DateTime
  fechaFin        DateTime?
  tasaInteres     Decimal? @db.Decimal(5,2)
  tipoPlazo       TipoPlazo
  numeroCuotas    Int?
  diaCobro        Int?
  estado          EstadoDeuda @default(ACTIVA)
  notas           String?
  pagos           PagoDeuda[]
  createdAt       DateTime @default(now())
}

enum TipoDeuda { BANCARIA TARJETA PERSONAL COMERCIAL OTRA }
enum TipoPlazo { FIJO FLEXIBLE }
enum EstadoDeuda { ACTIVA SALDADA EN_MORA RENEGOCIADA CANCELADA }

model PagoDeuda {
  id        String   @id @default(cuid())
  deudaId   String
  deuda     Deuda    @relation(fields: [deudaId], references: [id])
  monto     Decimal  @db.Decimal(15,2)
  fecha     DateTime
  estado    EstadoTransaccion
  notas     String?
  transaccionId String? @unique
}

// =================== EVENTOS ===================
model Evento {
  id              String   @id @default(cuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  nombre          String
  fecha           DateTime
  recurrente      Boolean  @default(false)
  tipoRecurrencia String?  // ANUAL, MENSUAL
  presupuestoEstimado Decimal @db.Decimal(15,2)
  rangoMin        Decimal? @db.Decimal(15,2)
  rangoMax        Decimal? @db.Decimal(15,2)
  prioridad       Int      @default(3)
  estado          EstadoEvento @default(PLANIFICADO)
  personaId       String?
  persona         Persona? @relation(fields: [personaId], references: [id])
  notas           String?
  transacciones   Transaccion[]
}

enum EstadoEvento { PLANIFICADO APARTADO EJECUTADO CANCELADO }

// =================== VEHÍCULOS Y COMBUSTIBLE ===================
model Vehiculo {
  id              String   @id @default(cuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  marca           String
  modelo          String
  ano             Int
  mpgRealWorld    Decimal  @db.Decimal(5,2)
  margenConsumo   Decimal  @db.Decimal(5,2) @default(15)
  fuenteMpg       String?  // ej: "fuelly.com"
  rutas           Ruta[]
  activo          Boolean  @default(true)
}

model Ruta {
  id              String   @id @default(cuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  vehiculoId      String?
  vehiculo        Vehiculo? @relation(fields: [vehiculoId], references: [id])
  nombre          String
  distanciaKm     Decimal  @db.Decimal(8,2)
  vecesPorSemana  Int
  porcentajePropio Decimal @db.Decimal(5,2) @default(100)
  activa          Boolean  @default(true)
}

model PrecioCombustible {
  id        String   @id @default(cuid())
  tipo      String   // Regular, Premium, Gasoil
  precio    Decimal  @db.Decimal(8,2)
  moneda    String   @default("DOP")
  unidad    String   @default("galon")
  fecha     DateTime
  fuente    String?
  @@index([fecha, tipo])
}

// =================== PRESUPUESTOS Y PLANES ===================
model Presupuesto {
  id            String   @id @default(cuid())
  clienteId     String
  cliente       Cliente  @relation(fields: [clienteId], references: [id])
  nombre        String
  fechaInicio   DateTime
  fechaFin      DateTime
  asignaciones  AsignacionPresupuesto[]
  createdAt     DateTime @default(now())
}

model AsignacionPresupuesto {
  id              String      @id @default(cuid())
  presupuestoId   String
  presupuesto     Presupuesto @relation(fields: [presupuestoId], references: [id])
  subcategoriaId  String
  subcategoria    Subcategoria @relation(fields: [subcategoriaId], references: [id])
  montoAsignado   Decimal     @db.Decimal(15,2)
}

model PlanFinanciero {
  id              String   @id @default(cuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  nombre          String
  version         String   @default("v1")
  fechaInicio     DateTime
  fechaFin        DateTime
  proyeccionJson  Json     // snapshot completo
  estado          EstadoPlan
  scoreAdherencia Decimal? @db.Decimal(5,2)
  createdAt       DateTime @default(now())
  cerradoEn       DateTime?
}

enum EstadoPlan { BORRADOR ACTIVO CERRADO ARCHIVADO }

// =================== AUXILIARES ===================
model TipoCambio {
  id            String   @id @default(cuid())
  monedaBase    String
  monedaDestino String
  tasa          Decimal  @db.Decimal(15,6)
  fecha         DateTime
  fuente        String?
  @@unique([monedaBase, monedaDestino, fecha])
}

model ReglaCategorizacion {
  id              String   @id @default(cuid())
  clienteId       String
  cliente         Cliente  @relation(fields: [clienteId], references: [id])
  patron          String   // texto o regex
  esRegex         Boolean  @default(false)
  categoriaId     String
  subcategoriaId  String
  prioridad       Int      @default(0)
  activa          Boolean  @default(true)
}

model Adjunto {
  id              String   @id @default(cuid())
  transaccionId   String?
  transaccion     Transaccion? @relation(fields: [transaccionId], references: [id])
  nombreArchivo   String
  rutaArchivo     String
  mimeType        String
  tamanoBytes     Int
  hash            String
  createdAt       DateTime @default(now())
}

model ApiKey {
  id          String   @id @default(cuid())
  usuarioId   String
  usuario     Usuario  @relation(fields: [usuarioId], references: [id])
  nombre      String
  keyHash     String   @unique
  scopes      String[]
  ultimoUso   DateTime?
  expiraEn    DateTime?
  revocada    Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model Notificacion {
  id        String   @id @default(cuid())
  clienteId String
  tipo      String
  titulo    String
  mensaje   String
  leida     Boolean  @default(false)
  metadata  Json?
  createdAt DateTime @default(now())
  @@index([clienteId, leida])
}

model Webhook {
  id        String   @id @default(cuid())
  clienteId String
  url       String
  eventos   String[]
  secret    String
  activo    Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

---

## 🔌 Endpoints API Principales

```
AUTH
  POST   /api/auth/login
  POST   /api/auth/refresh
  POST   /api/auth/logout
  POST   /api/auth/register
  POST   /api/auth/forgot-password

CLIENTES
  GET    /api/clientes
  POST   /api/clientes
  GET    /api/clientes/:id
  PATCH  /api/clientes/:id
  DELETE /api/clientes/:id

TRANSACCIONES
  GET    /api/clientes/:id/transacciones?desde=&hasta=&categoria=&estado=&q=
  POST   /api/clientes/:id/transacciones
  POST   /api/clientes/:id/transacciones/bulk
  PATCH  /api/transacciones/:txId
  DELETE /api/transacciones/:txId
  POST   /api/clientes/:id/transacciones/importar       (CSV/Excel)
  POST   /api/clientes/:id/transacciones/importar-pdf   (PDF de banco)

CATEGORÍAS Y REGLAS
  GET    /api/clientes/:id/categorias
  POST   /api/clientes/:id/categorias
  GET    /api/clientes/:id/reglas-categorizacion
  POST   /api/clientes/:id/reglas-categorizacion

CUENTAS Y TARJETAS
  GET    /api/clientes/:id/cuentas
  POST   /api/clientes/:id/cuentas
  GET    /api/clientes/:id/tarjetas
  POST   /api/clientes/:id/tarjetas
  GET    /api/tarjetas/:tjId/ciclos

DEUDAS
  GET    /api/clientes/:id/deudas
  POST   /api/clientes/:id/deudas
  POST   /api/deudas/:dId/pagos
  GET    /api/deudas/:dId/amortizacion

PERSONAS
  GET    /api/clientes/:id/personas
  POST   /api/clientes/:id/personas
  GET    /api/personas/:pId/balance

EVENTOS
  GET    /api/clientes/:id/eventos
  POST   /api/clientes/:id/eventos

VEHÍCULOS / COMBUSTIBLE
  GET    /api/clientes/:id/vehiculos
  POST   /api/clientes/:id/vehiculos
  GET    /api/clientes/:id/rutas
  POST   /api/clientes/:id/rutas
  POST   /api/clientes/:id/calcular-combustible    (con vehículo + rutas + precio)

PRESUPUESTOS
  GET    /api/clientes/:id/presupuestos
  POST   /api/clientes/:id/presupuestos
  GET    /api/presupuestos/:pId/ejecucion

PROYECCIONES
  POST   /api/clientes/:id/proyecciones                (genera)
  POST   /api/clientes/:id/proyecciones/optimizar      (alternativas)
  POST   /api/clientes/:id/planes                      (guarda plan)
  GET    /api/planes/:planId/comparativo               (Plan vs Real)

REPORTES
  GET    /api/reportes/ejecucion?formato=pdf|docx|xlsx
  GET    /api/reportes/proyeccion?formato=...
  GET    /api/reportes/plan-vs-real?formato=...
  GET    /api/reportes/anual?formato=...

DASHBOARD
  GET    /api/clientes/:id/dashboard

NOTIFICACIONES
  GET    /api/clientes/:id/notificaciones
  PATCH  /api/notificaciones/:nId/leer

INTEGRACIÓN
  GET    /api/integraciones/api-keys
  POST   /api/integraciones/api-keys
  GET    /api/integraciones/webhooks
  POST   /api/integraciones/webhooks

BACKUP
  POST   /api/backup/exportar
  POST   /api/backup/importar
```

---

## 📁 Estructura de Carpetas

```
finanzapp/
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── server-launcher.ts
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── clientes/
│   │   │   │   ├── transacciones/
│   │   │   │   ├── categorias/
│   │   │   │   ├── cuentas/
│   │   │   │   ├── tarjetas/
│   │   │   │   ├── deudas/
│   │   │   │   ├── personas/
│   │   │   │   ├── eventos/
│   │   │   │   ├── combustible/      # ⭐ módulo dedicado
│   │   │   │   ├── presupuestos/
│   │   │   │   ├── proyecciones/     # ⭐ núcleo
│   │   │   │   │   ├── motor.ts
│   │   │   │   │   ├── optimizador.ts
│   │   │   │   │   └── escenarios.ts
│   │   │   │   ├── reportes/
│   │   │   │   │   ├── pdf.ts
│   │   │   │   │   ├── docx.ts
│   │   │   │   │   └── xlsx.ts
│   │   │   │   ├── importacion/
│   │   │   │   │   ├── csv.ts
│   │   │   │   │   ├── excel.ts
│   │   │   │   │   ├── pdf-banreservas.ts
│   │   │   │   │   ├── pdf-bhdleon.ts
│   │   │   │   │   └── categorizador.ts
│   │   │   │   ├── notificaciones/
│   │   │   │   ├── backup/
│   │   │   │   ├── webhooks/
│   │   │   │   └── api-keys/
│   │   │   ├── shared/
│   │   │   ├── middleware/
│   │   │   └── server.ts
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.ts              # catálogo + reglas categorización
│   └── web/
│       ├── src/
│       │   ├── pages/
│       │   ├── features/
│       │   │   ├── dashboard/
│       │   │   ├── transacciones/
│       │   │   ├── cuentas/
│       │   │   ├── tarjetas/
│       │   │   ├── deudas/
│       │   │   ├── personas/
│       │   │   ├── eventos/
│       │   │   ├── combustible/
│       │   │   ├── presupuestos/
│       │   │   ├── proyecciones/
│       │   │   ├── reportes/
│       │   │   ├── importacion/
│       │   │   └── ajustes/
│       │   ├── components/ui/        # shadcn
│       │   ├── components/charts/
│       │   ├── lib/
│       │   ├── hooks/
│       │   ├── theme/                # tema verde + dark
│       │   └── App.tsx
│       └── vite.config.ts
├── packages/
│   └── shared/
│       └── src/
│           ├── schemas/
│           └── types/
├── docs/
│   ├── API.md
│   ├── ARQUITECTURA.md
│   ├── MANUAL.md
│   └── PARSERS.md
├── tests/
└── README.md
```

---

## 🚀 Fases de Desarrollo

### **Fase 1 — Fundación (Semana 1-2)**
- Monorepo + setup completo.
- Tema verde dark con shadcn customizado.
- Auth + modelo Usuario/Cliente.
- Layout base + navegación.

### **Fase 2 — Núcleo de Datos (Semana 3-4)**
- CRUD: categorías, subcategorías, cuentas, tarjetas, transacciones, personas.
- Catálogo base precargado vía seed.
- Reglas de categorización iniciales.

### **Fase 3 — Deudas, Tarjetas y Eventos (Semana 5)**
- Módulo deudas (bancarias + personales).
- Ciclos de tarjeta + alertas.
- Eventos especiales recurrentes.

### **Fase 4 — Combustible y Gastos Compartidos (Semana 6)** ⭐
- Vehículos + rutas + calculadora.
- Gastos compartidos / pagados por terceros.

### **Fase 5 — Proyecciones (Semana 7-8)** ⭐⭐
- Motor de proyecciones.
- Algoritmo de optimización con déficit.
- Comparativa de escenarios.
- Plan financiero guardado.

### **Fase 6 — Reportes y Dashboard (Semana 9)**
- Dashboard con Recharts (tema verde).
- Reportes PDF/DOCX/XLSX (formato del ejemplo de referencia).

### **Fase 7 — Importación PDF Bancos (Semana 10)** ⭐
- Parser Banreservas (basado en PDF real).
- Parser BHDLeón.
- Categorización automática.

### **Fase 8 — Multi-Moneda, Backup, API (Semana 11)**
- Tipos de cambio.
- Backup local + cloud.
- API keys + webhooks + OpenAPI.

### **Fase 9 — Pulido (Semana 12)**
- Tests E2E.
- Empaquetado Windows.
- Documentación final.

---

## 🧠 Algoritmos Clave (Pseudocódigo)

### Optimización de Proyección con Déficit
```typescript
function optimizarProyeccion(p: Proyeccion): Alternativa[] {
  if (p.balance >= 0) return [];
  const deficit = Math.abs(p.balance);
  const alternativas: Alternativa[] = [];

  // ESTRATEGIA 1: reducir prescindibles (peso ≤ 5)
  alternativas.push(estrategiaReduccion(p, { pesoMax: 5, factorReduccion: 0.5 }));

  // ESTRATEGIA 2: diferir gastos no críticos (peso ≤ 6)
  alternativas.push(estrategiaDiferimiento(p, { pesoMax: 6 }));

  // ESTRATEGIA 3: pago mínimo TC en lugar de total
  if (p.tarjetas.some(t => t.pagoTotalEnPeriodo)) {
    alternativas.push(estrategiaPagoMinimoTC(p));
  }

  // ESTRATEGIA 4: financiar con disponible de TC
  const tarjetaCupo = buscarTarjetaConDisponible(deficit, p.tarjetas);
  if (tarjetaCupo) {
    alternativas.push(estrategiaFinanciamientoTC(p, tarjetaCupo));
  }

  // ESTRATEGIA 5: reducir eventos al rango mínimo
  alternativas.push(estrategiaEventosMinimos(p));

  // ESTRATEGIA 6: pagos mínimos en deudas flexibles
  alternativas.push(estrategiaDeudasMinimas(p));

  // ESTRATEGIA 7: combinada óptima (greedy)
  alternativas.push(estrategiaCombinadaGreedy(p, deficit));

  return alternativas
    .filter(a => a.viable)
    .sort((a, b) => scoreAlternativa(a) - scoreAlternativa(b))
    .slice(0, 5);
}

function scoreAlternativa(a: Alternativa): number {
  return a.deficitFinal +
         a.costoFinanciero +
         a.impactoCalidadVida * 1000;
}
```

### Cálculo de Combustible
```typescript
function calcularCombustible(input: {
  vehiculo: Vehiculo;
  rutas: Ruta[];
  precioGalon: Decimal;
  porcentajePropio: number;
}): ResultadoCombustible {
  const kmSemanal = input.rutas.reduce(
    (acc, r) => acc + (r.distanciaKm * r.vecesPorSemana), 0
  );
  const kmMensual = kmSemanal * 4.33;
  const millasMes = kmMensual / 1.60934;
  const mpgEfectivo = input.vehiculo.mpgRealWorld /
                      (1 + input.vehiculo.margenConsumo / 100);
  const galonesMes = millasMes / mpgEfectivo;
  const costoTotal = galonesMes * input.precioGalon;
  const costoNeto = costoTotal * (input.porcentajePropio / 100);

  return { kmMensual, millasMes, galonesMes, costoTotal, costoNeto };
}
```

### Categorización Automática
```typescript
function categorizar(
  concepto: string,
  reglas: ReglaCategorizacion[]
): { categoriaId: string; subcategoriaId: string } | null {
  const reglasOrdenadas = reglas
    .filter(r => r.activa)
    .sort((a, b) => b.prioridad - a.prioridad);

  for (const r of reglasOrdenadas) {
    const match = r.esRegex
      ? new RegExp(r.patron, "i").test(concepto)
      : concepto.toUpperCase().includes(r.patron.toUpperCase());

    if (match) {
      return {
        categoriaId: r.categoriaId,
        subcategoriaId: r.subcategoriaId
      };
    }
  }
  return null;
}
```

---

## 🌱 Seed Inicial — Reglas de Categorización (extracto)

```typescript
const REGLAS_BASE = [
  // Transporte
  { patron: "UBER RIDES",       categoria: "Transporte",  sub: "Uber/Taxi" },
  { patron: "UBER *TRIP",       categoria: "Transporte",  sub: "Uber/Taxi" },
  { patron: "UBER EATS",        categoria: "Alimentación", sub: "Comida rápida" },
  { patron: "RD VIAL",          categoria: "Transporte",  sub: "Peaje" },

  // Combustible
  { patron: "SHELL",            categoria: "Transporte",  sub: "Combustible" },
  { patron: "TEXACO",           categoria: "Transporte",  sub: "Combustible" },
  { patron: "ECO PETROLEO",     categoria: "Transporte",  sub: "Combustible" },
  { patron: "TOTAL ",           categoria: "Transporte",  sub: "Combustible" },
  { patron: "SIGMA PETROLEUM",  categoria: "Transporte",  sub: "Combustible" },

  // Supermercados
  { patron: "PLAZA LAMA",       categoria: "Alimentación", sub: "Supermercado" },
  { patron: "PRICESMART",       categoria: "Alimentación", sub: "Supermercado" },
  { patron: "BRAVO",            categoria: "Alimentación", sub: "Supermercado" },
  { patron: "JUMBO",            categoria: "Alimentación", sub: "Supermercado" },
  { patron: "LA SIRENA",        categoria: "Alimentación", sub: "Supermercado" },
  { patron: "SM BRAVO",         categoria: "Alimentación", sub: "Supermercado" },

  // Servicios
  { patron: "EDEESTE",          categoria: "Servicios",   sub: "Electricidad" },
  { patron: "ALTICE",           categoria: "Servicios",   sub: "Internet/TV" },
  { patron: "CODETEL",          categoria: "Servicios",   sub: "Telefonía" },
  { patron: "CLARO",            categoria: "Servicios",   sub: "Telefonía" },
  { patron: "CAASD",            categoria: "Servicios",   sub: "Agua" },
  { patron: "PROPAGAS",         categoria: "Servicios",   sub: "Gas doméstico" },

  // Suscripciones
  { patron: "CLAUDE.AI",        categoria: "Tecnología",  sub: "Suscripciones" },
  { patron: "GOOGLE *GOOGLE ONE", categoria: "Tecnología", sub: "Suscripciones" },
  { patron: "PAYPAL *EBAY",     categoria: "Ocio",        sub: "Compras online" },
  { patron: "PAYPAL *ALIPAY",   categoria: "Ocio",        sub: "Compras online" },

  // Salud / Farmacia
  { patron: "FARMACIA",         categoria: "Salud",       sub: "Farmacia" },
  { patron: "FARM CAROL",       categoria: "Salud",       sub: "Farmacia" },
  { patron: "LAB AMADITA",      categoria: "Salud",       sub: "Laboratorio" },

  // Ingresos
  { patron: "NOM: PAGO NOMINA", categoria: "Ingresos",    sub: "Nómina" },
  { patron: "TRANSFERENCIA DE FREDDY AQUINO ESCALANTE", categoria: "Ingresos", sub: "Apoyo familiar" },

  // Cargos bancarios
  { patron: "COBRO IMP DGII",   categoria: "Impuestos",   sub: "DGII" },
  { patron: "CARGO MENSUAL USO TARJETA", categoria: "Impuestos", sub: "Cargos bancarios" },
  { patron: "RETIRO ATM",       categoria: "Transferencia", sub: "Retiro efectivo" },

  // Pagos tarjeta
  { patron: "PAGO TARJETA",     categoria: "Deudas",      sub: "Tarjeta crédito" },

  // Gimnasio
  { patron: "SMART FIT",        categoria: "Personal",    sub: "Gimnasio" },
];
```

---

## ✅ Criterios de Aceptación Generales

- [ ] App inicia en Windows < 3s con tema oscuro verde.
- [ ] Se importa exitosamente un PDF de Banreservas (formato del ejemplo) categorizando ≥ 80% automáticamente.
- [ ] Una proyección con déficit genera ≥ 3 alternativas viables ordenadas correctamente.
- [ ] Calculadora de combustible reproduce el cálculo del ejemplo (±1%).
- [ ] Reportes PDF y DOCX agrupan por categoría/subcategoría con totales correctos.
- [ ] El backend responde a `GET /api/health` y expone Swagger en `/api/docs`.
- [ ] Cobertura de tests ≥ 75% en `proyecciones`, `combustible`, `optimizador`, `deudas`.
- [ ] Backend funciona sin Electron (verificable con `curl`).
- [ ] Gasto pagado por tercero crea/actualiza deuda personal automáticamente.
- [ ] Plan vs Real calcula score de adherencia correctamente.

---

## 📦 Entregables

1. Código fuente completo, documentado, commits semánticos.
2. README con instrucciones de instalación, desarrollo, empaquetado.
3. Schema Prisma + migraciones + seed (categorías + reglas + cliente demo).
4. Documentación OpenAPI completa.
5. Manual de usuario en `/docs/MANUAL.md`.
6. Instalador Windows `.exe`.
7. Tests unit + E2E.

---

## 🎬 Instrucciones para Comenzar

> **Claude Code**:
>
> 1. **Comienza por la Fase 1**: setup monorepo, tema verde dark, auth básico.
> 2. **Antes de codificar**, confirma:
>    - Estructura final de carpetas.
>    - PostgreSQL local o Docker.
>    - Cualquier ambigüedad de requisitos.
> 3. **Procede incrementalmente**: cada fase termina con tests pasando.
> 4. **Pregunta** cuando tengas dudas en lugar de asumir.
> 5. **Datos de referencia**: el cliente demo del seed debe incluir el caso real del usuario (cuenta Banreservas, tarjeta crédito 15K, préstamo Banco Unión, vehículo Nissan Note 2016 con ruta Baní-Capital, deuda con familiar) para validar todos los flujos.
> 6. **Calidad visual**: el resultado debe verse profesional, denso pero limpio, **inspirado en Excel/Sheets** pero moderno (shadcn). Los reportes PDF deben rivalizar visualmente con los ejemplos de referencia.
