import { Request } from 'express';
import { isEmail } from 'validator';
import { ObjectId } from 'mongodb';
import { Event } from '../models/event';
import { Member, IMemberModel } from '../models/member';
import { sendAccountCreatedEmail, hasPermission } from '../utils';
import {
	JsonController,
	Req,
	Get,
	QueryParam,
	CurrentUser,
	Post,
	Authorized,
	Body,
	BadRequestError,
	Param,
	Delete
} from 'routing-controllers';
import { createLogger } from '../utils/logger';

// TODO: Add auth to routes
// TODO: Add permissions to routess
@JsonController('/api/events')
export class EventsController {
	private readonly logger = createLogger(this);
	
	@Get('/')
	async getAll(
		@QueryParam('sortBy') sortBy: string,
		@QueryParam('order') order: number,
		@CurrentUser() user: IMemberModel
	) {
		order = order === 1 ? 1 : -1;
		sortBy = sortBy || 'eventTime';
		if (!Event.schema.path(sortBy)) sortBy = 'eventTime';
		let contains = false;
		Event.schema.eachPath(path => {
			if (path.toLowerCase() === sortBy.toLowerCase()) contains = true;
		});
		if (!contains) sortBy = 'eventTime';

		const conditions = hasPermission(user, 'events') ? {} : { privateEvent: { $ne: true } };
		const results = await Event.find(
			conditions,
			'_id name createdAt eventTime location members'
		)
			.sort({ [sortBy]: order })
			.lean()
			.exec();

		return { events: results };
	}

	@Post('/')
	@Authorized(['events'])
	async createEvent(@Body()
	body: {
		name: string;
		privateEvent: boolean;
		eventTime: string;
		location: string;
		facebook: string;
	}) {
		const { name, privateEvent, eventTime, location, facebook } = body;
		if (!name) throw new BadRequestError('Event must have a name');
		if (!eventTime) throw new BadRequestError('Event must have a time');
		if (!location) throw new BadRequestError('Event must have a name');
		const time = Date.parse(eventTime);
		if (isNaN(time)) throw new BadRequestError('Invalid event time');
		if (facebook && !facebook.match('((http|https)://)?(www[.])?facebook.com.*'))
			throw new BadRequestError('Must specify a url from Facebook');

		const event = new Event({
			name,
			privateEvent: !!privateEvent,
			eventTime: time,
			location,
			facebook
		});

		await event.save();
		return event.toJSON();
	}

	@Get('/:id')
	async getById(@Param('id') id: string) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid event ID');
		const user = await Event.findById(id)
			.populate({
				path: 'members',
				model: Member
			})
			.exec();
		return user;
	}

	// TODO: Change to put request
	@Post('/:id')
	@Authorized(['events'])
	async updateEvent(@Req() req: Request) {
		if (!ObjectId.isValid(req.params.id)) throw new BadRequestError('Invalid event ID');
		const { name, privateEvent, eventTime, location, facebook } = req.body;
		const eventBuilder = { privateEvent };
		if (!name) throw new BadRequestError('Event must have a name');
		else Object.assign(eventBuilder, { name });
		if (!eventTime) throw new BadRequestError('Event must have a time');
		if (!location) throw new BadRequestError('Event must have a name');
		else Object.assign(eventBuilder, { location });
		const time = Date.parse(eventTime);
		if (isNaN(time)) throw new BadRequestError('Invalid event time');
		else Object.assign(eventBuilder, { eventTime: time });
		if (facebook) {
			if (!facebook.match('((http|https)://)?(www[.])?facebook.com.*'))
				throw new BadRequestError('Must specify a url from Facebook');
			else Object.assign(eventBuilder, { facebook });
		}

		const event = await Event.findById(req.params.id)
			.populate({
				path: 'members',
				model: Member
			})
			.exec();
		if (!event) throw new BadRequestError('Event does not exist');

		await event.update(eventBuilder).exec();
		return event.toJSON();
	}

	@Delete('/:id')
	@Authorized(['events'])
	async deleteEvent(@Req() req: Request) {
		if (!ObjectId.isValid(req.params.id)) throw new BadRequestError('Invalid event ID');
		const event = await Event.findById(req.params.id).exec();
		if (!event) throw new BadRequestError('Event does not exist');
		await event.remove();
		return event.toJSON();
	}

	@Post('/:id/checkin')
	@Authorized(['events'])
	async checkin(@Req() req: Request) {
		const { name, email, memberID } = req.body;
		if (!ObjectId.isValid(req.params.id)) throw new BadRequestError('Invalid event ID');
		const event = await Event.findById(req.params.id)
			.populate({
				path: 'members',
				model: Member
			})
			.exec();
		if (!event) throw new BadRequestError('Event does not exist');
		let member: IMemberModel = null;

		// Search by memberID
		if (memberID) {
			const m = await Member.findById(memberID).exec();
			if (m && m.email === email) member = m;
		}

		// No ID, so search by name and email
		if (!member) {
			if (!name) throw new BadRequestError('Invalid name');
			if (!isEmail(email)) throw new BadRequestError('Invalid email');
			const m = await Member.findOne({
				name,
				email
			}).exec();
			member = m;
		}

		// New Member
		if (!member) {
			if (await Member.findOne({ email }).exec())
				throw new BadRequestError(
					'A member with a different name is associated with this email'
				);
			member = new Member({
				name,
				email
			});

			await member.save();
			// TODO: Send welcome email when member is created
			await sendAccountCreatedEmail(member, event);
		}
		// Existing Member, If account not setup, send creation email
		else {
			if (member.graduationYear === 0) {
				await sendAccountCreatedEmail(member, event);
			}
		}

		// Check if Repeat
		if (event.members.some(m => m._id.equals(member._id)))
			throw new BadRequestError('Member already checked in');

		event.members.push(member);
		member.events.push(event);
		await Promise.all([event.save(), member.save()]);

		return event;
	}

	// TODO: Checkout member based on their name and email
	@Delete('/:id/checkin/:memberID')
	@Authorized(['events'])
	async checkout(@Req() req: Request) {
		const { id, memberID } = req.params;
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid event ID');
		if (!ObjectId.isValid(memberID)) throw new BadRequestError('Invalid member ID');
		const [event, member] = await Promise.all([
			Event.findById(id).exec(),
			Member.findById(memberID).exec()
		]);
		if (!event) throw new BadRequestError('Event does not exist');
		if (!member) throw new BadRequestError('Member does not exist');

		// Check if not already checked in
		if (!event.members.some(m => m._id.equals(member._id)))
			throw new BadRequestError('Member is not checked in to this event');

		// Remove member and event fom each other
		event.members = event.members.filter(m => !m._id.equals(member._id));
		member.events = member.events.filter(e => !e._id.equals(event._id));
		await Promise.all([event.save(), member.save()]);

		return event;
	}
}
