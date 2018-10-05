import * as nodemailer from 'nodemailer';
import { Request } from 'express';
import { join } from 'path';
import { readFileSync } from 'fs';
import * as jwt from 'jsonwebtoken';
import { compile } from 'handlebars';
import * as sendGrid from '@sendgrid/mail';
import CONFIG from '../config';
import { IEventModel } from '../models/event';
import { IMemberModel } from '../models/member';
import { formatDate } from './';

sendGrid.setApiKey(CONFIG.SENDGRID_KEY);

const transport = nodemailer.createTransport({
	host: 'smtp.sendgrid.net',
	port: 465,
	auth: {
		user: 'apikey',
		pass: CONFIG.SENDGRID_KEY
	}
});

const resetTemplate = compile(
	readFileSync(join(__dirname, '../emails', 'reset.hbs'), 'utf8')
);

const accountCreatedTemplate = compile(
	readFileSync(join(__dirname, '../emails', 'accountCreated.hbs'), 'utf8')
);

const _sendResetEmail = async (
	{ email, name }: { email: string; name: string },
	url: string,
	token: string
) =>
	(sendGrid as any).send({
		templateId: 'd-97ab2e626dbe4e32bcf0ccb7b719cd97',
		from: `"${CONFIG.ORG_NAME}" <${CONFIG.EMAIL}>`,
		to: email,
		subject: 'Reset your Purdue Hackers account password',
		dynamicTemplateData: {
			name,
			url,
			token
		}
	});

export const sendResetEmail = async (member: IMemberModel, req: Request) => {
	const token = jwt.sign({ id: member._id }, CONFIG.SECRET, {
		expiresIn: '2 days'
	});
	member.resetPasswordToken = token;
	await member.save();
	const resetUrl =
		CONFIG.NODE_ENV !== 'production'
			? `http://localhost:3000/reset?token=${token}`
			: `https://purduehackers.com/reset?token=${token}`;

	const url =
		CONFIG.NODE_ENV !== 'production'
			? 'http://localhost:3000'
			: 'https://purduehackers.com';

	return await _sendResetEmail(member, url, token);
};

const _sendAccountCreatedEmail = async (
	{ email, name }: { email: string; name: string },
	eventName: string,
	eventDate: Date,
	url: string,
	token: string
) =>
	transport.sendMail({
		from: `"${CONFIG.ORG_NAME}" <${CONFIG.EMAIL}>`,
		to: email,
		subject: 'Reset your Purdue Hackers account password',
		html: accountCreatedTemplate({
			name,
			eventName,
			eventDate: formatDate(eventDate),
			url,
			token
		}),
		attachments: [
			{
				filename: 'logo_square_200.png',
				path: join(__dirname, '../emails', 'logo_square_200.png'),
				cid: 'headerImage'
			}
		]
	});

export const sendAccountCreatedEmail = async (
	member: IMemberModel,
	event: IEventModel,
	req: Request
) => {
	const token = jwt.sign({ id: member._id }, CONFIG.SECRET, {
		expiresIn: '2 days'
	});
	member.resetPasswordToken = token;
	await member.save();
	// const resetUrl = `${req.protocol}://${req.get('host')}/reset?token=${token}`;
	const resetUrl =
		CONFIG.NODE_ENV !== 'production'
			? `http://localhost:3000/reset?token=${token}`
			: `https://purduehackers.com/reset?token=${token}`;

	const url =
		CONFIG.NODE_ENV !== 'production'
			? 'http://localhost:3000'
			: 'https://purduehackers.com';

	return await _sendAccountCreatedEmail(
		member,
		event.name,
		event.eventTime,
		url,
		token
	);
};
