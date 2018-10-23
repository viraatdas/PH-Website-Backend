import * as faker from 'faker';

export const generateUser = () => {
	const first = faker.name.firstName();
	const last = faker.name.lastName();
	const email = faker.internet.email(first, last);
	const password = faker.internet.password(8);
	return {
		name: `${first} ${last}`,
		email,
		graduationYear: faker.random.number({
			min: 1900,
			max: 2025
		}),
		password,
		passwordConfirm: password
	};
};

export const generateEvent = () => {
	const name = faker.hacker.noun();
	const eventTime = faker.date.past();
	const location = faker.address.streetAddress();
	return {
		name,
		eventTime,
		location
	};
};

export const generateUsers = numUsers => Array.from({ length: numUsers }, generateUser);
export const generateEvents = numEvents => Array.from({ length: numEvents }, generateEvent);
