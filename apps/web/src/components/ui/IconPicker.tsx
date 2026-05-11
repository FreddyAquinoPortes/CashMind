import { useState, useMemo } from 'react'
import { Icon } from '@iconify/react'

// ── Auto-suggest: maps category name words to the best icon ──────────────
// Priority map: keyword → exact tabler icon (first match wins)
const SUGGEST_MAP: Array<[string[], string]> = [
  // ── Categorías del sistema (nombres exactos primero) ──────────────────────
  [['vivienda','hogar propio'], 'tabler:home'],
  [['servicios basicos','servicios básicos','servicio basico'], 'tabler:bolt'],
  [['alimentacion','alimentación'], 'tabler:shopping-cart'],
  [['transporte','movilidad'], 'tabler:car'],
  [['impuesto','impuestos','comisione','dgii','itbis','tax','declaracion'], 'tabler:receipt'],
  [['imprevisto','emergencia','reserva','contingencia'], 'tabler:first-aid-kit'],
  [['ocio','recreacion','recreación','diversión','diversion'], 'tabler:device-gamepad'],
  [['tecnologia','tecnología'], 'tabler:device-laptop'],
  [['ingreso','ingresos','entrada'], 'tabler:trending-up'],
  // ── Compras ───────────────────────────────────────────────────────────────
  [['compra','supermercado','mercado','bravo','nacional','jumbo','plaza'], 'tabler:shopping-cart'],
  [['online','amazon','ebay','shopify','ecommerce','tienda online'], 'tabler:shopping-bag'],
  [['farmacia','medicamento','drogueria','carol'], 'tabler:pill'],
  [['ropa','moda','calzado','zapato','vestimenta','boutique'], 'tabler:shirt'],
  // ── Alimentación ─────────────────────────────────────────────────────────
  [['restaurante','comida','almuerzo','cena','desayuno','buffet'], 'tabler:tools-kitchen-2'],
  [['cafe','cafeteria','starbucks','coffee'], 'tabler:coffee'],
  [['pizza','burger','hamburguesa','mcdonalds','kfc','subway'], 'tabler:burger'],
  [['bar','cerveza','beer','licor','alcohol'], 'tabler:beer'],
  [['colmado','verdura','fruta','mercadito'], 'tabler:apple'],
  // ── Transporte ────────────────────────────────────────────────────────────
  [['gasolina','combustible','shell','texaco','gasolinera','fuel'], 'tabler:gas-station'],
  [['uber','taxi','didi','cabify','ride'], 'tabler:car'],
  [['carro','auto','vehiculo','nissan','toyota','honda','hyundai'], 'tabler:car-suv'],
  [['avion','vuelo','aeropuerto','viaje','turismo','vacacion'], 'tabler:plane'],
  [['bus','metro','tren','transporte publico'], 'tabler:bus'],
  [['bicicleta','bike','cycling'], 'tabler:bicycle'],
  [['moto','motocicleta'], 'tabler:motorbike'],
  // ── Hogar ─────────────────────────────────────────────────────────────────
  [['alquiler','renta','hipoteca','apartamento','casa','habitacion'], 'tabler:home'],
  [['electricidad','luz','edeeste','edenorte','edeste','corriente'], 'tabler:bolt'],
  [['agua','acueducto','caasd'], 'tabler:droplet'],
  [['internet','wifi','claro','altice','wind','fiber'], 'tabler:wifi'],
  [['telefono','celular','movil','plan','linea'], 'tabler:device-mobile'],
  [['limpieza','aseo','lavanderia','lavado'], 'tabler:washing-machine'],
  [['reparacion','mantenimiento','plomero','electricista','arreglo'], 'tabler:tool'],
  // ── Salud ─────────────────────────────────────────────────────────────────
  [['medico','doctor','clinica','hospital','consulta','cita'], 'tabler:stethoscope'],
  [['salud','seguro medico','seguro','poliza'], 'tabler:heart-rate'],
  [['gym','gimnasio','ejercicio','deporte','fitness'], 'tabler:dumbbell'],
  [['dentista','dental','odontologia'], 'tabler:dental'],
  [['oculista','optica','vision','lentes'], 'tabler:eye'],
  // ── Finanzas ──────────────────────────────────────────────────────────────
  [['ahorro','ahorros','fondo'], 'tabler:piggy-bank'],
  [['inversion','bolsa','acciones','dividendo','rendimiento'], 'tabler:trending-up'],
  [['prestamo','deuda','credito','banco union','banreservas','bpd','blh'], 'tabler:credit-card'],
  [['nomina','salario','sueldo','pago'], 'tabler:moneybag'],
  [['tarjeta','mastercard','visa','amex'], 'tabler:credit-card'],
  [['transferencia','envio'], 'tabler:transfer'],
  // ── Educación ─────────────────────────────────────────────────────────────
  [['escuela','colegio','universidad','educacion','curs','materia','beca'], 'tabler:school'],
  [['libro','libreria','papeleria','utiles'], 'tabler:book'],
  // ── Entretenimiento ───────────────────────────────────────────────────────
  [['netflix','disney','hbo','streaming','pelicula','cine'], 'tabler:movie'],
  [['spotify','musica','concierto','apple music'], 'tabler:music'],
  [['juego','game','playstation','xbox','nintendo','steam'], 'tabler:device-gamepad'],
  [['futbol','basketball','beisbol','tenis'], 'tabler:run'],
  // ── Trabajo ───────────────────────────────────────────────────────────────
  [['trabajo','oficina','empresa','negocio','freelance','proyecto'], 'tabler:briefcase'],
  [['computadora','laptop','software','hardware'], 'tabler:device-laptop'],
  // ── Social & familia ──────────────────────────────────────────────────────
  [['familia','hijo','esposa','esposo','pareja'], 'tabler:users'],
  [['mascota','perro','gato','veterinario'], 'tabler:paw'],
  [['regalo','cumpleanos','celebracion','fiesta'], 'tabler:gift'],
  [['vacaciones','hotel','turismo'], 'tabler:beach'],
  // ── Generales ─────────────────────────────────────────────────────────────
  [['personal','propio','yo','higiene'], 'tabler:user'],
  [['otros','varios','miscelaneo','general'], 'tabler:dots'],
]

