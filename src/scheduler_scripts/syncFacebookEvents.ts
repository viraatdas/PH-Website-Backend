import CONFIG from '../config';
const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
import { Event } from '../models/event';

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = '../../gCalToken.json';

import Server from '../../src/server';

let server: Server;

const accessToken = CONFIG.FACEBOOK_ACCESS_TOKEN;

const syncFacebookEvents = async () => {
	server = await Server.createInstance();

	// Get all upcoming facebook events id's
	try {
		const response = await axios.get(
			`https://graph.facebook.com/purduehackers/events?time_filter=upcoming&access_token=${accessToken}`
		);

		const upcomingEvents = response.data.data;

		for (const currEvent of upcomingEvents) {
			const currEventId = currEvent.id;
			const dbResponse = await Event.find({
				facebook: `https://www.facebook.com/events/${currEventId}/`
			}).exec();

			if (!dbResponse) {
				// Create db event
				const event = new Event({
					name: currEvent.name,
					location: currEvent.place.name,
					privateEvent: 0,
					eventTime: currEvent.start_time,
					facebook: `https://www.facebook.com/events/${currEventId}/`
				});

				await event.save();
				console.log('Saved succesfully');
			} else {
				// Update event
				Event.findOneAndUpdate(
					{
						facebook: `https://www.facebook.com/events/${currEventId}/`
					},
					{
						$set: {
							name: currEvent.name,
							location: currEvent.place.name,
							privateEvent: 0,
							eventTime: currEvent.start_time,
							facebook: `https://www.facebook.com/events/${currEventId}/`
						}
					}
				).exec();
				console.log('Updated succesfully');
			}
		}
	} catch (error) {
		console.log('Error, ', error);
	}
};

syncFacebookEvents();
