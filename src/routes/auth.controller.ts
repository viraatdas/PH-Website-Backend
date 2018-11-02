import * as express from 'express';
import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { isEmail, isMobilePhone, isURL } from 'validator';
import * as jwt from 'jsonwebtoken';
import CONFIG from '../config';
import { Member, MemberDto } from '../models/member';
import { Permission } from '../models/permission';
import { auth } from '../middleware/passport';
import { successRes, errorRes, multer, uploadToStorage, sendResetEmail } from '../utils';
import {
	JsonController,
	Post,
	Req,
	Res,
	UseBefore,
	Body,
	UseAfter,
	BadRequestError,
	UnauthorizedError
} from 'routing-controllers';
import { ValidationMiddleware } from '../middleware/validation';
import { IsEmail } from 'class-validator';

export const router = express.Router();

@JsonController('/auth')
@UseAfter(ValidationMiddleware)
export class AuthController {
	@Post('/signup')
	@UseBefore(multer.any())
	async signup(@Req() req: Request, @Body() member: MemberDto) {
		const { passwordConfirm } = req.body;
		const files: Express.Multer.File[] = req.files
			? (req.files as Express.Multer.File[])
			: new Array<Express.Multer.File>();

		if (!passwordConfirm) throw new BadRequestError('Please confirm your password');
		if (passwordConfirm !== member.password)
			throw new BadRequestError('Passwords did not match');
		member.graduationYear = Number(member.graduationYear);
		const maxYear = new Date().getFullYear() + 20;
		if (member.graduationYear < 1869 || member.graduationYear > maxYear)
			throw new BadRequestError(
				`Graduation year must be a number between 1869 and ${maxYear}`
			);

		member.privateProfile = Boolean(member.privateProfile);
		member.unsubscribed = Boolean(member.unsubscribed);

		const picture = files.find(file => file.fieldname === 'picture');
		const resume = files.find(file => file.fieldname === 'resume');

		if (picture) member.picture = await uploadToStorage(picture, 'pictures', member);
		if (resume) member.resume = await uploadToStorage(resume, 'resumes', member);

		const user = new Member(member);
		await user.save();
		const u = user.toJSON();
		delete u.password;
		const token = jwt.sign(u, CONFIG.SECRET, { expiresIn: '7 days' });
		return {
			user: u,
			token
		};
	}

	@Post('/login')
	async login(@Req() req, @Body() body: { email: string; password: string }) {
		const { email, password } = body;
		const user = await Member.findOne({ email }, '+password')
			.populate({ path: 'permissions', model: Permission })
			.exec();

		console.log('Body', body);
		if (!user) throw new UnauthorizedError('Member not found');

		// Check if password matches
		if (!user.comparePassword(password)) throw new UnauthorizedError('Wrong password');

		const u = user.toJSON();
		delete u.password;

		// If user is found and password is right create a token
		const token = jwt.sign(
			{
				_id: u._id,
				name: u.name,
				email: u.email,
				graduationYear: u.graduationYear
			},
			CONFIG.SECRET,
			{ expiresIn: '7 days' }
		);

		return {
			user: u,
			token
		};
	}
}

router.post('/login', async (req, res) => {
	const { email, password } = req.body;
	try {
		const user = await Member.findOne({ email }, '+password')
			.populate({ path: 'permissions', model: Permission })
			.exec();
		if (!user) return errorRes(res, 401, 'Member not found');

		// Check if password matches
		if (!user.comparePassword(password)) return errorRes(res, 401, 'Wrong password');

		const u = user.toJSON();
		delete u.password;

		// If user is found and password is right create a token
		const token = jwt.sign(
			{
				_id: u._id,
				name: u.name,
				email: u.email,
				graduationYear: u.graduationYear
			},
			CONFIG.SECRET,
			{ expiresIn: '7 days' }
		);

		return successRes(res, {
			user: u,
			token
		});
	} catch (error) {
		console.error(error);
		return errorRes(res, 500, error);
	}
});

router.get('/me', auth(), async (req, res) => {
	try {
		const user = await Member.findById(req.user._id)
			.populate({ path: 'permissions', model: Permission })
			.exec();
		if (!user) return errorRes(res, 401, 'Member not found');

		// If user is found and password is right create a token
		const token = jwt.sign(
			{
				_id: user._id,
				name: user.name,
				email: user.email,
				graduationYear: user.graduationYear
			},
			CONFIG.SECRET,
			{ expiresIn: '7 days' }
		);

		return successRes(res, {
			user,
			token
		});
	} catch (error) {
		console.error(error);
		return errorRes(res, 500, error);
	}
});

router.post('/forgot', async (req, res) => {
	try {
		const { email } = req.body;
		if (!email || !isEmail(email)) return errorRes(res, 400, 'Please provide a valid email');
		const member = await Member.findOne({ email }).exec();
		if (!member) return errorRes(res, 400, `There is no member with the email: ${email}`);
		const token = jwt.sign({ id: member._id }, CONFIG.SECRET, {
			expiresIn: '2 days'
		});
		member.resetPasswordToken = token;
		await member.save();
		await sendResetEmail(member);
		return successRes(res, `A link to reset your password has been sent to: ${email}`);
	} catch (error) {
		console.error(error);
		return errorRes(res, 500, error);
	}
});

router.post('/reset', async (req, res) => {
	try {
		const { password, passwordConfirm, token } = req.body;
		if (!password || password.length < 5)
			return errorRes(res, 400, 'A password longer than 5 characters is required');
		if (!passwordConfirm) return errorRes(res, 400, 'Please confirm your password');
		if (passwordConfirm !== password) return errorRes(res, 400, 'Passwords did not match');
		if (!token) return errorRes(res, 401, 'Invalid reset password token');
		let payload;
		try {
			payload = jwt.verify(token, CONFIG.SECRET) as object;
		} catch (error) {
			return errorRes(res, 400, 'Invalid reset password token');
		}
		if (!payload) return errorRes(res, 400, 'Invalid reset password token');
		const { id } = payload;
		if (!id || !ObjectId.isValid(id))
			return errorRes(res, 400, 'Reset password token corresponds to an invalid member');
		const member = await Member.findById(id).exec();
		if (!member)
			return errorRes(res, 400, 'Reset password token corresponds to a non existing member');

		if (member.resetPasswordToken !== token)
			return errorRes(res, 401, 'Wrong reset password token for this member');
		member.password = password;
		member.resetPasswordToken = '';
		await member.save();
		return successRes(res, `Successfully changed password for: ${member.name}`);
	} catch (error) {
		console.error(error);
		return errorRes(res, 500, error);
	}
});
