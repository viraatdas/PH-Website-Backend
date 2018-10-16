import { Event } from '../models/event';
import CONFIG from '../config';
import axios from 'axios';
import Server from '../../src/server';

let server: Server;
const accessToken = CONFIG.FACEBOOK_ACCESS_TOKEN;

const syncFacebookEvents = async () => {
	// Get all upcoming facebook events id's
	try {
		server = await Server.createInstance();
		const { data } = await axios.get(
			`https://graph.facebook.com/purduehackers/events?time_filter=upcoming&access_token=${accessToken}`
		);

		const upcomingEvents = data.data;
		for (const currEvent of upcomingEvents) {
			const {
				id: facebookId,
				name: eventName,
				place: { name: eventLocation },
				start_time: eventTime
			} = currEvent;

			const mongoEvent = await Event.findOne({
				facebook: `https://www.facebook.com/events/${facebookId}/`
			}).exec();

			// New Facebook event
			if (!mongoEvent) {
				// Create db event
				const event = new Event({
					name: eventName,
					location: eventLocation,
					privateEvent: false,
					eventTime,
					facebook: `https://www.facebook.com/events/${facebookId}/`
				});

				await event.save();
			} else {
				// Update event
				await Event.findOneAndUpdate(
					{
						facebook: `https://www.facebook.com/events/${facebookId}/`
					},
					{
						$set: {
							name: eventName,
							location: eventLocation,
							privateEvent: false,
							eventTime,
							facebook: `https://www.facebook.com/events/${facebookId}/`
						}
					}
				).exec();
			}
		}
	} catch (error) {
		console.log('Error, ', error);
	} finally {
		await server.mongoose.disconnect();
	}
};

syncFacebookEvents();
