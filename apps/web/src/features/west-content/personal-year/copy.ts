import type { PersonalYearLocale, PersonalYearNumber } from './paths.ts'

/**
 * personal year 页的界面文字（设计稿 docs/design/prototypes/content-growth-v2-batch2/PersonalYear.dc.html、
 * YearNumber.dc.html，使用者 2026-11-24 确认）。只有 en、es，随按需加载的页面模块下发，不进 messages。
 * 逐页撰写的正文在 content/personal-year/<locale>；合规声明沿用站上的 tools_disclaimer。
 * es 按西语写法另写，不逐字对应 en。
 */
export interface PersonalYearCopy {
  readonly numberName: (value: number) => string
  /** 1–9 网格的副标签（设计稿 A5「数字网格增加副标签」） */
  readonly keyword: Readonly<Record<PersonalYearNumber, string>>
  /** 年份数页数字面板的「主题」 */
  readonly theme: Readonly<Record<PersonalYearNumber, string>>
  /** 计算结果下的一句话 */
  readonly summary: Readonly<Record<PersonalYearNumber, string>>
  readonly months: readonly string[]
  readonly formLabel: string
  readonly monthDayLegend: string
  readonly monthLabel: string
  readonly dayLabel: string
  readonly dayPlaceholder: string
  readonly monthDayHint: string
  readonly monthDayError: string
  readonly yearLabel: string
  readonly yearHint: string
  readonly privacyHint: string
  readonly calculate: string
  readonly resultTitle: (year: number) => string
  readonly readAbout: (value: number) => string
  readonly stepsTitle: string
  readonly stepMonth: string
  readonly stepDay: string
  readonly stepYear: string
  readonly stepSum: string
  readonly stepReduce: string
  readonly stepRoot: string
  readonly kept: string
  readonly masterNote: (engine: number, value: number) => string
  readonly cycleTitle: string
  readonly cycleNote: string
  readonly otherTitle: string
  readonly otherText: string
  readonly otherLink: string
  readonly allNumbersTitle: string
  readonly faqTitle: string
  readonly relatedTitle: string
  readonly crumbHome: string
  readonly miniFormLead: string
  readonly factTheme: string
  readonly factPlace: string
  readonly factFollows: string
  readonly factLeads: string
  readonly place: (value: number) => string
  readonly example: (date: string, year: number) => string
  readonly questionsTitle: string
  readonly previous: string
  readonly next: string
  readonly seriesLabel: string
  readonly monthDay: (month: number, day: number) => string
}

