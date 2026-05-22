import type { Metadata } from "next"
import Link from "next/link"
import {
  Activity,
  AlarmClockCheck,
  ArrowRight,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  DatabaseZap,
  FileSpreadsheet,
  Fingerprint,
  History,
  Hotel,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Music2,
  PhoneCall,
  RadioTower,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Demo Day | GigFlow",
  description:
    "Presentación de GigFlow: plataforma para controlar eventos musicales, validar check-ins, unificar catálogos y auditar la operación en tiempo real.",
}

const eventFacts = [
  { label: "Creado por", value: "Valeria Manager", icon: UsersRound },
  { label: "Hotel", value: "Marina Azul Resort", icon: Hotel },
  { label: "Fecha", value: "Viernes 22 mayo", icon: CalendarClock },
  { label: "Hora", value: "20:00", icon: Clock3 },
]

const logs = [
  {
    time: "18:42",
    title: "Evento creado",
    detail: "Cena Sunset Jazz asignada a Marina Azul Resort",
    tone: "ok",
  },
  {
    time: "18:44",
    title: "Banda asignada",
    detail: "The Riviera Quartet queda como talento principal",
    tone: "info",
  },
  {
    time: "19:36",
    title: "Invitación leída",
    detail: "El líder de banda abrió los detalles del gig",
    tone: "info",
  },
  {
    time: "19:52",
    title: "Check-in registrado",
    detail: "Foto, ubicación y hora capturadas desde el hotel",
    tone: "success",
  },
]

const benefits = [
  {
    title: "Control total de cada evento",
    body: "Cada evento deja contexto completo: quién lo creó, cuándo, para qué hotel, a qué hora, qué talento fue asignado y qué cambió después.",
    icon: Fingerprint,
  },
  {
    title: "Check-in verificable",
    body: "La puntualidad deja de ser una conversación difícil. El sistema captura hora, evidencia, ubicación y comentarios del músico.",
    icon: AlarmClockCheck,
  },
  {
    title: "Catálogos como fuente de verdad",
    body: "Músicos, bandas, hoteles y organizaciones viven en un solo lugar para reducir duplicados, hojas paralelas y datos desactualizados.",
    icon: DatabaseZap,
  },
  {
    title: "Logs y notificaciones fuertes",
    body: "Cambios, invitaciones, check-ins, estados y alertas quedan visibles para operar mejor hoy y auditar con calma mañana.",
    icon: BellRing,
  },
]

const operatingLoop = [
  "Crear evento con hotel, hora, duración y talento.",
  "Enviar invitación y mantener trazabilidad de lectura.",
  "Recibir check-in con evidencia antes del gig.",
  "Confirmar, rechazar o investigar desde el historial.",
]

const scatteredChannels = [
  {
    name: "WhatsApp",
    pain: "Mensajes perdidos, capturas fuera de contexto y decisiones que nadie puede auditar.",
    icon: MessageCircle,
  },
  {
    name: "Emails",
    pain: "Hilos largos, información duplicada y detalles críticos enterrados entre respuestas.",
    icon: Mail,
  },
  {
    name: "Llamadas",
    pain: "Acuerdos verbales que después dependen de memoria, notas sueltas o buena fe.",
    icon: PhoneCall,
  },
  {
    name: "Falta de comunicación",
    pain: "Managers, hoteles y músicos trabajando con versiones diferentes del mismo evento.",
    icon: MessagesSquare,
  },
  {
    name: "Excel",
    pain: "Hojas que se rompen, se duplican, se desactualizan y no explican qué pasó.",
    icon: FileSpreadsheet,
  },
]

const signals = [
  ["Notificación", "Check-in pendiente para Lobby Bossa a las 21:00"],
  ["Alerta", "La hora actual está fuera del rango normal del evento"],
  ["Acción", "Confirmar llegada, rechazar evidencia o investigar el historial"],
]

const demoScript = [
  {
    moment: "01",
    title: "Crear el evento",
    detail: "Muestra hotel, hora, duración, músico o banda, y quién lo creó.",
  },
  {
    moment: "02",
    title: "Abrir el historial",
    detail: "Enseña que asignaciones, cambios, invitaciones y estados quedan registrados.",
  },
  {
    moment: "03",
    title: "Probar el check-in",
    detail: "Subraya llegada a tiempo, evidencia, ubicación y alerta si algo no cuadra.",
  },
]

