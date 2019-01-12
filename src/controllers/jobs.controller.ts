import {
	JsonController,
	Get,
	BadRequestError,
	UseAfter,
	Body,
	Authorized,
	CurrentUser,
	UnauthorizedError
} from 'routing-controllers';
import axios from 'axios';
import { ObjectId } from 'bson';
import { BaseController } from './base.controller';
import { ValidationMiddleware } from '../middleware/validation';
import { Member, IMemberModel } from '../models/member';
import { Location } from '../models/location';
import { Job, JobDto } from '../models/job';
import { memberMatches } from '../utils';

@JsonController('/api/jobs')
@UseAfter(ValidationMiddleware)
export class JobsController extends BaseController {
	@Get('/')
	async getAll() {
		const jobs = await Job.find()
			.populate(['member', 'location'])
			.exec();
		return jobs;
	}

	@Authorized()
	async createJob(@Body() body: JobDto, @CurrentUser() user: IMemberModel) {
		if (!ObjectId.isValid(body.memberID)) throw new BadRequestError('Invalid member id');

		// tslint:disable-next-line:prefer-const
		let [location, member] = await Promise.all([
			Location.findOne({ name: body.name, city: body.city })
				.populate({
					path: 'members.member',
					model: 'Member'
				})
				.exec(),
			Member.findById(body.memberID)
				.populate([
					{
						path: 'permissions',
						model: 'Permission'
					},
					{
						path: 'locations.location',
						model: 'Location'
					}
				])
				.exec()
		]);
		if (!member) throw new BadRequestError('Member does not exist');
		if (!memberMatches(member, user._id)) throw new UnauthorizedError('Unauthorized');

		if (!location) {
			location = new Location({
				name: body.name,
				city: body.city
			});
			const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
				params: {
					address: `${body.name}, ${body.city}`
				}
			});
			if (data.results.length) {
				location.lat = data.results[0].geometry.location.lat;
				location.lng = data.results[0].geometry.location.lng;
			}
			await location.save();
		}

		member.locations.push({
			location,
			dateStart: new Date(body.start),
			dateEnd: body.end ? new Date(body.end) : null
		});

		await Location.findByIdAndUpdate(location._id, {
			$push: {
				members: {
					member,
					dateStart: new Date(body.start),
					dateEnd: body.end ? new Date(body.end) : null
				}
			}
		}).exec();

		const job = new Job({
			location,
			member,
			start: new Date(body.start),
			end: body.end ? new Date(body.end) : null
		});
		await Promise.all([job.save(), member.save(), location.save()]);
		const ret = await job.populate('location').execPopulate();
		return job;
	}
}