// Normalize text: lowercase, remove accents
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Returns the best icon suggestion for a given category name, or '' if none
export function suggestIcon(name: string): string {
  const n = normalize(name)
  for (const [keywords, icon] of SUGGEST_MAP) {
    if (keywords.some(k => n.includes(normalize(k)))) {
      return icon
    }
  }
  return ''
}

// ── Bilingual keyword map ─────────────────────────────────────────────────
// Maps Spanish words and common terms to icon name fragments
const ES_EN: Record<string, string[]> = {
  // Alimentación
  comida: ['food','burger','pizza','apple','bread','fork','knife','salad','restaurant','eat','chicken','fish','steak'],
  alimentacion: ['food','burger','pizza','apple','bread','fork','knife','salad','eat'],
  supermercado: ['shopping','cart','store','basket','bag','market'],
  restaurante: ['restaurant','fork','knife','eat','food','coffee','pizza'],
  cafe: ['coffee','cup','mug','cafe','espresso'],
  bebida: ['drink','cup','bottle','beer','wine','water','juice','glass'],
  // Transporte
  transporte: ['car','bus','train','truck','bicycle','moto','vehicle','transport','plane','ship'],
  auto: ['car','vehicle','steering','parking','garage'],
  carro: ['car','vehicle','steering','parking'],
  gasolina: ['gas','fuel','pump','station','oil'],
  combustible: ['fuel','gas','pump','flame','fire'],
  bus: ['bus','transport','vehicle'],
  avion: ['plane','airplane','flight','airport','travel'],
  bicicleta: ['bicycle','bike','cycle'],
  // Hogar
  casa: ['home','house','building','apartment','door','window','furniture','sofa'],
  hogar: ['home','house','building','apartment','sofa','lamp','bed'],
  alquiler: ['building','home','house','key','rent','contract'],
  electricidad: ['bolt','lightning','plug','power','electricity','bulb','zap'],
  agua: ['water','drop','droplet','waves','rain','sea'],
  internet: ['wifi','network','router','globe','world','signal'],
  telefono: ['phone','mobile','call','device','cell'],
  // Salud
  salud: ['heart','medical','health','hospital','pill','medicine','doctor','cross'],
  medico: ['medical','doctor','stethoscope','hospital','health','cross'],
  farmacia: ['pill','medicine','capsule','pharmacy','drug'],
  deporte: ['sport','run','gym','football','ball','fitness','dumbbell','weight'],
  // Finanzas
  dinero: ['money','coin','cash','dollar','wallet','bank','credit','payment'],
  banco: ['bank','building','money','coin','credit','savings'],
  deuda: ['credit','card','debt','loan','payment','bill'],
  tarjeta: ['credit','card','wallet','payment'],
  inversion: ['chart','trending','stock','graph','investment','profit'],
  ahorro: ['piggy','savings','coin','money','bank','safe'],
  presupuesto: ['budget','calculator','spreadsheet','chart','clipboard'],
  // Entretenimiento
  entretenimiento: ['music','movie','game','tv','controller','headphone','camera'],
  musica: ['music','headphone','speaker','note','guitar','piano','sound'],
  pelicula: ['movie','film','camera','video','play','screen','tv','cinema'],
  juego: ['game','controller','dice','joystick','chess','puzzle'],
  libro: ['book','read','library','education','school','study'],
  // Educacion
  educacion: ['school','book','graduation','pencil','study','learn','university'],
  universidad: ['school','university','graduation','book','study'],
  // Trabajo
  trabajo: ['briefcase','office','work','desk','computer','laptop','job'],
  oficina: ['office','desk','building','computer','work','laptop'],
  computadora: ['computer','laptop','desktop','screen','device','monitor'],
  // Ropa
  ropa: ['shirt','clothes','dress','fashion','hanger','pants','jacket'],
  zapatos: ['shoe','boot','sneaker','footwear'],
  // Viajes
  viaje: ['plane','luggage','travel','vacation','map','compass','globe'],
  vacaciones: ['beach','sun','umbrella','vacation','travel','palm','luggage'],
  hotel: ['hotel','bed','room','building','star','key'],
  // Mascotas
  mascota: ['dog','cat','pet','paw','animal','fish'],
  perro: ['dog','paw','pet'],
  gato: ['cat','pet','paw'],
  // Servicios
  servicio: ['tool','wrench','settings','service','repair','maintenance'],
  reparacion: ['wrench','tool','hammer','fix','repair','settings'],
  limpieza: ['clean','mop','bucket','wash','cleaning','broom'],
  // Otros
  regalo: ['gift','present','box','birthday','celebration'],
  fiesta: ['party','birthday','balloon','celebration','cake','confetti'],
  otros: ['dots','more','category','tag','label','bookmark'],
  tag: ['tag','label','bookmark','category','price'],
  impuesto: ['receipt','tax','document','file','invoice','money'],
  seguro: ['shield','security','lock','safe','insurance','protection'],
  combustibles: ['fuel','gas','pump','fire','flame'],
  ingreso: ['arrow-down','income','money','coin','wallet','trending-up'],
  gasto: ['arrow-up','expense','money','spending','cart'],
  personal: ['user','person','profile','account','human'],
  familia: ['users','family','home','people','group'],
  // English terms also work
  shopping: ['shopping','cart','bag','basket','store'],
  food: ['food','burger','pizza','apple','bread'],
  health: ['heart','medical','health','hospital','pill'],
  money: ['money','coin','cash','dollar','wallet'],
  travel: ['plane','luggage','travel','vacation','map'],
  home: ['home','house','building','apartment','door'],
  work: ['briefcase','office','work','desk','computer'],
  car: ['car','vehicle','steering','parking','fuel'],
  music: ['music','headphone','speaker','note','guitar'],
  sport: ['sport','run','gym','football','ball','fitness'],
}

