import 'reflect-metadata';
import Server from './server';
import CONFIG from './config';
const { PORT } = CONFIG;

const start = async () => {
	try {
		const server = await Server.createInstance();
		server.app.listen(PORT, () =>
			console.log('CONFIG: ', CONFIG, `\nListening on port: ${PORT}`)
		);

		// Graceful shutdown
		process.on('SIGTERM', async () => {
			await server.mongoose.disconnect();
			process.exit(0);
		});
		
		return server;
	} catch (error) {
		console.error('Error:', error);
		return null;
	}
};

start();
