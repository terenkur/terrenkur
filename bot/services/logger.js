const pino = require('pino');
const chalk = require('chalk');

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
      messageFormat: (log, messageKey) => {
        const msg = chalk.cyan(log[messageKey]);
        const time = chalk.gray(`[${new Date().toLocaleTimeString()}]`);

        let formattedLevel;
        switch (log.level) {
          case 60: // fatal
            formattedLevel = chalk.bgRed.black(' FATAL ');
            break;
          case 50: // error
            formattedLevel = chalk.red(' ERROR ');
            break;
          case 40: // warn
            formattedLevel = chalk.yellow(' WARN ');
            break;
          case 30: // info
            formattedLevel = chalk.green(' INFO ');
            break;
          case 20: // debug
            formattedLevel = chalk.blue(' DEBUG ');
            break;
          case 10: // trace
            formattedLevel = chalk.gray(' TRACE ');
            break;
          default:
            formattedLevel = chalk.white(` ${log.level} `);
        }

        let formattedMessage = `${time} ${formattedLevel} ${msg}`;

        const standardKeys = [
          'pid',
          'hostname',
          'level',
          'time',
          'v',
          messageKey,
        ];

        const extraFields = Object.keys(log)
          .filter((key) => !standardKeys.includes(key))
          .map((key) => `  ${chalk.dim.white(key)}: ${chalk.dim.white(JSON.stringify(log[key]))}`)
          .join('\n');

        if (extraFields) {
          formattedMessage += `\n${extraFields}`;
        }

        return formattedMessage;
      },
    },
  },
});

module.exports = logger;
