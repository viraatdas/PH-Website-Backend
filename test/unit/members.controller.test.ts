import 'jest';
import * as faker from 'faker';
import Server from '../../src/server';
import { generateUsers } from '../../src/utils/helper';
import { IMemberModel } from '../../src/models/member';
import { AuthController } from '../../src/controllers/auth.controller';
import { MemberController } from '../../src/controllers/members.controller';
import { BadRequestError, UnauthorizedError } from 'routing-controllers';

let server: Server;
let authController: AuthController;
let memberController: MemberController;
let generatedUsers: {
	name: string;
	email: string;
	graduationYear: number;
	password: string;
	passwordConfirm: string;
}[];
let members: { user: IMemberModel; token: string }[];
let user: { user: IMemberModel; token: string };

describe('Member controller unit tests', () => {
	beforeAll(() =>
		Server.createInstance()
			.then(s => (server = s))
			.then(() => {
				authController = new AuthController();
				memberController = new MemberController();
			}));

	beforeEach(async () => {
		generatedUsers = generateUsers(6);
		members = await Promise.all<{ user: IMemberModel; token: string }>(
			generatedUsers.map(u => authController.signup({ body: { ...u } } as any, u as any))
		);
		user = members[0];
	});

	describe('Get all Users', () => {
		it('Successfully gets all users', async () => {
			const response = await memberController.getAll();
			expect(response.members).toHaveLength(members.length);
			response.members.forEach(u => {
				expect(u).not.toHaveProperty('password');
				expect(u).toHaveProperty('_id');
				const foundUser = members.find(val => val.user._id.equals(u._id));
				expect(foundUser).toBeTruthy();
				expect(u.name).toEqual(foundUser.user.name);
				expect(u.graduationYear).toEqual(foundUser.user.graduationYear);
			});
		});
	});

	describe('Get a single user', () => {
		it('Fails to get a single user because invalid id', async () => {
			try {
				await memberController.getById('invalidID');
			} catch (error) {
				expect(error.httpCode).toEqual(400);
				expect(error.message).toEqual('Invalid member ID');
			}
		});

		it('Fails to get a single user because user does not exist', async () => {
			try {
				const id = server.mongoose.Types.ObjectId().toHexString();
				await memberController.getById(id);
			} catch (error) {
				expect(error.httpCode).toEqual(400);
				expect(error.message).toEqual('Member does not exist');
			}
		});

		it('Successfully gets a single user', async () => {
			const response = await memberController.getById(user.user._id);
			expect(response).toEqual(user.user);
		});
	});

	describe('Get a single user', () => {
		it('Fails to update a single user because invalid ID', async () => {
			const generatedUser = generatedUsers.find(val => user.user.email === val.email);
			const userUpdate = {
				...user.user,
				name: `${faker.name.firstName()} ${faker.name.lastName()}`
			};

			await expect(
				memberController.updateById(
					{
						body: {
							password: generatedUser.password,
							passwordConfirm: generatedUser.passwordConfirm
						}
					} as any,
					'InvalidID',
					userUpdate as any,
					user.user
				)
			).rejects.toEqual(new BadRequestError('Invalid member ID'));
		});

		it('Fails to update a single user because member does not exist', async () => {
			const generatedUser = generatedUsers.find(val => user.user.email === val.email);
			const userUpdate = {
				...user.user,
				name: `${faker.name.firstName()} ${faker.name.lastName()}`
			};
			const id = server.mongoose.Types.ObjectId().toHexString();
			await expect(
				memberController.updateById(
					{
						body: {
							password: generatedUser.password,
							passwordConfirm: generatedUser.passwordConfirm
						}
					} as any,
					id,
					userUpdate as any,
					user.user
				)
			).rejects.toEqual(new UnauthorizedError('You are unauthorized to edit this profile'));
		});

		it('Successfully updates a single users name', async () => {
			const generatedUser = generatedUsers.find(val => user.user.email === val.email);
			const userUpdate = {
				...user.user,
				name: `${faker.name.firstName()} ${faker.name.lastName()}`
			};
			const u = await memberController.updateById(
				{
					body: {
						password: generatedUser.password,
						passwordConfirm: generatedUser.passwordConfirm
					}
				} as any,
				user.user._id,
				userUpdate as any,
				user.user
			);
			expect(u).toHaveProperty('_id');
			expect(u.password).toEqual(undefined);
			expect(u.email).toEqual(user.user.email);
			expect(u.graduationYear).toEqual(user.user.graduationYear);
			expect(u.name).not.toEqual(user.user.name);
		});

		it('Successfully updates a single users gender', async () => {
			const generatedUser = generatedUsers.find(val => user.user.email === val.email);
			const userUpdate = {
				...user.user,
				gender: 'Male'
			};
			const u = await memberController.updateById(
				{
					body: {
						password: generatedUser.password,
						passwordConfirm: generatedUser.passwordConfirm
					}
				} as any,
				user.user._id,
				userUpdate as any,
				user.user
			);
			expect(u).toHaveProperty('_id');
			expect(u.password).toEqual(undefined);
			expect(u.email).toEqual(user.user.email);
			expect(u.graduationYear).toEqual(user.user.graduationYear);
			expect(u.gender).not.toEqual(user.user.gender);
		});
	});

	afterEach(() => server.mongoose.connection.dropDatabase());

	afterAll(() => server.mongoose.disconnect());
});
