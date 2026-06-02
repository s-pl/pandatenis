/**
 * Catálogo de plantillas WhatsApp predefinidas para escuelas de tenis.
 *
 * Estas plantillas NO se envían a Meta automáticamente. Desde la biblioteca,
 * el admin puede clonar la que quiera a su lista de plantillas locales y
 * decidir después si la envía a aprobación (botón "Enviar a Meta" en la tarjeta).
 *
 * Reglas Meta respetadas:
 *  - El body NO empieza ni termina con variable.
 *  - Las variables van con contexto descriptivo alrededor.
 *  - El body tiene siempre texto fijo además de las variables.
 */

export type CatalogTemplate = {
  slug: string;
  name: string;
  description: string;
  category: "recibo" | "promocion" | "evento" | "inscripcion" | "galeria";
  body: string;
  metaTemplateName: string;
  tags: string[];
};

export type CatalogGroup = {
  id: string;
  title: string;
  description: string;
  icon: "receipt" | "megaphone" | "calendar" | "userplus" | "image" | "trophy" | "sun" | "bell";
  templates: CatalogTemplate[];
};

export const TEMPLATE_CATALOG: CatalogGroup[] = [
  {
    id: "pagos",
    title: "Pagos y recibos",
    description: "Cobros, recordatorios y confirmaciones de pago.",
    icon: "receipt",
    templates: [
      {
        slug: "recibo_pago_confirmado",
        name: "Recibo pagado",
        description: "Confirmación al recibir un pago de cuota o matrícula.",
        category: "recibo",
        body:
          "Hola {{1}}, hemos recibido tu pago del recibo {{2}} por importe de {{3}}€. ¡Gracias por confiar en la escuela!",
        metaTemplateName: "recibo_pago_confirmado",
        tags: ["recibo", "pago", "confirmacion"],
      },
      {
        slug: "recordatorio_pago_proximo",
        name: "Recordatorio de pago próximo",
        description: "Aviso amable unos días antes del vencimiento de un recibo.",
        category: "recibo",
        body:
          "Hola {{1}}, te recordamos que el recibo {{2}} de {{3}}€ vence el {{4}}. Puedes pagarlo por transferencia o Bizum, gracias.",
        metaTemplateName: "recordatorio_pago_proximo",
        tags: ["recibo", "recordatorio", "vencimiento"],
      },
      {
        slug: "recibo_atrasado_amable",
        name: "Recibo atrasado (tono amable)",
        description: "Primer aviso cuando un recibo se ha pasado de fecha.",
        category: "recibo",
        body:
          "Hola {{1}}, hemos visto que el recibo {{2}} por {{3}}€ aún figura pendiente desde el {{4}}. ¿Podrías revisarlo cuando puedas? Cualquier duda nos cuentas.",
        metaTemplateName: "recibo_atrasado_amable",
        tags: ["recibo", "atrasado", "deuda"],
      },
      {
        slug: "confirmacion_matricula",
        name: "Confirmación de matrícula",
        description: "Confirma matrícula y resume importe + concepto.",
        category: "recibo",
        body:
          "Hola {{1}}, la matrícula de {{2}} queda confirmada por un importe de {{3}}€. Ya puedes ver el calendario en el área privada de familias, ¡bienvenidos!",
        metaTemplateName: "confirmacion_matricula",
        tags: ["matricula", "confirmacion"],
      },
      {
        slug: "cambio_cuota_aviso",
        name: "Aviso de cambio de cuota",
        description: "Informa de un cambio en la cuota mensual.",
        category: "recibo",
        body:
          "Hola {{1}}, te avisamos de que la cuota mensual de {{2}} pasa a ser de {{3}}€ a partir de {{4}}. Si necesitas que lo hablemos, escríbenos por aquí.",
        metaTemplateName: "cambio_cuota_aviso",
        tags: ["cuota", "cambio", "aviso"],
      },
    ],
  },
  {
    id: "asistencia",
    title: "Asistencia y clases",
    description: "Recordatorios de clase, cambios de horario y bajas.",
    icon: "bell",
    templates: [
      {
        slug: "recordatorio_clase_manana",
        name: "Recordatorio de clase mañana",
        description: "Aviso la tarde anterior a una clase.",
        category: "evento",
        body:
          "Hola {{1}}, te recordamos la clase de {{2}} mañana {{3}} a las {{4}}. ¡Nos vemos en la pista! 🎾",
        metaTemplateName: "recordatorio_clase_manana",
        tags: ["clase", "recordatorio"],
      },
      {
        slug: "cancelacion_clase_lluvia",
        name: "Cancelación por lluvia",
        description: "Avisa cuando se suspende una clase por mal tiempo.",
        category: "evento",
        body:
          "Hola {{1}}, suspendemos la clase de {{2}} de hoy a las {{3}} por la lluvia. Cuando confirmemos día de recuperación te avisamos por aquí.",
        metaTemplateName: "cancelacion_clase_lluvia",
        tags: ["cancelacion", "lluvia", "clase"],
      },
      {
        slug: "cambio_pista_aviso",
        name: "Cambio de pista",
        description: "Informa de un cambio de pista o instalación.",
        category: "evento",
        body:
          "Hola {{1}}, la clase de {{2}} de las {{3}} se traslada a la pista {{4}}. ¡Os esperamos allí!",
        metaTemplateName: "cambio_pista_aviso",
        tags: ["cambio", "pista"],
      },
      {
        slug: "ausencia_avisada_ok",
        name: "Confirmación de ausencia avisada",
        description: "Acuse de recibo cuando la familia avisa de una falta.",
        category: "evento",
        body:
          "Hola {{1}}, tomamos nota de la ausencia de {{2}} a la clase del {{3}}. Si quieres recuperarla, dinos qué día os va bien y miramos hueco.",
        metaTemplateName: "ausencia_avisada_ok",
        tags: ["ausencia", "falta"],
      },
      {
        slug: "recuperacion_clase_propuesta",
        name: "Propuesta de recuperación",
        description: "Ofrece día y hora para recuperar una clase perdida.",
        category: "evento",
        body:
          "Hola {{1}}, te proponemos recuperar la clase de {{2}} el {{3}} a las {{4}}. Confírmanos si os va bien y la dejamos apuntada.",
        metaTemplateName: "recuperacion_clase_propuesta",
        tags: ["recuperacion", "clase"],
      },
      {
        slug: "profesor_sustitucion_aviso",
        name: "Aviso de profesor sustituto",
        description: "Cuando el profesor habitual no puede dar una clase.",
        category: "evento",
        body:
          "Hola {{1}}, en la clase de {{2}} del {{3}} cubrirá la sesión el profesor {{4}}, que ya conoce al grupo. Cualquier duda nos dices.",
        metaTemplateName: "profesor_sustitucion_aviso",
        tags: ["profesor", "sustitucion"],
      },
    ],
  },
  {
    id: "inscripciones",
    title: "Inscripciones y captación",
    description: "Bienvenidas, plazas abiertas y seguimiento de leads.",
    icon: "userplus",
    templates: [
      {
        slug: "bienvenida_nuevo_alumno",
        name: "Bienvenida a nuevo alumno",
        description: "Primer mensaje cuando se confirma una plaza.",
        category: "inscripcion",
        body:
          "Hola {{1}}, ¡bienvenida familia! Hemos confirmado la plaza de {{2}} en el grupo {{3}} con clases los {{4}}. Cualquier duda, estamos aquí.",
        metaTemplateName: "bienvenida_nuevo_alumno",
        tags: ["bienvenida", "alumno"],
      },
      {
        slug: "lista_espera_aviso",
        name: "Plaza disponible (lista de espera)",
        description: "Avisar a una familia en lista de espera cuando se abre hueco.",
        category: "inscripcion",
        body:
          "Hola {{1}}, ¡buenas noticias! Se ha abierto plaza en el grupo {{2}} para {{3}}. ¿Te interesa reservarla? Responde a este mensaje y la dejamos apartada 48 h.",
        metaTemplateName: "lista_espera_aviso",
        tags: ["lista", "espera", "plaza"],
      },
      {
        slug: "puertas_abiertas_invitacion",
        name: "Invitación a puertas abiertas",
        description: "Invita a una familia interesada a una jornada de prueba.",
        category: "inscripcion",
        body:
          "Hola {{1}}, te invitamos a la jornada de puertas abiertas del {{2}} a las {{3}} en la escuela. Trae a {{4}} y os enseñamos cómo trabajamos. ¿Confirmas?",
        metaTemplateName: "puertas_abiertas_invitacion",
        tags: ["puertas-abiertas", "captacion"],
      },
      {
        slug: "clase_prueba_propuesta",
        name: "Propuesta de clase de prueba",
        description: "Ofrece una clase gratuita al lead nuevo.",
        category: "inscripcion",
        body:
          "Hola {{1}}, te proponemos una clase de prueba para {{2}} el {{3}} a las {{4}}. Si os encaja, confírmame y reservamos sitio en el grupo.",
        metaTemplateName: "clase_prueba_propuesta",
        tags: ["clase-prueba", "lead"],
      },
      {
        slug: "seguimiento_lead_frio",
        name: "Seguimiento a lead frío",
        description: "Mensaje suave a un contacto que dejó la solicitud parada.",
        category: "inscripcion",
        body:
          "Hola {{1}}, te escribimos para retomar la inscripción que dejasteis para {{2}}. Si seguís interesados, os contamos opciones de grupos y horarios. ¡Sin compromiso!",
        metaTemplateName: "seguimiento_lead_frio",
        tags: ["lead", "seguimiento"],
      },
      {
        slug: "renovacion_plaza_temporada",
        name: "Renovación de plaza temporada",
        description: "Recordatorio para renovar plaza el curso siguiente.",
        category: "inscripcion",
        body:
          "Hola {{1}}, abrimos la renovación de plaza para {{2}} en la temporada {{3}}. Si quieres mantener su grupo y horario actual, confírmanos antes del {{4}}.",
        metaTemplateName: "renovacion_plaza_temporada",
        tags: ["renovacion", "temporada"],
      },
    ],
  },
  {
    id: "campus",
    title: "Campus e intensivos",
    description: "Convocatorias de campus, semanas blancas, intensivos…",
    icon: "sun",
    templates: [
      {
        slug: "campus_apertura_inscripcion",
        name: "Campus: apertura de inscripción",
        description: "Comunica el inicio de inscripciones de un campus.",
        category: "inscripcion",
        body:
          "Hola {{1}}, ya está abierta la inscripción al {{2}} del {{3}} al {{4}}. Puedes apuntar a {{5}} desde el área web de familias o respondiendo a este mensaje.",
        metaTemplateName: "campus_apertura_inscripcion",
        tags: ["campus", "inscripcion"],
      },
      {
        slug: "campus_confirmacion_plaza",
        name: "Campus: confirmación de plaza",
        description: "Confirma la plaza de un niño/a en el campus.",
        category: "inscripcion",
        body:
          "Hola {{1}}, confirmamos la plaza de {{2}} en el {{3}}. Las fechas son {{4}} y el horario {{5}}. La semana antes te enviaremos qué llevar.",
        metaTemplateName: "campus_confirmacion_plaza",
        tags: ["campus", "plaza"],
      },
      {
        slug: "campus_recordatorio_inicio",
        name: "Campus: recordatorio inicio",
        description: "Envío 2-3 días antes del comienzo del campus.",
        category: "evento",
        body:
          "Hola {{1}}, el {{2}} empieza el {{3}} a las {{4}}. Recuerda traer ropa cómoda, gorra, crema solar y botella de agua. ¡Os esperamos!",
        metaTemplateName: "campus_recordatorio_inicio",
        tags: ["campus", "recordatorio"],
      },
      {
        slug: "campus_intensivo_navidad",
        name: "Intensivo de Navidad",
        description: "Promoción del intensivo navideño.",
        category: "promocion",
        body:
          "Hola {{1}}, abrimos plazas para el intensivo de Navidad del {{2}}. Cinco días para que {{3}} no pierda ritmo con tenis, juegos y mucho ambiente.",
        metaTemplateName: "campus_intensivo_navidad",
        tags: ["intensivo", "navidad"],
      },
      {
        slug: "campus_semana_blanca",
        name: "Semana blanca",
        description: "Intensivo de la semana blanca / Semana Santa.",
        category: "promocion",
        body:
          "Hola {{1}}, durante la semana blanca organizamos un intensivo de tenis del {{2}}. Si te interesa apuntar a {{3}}, escríbenos y te mandamos detalles.",
        metaTemplateName: "campus_semana_blanca",
        tags: ["semana-blanca", "intensivo"],
      },
      {
        slug: "campus_ultimas_plazas",
        name: "Últimas plazas campus",
        description: "Sentido de urgencia cuando quedan pocas plazas.",
        category: "promocion",
        body:
          "Hola {{1}}, quedan las últimas plazas para el {{2}}. Si quieres reservar la de {{3}}, confírmanos en los próximos días o pasaremos a la lista de espera.",
        metaTemplateName: "campus_ultimas_plazas",
        tags: ["campus", "urgencia"],
      },
    ],
  },
  {
    id: "eventos",
    title: "Torneos y eventos",
    description: "Convocatorias, resultados y entregas de premios.",
    icon: "trophy",
    templates: [
      {
        slug: "torneo_convocatoria",
        name: "Convocatoria de torneo",
        description: "Anuncia un torneo interno o abierto.",
        category: "evento",
        body:
          "Hola {{1}}, el {{2}} celebraremos el torneo {{3}} para la categoría {{4}}. Si te animas a participar, confírmanos antes del {{5}}.",
        metaTemplateName: "torneo_convocatoria",
        tags: ["torneo", "convocatoria"],
      },
      {
        slug: "torneo_recordatorio_horario",
        name: "Torneo: horario individual",
        description: "Envía a cada jugador su hora del torneo.",
        category: "evento",
        body:
          "Hola {{1}}, te confirmamos que {{2}} juega el {{3}} a las {{4}} en la pista {{5}}. Recordad llegar 20 minutos antes para calentar.",
        metaTemplateName: "torneo_horario_individual",
        tags: ["torneo", "horario"],
      },
      {
        slug: "torneo_resultado_final",
        name: "Resultado y enhorabuena",
        description: "Felicita después de jugar (gane o pierda).",
        category: "evento",
        body:
          "Hola {{1}}, enhorabuena a {{2}} por el partido de hoy en el {{3}}. {{4}} ¡Seguimos trabajando para la próxima!",
        metaTemplateName: "torneo_resultado_final",
        tags: ["torneo", "resultado"],
      },
      {
        slug: "entrega_premios_invitacion",
        name: "Entrega de premios",
        description: "Invita a la entrega de premios o fiesta de fin de temporada.",
        category: "evento",
        body:
          "Hola {{1}}, te invitamos a la entrega de premios del {{2}} el día {{3}} a las {{4}} en la escuela. Vendrán todos los grupos, ¡no faltéis!",
        metaTemplateName: "entrega_premios_invitacion",
        tags: ["premios", "evento"],
      },
      {
        slug: "fiesta_fin_temporada",
        name: "Fiesta de fin de temporada",
        description: "Convoca a la fiesta de cierre con familias.",
        category: "evento",
        body:
          "Hola {{1}}, cerramos la temporada con una fiesta el {{2}} a las {{3}}. Habrá partidos, sorteo y picoteo. Si venís, confírmanos cuántos seréis.",
        metaTemplateName: "fiesta_fin_temporada",
        tags: ["fiesta", "fin-temporada"],
      },
    ],
  },
  {
    id: "comunicacion",
    title: "Comunicación general",
    description: "Comunicados breves a familias y vecinos del club.",
    icon: "megaphone",
    templates: [
      {
        slug: "obras_aviso_familias",
        name: "Aviso de obras",
        description: "Avisa de obras o mantenimiento en las instalaciones.",
        category: "evento",
        body:
          "Hola {{1}}, del {{2}} al {{3}} estaremos haciendo mejoras en {{4}}. Las clases siguen con normalidad en {{5}}. Disculpa las molestias.",
        metaTemplateName: "obras_aviso_familias",
        tags: ["obras", "mantenimiento"],
      },
      {
        slug: "cambio_horario_recepcion",
        name: "Nuevo horario de recepción",
        description: "Comunica un cambio de horario de oficina.",
        category: "evento",
        body:
          "Hola {{1}}, te avisamos del nuevo horario de recepción a partir del {{2}}: de lunes a viernes de {{3}} a {{4}}. ¡Cualquier duda nos cuentas!",
        metaTemplateName: "cambio_horario_recepcion",
        tags: ["horario", "recepcion"],
      },
      {
        slug: "encuesta_satisfaccion",
        name: "Encuesta de satisfacción",
        description: "Solicita feedback al final del trimestre.",
        category: "promocion",
        body:
          "Hola {{1}}, ¿te dedicarías 2 minutos a contarnos cómo va {{2}} en clase? Aquí va el formulario: {{3}}. Nos ayuda muchísimo a mejorar, ¡gracias!",
        metaTemplateName: "encuesta_satisfaccion",
        tags: ["encuesta", "feedback"],
      },
      {
        slug: "valoracion_google_invitacion",
        name: "Invitación a valoración Google",
        description: "Pide reseña a familias contentas.",
        category: "promocion",
        body:
          "Hola {{1}}, si {{2}} está disfrutando de las clases, nos ayudaría mucho una reseña en Google. Aquí tienes el enlace directo: {{3}}. ¡Gracias!",
        metaTemplateName: "valoracion_google_invitacion",
        tags: ["resena", "google"],
      },
      {
        slug: "documento_autorizacion",
        name: "Envío de autorización",
        description: "Envía un PDF a firmar (autorización imagen, salidas, etc.).",
        category: "evento",
        body:
          "Hola {{1}}, te adjuntamos la autorización de {{2}} para que la revises y nos la devuelvas firmada antes del {{3}}. Cualquier duda nos preguntas.",
        metaTemplateName: "documento_autorizacion",
        tags: ["autorizacion", "documento", "pdf"],
      },
    ],
  },
  {
    id: "galeria",
    title: "Galería y momentos",
    description: "Envíos personales con fotos o momentos del alumno.",
    icon: "image",
    templates: [
      {
        slug: "galeria_foto_clase",
        name: "Foto desde la clase",
        description: "Comparte una foto puntual con la familia.",
        category: "galeria",
        body:
          "Hola {{1}}, te mandamos una foto de {{2}} hoy en la pista. ¡Está disfrutando muchísimo!",
        metaTemplateName: "galeria_foto_clase",
        tags: ["galeria", "foto"],
      },
      {
        slug: "galeria_video_progreso",
        name: "Vídeo de progreso",
        description: "Comparte un vídeo del golpe trabajado.",
        category: "galeria",
        body:
          "Hola {{1}}, te mandamos un vídeo corto de {{2}} trabajando {{3}}. Mira qué bien lo está cogiendo. ¡A seguir!",
        metaTemplateName: "galeria_video_progreso",
        tags: ["galeria", "video"],
      },
      {
        slug: "felicitacion_cumple_alumno",
        name: "Cumpleaños del alumno",
        description: "Felicita al niño/a por su cumpleaños.",
        category: "promocion",
        body:
          "¡Hola {{1}}! Hoy es el cumple de {{2}} y queremos felicitarle desde toda la escuela 🎂🎾. ¡Que paséis un día genial!",
        metaTemplateName: "felicitacion_cumple_alumno",
        tags: ["cumple", "felicitacion"],
      },
      {
        slug: "felicitacion_navidad",
        name: "Felicitación de Navidad",
        description: "Comunicado navideño general.",
        category: "promocion",
        body:
          "Hola {{1}}, desde toda la escuela os deseamos unas felices fiestas a la familia de {{2}}. Volvemos el {{3}}, ¡nos vemos pronto en la pista!",
        metaTemplateName: "felicitacion_navidad",
        tags: ["navidad", "felicitacion"],
      },
      {
        slug: "felicitacion_fin_curso",
        name: "Fin de curso",
        description: "Despedida al cerrar el curso escolar.",
        category: "promocion",
        body:
          "Hola {{1}}, cerramos el curso muy contentos con la evolución de {{2}}. Disfrutad del verano y nos vemos en septiembre con las clases del {{3}}.",
        metaTemplateName: "felicitacion_fin_curso",
        tags: ["fin-curso", "despedida"],
      },
    ],
  },
];

export function flatCatalog(): CatalogTemplate[] {
  return TEMPLATE_CATALOG.flatMap((group) => group.templates);
}

export function findCatalogTemplate(slug: string): CatalogTemplate | null {
  for (const group of TEMPLATE_CATALOG) {
    const found = group.templates.find((t) => t.slug === slug);
    if (found) return found;
  }
  return null;
}
