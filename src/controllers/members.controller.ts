import * as express from 'express';
import { Request } from 'express';
// import * as paginate from 'express-paginate';
import { ObjectId } from 'mongodb';
import { compareSync, compare } from 'bcrypt';
import { Member, MemberDto, IMemberModel, majors } from '../models/member';
import { Event, IEventModel } from '../models/event';
import { Location } from '../models/location';
import { Permission } from '../models/permission';
import { Job } from '../models/job';
import { memberMatches, uploadToStorage, multer, addMemberToPermissions } from '../utils';
import {
	JsonController,
	Get,
	QueryParam,
	Param,
	BadRequestError,
	Put,
	Body,
	Req,
	UseBefore,
	CurrentUser,
	UnauthorizedError,
	Post,
	BodyParam,
	Authorized,
	Delete
} from 'routing-controllers';
import { createLogger } from '../utils/logger';

// TODO: Add auth to routes
// TODO: Add permissions to routes
@JsonController('/api/members')
export class MemberController {
	private readonly logger = createLogger(this);

	@Get('/')
	async getAll(@QueryParam('sortBy') sortBy?: string, @QueryParam('order') order?: number) {
		order = order === 1 ? 1 : -1;
		sortBy = sortBy || 'createdAt';

		let contains = false;
		Member.schema.eachPath(path => {
			if (path.toLowerCase() === sortBy.toLowerCase()) contains = true;
		});
		if (!contains) sortBy = 'createdAt';

		const results = await Member.find(
			{
				privateProfile: { $ne: 1 },
				graduationYear: { $gt: 0 }
			},
			'_id name graduationYear createdAt'
		)

			.populate({
				path: 'permissions',
				model: Permission
			})
			.sort({ [sortBy]: order })
			// .limit(100)
			.lean()
			.exec();

		return { members: results };
	}

	@Get('/:id')
	async getById(@Param('id') id: string) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid member ID');
		const member = await Member.findById(id)
			.populate({
				path: 'permissions',
				model: Permission
			})
			.lean()
			.exec();
		if (!member) throw new BadRequestError('Member does not exist');
		return member;
	}

	@Put('/:id')
	@UseBefore(multer.any())
	async updateById(
		@Req() req: Request,
		@Param('id') id: string,
		@Body() memberDto: MemberDto,
		@CurrentUser({ required: true }) user: IMemberModel
	) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid member ID');
		if (!memberMatches(user, id))
			throw new UnauthorizedError('You are unauthorized to edit this profile');

		const { password, passwordConfirm } = req.body;
		const files: Express.Multer.File[] = req.files
			? (req.files as Express.Multer.File[])
			: new Array<Express.Multer.File>();

		if (!password) throw new BadRequestError('A password is required');
		if (!passwordConfirm) throw new BadRequestError('Please confirm your password');
		if (password !== passwordConfirm) throw new BadRequestError('Passwords does not match');

		memberDto.privateProfile = Boolean(memberDto.privateProfile);
		memberDto.unsubscribed = Boolean(memberDto.unsubscribed);

		const picture = files.find(file => file.fieldname === 'picture');
		const resume = files.find(file => file.fieldname === 'resume');
		if (picture) memberDto.picture = await uploadToStorage(picture, 'pictures', memberDto);
		if (resume) memberDto.resume = await uploadToStorage(resume, 'resumes', memberDto);

		let member = await Member.findById(id, '+password').exec();
		if (!member) throw new BadRequestError('Member not found');
		if (!(await compare(password, member.password)))
			throw new UnauthorizedError('Incorrect password');

		member = await Member.findByIdAndUpdate(id, memberDto, { new: true }).exec();
		return member;
	}

	@Post('/organizer')
	@Authorized(['permissions'])
	async addOrganizer(
		@CurrentUser({ required: true }) user: IMemberModel,
		@BodyParam('email', { required: true, parse: true }) email: string
	) {
		if (!email) throw new BadRequestError('Please enter member name or email');
		const permissions = await Permission.find()
			.where('organizer')
			.ne(0)
			.exec();

		const member = await Member.findOne({
			$or: [{ name: email }, { email }]
		}).exec();

		if (!member) throw new BadRequestError('Member not found');

		const [m, p] = await addMemberToPermissions(member, permissions, user);

		return { member: m, permissions: p };
	}

	@Delete('/:id')
	@Authorized(['admin'])
	async deleteById(@CurrentUser({ required: true }) user: IMemberModel, @Param('id') id: string) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid member ID');

		const [member, jobs] = await Promise.all([
			Member.findById(id, '_id')
				.populate([
					{
						path: 'permissions',
						model: 'Permission',
						select: 'members.member'
					},
					{
						path: 'events',
						model: 'Event',
						select: '_id'
					},
					{
						path: 'locations.location',
						model: 'Location',
						select: '_id',
						populate: {
							path: 'members.member',
							model: 'Member',
							select: '_id'
						}
					}
				])
				.exec(),
			Job.find()
				.populate([{ path: 'member', select: '_id' }, { path: 'location', select: '_id' }])
				.exec()
		]);

		if (!member) throw new BadRequestError('Member does not exist');

		for (const event of member.events) {
			await Promise.all([
				event.update({ $pull: { members: member._id } }),
				member.update({ $pull: { events: event._id } })
			]);
		}

		for (const permission of member.permissions) {
			permission.members = permission.members.filter(
				permissionMember => !member._id.equals(permissionMember.member)
			);
			await permission.save();
		}

		for (const { location } of member.locations) {
			location.members = location.members.filter(
				locationMember => !locationMember.member._id.equals(member._id)
			);
			location.members.length ? await location.save() : await location.remove();
		}

		await Promise.all(
			jobs.filter(job => job.member._id.equals(member._id)).map(job => job.remove())
		);

		await member.remove();

		return member;
	}

	@Get('/:id/events')
	async getMemberEvents(@Param('id') id: string) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid member ID');
		const member = await Member.findById(id)
			.populate({
				path: 'events',
				model: Event
			})
			.lean()
			.exec();
		if (!member) return [];
		const { events } = member;
		const publicEvents = events
			? events.filter((event: IEventModel) => !event.privateEvent)
			: [];
		return publicEvents;
	}

	@Get('/:id/locations')
	async getMemberLocations(@Param('id') id: string) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid member ID');
		const member = await Member.findById(id)
			.populate({
				path: 'locations.location',
				model: Location
			})
			.lean()
			.exec();
		if (!member) return [];
		const { locations } = member;
		return locations || [];
	}

	@Get('/:id/jobs')
	async getMemberJobs(@Param('id') id: string) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid member ID');
		const jobs = await Job.find({ member: id })
			.populate('location')
			.exec();
		return jobs;
	}
}