const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const ES_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const EN: PersonalYearCopy = {
  numberName: (value) => `Personal Year ${value}`,
  keyword: {
    1: 'start',
    2: 'patience',
    3: 'expression',
    4: 'groundwork',
    5: 'change',
    6: 'care',
    7: 'study',
    8: 'results',
    9: 'completion',
  },
  theme: {
    1: 'Beginnings and initiative',
    2: 'Patience and cooperation',
    3: 'Expression and connection',
    4: 'Groundwork and structure',
    5: 'Change and movement',
    6: 'Care and responsibility',
    7: 'Study and reflection',
    8: 'Results and resources',
    9: 'Completion and release',
  },
  summary: {
    1: 'The first year of the nine-year cycle is traditionally associated with beginnings, initiative and planting seeds.',
    2: 'The second year of the cycle is traditionally linked with patience, cooperation and attention to detail.',
    3: 'The third year of the cycle is traditionally associated with expression, creativity and time with other people.',
    4: 'The fourth year of the cycle is traditionally linked with groundwork, routine and steady effort.',
    5: 'The fifth year of the nine-year cycle is traditionally associated with change, movement and trying things out.',
    6: 'The sixth year of the cycle is traditionally linked with care, home and the commitments you keep.',
    7: 'The seventh year of the cycle is traditionally associated with study, reflection and quieter time.',
    8: 'The eighth year of the cycle is traditionally linked with results, responsibility and practical matters.',
    9: 'The ninth year closes the cycle and is traditionally associated with completion, review and letting go.',
  },
  months: EN_MONTHS,
  formLabel: 'Birthday and year',
  monthDayLegend: 'Birth month and day',
  monthLabel: 'Month',
  dayLabel: 'Day',
  dayPlaceholder: '14',
  monthDayHint: 'Your birth year isn’t needed.',
  monthDayError: 'Enter a real month and day, for example July 14.',
  yearLabel: 'Year',
  yearHint: 'Starts on the current year. Choose any year from 1900 to 2100.',
  privacyHint: 'Calculated in your browser. No sign-up needed.',
  calculate: 'Calculate',
  resultTitle: (year) => `Your personal year in ${year}`,
  readAbout: (value) => `Read about Personal Year ${value}`,
  stepsTitle: 'Calculation steps',
  stepMonth: 'Month',
  stepDay: 'Day',
  stepYear: 'Year',
  stepSum: 'Sum',
  stepReduce: 'Reduce',
  stepRoot: 'Read as',
  kept: '(kept as a master number)',
  masterNote: (engine, value) =>
    `The total stops at ${engine}, a master number that some numerologists keep as its own year. This calculator reduces every result to 1–9, so ${engine} is read as Personal Year ${value}.`,
  cycleTitle: 'Your nine-year cycle',
  cycleNote:
    'This calculator applies the result from January 1 to December 31 of the selected year. With the same formula, a birthday-based reading uses that number starting on the birthday in that year.',
  otherTitle: 'Your other numbers',
  otherText:
    'The personal year is one number in a numerology chart. The life path calculator works out your core number from your full birth date, with the same step-by-step arithmetic.',
  otherLink: 'Open the Life Path Calculator',
  allNumbersTitle: 'Personal year numbers 1 to 9',
  faqTitle: 'Common questions',
  relatedTitle: 'Related',
  crumbHome: 'Home',
  miniFormLead: 'Not sure this is your year? Check it here. The result opens in the calculator.',
  factTheme: 'Theme',
  factPlace: 'Place in the cycle',
  factFollows: 'Follows',
  factLeads: 'Leads to',
  place: (value) =>
    value === 1
      ? 'Year 1 of 9, the opening year'
      : value === 5
        ? 'Year 5 of 9, the midpoint'
        : value === 9
          ? 'Year 9 of 9, the closing year'
          : `Year ${value} of 9`,
  example: (date, year) => `Example · born ${date}, year ${year}:`,
  questionsTitle: 'Questions for the year',
  previous: 'Previous',
  next: 'Next',
  seriesLabel: 'Personal year numbers',
  monthDay: (month, day) => `${EN_MONTHS[month - 1]} ${day}`,
}

