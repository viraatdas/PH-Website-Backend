import { errorRes, sendErrorEmail } from '../utils';
import { createLogger } from '../utils/logger';

const logger = createLogger('GlobalError');

export const globalError = (err, req, res, next) => {
	let { message, httpCode } = err;
	message = message || 'Whoops! Something went wrong!';
	httpCode = httpCode || 500;
	// Send an email if error is from server
	if (httpCode === 500) {
		logger.emerg('Unhandled exception:', err);
		sendErrorEmail(err, req.user)
			.then(() => logger.info('Email sent'))
			.catch(error => logger.error('Error sending email:', error));
		errorRes(res, httpCode, 'Whoops! Something went wrong!');
	} else {
		logger.error('Caught error:', message);
		errorRes(res, httpCode, message);
		next();
	}
};
