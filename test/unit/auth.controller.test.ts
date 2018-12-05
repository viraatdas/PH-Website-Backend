import 'jest';
import { generateUser } from '../../src/utils/helper';
import Server from '../../src/server';
// import { AuthController } from '../../src/routes/auth.controller';
import { AuthController } from '../../src/controllers/auth.controller';
import { MemberDto } from '../../src/models/member';
import { Request } from 'express';
import { BadRequestError } from 'routing-controllers';

let server: Server;
let controller: AuthController;
describe('Auth controller unit tests', () => {
	beforeAll(() =>
		Server.createInstance()
			.then(s => (server = s))
			.then(() => (controller = new AuthController())));

	describe('Signup Tests', () => {
		it('Successfully signs up', async () => {
			const member = generateUser();
			const req: Partial<Request> = {
				body: {
					// passwordConfirm: member.passwordConfirm
				}
			};

			// expect.assertions(1);
			await expect(controller.signup(req as Request, member as any)).rejects.toEqual(
				new BadRequestError('Please confirm your password')
			);
			console.log('Finished');
			// const res = await controller.signup(req as Request, member as any);
		});
	});

	// describe('Login Tests', () => {});

	afterEach(() => server.mongoose.connection.dropDatabase());

	afterAll(() => server.mongoose.disconnect());
});
