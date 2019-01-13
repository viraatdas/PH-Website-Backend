import axios from 'axios';
import { Job } from 'bull';
import { Event } from '../models/event';
import CONFIG from '../config';

const { FACEBOOK_ACCESS_TOKEN: accessToken } = CONFIG;

const getUpcomingFacebookEvents = async () => {
	const {
		data: { data: upcomingEvents }
	} = await axios.get('https://graph.facebook.com/purduehackers/events', {
		params: {
			// time_filter: 'upcoming',
			access_token: accessToken
		}
	});
	return upcomingEvents;
};

const updateDatabase = async (upcomingEvents: any) => {
	const upcomingEventsLinks = await Event.find(
		{ eventTime: { $gte: new Date() } },
		'_id facebook'
	)
		.exec()
		.then(result => result.map(event => event.facebook));

	for (const currEvent of upcomingEvents) {
		const {
			id: facebookId,
			name: eventName,
			place: { name: eventLocation },
			start_time: eventTime
		} = currEvent;

		const facebook = `https://www.facebook.com/events/${facebookId}`;
		if (!upcomingEventsLinks.includes(facebook)) {
			// Create db event
			const event = new Event({
				name: eventName,
				location: eventLocation,
				privateEvent: false,
				eventTime,
				facebook
			});

			await event.save();
			console.log('Created Event:', event);
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
			console.log(
				'Updated event:',
				await Event.findOne({ facebook })
					.lean()
					.exec()
			);
		}
		// remove the event from the upcoming facebook events in db list
		upcomingEventsLinks.splice(upcomingEventsLinks.indexOf(facebook), 1);
	}

	// Reflect facebook event deletions in the database
	if (upcomingEventsLinks.length > 0) {
		for (const currEventInTheDatabaseFacebookLink of upcomingEventsLinks) {
			await Event.findOneAndDelete({
				facebook: { $eq: currEventInTheDatabaseFacebookLink }
			}).exec();
			console.log('Deleted event');
		}
	}
};

export const syncFacebookEvents = async (job: Job) => {
	// Get all upcoming facebook events id's
	const upcomingEvents = await getUpcomingFacebookEvents();
	console.log('Got upcoming events:', upcomingEvents);
	await updateDatabase(upcomingEvents);
};

// export this test function that will allow the test file to simply enter fake facebook events
// to test mainly the database functions. This way tests will be permanent
export const testSyncFacebookEvents = updateDatabase;
