import {
	JsonController,
	Get,
	BadRequestError,
	UseAfter,
	QueryParam,
	Param,
	Post,
	Body
} from 'routing-controllers';
import { BaseController } from './base.controller';
import { ValidationMiddleware } from '../middleware/validation';
import { Member } from '../models/member';
import { Location, LocationDto } from '../models/location';
import { ObjectId } from 'bson';

@JsonController('/api/locations')
@UseAfter(ValidationMiddleware)
export class LocationsController extends BaseController {
	@Get('/')
	async getAll() {
		const locations = await Location.find()
			.populate({
				path: 'members'
			})
			.exec();

		return locations;
	}

	@Get('/:id')
	async getById(@Param('id') id: string) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid location ID');
		const location = await Location.findById(id)
			.populate({
				path: 'members.member'
			})
			.exec();
		return location;
	}

	@Post('/:id')
	async updateById(@Param('id') id: string, @Body() body: LocationDto) {
		if (!ObjectId.isValid(id)) throw new BadRequestError('Invalid location ID');
		const location = await Location.findById(id)
			.populate({
				path: 'members.member'
			})
			.exec();
		if (!location) throw new BadRequestError('Location does not exist');
		location.name = body.name;
		location.city = body.city;
		await location.save();
		return location;
	}
}
