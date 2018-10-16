import 'jest';
import * as supertest from 'supertest';
import Server from '../src/server';

let server: Server;
let request: supertest.SuperTest<supertest.Test>;

describe('Report Route Tests', () => {
	beforeAll(() =>
		Server.createInstance()
			.then(s => (server = s))
			.then(s => (request = supertest(s.app))));

	describe();
});
