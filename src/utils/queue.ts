import * as Queue from 'bull';
import CONFIG from '../config';

export const createQueue = (name: string, opts?) => {
	return new Queue(name, CONFIG.REDIS_URL, opts);
};
