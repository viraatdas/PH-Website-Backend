import 'reflect-metadata';
require('source-map-support').install();
import Server from './server';
import CONFIG from './config';
const { PORT } = CONFIG;

const start = async () => {
	try {
		const server = await Server.createInstance();
		const httpServer = server.app.listen(PORT, () => {
			if (CONFIG.NODE_ENV === 'production') server.logger.info('CONFIG:', CONFIG);
			// if (CONFIG.NODE_ENV === 'production') {
			// 	server.startJobs();
			// 	server.logger.info('Started jobs');
			// }
			server.logger.info(`Listening on port: ${PORT}`);
		});

		// Graceful shutdown
		process.on('SIGTERM', async () => {
			await server.mongoose.disconnect();
			httpServer.close();
			process.exit(0);
		});

		return server;
	} catch (error) {
		console.error('Error:', error);
		// return null;
		throw error;
	}
};

start();
