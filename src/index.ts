import 'reflect-metadata';
import Server from './server';
import CONFIG from './config';
const { PORT } = CONFIG;

const start = async () => {
	try {
		const server = await Server.createInstance();
		const httpServer = server.app.listen(PORT, () => {
			// server.logger.info('CONFIG: ', CONFIG);
			server.logger.info(`Listening on port: ${PORT}`);
		});

		// Graceful shutdown
		process.on('SIGTERM', async () => {
			server.logger.warn('Shutting down server');
			await server.mongoose.disconnect();
			server.logger.info('Server successfully shutdown');
			httpServer.close();
			process.exit(0);
		});

		return server;
	} catch (error) {
		console.error('Error:', error);
		return null;
	}
};

start();