// ── Curated Tabler icon list (finance + lifestyle relevant) ───────────────
// ~250 most useful icons from Tabler for a finance app
const ICON_NAMES = [
  // Money & Finance
  'wallet','coin','coins','cash','currency-dollar','currency-euro','credit-card',
  'credit-card-off','piggy-bank','bank','receipt','receipt-2','invoice','file-invoice',
  'trending-up','trending-down','chart-bar','chart-line','chart-pie',
  'arrow-up-circle','arrow-down-circle','transfer','exchange',
  'report-money','moneybag','discount','percent','calculator',
  // Shopping
  'shopping-cart','shopping-bag','basket','store','building-store',
  'barcode','qrcode','tag','tags','price-tag',
  // Food
  'tools-kitchen-2','bowl-chopsticks','pizza','burger','coffee',
  'beer','wine','apple','bread','egg-fried','fish','meat','salad','soup',
  'fork','knife','spoon','glass-full',
  // Transport
  'car','car-suv','truck','bus','train','plane','ship','bicycle','motorbike',
  'steering-wheel','gas-station','parking','road','map','map-pin','compass',
  'plane-departure','plane-arrival','anchor',
  // Home
  'home','building','building-apartment','door','sofa','bed','lamp','bathtub',
  'toilet-paper','couch','armchair','air-conditioning','washing-machine',
  // Utilities
  'bolt','plug','bulb','droplet','flame','wifi','device-desktop',
  'device-laptop','device-mobile','phone','broadcast',
  // Health
  'heart','heart-rate','stethoscope','pill','pills','vaccine','bandage',
  'first-aid-kit','dental','eye','brain','dumbbell','run','yoga','swimming',
  'apple-2','salad-2',
  // Entertainment
  'music','headphones','player-play','camera','video','tv','device-gamepad',
  'book','book-2','movie','confetti','pacman','chess',
  // Work & Education
  'briefcase','building-skyscraper','desk','pencil','school',
  'certificate','graduation-cap','microscope','flask','telescope',
  'robot','code','terminal','database','server','cloud',
  // People & Social
  'user','users','user-circle','friends','baby','man','woman','old-man',
  'dog','cat','paw','fish-2','butterfly',
  // Clothing
  'shirt','shoe','hanger','sunglasses','tie','socks',
  // Travel & Leisure
  'beach','sun','moon','stars','umbrella','palm-tree','mountain',
  'tent','swimming-pool','snowflake','leaf','flower',
  // Services
  'tool','wrench','hammer','screwdriver','paint','brush','scissors',
  'washing-machine-2','broom','vacuum-cleaner',
  // Documents & Admin
  'file','file-text','clipboard','folder','archive','mail',
  'shield','lock','key','fingerprint',
  // Misc
  'gift','balloon','cake','star','crown','trophy','medal',
  'bell','alarm','clock','calendar','world','globe',
  'activity','plus','minus','check','x','dots','circle-dot',
].map(name => `tabler:${name}`)

