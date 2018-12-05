import * as express from 'express';
import { Request } from 'express';
// import * as paginate from 'express-paginate';
import { ObjectId } from 'mongodb';
import { isEmail, isMobilePhone, isURL } from 'validator';
import { compareSync } from 'bcrypt';
import { Member, MemberDto, IMemberModel, majors } from '../models/member';
import { Event, IEventModel } from '../models/event';
import { Location } from '../models/location';
import { Permission } from '../models/permission';
import { Job } from '../models/job';
import { auth, hasPermissions } from '../middleware/passport';
import {
	successRes,
	errorRes,
	memberMatches,
	uploadToStorage,
	multer,
	addMemberToPermissions
} from '../utils';
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

// TODO: Add auth to routes
// TODO: Add permissions to routes
@JsonController('/api/members')
export class MemberController {
	@Get('/')
	async getAll(@QueryParam('sortBy') sortBy: string, @QueryParam('order') order: number) {
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
		@CurrentUser({ required: true }) user: IMemberModel
	) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid member ID');
		if (!memberMatches(user, id))
			throw new UnauthorizedError('You are unauthorized to edit this profile');

		const files: Express.Multer.File[] = req.files
			? (req.files as Express.Multer.File[])
			: new Array<Express.Multer.File>();

		const {
			name,
			email,
			password,
			passwordConfirm,
			graduationYear,
			privateProfile,
			unsubscribed,
			phone,
			major,
			facebook,
			gender,
			github,
			linkedin,
			website,
			description,
			devpost,
			resumeLink
		} = req.body;

		if (!name) throw new BadRequestError('Please provide your first and last name');
		if (!email) throw new BadRequestError('Please provide your email');
		if (!isEmail(email)) throw new BadRequestError('Invalid email');
		if (!password) throw new BadRequestError('A password is required');
		if (!passwordConfirm) throw new BadRequestError('Please confirm your password');
		if (!graduationYear || !parseInt(graduationYear, 10))
			throw new BadRequestError('Please provide a valid graduation year');
		if (
			gender &&
			gender !== 'Male' &&
			gender !== 'Female' &&
			gender !== 'Other' &&
			gender !== 'No'
		)
			throw new BadRequestError('Please provide a valid gender');
		console.log('Body:', req.body);
		if (major && !majors.some(maj => maj === major))
			throw new BadRequestError('Please provide a valid major');
		if (phone && !isMobilePhone(phone, ['en-US'] as any))
			throw new BadRequestError('Invalid phone number: ' + phone);
		if (password !== passwordConfirm) throw new BadRequestError('Passwords does not match');
		if (facebook && !/(facebook|fb)/.test(facebook))
			throw new BadRequestError('Invalid Facebook URL');
		if (github && !/github/.test(github)) throw new BadRequestError('Invalid GitHub URL');
		if (linkedin && !/linkedin/.test(linkedin))
			throw new BadRequestError('Invalid LinkedIn URL');
		if (devpost && !/devpost/.test(devpost)) throw new BadRequestError('Invalid Devpost URL');
		if (website && !isURL(website)) throw new BadRequestError('Invalid website URL');
		const member = await Member.findById(req.params.id, '+password').exec();
		if (!member) throw new BadRequestError('Member not found');
		if (!compareSync(password, member.password))
			throw new UnauthorizedError('Incorrect password');

		const picture = files.find(file => file.fieldname === 'picture');
		const resume = files.find(file => file.fieldname === 'resume');
		if (picture) member.picture = await uploadToStorage(picture, 'pictures', member);
		if (resume) member.resume = await uploadToStorage(resume, 'resumes', member);
		member.name = name;
		member.email = email;
		member.password = password;
		member.graduationYear = parseInt(graduationYear, 10);
		member.privateProfile = privateProfile;
		member.unsubscribed = unsubscribed;
		member.phone = phone;
		member.major = major;
		member.facebook = facebook;
		member.gender = gender;
		member.github = github;
		member.linkedin = linkedin;
		member.website = website;
		member.description = description;
		member.devpost = devpost;
		member.resumeLink = resumeLink;

		await member.save();
		const m = member.toJSON();
		delete m.password;
		return m;
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
