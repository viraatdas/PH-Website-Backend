import * as jwt from 'jsonwebtoken';
import * as sendGrid from '@sendgrid/mail';
import CONFIG from '../config';
import { IEventModel } from '../models/event';
import { IMemberDocument } from '../models/member';
import { formatDate } from '.';

sendGrid.setApiKey(CONFIG.SENDGRID_KEY);

export const sendResetEmail = async (member: IMemberDocument) => {
	const token = jwt.sign({ id: member._id }, CONFIG.SECRET, {
		expiresIn: '2 days'
	});
	member.resetPasswordToken = token;
	await member.save();

	const url =
		CONFIG.NODE_ENV !== 'production' ? 'http://localhost:3000' : 'https://purduehackers.com';

	return await (sendGrid as any).send({
		templateId: 'd-97ab2e626dbe4e32bcf0ccb7b719cd97',
		from: `"${CONFIG.ORG_NAME}" <${CONFIG.EMAIL}>`,
		to: member.email,
		dynamicTemplateData: {
			name: member.name,
			url,
			token
		}
	});
};

export const sendAccountCreatedEmail = async (member: IMemberDocument, event: IEventModel) => {
	const token = jwt.sign({ id: member._id }, CONFIG.SECRET, {
		expiresIn: '2 days'
	});
	member.resetPasswordToken = token;
	await member.save();

	const url =
		CONFIG.NODE_ENV !== 'production' ? 'http://localhost:3000' : 'https://purduehackers.com';

	return await (sendGrid as any).send({
		templateId: 'd-d27b542ca1ba49cfa335c84ca4d4f97a',
		from: `"${CONFIG.ORG_NAME}" <${CONFIG.EMAIL}>`,
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