// ── IconPicker component ──────────────────────────────────────────────────
interface IconPickerProps {
  value: string
  onChange: (icon: string) => void
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return ICON_NAMES

    // Get English search terms from Spanish/English bilingual map
    const terms = new Set<string>([q])
    for (const [es, en] of Object.entries(ES_EN)) {
      if (es.includes(q) || q.includes(es)) {
        en.forEach(t => terms.add(t))
      }
    }

    return ICON_NAMES.filter(icon => {
      const name = icon.replace('tabler:', '')
      return [...terms].some(t => name.includes(t))
    })
  }, [search])

  const selectedName = value?.replace('tabler:', '') || ''

  return (
    <div className="relative flex flex-col gap-2">
      {/* Trigger button — shows current icon */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(p => !p)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-text-secondary text-sm hover:border-primary hover:text-text-primary transition-colors"
        >
          {value ? (
            <>
              <Icon icon={value} className="w-5 h-5 text-primary" />
              <span className="text-xs text-text-muted">{selectedName}</span>
            </>
          ) : (
            <span className="text-text-muted">Sin ícono — clic para elegir</span>
          )}
          <span className="ml-auto text-text-muted text-xs">{open ? '▲' : '▼'}</span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-text-muted hover:text-danger text-xs px-2"
          >
            ✕
          </button>
        )}
      </div>

      {/* Picker panel — absolutely positioned so it floats over modal content */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-[200] border border-border rounded-xl bg-surface overflow-hidden shadow-2xl mt-1">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ícono... ej: comida, auto, salud, money"
              className="input text-sm"
            />
          </div>

          {/* Icon grid */}
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="col-span-8 text-center text-text-muted text-xs py-6">
                Sin resultados para "{search}"
              </div>
            )}
            {filtered.map(icon => {
              const isSelected = value === icon
              return (
                <button
                  key={icon}
                  type="button"
                  title={icon.replace('tabler:', '')}
                  onClick={() => { onChange(icon); setOpen(false); setSearch('') }}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-colors
                    ${isSelected
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                    }`}
                >
                  <Icon icon={icon} className="w-5 h-5" />
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-border text-xs text-text-muted flex justify-between">
            <span>{filtered.length} íconos</span>
            <button type="button" onClick={() => setOpen(false)} className="hover:text-text-primary">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}