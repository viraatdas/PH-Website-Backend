import * as bcrypt from 'bcrypt';
import { Document, Schema, model } from 'mongoose';
import { IEventModel } from './event';
import { IPermissionModel } from './permission';
import { IJobModel } from './job';
import { ILocationModel } from './location';
import {
	IsEmail,
	IsEnum,
	Matches,
	MinLength,
	IsOptional,
	IsIn,
	IsUrl,
	IsMobilePhone,
	IsNotEmpty
} from 'class-validator';
import { IsPhoneNumber } from '../validators/phone';

export const genders = {
	MALE: 'Male',
	FEMALE: 'Female',
	OTHER: 'Other',
	NO: 'No'
};

export const majors = [
	'Computer Science',
	'Computer Graphics Technology',
	'Computer Information Technology',
	'Electrical Computer Engineering',
	'Electrical Engineering',
	'First Year Engineering',
	'Math',
	'Mechanical Engineering',
	'Other'
];

export class MemberDto {
	@IsNotEmpty({ message: 'Please provide your first and last name' })
	@Matches(/([a-zA-Z']+ )+[a-zA-Z']+$/, { message: 'Please provide your first and last name' })
	name: string;
	// @IsMemberAlreadyExist({ message: 'An account already exists with that email' })
	@IsNotEmpty({ message: 'Please provide a valid email address' })
	@IsEmail({}, { message: 'Please provide a valid email address' })
	email: string;
	@IsNotEmpty()
	graduationYear: number;
	@MinLength(5, { message: 'A password longer than 5 characters is required' })
	password: string;
	permissions?: IPermissionModel[];
	events?: IEventModel[];
	locations?: {
		location: ILocationModel;
		dateStart: Date;
		dateEnd: Date;
	}[];
	jobs?: IJobModel[];
	@IsOptional()
	@IsEnum(genders, { message: 'Please provide a valid gender' })
	gender?: string;
	@IsOptional()
	unsubscribed?: boolean;
	@IsOptional()
	privateProfile?: boolean;
	@IsOptional()
	@IsPhoneNumber('USA', { message: 'Please provide a valid U.S. phone number' })
	phone?: string;
	setupEmailSent?: Date;
	@IsOptional()
	@IsIn(majors, { message: 'Please provide a valid major' })
	major?: string;
	picture?: string;
	@IsOptional()
	description?: string;
	@IsOptional()
	@Matches(/(facebook|fb)/, { message: 'Invalid Facebook URL' })
	facebook?: string;
	@IsOptional()
	@Matches(/github/, { message: 'Invalid GitHub URL' })
	github?: string;
	@IsOptional()
	@Matches(/linkedin/, { message: 'Invalid Linkedin URL' })
	linkedin?: string;
	@IsOptional()
	@Matches(/devpost/, { message: 'Invalid Devpost URL' })
	devpost?: string;
	@IsOptional()
	@IsUrl({}, { message: 'Invalid website URL' })
	website?: string;
	resume?: string;
	resumeLink?: string;
	createdAt: Date;
	updatedAt: Date;
	authenticatedAt?: Date;
	rememberToken?: string;
	resetPasswordToken?: string;
	comparePassword(password: string) {
		return bcrypt.compareSync(password, this.password);
	}
}

export interface IMemberModel extends MemberDto, Document {}

const schema = new Schema(
	{
		name: {
			type: String,
			required: true
		},
		email: {
			type: String,
			unique: true,
			required: true
		},
		graduationYear: {
			type: Number,
			default: 0
		},
		password: {
			type: String,
			select: false,
			default: ''
		},
		gender: { type: String },
		unsubscribed: {
			type: Boolean,
			default: false
		},
		privateProfile: {
			type: Boolean,
			default: false
		},
		phone: { type: String },
		major: { type: String },
		picture: { type: String },
		description: { type: String },
		facebook: { type: String },
		github: { type: String },
		linkedin: { type: String },
		devpost: { type: String },
		website: { type: String },
		resume: { type: String },
		resumeLink: { type: String },
		authenticatedAt: { type: String },
		setupEmailSent: { type: String },
		rememberToken: { type: String },
		resetPasswordToken: { type: String },
		permissions: {
			type: [Schema.Types.ObjectId],
			ref: 'Permission',
			default: []
		},
		events: {
			type: [Schema.Types.ObjectId],
			ref: 'Event',
			default: []
		},
		locations: [
			{
				location: {
					type: Schema.Types.ObjectId,
					ref: 'Location'
				},
				dateStart: Date,
				dateEnd: Date
			}
		],
		jobs: {
			type: [Schema.Types.ObjectId],
			ref: 'Job',
			default: []
		}
	},
	{ timestamps: true }
);

schema.pre('save', async function(next) {
	const member = this as IMemberModel;
	if (member.isModified('password') || member.isNew) {
		try {
			const salt = await bcrypt.genSalt(10);
			const hash = await bcrypt.hash(member.password, salt);
			member.password = hash;
		} catch (error) {
			console.error(error);
			throw error;
		}
	}
	next();
});

schema.methods.comparePassword = function(password: string) {
	const member = this as IMemberModel;
	return password && bcrypt.compareSync(password, member.password);
};

export const Member = model<IMemberModel>('Member', schema, 'members');
