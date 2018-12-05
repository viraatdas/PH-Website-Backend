import { Event } from '../models/event';
import CONFIG from '../config';
import axios from 'axios';
import Server from '../server';

let server: Server;

const { NODE_ENV, FACEBOOK_ACCESS_TOKEN: accessToken } = CONFIG;

const getUpcomingFacebookEvents = async () => {
	const {
		data: { data: upcomingEvents }
	} = await axios.get('https://graph.facebook.com/purduehackers/events', {
		params: {
			time_filter: 'upcoming',
			access_token: accessToken
		}
	});
	return upcomingEvents;
};

const updateDatabase = async upcomingEvents => {
	const upcomingEventsInTheDatabaseFacebookLinks = await Event.find(
		{ eventTime: { $gte: new Date() } },
		'_id facebook'
	)
		.exec()
		.then((result: any) => (result = result.map(event => event.facebook)));

	for (const currEvent of upcomingEvents) {
		const {
			id: facebookId,
			name: eventName,
			place: { name: eventLocation },
			start_time: eventTime
		} = currEvent;

		const facebook = `https://www.facebook.com/events/${facebookId}`;
		if (!upcomingEventsInTheDatabaseFacebookLinks.includes(facebook)) {
			// Create db event
			const event = new Event({
				name: eventName,
				location: eventLocation,
				privateEvent: false,
				eventTime,
				facebook
			});

			await event.save();
			// console.log('Created Event');
		} else {
			// Update event
			await Event.findOneAndUpdate(
				{
					facebook
				},
				{
					$set: {
						name: eventName,
						location: eventLocation,
						privateEvent: false,
						eventTime,
						facebook
					}
				}
			).exec();
			console.log('Updated event');
		}
		// remove the event from the upcoming facebook events in db list
		upcomingEventsInTheDatabaseFacebookLinks.splice(
			upcomingEventsInTheDatabaseFacebookLinks.indexOf(facebook),
			1
		);
	}

	// Reflect facebook event deletions in the database
	if (upcomingEventsInTheDatabaseFacebookLinks.length > 0) {
		for (const currEventInTheDatabaseFacebookLink of upcomingEventsInTheDatabaseFacebookLinks) {
			await Event.findOneAndDelete({
				facebook: { $eq: currEventInTheDatabaseFacebookLink }
			}).exec();
			console.log('Deleted event');
		}
	}
};

const syncFacebookEvents = async () => {
	// Get all upcoming facebook events id's
	try {
		server = await Server.createInstance();
		const upcomingEvents = await getUpcomingFacebookEvents();
		await updateDatabase(upcomingEvents);
	} catch (error) {
		console.log('Error, ', error);
	} finally {
		await server.mongoose.disconnect();
	}
};

if (NODE_ENV !== 'test') {
	syncFacebookEvents();
}

// export this test function that will allow the test file to simply enter fake facebook events
// to test mainly the database functions. This way tests will be permanent
export const testSyncFacebookEvents = updateDatabase;