const ES: PersonalYearCopy = {
  numberName: (value) => `Año personal ${value}`,
  keyword: {
    1: 'inicio',
    2: 'paciencia',
    3: 'expresión',
    4: 'cimientos',
    5: 'cambio',
    6: 'cuidado',
    7: 'estudio',
    8: 'resultados',
    9: 'cierre',
  },
  theme: {
    1: 'Inicio e iniciativa',
    2: 'Paciencia y cooperación',
    3: 'Expresión y vínculos',
    4: 'Cimientos y orden',
    5: 'Cambio y movimiento',
    6: 'Cuidado y responsabilidad',
    7: 'Estudio y reflexión',
    8: 'Resultados y recursos',
    9: 'Cierre y desapego',
  },
  summary: {
    1: 'La tradición asocia el primer año del ciclo de nueve con los comienzos, la iniciativa y sembrar ideas nuevas.',
    2: 'El segundo año del ciclo se asocia tradicionalmente con la paciencia, la cooperación y el cuidado de los detalles.',
    3: 'El tercer año del ciclo se vincula con la expresión, la creatividad y el tiempo compartido con otras personas.',
    4: 'El cuarto año del ciclo se asocia con poner cimientos, ordenar rutinas y sostener el esfuerzo.',
    5: 'El quinto año, a mitad del ciclo, se asocia tradicionalmente con el cambio, el movimiento y la experimentación.',
    6: 'El sexto año del ciclo se vincula con el cuidado, el hogar y los compromisos que mantienes.',
    7: 'El séptimo año del ciclo se asocia con el estudio, la reflexión y un ritmo más tranquilo.',
    8: 'El octavo año del ciclo se vincula con los resultados, la responsabilidad y los asuntos prácticos.',
    9: 'El noveno año cierra el ciclo y se asocia con terminar etapas, hacer balance y soltar.',
  },
  months: ES_MONTHS.map((month) => month[0]?.toUpperCase() + month.slice(1)),
  formLabel: 'Fecha de nacimiento y año',
  monthDayLegend: 'Mes y día de nacimiento',
  monthLabel: 'Mes',
  dayLabel: 'Día',
  dayPlaceholder: '14',
  monthDayHint: 'No hace falta el año de nacimiento.',
  monthDayError: 'Escribe un mes y un día que existan, por ejemplo 14 de julio.',
  yearLabel: 'Año',
  yearHint: 'El año actual aparece seleccionado. Puedes elegir cualquier año entre 1900 y 2100.',
  privacyHint: 'El cálculo se hace en tu navegador. No necesitas registrarte.',
  calculate: 'Calcular',
  resultTitle: (year) => `Tu año personal en ${year}`,
  readAbout: (value) => `Leer sobre el año personal ${value}`,
  stepsTitle: 'Pasos del cálculo',
  stepMonth: 'Mes',
  stepDay: 'Día',
  stepYear: 'Año',
  stepSum: 'Suma',
  stepReduce: 'Reducción',
  stepRoot: 'Se lee como',
  kept: '(se conserva como número maestro)',
  masterNote: (engine, value) =>
    `La suma se detiene en ${engine}, un número maestro que algunos numerólogos tratan como un año aparte. Esta calculadora reduce todos los resultados a un número del 1 al 9, así que ${engine} se lee como año personal ${value}.`,
  cycleTitle: 'Tu ciclo de nueve años',
  cycleNote:
    'Esta calculadora aplica el resultado del 1 de enero al 31 de diciembre del año elegido. Si se usa la misma fórmula y se cuenta desde el cumpleaños, ese número se aplica desde el cumpleaños de ese año.',
  otherTitle: 'Tus otros números',
  otherText:
    'El año personal es uno de los números de una carta numerológica. La calculadora del número de vida obtiene tu número principal a partir de la fecha de nacimiento completa, con los mismos pasos a la vista.',
  otherLink: 'Calcular tu número de vida',
  allNumbersTitle: 'Años personales del 1 al 9',
  faqTitle: 'Preguntas frecuentes',
  relatedTitle: 'Relacionado',
  crumbHome: 'Inicio',
  miniFormLead:
    '¿No sabes si este es tu año? Compruébalo aquí: el resultado se abre en la calculadora.',
  factTheme: 'Tema',
  factPlace: 'Lugar en el ciclo',
  factFollows: 'Viene después de',
  factLeads: 'Da paso a',
  place: (value) =>
    value === 1
      ? 'Año 1 de 9, el que abre el ciclo'
      : value === 5
        ? 'Año 5 de 9, la mitad del ciclo'
        : value === 9
          ? 'Año 9 de 9, el que cierra el ciclo'
          : `Año ${value} de 9`,
  example: (date, year) => `Ejemplo · nacimiento el ${date}, año ${year}:`,
  questionsTitle: 'Preguntas para el año',
  previous: 'Anterior',
  next: 'Siguiente',
  seriesLabel: 'Años personales',
  monthDay: (month, day) => `${day} de ${ES_MONTHS[month - 1]}`,
}

export const PERSONAL_YEAR_COPY: Readonly<Record<PersonalYearLocale, PersonalYearCopy>> = {
  en: EN,
  es: ES,
}