const productProof = [
  {
    title: "Producto SaaS real",
    detail: "Organizaciones, roles, autenticación, onboarding, billing y rutas protegidas ya están contempladas en la app.",
    icon: ShieldCheck,
  },
  {
    title: "Operación hotelera entendida",
    detail: "El diseño prioriza lo que duele en campo: cambios de último minuto, talento que no llega, evidencia y responsabilidad.",
    icon: Building2,
  },
  {
    title: "Datos preparados para crecer",
    detail: "Eventos, hoteles, músicos, bandas, notificaciones y auditoría viven como modelos claros, no como pantallas aisladas.",
    icon: DatabaseZap,
  },
]

export default function DemoDayPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f3ea] text-[#17120e]">
      <section className="relative border-[#17120e] border-b bg-[#f7f3ea]">
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(#17120e_1px,transparent_1px),linear-gradient(90deg,#17120e_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-6 md:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-start lg:py-8">
          <nav className="flex items-center justify-between lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full border border-[#17120e] bg-[#f45d48] shadow-[4px_4px_0_#17120e]">
                <Music2 aria-hidden="true" />
              </div>
              <div>
                <p className="font-black text-lg leading-none tracking-tight">GigFlow</p>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#65584d]">Demo Day</p>
              </div>
            </div>
            <Link
              className="group inline-flex items-center gap-2 rounded-full border border-[#17120e] bg-[#17120e] px-4 py-2 font-bold text-sm text-white shadow-[3px_3px_0_#f45d48] transition-transform hover:-translate-y-0.5"
              href="/auth/login"
            >
              Abrir producto
              <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
            </Link>
          </nav>

          <div className="flex flex-col gap-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#17120e] bg-[#f8c84c] px-4 py-2 font-black text-xs uppercase tracking-[0.22em] shadow-[3px_3px_0_#17120e]">
              <Sparkles aria-hidden="true" />
              Operación musical sin puntos ciegos
            </div>
            <div className="flex flex-col gap-5">
              <h1 className="max-w-4xl text-balance font-black text-5xl leading-[0.92] tracking-tight sm:text-6xl lg:text-6xl">
                La operación musical que se puede comprobar.
              </h1>
              <p className="max-w-2xl text-pretty text-lg font-medium leading-8 text-[#4c4037]">
                GigFlow ayuda a managers y hoteles a saber qué evento ocurre, quién lo creó, qué talento fue asignado y si los músicos llegaron a tiempo.
              </p>
            </div>
            <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Eventos", "auditables"],
                ["Check-in", "con evidencia"],
                ["Catálogos", "unificados"],
                ["Alertas", "accionables"],
              ].map(([top, bottom]) => (
                <div key={top} className="rounded-lg border border-[#17120e] bg-white p-4 shadow-[4px_4px_0_#17120e]">
                  <p className="font-black text-lg leading-tight">{top}</p>
                  <p className="text-sm font-semibold text-[#65584d]">{bottom}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-8 -top-8 hidden h-32 w-32 rotate-12 border border-[#17120e] bg-[#55c0a9] shadow-[7px_7px_0_#17120e] lg:block" />
            <div className="relative rounded-[1.75rem] border-2 border-[#17120e] bg-[#17120e] p-3 shadow-[12px_12px_0_#f45d48]">
              <div className="rounded-[1.25rem] bg-[#fdfbf6] p-4">
                <div className="mb-4 flex items-center justify-between gap-4 border-[#17120e] border-b pb-4">
                  <div>
                    <p className="font-black text-2xl">Control del evento</p>
                    <p className="font-semibold text-[#65584d]">Cena Sunset Jazz</p>
                  </div>
                  <div className="rounded-full bg-[#55c0a9] px-3 py-1 font-black text-sm text-[#10231f]">ON TIME</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {eventFacts.map((fact) => (
                    <div key={fact.label} className="rounded-lg border border-[#d8cdbf] bg-white p-3">
                      <fact.icon aria-hidden="true" className="mb-2 text-[#f45d48]" />
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a786a]">{fact.label}</p>
                      <p className="mt-1 font-black text-lg">{fact.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-xl border border-[#17120e] bg-[#f8c84c] p-3">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="font-black text-xl">Check-in</p>
                        <p className="text-sm font-semibold text-[#4c4037]">The Riviera Quartet</p>
                      </div>
                      <CheckCircle2 aria-hidden="true" />
                    </div>
                    <div className="rounded-lg border border-[#17120e] bg-white p-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-black text-4xl">19:52</span>
                        <span className="rounded-full bg-[#17120e] px-3 py-1 font-bold text-sm text-white">8 min antes</span>
                      </div>
                      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#65584d]">
                        <MapPin aria-hidden="true" />
                        Ubicación y foto capturadas
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#17120e] bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-black text-xl">Bitácora viva</p>
                      <History aria-hidden="true" className="text-[#f45d48]" />
                    </div>
                    <div className="flex flex-col gap-2">
                      {logs.map((log) => (
                        <div key={`${log.time}-${log.title}`} className="grid grid-cols-[3.5rem_1fr] gap-3 rounded-lg border border-[#e7ded3] bg-[#fdfbf6] p-3">
                          <span className="font-black text-sm text-[#65584d]">{log.time}</span>
                          <div>
                            <p className="font-black leading-tight">{log.title}</p>
                            <p className="text-sm font-medium text-[#65584d]">{log.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-[#17120e] border-b bg-[#17120e] px-5 py-16 text-white md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="mb-3 font-black text-[#f8c84c] uppercase tracking-[0.24em]">El problema que resolvemos</p>
            <h2 className="text-balance font-black text-4xl leading-tight sm:text-5xl">
              Antes: mensajes, dudas y llamadas de último minuto. Ahora: evidencia.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {["¿Quién cambió el evento?", "¿La banda ya llegó?", "¿Cuál hotel tiene el dato correcto?"].map((question) => (
              <div key={question} className="min-h-36 rounded-lg border border-white/25 bg-white/8 p-5">
                <p className="font-black text-2xl text-[#f45d48]">?</p>
                <p className="mt-5 font-bold text-lg">{question}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-[#17120e] border-b bg-[#f8c84c] px-5 py-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="font-black uppercase tracking-[0.24em] text-[#8a3b31]">Fuente de verdad</p>
              <h2 className="mt-3 text-balance font-black text-4xl leading-tight sm:text-6xl">
                Dejar de operar la compañía en cinco lugares distintos.
              </h2>
            </div>
            <p className="max-w-2xl text-lg font-bold leading-8 text-[#4c4037]">
              GigFlow centraliza lo que antes vivía disperso: eventos, hoteles, músicos, bandas, invitaciones, check-ins, notificaciones, reportes y bitácoras. Una compañía no debería depender de recordar dónde se dijo algo.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {scatteredChannels.map((channel) => (
              <article key={channel.name} className="rounded-xl border border-[#17120e] bg-[#fdfbf6] p-5 shadow-[6px_6px_0_#17120e]">
                <channel.icon aria-hidden="true" className="mb-6 text-[#f45d48]" />
                <h3 className="font-black text-xl">{channel.name}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#65584d]">{channel.pain}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border-2 border-[#17120e] bg-[#17120e] p-5 text-white shadow-[10px_10px_0_#f45d48]">
            <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-center">
              <p className="font-black text-3xl leading-tight">Todo sobre la operación de la compañía, en un solo sistema.</p>
              <p className="text-lg font-bold leading-8 text-white/75">
                El punto no es reemplazar conversaciones humanas. Es que las decisiones importantes terminen registradas en el lugar correcto, con contexto, responsables, hora y evidencia.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#fdfbf6] px-5 py-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="font-black text-[#f45d48] uppercase tracking-[0.24em]">Beneficios</p>
              <h2 className="mt-3 max-w-3xl text-balance font-black text-4xl leading-tight sm:text-6xl">
                Una sola cabina para operar eventos musicales.
              </h2>
            </div>
            <p className="max-w-md text-lg font-medium leading-7 text-[#65584d]">
              El manager deja de perseguir información. El hotel gana visibilidad. El músico tiene una forma clara de comprobar llegada.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className="rounded-xl border border-[#17120e] bg-[#f7f3ea] p-6 shadow-[7px_7px_0_#17120e]"
              >
                <div className="mb-8 flex items-start justify-between gap-4">
                  <benefit.icon aria-hidden="true" className="text-[#f45d48]" />
                  <span className="font-black text-5xl text-[#d8cdbf]">0{index + 1}</span>
                </div>
                <h3 className="font-black text-2xl">{benefit.title}</h3>
                <p className="mt-3 text-lg font-medium leading-7 text-[#4c4037]">{benefit.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-[#17120e] border-y bg-[#55c0a9] px-5 py-16 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="font-black uppercase tracking-[0.24em] text-[#10231f]">Flujo operacional</p>
            <h2 className="mt-3 text-balance font-black text-4xl leading-tight sm:text-6xl">
              Del booking al escenario, todo deja rastro.
            </h2>
          </div>
          <div className="rounded-2xl border-2 border-[#17120e] bg-[#fdfbf6] p-4 shadow-[12px_12px_0_#17120e]">
            {operatingLoop.map((step, index) => (
              <div key={step} className="flex gap-4 border-[#d8cdbf] border-b p-4 last:border-b-0">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f45d48] font-black text-white">
                  {index + 1}
                </div>
                <p className="self-center text-lg font-black">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f7f3ea] px-5 py-20 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="font-black text-[#f45d48] uppercase tracking-[0.24em]">Por qué confiar</p>
              <h2 className="mt-3 text-balance font-black text-4xl leading-tight sm:text-6xl">
                No es una pantalla bonita. Es una base para operar.
              </h2>
            </div>
            <p className="max-w-2xl text-lg font-medium leading-8 text-[#4c4037]">
              La propuesta no vende “software para eventos” en abstracto. Ataca un problema específico: controlar la ejecución real de música en hoteles con trazabilidad, responsabilidad y datos confiables.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {productProof.map((proof) => (
              <article key={proof.title} className="rounded-xl border border-[#17120e] bg-white p-6 shadow-[7px_7px_0_#17120e]">
                <proof.icon aria-hidden="true" className="mb-8 text-[#f45d48]" />
                <h3 className="font-black text-2xl">{proof.title}</h3>
                <p className="mt-3 text-lg font-medium leading-7 text-[#4c4037]">{proof.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#17120e] px-5 py-20 text-white md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div>
              <p className="font-black text-[#f8c84c] uppercase tracking-[0.24em]">Cierre de demo</p>
              <h2 className="mt-3 max-w-4xl text-balance font-black text-4xl leading-tight sm:text-6xl">
                La demo no pide fe. Muestra control operativo.
              </h2>
            </div>
            <p className="max-w-2xl text-lg font-bold leading-8 text-white/75">
              El producto ya conecta calendario, administración de eventos, músicos, hoteles, bandas, check-in, notificaciones, reportes y auditoría de eventos.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-white/25 bg-white/8 p-6">
              <div className="mb-6 flex items-center gap-3">
                <RadioTower aria-hidden="true" className="text-[#f8c84c]" />
                <h3 className="font-black text-3xl">Sistema de señales</h3>
              </div>
              <div className="grid gap-3">
                {signals.map(([label, value]) => (
                  <div key={label} className="grid gap-2 rounded-lg border border-white/20 bg-[#fdfbf6] p-4 text-[#17120e] sm:grid-cols-[9rem_1fr]">
                    <span className="font-black text-[#f45d48]">{label}</span>
                    <span className="font-bold">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#f8c84c] bg-[#f8c84c] p-6 text-[#17120e]">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="font-black uppercase tracking-[0.18em] text-[#8a3b31]">Guion recomendado</p>
                  <h3 className="mt-2 font-black text-3xl">90 segundos para ganar la sala</h3>
                </div>
                <ShieldCheck aria-hidden="true" />
              </div>
              <div className="grid gap-3">
                {demoScript.map((item) => (
                  <article key={item.moment} className="grid gap-4 rounded-xl border border-[#17120e] bg-white p-4 sm:grid-cols-[4rem_1fr]">
                    <div className="flex size-14 items-center justify-center rounded-full bg-[#17120e] font-black text-white">
                      {item.moment}
                    </div>
                    <div>
                      <h4 className="font-black text-xl">{item.title}</h4>
                      <p className="mt-1 font-semibold leading-6 text-[#4c4037]">{item.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {[
              [Activity, "Estados"],
              [ClipboardList, "Reportes"],
              [Building2, "Hoteles"],
              [Music2, "Talento"],
            ].map(([Icon, label]) => (
              <div key={label as string} className="rounded-lg border border-white/20 bg-white/8 p-4 font-black">
                <Icon aria-hidden="true" className="mb-3 text-[#55c0a9]" />
                {label as string}
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-5 border-[#f8c84c] border-t pt-8 md:flex-row md:items-center">
            <p className="max-w-2xl text-2xl font-black leading-tight">
              Mensaje final: GigFlow no solo agenda música; convierte cada evento en una operación medible, verificable y escalable.
            </p>
            <Link
              className="group inline-flex items-center gap-2 rounded-full border border-[#f8c84c] bg-[#f8c84c] px-5 py-3 font-black text-[#17120e] shadow-[4px_4px_0_#f45d48] transition-transform hover:-translate-y-0.5"
              href="/auth/login"
            >
              Entrar al producto
              <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
