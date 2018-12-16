import * as util from 'util';
import chalk from 'chalk';
import { createLogger as createWinstonLogger, format, transports } from 'winston';
import CONFIG from '../config';

const customConsoleFormat = format.printf(({ level, timestamp, context, message, meta }) => {
	let result = `[${level}] [${timestamp}]`;
	if (context) result += ` ${chalk.yellow(`[${context}]`)} --`;
	result += ` ${message}`;
	if (meta) result += ` ${util.inspect(meta, { colors: true, compact: false })}`;

	return result;
});

const transporters = context => [
	new transports.Console({
		format: format.combine(
			format(info => {
				info.level = info.level.toUpperCase();
				info.context = context;
				info.timestamp = new Date(Date.now()).toLocaleString();
				return info;
			})(),
			format.splat(),
			format.colorize(),
			format.prettyPrint(),
			customConsoleFormat
		)
	})
];

// tslint:disable-next-line:ban-types
export const createLogger = (context: string | object | Function) => {
	if (typeof context === 'object') context = context.constructor.name;
	if (typeof context === 'function') context = context.name;
	return createWinstonLogger({
		transports: transporters(context),
		silent: CONFIG.NODE_ENV === 'test'
	}).on('error', err => {
		console.log('Logger Error:', err);
	});
};
