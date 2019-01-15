import { Action, UnauthorizedError } from 'routing-controllers';
import { ExtractJwt } from 'passport-jwt';
import { decode, verify } from 'jsonwebtoken';
import { Member } from '../models/member';
import { Permission } from '../models/permission';
import { ObjectId } from 'bson';
import CONFIG from '../config';
import { hasPermission } from '../utils';

export const currentUserChecker = async (action: Action) => {
	const token = ExtractJwt.fromExtractors([
		ExtractJwt.fromAuthHeaderAsBearerToken(),
		ExtractJwt.fromBodyField('token'),
		ExtractJwt.fromHeader('token'),
		ExtractJwt.fromUrlQueryParameter('token')
	])(action.request);
	if (!token || token === 'null' || token === 'undefined') return null;

	try {
		verify(token, CONFIG.SECRET);
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

export const authorizationChecker = async (action: Action, roles: string[]) => {
	const user = await currentUserChecker(action);
	// if (!user) return false;
	if (!user) throw new UnauthorizedError('Permission Denied');
	if (!roles.length) return true;
	// return roles.some(role => hasPermission(user, role));
	if (!roles.some(role => hasPermission(user, role)))
		throw new UnauthorizedError('Permission Denied');
	return true;
};
