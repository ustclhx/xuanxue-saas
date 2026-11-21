import type { CardMeaning } from '../types.ts'

// 西班牙语牌义短句（openspec add-locales-eu-ja 任务 5.6）：牌名取术语表 apps/web/i18n/glossary/es.json，
// 关键词与牌义长文 content/tarot/es 的「Palabras clave」一致；是或否的答案词由 yesNo 固定映射决定。
export const meanings: Readonly<Record<string, CardMeaning>> = {
  'major-00': {
    name: 'El Loco',
    keywords: ['nuevos comienzos', 'apertura'],
    upright: 'Reflexiona sobre nuevos comienzos y apertura.',
    reversed: 'Observa cómo imprudencia y vacilación pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre nuevos comienzos y apertura; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre imprudencia y vacilación; no es una predicción.',
    },
  },
  'major-01': {
    name: 'El Mago',
    keywords: ['iniciativa', 'habilidad'],
    upright: 'Reflexiona sobre iniciativa y habilidad.',
    reversed: 'Observa cómo manipulación y dispersión pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre iniciativa y habilidad; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre manipulación y dispersión; no es una predicción.',
    },
  },
  'major-02': {
    name: 'La Sacerdotisa',
    keywords: ['intuición', 'reflexión'],
    upright: 'Reflexiona sobre intuición y reflexión.',
    reversed: 'Observa cómo secretismo y intuición ignorada pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre intuición y reflexión; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre secretismo y intuición ignorada; no es una predicción.',
    },
  },
  'major-03': {
    name: 'La Emperatriz',
    keywords: ['creatividad', 'cuidado'],
    upright: 'Reflexiona sobre creatividad y cuidado.',
    reversed: 'Observa cómo dependencia y descuido pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre creatividad y cuidado; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre dependencia y descuido; no es una predicción.',
    },
  },
  'major-04': {
    name: 'El Emperador',
    keywords: ['estructura', 'liderazgo'],
    upright: 'Reflexiona sobre estructura y liderazgo.',
    reversed: 'Observa cómo rigidez y control pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre estructura y liderazgo; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre rigidez y control; no es una predicción.',
    },
  },
  'major-05': {
    name: 'El Hierofante',
    keywords: ['tradición', 'aprendizaje'],
    upright: 'Reflexiona sobre tradición y aprendizaje.',
    reversed: 'Observa cómo conformismo y cuestionamiento pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre tradición y aprendizaje; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre conformismo y cuestionamiento; no es una predicción.',
    },
  },
  'major-06': {
    name: 'Los Enamorados',
    keywords: ['armonía', 'elección'],
    upright: 'Reflexiona sobre armonía y elección.',
    reversed: 'Observa cómo discordia y desajuste pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre armonía y elección; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre discordia y desajuste; no es una predicción.',
    },
  },
  'major-07': {
    name: 'El Carro',
    keywords: ['dirección', 'determinación'],
    upright: 'Reflexiona sobre dirección y determinación.',
    reversed: 'Observa cómo fuerza sin control y rumbo perdido pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre dirección y determinación; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre fuerza sin control y rumbo perdido; no es una predicción.',
    },
  },
  'major-08': {
    name: 'La Fuerza',
    keywords: ['paciencia', 'valentía'],
    upright: 'Reflexiona sobre paciencia y valentía.',
    reversed: 'Observa cómo inseguridad y impaciencia pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre paciencia y valentía; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre inseguridad y impaciencia; no es una predicción.',
    },
  },
  'major-09': {
    name: 'El Ermitaño',
    keywords: ['soledad', 'introspección'],
    upright: 'Reflexiona sobre soledad y introspección.',
    reversed: 'Observa cómo aislamiento y retraimiento pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre soledad y introspección; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre aislamiento y retraimiento; no es una predicción.',
    },
  },
  'major-10': {
    name: 'La Rueda de la Fortuna',
    keywords: ['ciclos', 'adaptabilidad'],
    upright: 'Reflexiona sobre ciclos y adaptabilidad.',
    reversed: 'Observa cómo resistencia al cambio y inestabilidad pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre ciclos y adaptabilidad; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre resistencia al cambio y inestabilidad; no es una predicción.',
    },
  },
  'major-11': {
    name: 'La Justicia',
    keywords: ['equidad', 'responsabilidad'],
    upright: 'Reflexiona sobre equidad y responsabilidad.',
    reversed: 'Observa cómo parcialidad y evasión pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre equidad y responsabilidad; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre parcialidad y evasión; no es una predicción.',
    },
  },
  'major-12': {
    name: 'El Colgado',
    keywords: ['pausa', 'nueva perspectiva'],
    upright: 'Reflexiona sobre pausa y nueva perspectiva.',
    reversed: 'Observa cómo postergación y resistencia pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre pausa y nueva perspectiva; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre postergación y resistencia; no es una predicción.',
    },
  },
  'major-13': {
    name: 'La Muerte',
    keywords: ['finales', 'transición'],
    upright: 'Reflexiona sobre finales y transición.',
    reversed: 'Observa cómo estancamiento y aferramiento pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre finales y transición; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre estancamiento y aferramiento; no es una predicción.',
    },
  },
  'major-14': {
    name: 'La Templanza',
    keywords: ['equilibrio', 'moderación'],
    upright: 'Reflexiona sobre equilibrio y moderación.',
    reversed: 'Observa cómo exceso y desequilibrio pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre equilibrio y moderación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre exceso y desequilibrio; no es una predicción.',
    },
  },
  'major-15': {
    name: 'El Diablo',
    keywords: ['apego', 'hábitos'],
    upright: 'Reflexiona sobre apego y hábitos.',
    reversed: 'Observa cómo liberación y toma de conciencia pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre apego y hábitos; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre liberación y toma de conciencia; no es una predicción.',
    },
  },
  'major-16': {
    name: 'La Torre',
    keywords: ['sacudida', 'revelación'],
    upright: 'Reflexiona sobre sacudida y revelación.',
    reversed: 'Observa cómo evitación y cambio aplazado pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre sacudida y revelación; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre evitación y cambio aplazado; no es una predicción.',
    },
  },
  'major-17': {
    name: 'La Estrella',
    keywords: ['esperanza', 'renovación'],
    upright: 'Reflexiona sobre esperanza y renovación.',
    reversed: 'Observa cómo desánimo y desconexión pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre esperanza y renovación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre desánimo y desconexión; no es una predicción.',
    },
  },
  'major-18': {
    name: 'La Luna',
    keywords: ['incertidumbre', 'imaginación'],
    upright: 'Reflexiona sobre incertidumbre y imaginación.',
    reversed: 'Observa cómo claridad y inquietud pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre incertidumbre y imaginación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre claridad y inquietud; no es una predicción.',
    },
  },
  'major-19': {
    name: 'El Sol',
    keywords: ['alegría', 'claridad'],
    upright: 'Reflexiona sobre alegría y claridad.',
    reversed: 'Observa cómo alegría apagada y exceso de confianza pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre alegría y claridad; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre alegría apagada y exceso de confianza; no es una predicción.',
    },
  },
  'major-20': {
    name: 'El Juicio',
    keywords: ['reflexión', 'renovación'],
    upright: 'Reflexiona sobre reflexión y renovación.',
    reversed: 'Observa cómo autocrítica y evasión pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre reflexión y renovación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre autocrítica y evasión; no es una predicción.',
    },
  },
  'major-21': {
    name: 'El Mundo',
    keywords: ['culminación', 'integración'],
    upright: 'Reflexiona sobre culminación y integración.',
    reversed: 'Observa cómo trabajo inconcluso y retraso pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre culminación y integración; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre trabajo inconcluso y retraso; no es una predicción.',
    },
  },
  'wands-01': {
    name: 'As de Bastos',
    keywords: ['inspiración', 'iniciativa'],
    upright: 'Reflexiona sobre inspiración y iniciativa.',
    reversed: 'Observa cómo chispa bloqueada y retraso pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre inspiración y iniciativa; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre chispa bloqueada y retraso; no es una predicción.',
    },
  },
  'wands-02': {
    name: 'Dos de Bastos',
    keywords: ['planificación', 'opciones'],
    upright: 'Reflexiona sobre planificación y opciones.',
    reversed: 'Observa cómo indecisión y visión limitada pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre planificación y opciones; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre indecisión y visión limitada; no es una predicción.',
    },
  },
  'wands-03': {
    name: 'Tres de Bastos',
    keywords: ['expansión', 'previsión'],
    upright: 'Reflexiona sobre expansión y previsión.',
    reversed: 'Observa cómo contratiempos y impaciencia pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre expansión y previsión; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre contratiempos y impaciencia; no es una predicción.',
    },
  },
  'wands-04': {
    name: 'Cuatro de Bastos',
    keywords: ['celebración', 'pertenencia'],
    upright: 'Reflexiona sobre celebración y pertenencia.',
    reversed: 'Observa cómo inestabilidad y exclusión pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre celebración y pertenencia; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre inestabilidad y exclusión; no es una predicción.',
    },
  },
  'wands-05': {
    name: 'Cinco de Bastos',
    keywords: ['competencia', 'fricción'],
    upright: 'Reflexiona sobre competencia y fricción.',
    reversed: 'Observa cómo conflicto evitado y concesiones pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre competencia y fricción; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre conflicto evitado y concesiones; no es una predicción.',
    },
  },
  'wands-06': {
    name: 'Seis de Bastos',
    keywords: ['reconocimiento', 'confianza'],
    upright: 'Reflexiona sobre reconocimiento y confianza.',
    reversed: 'Observa cómo ego y esfuerzo ignorado pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre reconocimiento y confianza; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre ego y esfuerzo ignorado; no es una predicción.',
    },
  },
  'wands-07': {
    name: 'Siete de Bastos',
    keywords: ['convicción', 'límites'],
    upright: 'Reflexiona sobre convicción y límites.',
    reversed: 'Observa cómo agobio y actitud defensiva pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre convicción y límites; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre agobio y actitud defensiva; no es una predicción.',
    },
  },
  'wands-08': {
    name: 'Ocho de Bastos',
    keywords: ['impulso', 'comunicación'],
    upright: 'Reflexiona sobre impulso y comunicación.',
    reversed: 'Observa cómo prisa y malentendidos pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre impulso y comunicación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre prisa y malentendidos; no es una predicción.',
    },
  },
  'wands-09': {
    name: 'Nueve de Bastos',
    keywords: ['resiliencia', 'vigilancia'],
    upright: 'Reflexiona sobre resiliencia y vigilancia.',
    reversed: 'Observa cómo agotamiento y desconfianza pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre resiliencia y vigilancia; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre agotamiento y desconfianza; no es una predicción.',
    },
  },
  'wands-10': {
    name: 'Diez de Bastos',
    keywords: ['carga', 'responsabilidad'],
    upright: 'Reflexiona sobre carga y responsabilidad.',
    reversed: 'Observa cómo liberación y delegación pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre carga y responsabilidad; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre liberación y delegación; no es una predicción.',
    },
  },
  'wands-11': {
    name: 'Sota de Bastos',
    keywords: ['curiosidad', 'exploración'],
    upright: 'Reflexiona sobre curiosidad y exploración.',
    reversed: 'Observa cómo inquietud y falta de rumbo pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre curiosidad y exploración; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre inquietud y falta de rumbo; no es una predicción.',
    },
  },
  'wands-12': {
    name: 'Caballero de Bastos',
    keywords: ['aventura', 'entusiasmo'],
    upright: 'Reflexiona sobre aventura y entusiasmo.',
    reversed: 'Observa cómo impulsividad y inconstancia pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre aventura y entusiasmo; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre impulsividad y inconstancia; no es una predicción.',
    },
  },
  'wands-13': {
    name: 'Reina de Bastos',
    keywords: ['calidez', 'confianza'],
    upright: 'Reflexiona sobre calidez y confianza.',
    reversed: 'Observa cómo celos y inseguridad pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre calidez y confianza; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre celos y inseguridad; no es una predicción.',
    },
  },
  'wands-14': {
    name: 'Rey de Bastos',
    keywords: ['visión', 'liderazgo'],
    upright: 'Reflexiona sobre visión y liderazgo.',
    reversed: 'Observa cómo dominación y impaciencia pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre visión y liderazgo; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre dominación y impaciencia; no es una predicción.',
    },
  },
  'cups-01': {
    name: 'As de Copas',
    keywords: ['apertura emocional', 'compasión'],
    upright: 'Reflexiona sobre apertura emocional y compasión.',
    reversed: 'Observa cómo represión y agotamiento emocional pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre apertura emocional y compasión; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre represión y agotamiento emocional; no es una predicción.',
    },
  },
  'cups-02': {
    name: 'Dos de Copas',
    keywords: ['conexión', 'reciprocidad'],
    upright: 'Reflexiona sobre conexión y reciprocidad.',
    reversed: 'Observa cómo desequilibrio y desconexión pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre conexión y reciprocidad; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre desequilibrio y desconexión; no es una predicción.',
    },
  },
  'cups-03': {
    name: 'Tres de Copas',
    keywords: ['amistad', 'celebración'],
    upright: 'Reflexiona sobre amistad y celebración.',
    reversed: 'Observa cómo exclusión y exceso pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre amistad y celebración; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre exclusión y exceso; no es una predicción.',
    },
  },
  'cups-04': {
    name: 'Cuatro de Copas',
    keywords: ['contemplación', 'insatisfacción'],
    upright: 'Reflexiona sobre contemplación y insatisfacción.',
    reversed: 'Observa cómo interés renovado y toma de conciencia pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre contemplación y insatisfacción; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre interés renovado y toma de conciencia; no es una predicción.',
    },
  },
  'cups-05': {
    name: 'Cinco de Copas',
    keywords: ['decepción', 'duelo'],
    upright: 'Reflexiona sobre decepción y duelo.',
    reversed: 'Observa cómo aceptación y recuperación pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre decepción y duelo; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre aceptación y recuperación; no es una predicción.',
    },
  },
  'cups-06': {
    name: 'Seis de Copas',
    keywords: ['recuerdos', 'bondad'],
    upright: 'Reflexiona sobre recuerdos y bondad.',
    reversed: 'Observa cómo nostalgia y apego al pasado pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre recuerdos y bondad; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre nostalgia y apego al pasado; no es una predicción.',
    },
  },
  'cups-07': {
    name: 'Siete de Copas',
    keywords: ['opciones', 'fantasía'],
    upright: 'Reflexiona sobre opciones y fantasía.',
    reversed: 'Observa cómo claridad y reducción de opciones pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre opciones y fantasía; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre claridad y reducción de opciones; no es una predicción.',
    },
  },
  'cups-08': {
    name: 'Ocho de Copas',
    keywords: ['partida', 'búsqueda'],
    upright: 'Reflexiona sobre partida y búsqueda.',
    reversed: 'Observa cómo evasión y indecisión pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre partida y búsqueda; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre evasión y indecisión; no es una predicción.',
    },
  },
  'cups-09': {
    name: 'Nueve de Copas',
    keywords: ['satisfacción', 'gratitud'],
    upright: 'Reflexiona sobre satisfacción y gratitud.',
    reversed: 'Observa cómo insatisfacción y exceso de indulgencia pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre satisfacción y gratitud; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre insatisfacción y exceso de indulgencia; no es una predicción.',
    },
  },
  'cups-10': {
    name: 'Diez de Copas',
    keywords: ['armonía', 'pertenencia'],
    upright: 'Reflexiona sobre armonía y pertenencia.',
    reversed: 'Observa cómo discordia y idealización pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre armonía y pertenencia; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre discordia y idealización; no es una predicción.',
    },
  },
  'cups-11': {
    name: 'Sota de Copas',
    keywords: ['sensibilidad', 'imaginación'],
    upright: 'Reflexiona sobre sensibilidad y imaginación.',
    reversed: 'Observa cómo inmadurez y expresión bloqueada pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre sensibilidad y imaginación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre inmadurez y expresión bloqueada; no es una predicción.',
    },
  },
  'cups-12': {
    name: 'Caballero de Copas',
    keywords: ['romance', 'invitación'],
    upright: 'Reflexiona sobre romance y invitación.',
    reversed: 'Observa cómo ideales poco realistas y cambios de humor pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre romance y invitación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre ideales poco realistas y cambios de humor; no es una predicción.',
    },
  },
  'cups-13': {
    name: 'Reina de Copas',
    keywords: ['empatía', 'calma interior'],
    upright: 'Reflexiona sobre empatía y calma interior.',
    reversed: 'Observa cómo dar de más y límites difusos pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre empatía y calma interior; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre dar de más y límites difusos; no es una predicción.',
    },
  },
  'cups-14': {
    name: 'Rey de Copas',
    keywords: ['serenidad', 'compasión'],
    upright: 'Reflexiona sobre serenidad y compasión.',
    reversed: 'Observa cómo represión emocional y manipulación pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre serenidad y compasión; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre represión emocional y manipulación; no es una predicción.',
    },
  },
  'swords-01': {
    name: 'As de Espadas',
    keywords: ['claridad', 'lucidez'],
    upright: 'Reflexiona sobre claridad y lucidez.',
    reversed: 'Observa cómo confusión y dureza pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre claridad y lucidez; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre confusión y dureza; no es una predicción.',
    },
  },
  'swords-02': {
    name: 'Dos de Espadas',
    keywords: ['estancamiento', 'deliberación'],
    upright: 'Reflexiona sobre estancamiento y deliberación.',
    reversed: 'Observa cómo sobrecarga y evasión pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre estancamiento y deliberación; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre sobrecarga y evasión; no es una predicción.',
    },
  },
  'swords-03': {
    name: 'Tres de Espadas',
    keywords: ['dolor', 'verdad dolorosa'],
    upright: 'Reflexiona sobre dolor y verdad dolorosa.',
    reversed: 'Observa cómo liberación y perdón pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre dolor y verdad dolorosa; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre liberación y perdón; no es una predicción.',
    },
  },
  'swords-04': {
    name: 'Cuatro de Espadas',
    keywords: ['descanso', 'contemplación'],
    upright: 'Reflexiona sobre descanso y contemplación.',
    reversed: 'Observa cómo inquietud y agotamiento pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre descanso y contemplación; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre inquietud y agotamiento; no es una predicción.',
    },
  },
  'swords-05': {
    name: 'Cinco de Espadas',
    keywords: ['conflicto', 'victoria vacía'],
    upright: 'Reflexiona sobre conflicto y victoria vacía.',
    reversed: 'Observa cómo reconciliación y arrepentimiento pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre conflicto y victoria vacía; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre reconciliación y arrepentimiento; no es una predicción.',
    },
  },
  'swords-06': {
    name: 'Seis de Espadas',
    keywords: ['transición', 'perspectiva'],
    upright: 'Reflexiona sobre transición y perspectiva.',
    reversed: 'Observa cómo resistencia y equipaje pendiente pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre transición y perspectiva; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre resistencia y equipaje pendiente; no es una predicción.',
    },
  },
  'swords-07': {
    name: 'Siete de Espadas',
    keywords: ['estrategia', 'secreto'],
    upright: 'Reflexiona sobre estrategia y secreto.',
    reversed: 'Observa cómo revelación y responsabilidad pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre estrategia y secreto; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre revelación y responsabilidad; no es una predicción.',
    },
  },
  'swords-08': {
    name: 'Ocho de Espadas',
    keywords: ['restricción', 'autolimitación'],
    upright: 'Reflexiona sobre restricción y autolimitación.',
    reversed: 'Observa cómo capacidad de acción y liberación pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre restricción y autolimitación; no es una predicción.',
      reversed:
        'Sí: correspondencia fija de referencia sobre capacidad de acción y liberación; no es una predicción.',
    },
  },
  'swords-09': {
    name: 'Nueve de Espadas',
    keywords: ['preocupación', 'rumiación'],
    upright: 'Reflexiona sobre preocupación y rumiación.',
    reversed: 'Observa cómo perspectiva y búsqueda de apoyo pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre preocupación y rumiación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre perspectiva y búsqueda de apoyo; no es una predicción.',
    },
  },
  'swords-10': {
    name: 'Diez de Espadas',
    keywords: ['final', 'agotamiento'],
    upright: 'Reflexiona sobre final y agotamiento.',
    reversed: 'Observa cómo recuperación y renovación pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre final y agotamiento; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre recuperación y renovación; no es una predicción.',
    },
  },
  'swords-11': {
    name: 'Sota de Espadas',
    keywords: ['indagación', 'estado de alerta'],
    upright: 'Reflexiona sobre indagación y estado de alerta.',
    reversed: 'Observa cómo chisme y prisa pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre indagación y estado de alerta; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre chisme y prisa; no es una predicción.',
    },
  },
  'swords-12': {
    name: 'Caballero de Espadas',
    keywords: ['impulso', 'franqueza'],
    upright: 'Reflexiona sobre impulso y franqueza.',
    reversed: 'Observa cómo imprudencia y agresividad pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre impulso y franqueza; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre imprudencia y agresividad; no es una predicción.',
    },
  },
  'swords-13': {
    name: 'Reina de Espadas',
    keywords: ['discernimiento', 'honestidad'],
    upright: 'Reflexiona sobre discernimiento y honestidad.',
    reversed: 'Observa cómo frialdad y juicio severo pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre discernimiento y honestidad; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre frialdad y juicio severo; no es una predicción.',
    },
  },
  'swords-14': {
    name: 'Rey de Espadas',
    keywords: ['razón', 'integridad'],
    upright: 'Reflexiona sobre razón y integridad.',
    reversed: 'Observa cómo rigidez y abuso de autoridad pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre razón y integridad; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre rigidez y abuso de autoridad; no es una predicción.',
    },
  },
  'pentacles-01': {
    name: 'As de Oros',
    keywords: ['oportunidad', 'arraigo'],
    upright: 'Reflexiona sobre oportunidad y arraigo.',
    reversed: 'Observa cómo oportunidad perdida y mala planificación pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre oportunidad y arraigo; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre oportunidad perdida y mala planificación; no es una predicción.',
    },
  },
  'pentacles-02': {
    name: 'Dos de Oros',
    keywords: ['adaptabilidad', 'prioridades'],
    upright: 'Reflexiona sobre adaptabilidad y prioridades.',
    reversed: 'Observa cómo sobrecarga y desequilibrio pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre adaptabilidad y prioridades; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre sobrecarga y desequilibrio; no es una predicción.',
    },
  },
  'pentacles-03': {
    name: 'Tres de Oros',
    keywords: ['trabajo en equipo', 'oficio'],
    upright: 'Reflexiona sobre trabajo en equipo y oficio.',
    reversed: 'Observa cómo mala coordinación y talento infravalorado pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre trabajo en equipo y oficio; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre mala coordinación y talento infravalorado; no es una predicción.',
    },
  },
  'pentacles-04': {
    name: 'Cuatro de Oros',
    keywords: ['seguridad', 'conservación'],
    upright: 'Reflexiona sobre seguridad y conservación.',
    reversed: 'Observa cómo posesividad y desprendimiento pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre seguridad y conservación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre posesividad y desprendimiento; no es una predicción.',
    },
  },
  'pentacles-05': {
    name: 'Cinco de Oros',
    keywords: ['escasez', 'exclusión'],
    upright: 'Reflexiona sobre escasez y exclusión.',
    reversed: 'Observa cómo apoyo y reconstrucción pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'No: correspondencia fija de referencia sobre escasez y exclusión; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre apoyo y reconstrucción; no es una predicción.',
    },
  },
  'pentacles-06': {
    name: 'Seis de Oros',
    keywords: ['generosidad', 'intercambio'],
    upright: 'Reflexiona sobre generosidad y intercambio.',
    reversed:
      'Observa cómo intercambio desigual y favores con condiciones pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre generosidad y intercambio; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre intercambio desigual y favores con condiciones; no es una predicción.',
    },
  },
  'pentacles-07': {
    name: 'Siete de Oros',
    keywords: ['paciencia', 'evaluación'],
    upright: 'Reflexiona sobre paciencia y evaluación.',
    reversed: 'Observa cómo impaciencia y esfuerzo mal dirigido pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Quizás: correspondencia fija de referencia sobre paciencia y evaluación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre impaciencia y esfuerzo mal dirigido; no es una predicción.',
    },
  },
  'pentacles-08': {
    name: 'Ocho de Oros',
    keywords: ['práctica', 'dedicación'],
    upright: 'Reflexiona sobre práctica y dedicación.',
    reversed: 'Observa cómo perfeccionismo y atajos pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre práctica y dedicación; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre perfeccionismo y atajos; no es una predicción.',
    },
  },
  'pentacles-09': {
    name: 'Nueve de Oros',
    keywords: ['independencia', 'disfrute'],
    upright: 'Reflexiona sobre independencia y disfrute.',
    reversed: 'Observa cómo dependencia y exceso de trabajo pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre independencia y disfrute; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre dependencia y exceso de trabajo; no es una predicción.',
    },
  },
  'pentacles-10': {
    name: 'Diez de Oros',
    keywords: ['legado', 'estabilidad'],
    upright: 'Reflexiona sobre legado y estabilidad.',
    reversed: 'Observa cómo tensiones familiares y inestabilidad pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre legado y estabilidad; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre tensiones familiares y inestabilidad; no es una predicción.',
    },
  },
  'pentacles-11': {
    name: 'Sota de Oros',
    keywords: ['estudio', 'metas prácticas'],
    upright: 'Reflexiona sobre estudio y metas prácticas.',
    reversed: 'Observa cómo postergación y distracción pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre estudio y metas prácticas; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre postergación y distracción; no es una predicción.',
    },
  },
  'pentacles-12': {
    name: 'Caballero de Oros',
    keywords: ['fiabilidad', 'perseverancia'],
    upright: 'Reflexiona sobre fiabilidad y perseverancia.',
    reversed: 'Observa cómo estancamiento y rigidez pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre fiabilidad y perseverancia; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre estancamiento y rigidez; no es una predicción.',
    },
  },
  'pentacles-13': {
    name: 'Reina de Oros',
    keywords: ['ingenio', 'cuidado'],
    upright: 'Reflexiona sobre ingenio y cuidado.',
    reversed: 'Observa cómo descuido personal y desequilibrio pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre ingenio y cuidado; no es una predicción.',
      reversed:
        'Quizás: correspondencia fija de referencia sobre descuido personal y desequilibrio; no es una predicción.',
    },
  },
  'pentacles-14': {
    name: 'Rey de Oros',
    keywords: ['buena administración', 'estabilidad'],
    upright: 'Reflexiona sobre buena administración y estabilidad.',
    reversed: 'Observa cómo materialismo y control pueden influir en tu mirada.',
    yesNoReason: {
      upright:
        'Sí: correspondencia fija de referencia sobre buena administración y estabilidad; no es una predicción.',
      reversed:
        'No: correspondencia fija de referencia sobre materialismo y control; no es una predicción.',
    },
  },
}
