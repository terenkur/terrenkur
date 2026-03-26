/**
 * Простой и наглядный логгер для консоли с использованием цветов и эмодзи.
 * Не требует внешних зависимостей.
 */

// ANSI escape-коды для раскрашивания текста в терминале
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

const logger = {
  /**
   * Логирует сообщение об ошибке (красный цвет).
   * @param {string} message - Текст сообщения.
   * @param {*} [data] - Дополнительные данные для вывода (например, объект ошибки).
   */
  error: (message, data) => {
    console.error(`${colors.red}[ERROR]${colors.reset}   ${message} ❌`);
    if (data) console.error(data);
  },

  /**
   * Логирует сообщение об успехе (зеленый цвет).
   * @param {string} message - Текст сообщения.
   */
  success: (message) => {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message} ✅`);
  },

  /**
   * Логирует информационное сообщение (синий цвет).
   * @param {string} message - Текст сообщения.
   */
  info: (message) => {
    console.log(`${colors.blue}[INFO]${colors.reset}    ${message} ℹ️`);
  },

  /**
   * Логирует предупреждение (желтый цвет).
   * @param {string} message - Текст сообщения.
   */
  warn: (message) => {
    console.warn(`${colors.yellow}[WARN]${colors.reset}    ${message} ⚠️`);
  },

  /**
   * Логирует отладочное сообщение (пурпурный цвет).
   * @param {string} message - Текст сообщения.
   */
  debug: (message) => {
    console.log(`${colors.magenta}[DEBUG]${colors.reset}   ${message} 🐛`);
  },
};

module.exports = logger;