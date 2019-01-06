import * as faker from 'faker';
import { ValidationError } from 'class-validator';

export const generateUser = () => {
	const first = faker.name.firstName();
	const last = faker.name.lastName();
	const domain = faker.internet.domainName();
	const email = faker.internet.email(first, last, domain);

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
	const facebook = `https://www.facebook.com/events/${faker.random.number({
		min: 100000000000000,
		max: 999999999999999
	})}/`;
	const privateEvent = faker.random.boolean();
	return {
		name,
		eventTime,
		location,
		facebook,
		privateEvent
	};
};

const spoofFacebookEvent = () => {
	const startTime = faker.date.future();
	const name = faker.hacker.noun();
	const place = {
		name: faker.address.city()
	};

	// Don't set id, just in case two events generate the same random number
	return {
		name,
		place,
		start_time: startTime
	};
};

export const spoofFacebookEvents = (numEvents: number) =>
	Array.from({ length: numEvents }, (v, i) => ({ ...spoofFacebookEvent(), id: i }));

export const generateUsers = (numUsers: number) => Array.from({ length: numUsers }, generateUser);

export const generateEvents = (numEvents: number) =>
	Array.from({ length: numEvents }, generateEvent);

export const getError = (errors: ValidationError[]) => Object.values(errors[0].constraints).pop();
