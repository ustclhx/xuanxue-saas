import type { PageCopy } from '../page-copy.ts'

/**
 * 西班牙语页面 SEO 文案（add-locales-eu-ja 第 5 组）：Title 与 H1 按使用者 2026-11-20 确认的关键词地图
 * （locales-eu-ja/keyword-maps/es.md）；Title 不含「 | Arcanumber」（pageHead 统一追加），首页 Title 自带站名。
 */
const es: PageCopy = {
  home: [
    'Arcanumber: numerología y tarot gratis, paso a paso',
    'Calcula gratis tu número de vida, tu carta numerológica y el significado de tu nombre, o saca una tirada de tarot. Reglas tradicionales, solo como referencia.',
    'Numerología y tarot gratis',
  ],
  static: {
    '/pricing': [
      'Precios: herramientas gratis y créditos',
      'Todas las herramientas de numerología y tarot son gratis. Los créditos sirven para desbloquear lecturas completas con IA de tus propios números y cartas.',
    ],
    '/faq': [
      'Preguntas frecuentes: créditos y privacidad',
      'Respuestas sobre herramientas gratis, créditos y reembolsos, lecturas fallidas, privacidad y cómo se calculan la numerología y el tarot.',
    ],
    '/blog': ['Blog', 'Guías de numerología y tarot para entender tus propios resultados.'],
    '/guides': ['Guías', 'Respuestas breves a preguntas frecuentes.'],
    '/docs': ['Ayuda', 'Ayuda y guías para usar Arcanumber.'],
    '/newsletter': [
      'Boletín',
      'Suscríbete para recibir nuevas guías de numerología y tarot y novedades del sitio.',
    ],
    '/waitlist': ['Lista de espera', 'Anótate en la lista de espera para saber cuándo abrimos.'],
  },
  tarot: {
    'three-card': [
      'Tarot gratis: pasado, presente y futuro',
      'Tarot gratis de 3 cartas: baraja, corta y descubre pasado, presente y futuro con el mazo Rider–Waite. Solo como referencia para reflexionar.',
    ],
    daily: [
      'Tarot del día: tu carta del día gratis',
      'Tarot del día gratis: saca una carta y tómala como tema para pensar hoy, con sus palabras clave al derecho e invertida.',
    ],
    'yes-or-no': [
      'Tarot sí o no gratis con 1 carta',
      'Tarot sí o no gratis con 1 carta: la respuesta Sí, No o Quizás sale de una tabla fija y pública de cartas, con su explicación.',
    ],
    'celtic-cross': [
      'Tirada cruz celta gratis: 10 posiciones',
      'Tirada cruz celta gratis: diez cartas para mirar a fondo una situación, con el significado de cada una de las 10 posiciones.',
    ],
  },
  tarotIndex: [
    'Significado de las cartas del tarot (78)',
    'El significado de las 78 cartas del tarot: los 22 Arcanos Mayores y los palos de Bastos, Copas, Espadas y Oros, al derecho e invertidas.',
  ],
  numerologyTools: {
    'numerology-calculator': [
      'Calculadora de numerología gratis y completa',
      'Calculadora de numerología gratis: con tu nombre y fecha de nacimiento obtienes número de vida, destino, alma, personalidad, día de nacimiento y año personal.',
    ],
    'numerology-chart': [
      'Carta numerológica pitagórica gratis',
      'Ubica los dígitos de tu fecha de nacimiento, y si quieres de tu nombre, en la cuadrícula pitagórica 3×3 para ver qué números se repiten y cuáles faltan.',
    ],
    'name-numerology': [
      'Numerología del nombre: calcula tu nombre',
      'Convierte las letras de tu nombre y apellidos en número del destino, del alma y de la personalidad con la tabla pitagórica, incluidos acentos y la ñ.',
    ],
    'life-path-compatibility': [
      'Compatibilidad numerológica de pareja',
      'Compara dos fechas de nacimiento: el número de vida de cada persona, el cálculo paso a paso y el nivel de afinidad según una tabla fija de numerología.',
    ],
  },
}

export default es
