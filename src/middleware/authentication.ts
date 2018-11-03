import { Action, UnauthorizedError } from 'routing-controllers';
import { ExtractJwt } from 'passport-jwt';
import { decode, verify } from 'jsonwebtoken';
import { Member, IMemberModel } from '../models/member';
import { Permission } from '../models/permission';
import { ObjectId } from 'bson';
import CONFIG from '../config';

export const currentUserChecker = async (action: Action, value?: any) => {
	const token = ExtractJwt.fromExtractors([
		ExtractJwt.fromAuthHeaderAsBearerToken(),
		ExtractJwt.fromBodyField('token'),
		ExtractJwt.fromHeader('token'),
		ExtractJwt.fromUrlQueryParameter('token')
	])(action.request);
	if (!token) return null;

	try {
		const valid = verify(token, CONFIG.SECRET);
	} catch (error) {
		throw new UnauthorizedError('Invalid token');
	}
	const payload: any = decode(token);
	if (!payload._id || !ObjectId.isValid(payload._id))
		throw new UnauthorizedError('Invalid token');

	const user = await Member.findById(payload._id)
		.populate({
			path: 'permissions',
			model: Permission
		})
		// .lean()
		.exec();
	return user;
};
