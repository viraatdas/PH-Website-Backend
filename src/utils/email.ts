import * as jwt from 'jsonwebtoken';
import * as sendGrid from '@sendgrid/mail';
import CONFIG from '../config';
import { IEventModel } from '../models/event';
import { IMemberModel } from '../models/member';
import { formatDate } from './';

sendGrid.setApiKey(CONFIG.SENDGRID_KEY);

export const sendResetEmail = async (member: IMemberModel) => {
	const token = jwt.sign({ id: member._id }, CONFIG.SECRET, {
		expiresIn: '2 days'
	});
	member.resetPasswordToken = token;
	await member.save();

	const url =
		CONFIG.NODE_ENV !== 'production'
			? 'http://localhost:3000'
			: 'https://purduehackers.com';

	return await (sendGrid as any).send({
		templateId: 'd-850d406dbbf240bc9f53f455ed975321',
		from: `"${CONFIG.ORG_NAME}" <${CONFIG.EMAIL}>`,
		to: member.email,
		dynamicTemplateData: {
			name: member.name,
			url,
			token
		}
	});
};

export const sendAccountCreatedEmail = async (
	member: IMemberModel,
	event: IEventModel
) => {
	const token = jwt.sign({ id: member._id }, CONFIG.SECRET, {
		expiresIn: '2 days'
	});
	member.resetPasswordToken = token;
	await member.save();

	const url =
		CONFIG.NODE_ENV !== 'production'
			? 'http://localhost:3000'
			: 'https://purduehackers.com';

	return await (sendGrid as any).send({
		templateId: 'd-0bba1a0346c24bd69a46d81d2e950e55',
		from: `${CONFIG.ORG_NAME} <${CONFIG.EMAIL}>`,
		to: member.email,
		dynamicTemplateData: {
			name: member.name,
			eventName: event.name,
			eventTime: formatDate(event.eventTime),
			url,
			token
		}
	});
};
