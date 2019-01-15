import MongodbMemoryServer from 'mongodb-memory-server';

let mongod: MongodbMemoryServer;

export const setup = async () => {
	mongod = new MongodbMemoryServer({
		binary: {
			version: '4.0.2'
		}
	});
	const DB = await mongod.getConnectionString();
	process.env.DB = DB;
};

export const teardown = async () => {
	await mongod.stop();
};
