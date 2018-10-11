import Server from './server';
import CONFIG from './config';
const { PORT, DB } = CONFIG;

const start = async () => {
	try {
		const server = await Server.createInstance();
		server.app.listen(PORT, () =>
			console.log('CONFIG: ', CONFIG, `\nListening on port: ${PORT}`)
		);
		return server;
	} catch (error) {
		console.error('Error:', error);
		return null;
	}
};

start();
