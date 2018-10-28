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

const spoofFacebookEvent = () => {
	const startTime = faker.date.future();
	const name = faker.hacker.noun();
	const place = {
		name: faker.address.city()
	};

	// dont set id, just in case two events generate the same random number
	return {
		name,
		place,
		start_time: startTime
	};
};

export const spoofFacebookEvents = numEvents =>
	Array.from({ length: numEvents }, (v, i) => ({ ...spoofFacebookEvent(), id: i }));

export const generateUsers = numUsers => Array.from({ length: numUsers }, generateUser);
export const generateEvents = numEvents => Array.from({ length: numEvents }, generateEvent);
