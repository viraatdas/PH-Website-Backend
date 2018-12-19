import { errorRes } from '../utils';
import { createLogger } from '../utils/logger';

const logger = createLogger('GlobalError');

export const globalError = (err, req, res, next) => {
	let { message, httpCode } = err;
	message = message || 'Whoops! Something went wrong!';
	httpCode = httpCode || 500;
	// logger.error('Caught error:', message);
	if (httpCode === 500) {
		logger.error('Caught error:', message);
		logger.error('Error:', err);
	}
	errorRes(res, httpCode, message);
	next();
};
